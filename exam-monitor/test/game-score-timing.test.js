const test=require('node:test');
const assert=require('node:assert/strict');
const g=require('../game');
const client=require('../public/game-client');
const audio=require('../public/game-audio');
function played(count=3){
 const s=g.newSession('owner',{title:'Show',questions:[{id:'q1',text:'One?',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]},0);
 const players=Array.from({length:count},(_,i)=>g.join(s,{nickname:'Player '+i,avatarId:'avatar-0'+(i+1),resumeToken:String(i).repeat(43)},0));
 g.advance(s,0);
 players.forEach((p,i)=>g.answer(s,{...p,questionIndex:0,slot:0},6000+1000*i));
 return {s,players};
}
test('both displays get one score anchor and prior scores and ranks until the anchor',()=>{
 const {s,players:[a,b]}=played();const show=10000,start=show+1200;
 const reveal=g.playerView(s,b.playerId,show-1);
 assert.deepEqual(reveal.answer,{slot:0,correct:true});
 g.advance(s,show);
 for(const t of [show,start-1]){
  const own=g.playerView(s,b.playerId,t), board=g.publicView(s,t);
  assert.equal(own.scoreStartsAt,start);assert.equal(board.scoreStartsAt,start);
  assert.equal(own.score,0);assert.equal(own.rank,1);assert.equal(own.answer.points,undefined);
  assert.deepEqual(board.leaderboard.map(p=>p.score),[0,0,0]);
  assert.equal(own.leaderboard,undefined);
 }
 const own=g.playerView(s,b.playerId,start), board=g.publicView(s,start+300);
 assert.equal(own.score,950);assert.equal(own.previousScore,0);
 assert.equal(own.rank,2);assert.equal(own.previousRank,1);assert.equal(own.answer.points,950);
 assert.deepEqual(board.leaderboard.map(p=>p.id).slice(0,2),[a.playerId,b.playerId]);
});
test('the same count-up curve catches up from staggered polls; a later rejoin does not replay it',()=>{
 const v={phase:'leaderboard',scoreStartsAt:1000};
 assert.equal(client.SCORE_DURATION_MS,1020);
 assert.equal(client.scoreProgress({...v,serverNow:950},2000,2010),0);
 assert.equal(client.scoreProgress({...v,serverNow:1051},3000,3102),.15);
 assert.equal(client.scoreProgress({...v,serverNow:1102},5000,5051),.15);
 assert.equal(client.scoreProgress({...v,serverNow:2500},6000,6000),1);
 assert.equal(client.nextPollDelay({...v,serverNow:990},6000,6000),150);
});
test('podium exposes only the places revealed on the shared timeline',()=>{
 const {s,players:[a,b,c]}=played();g.advance(s,10000);g.advance(s,14000);
 const opening=g.publicView(s,14000);
 assert.deepEqual(opening.podiumSchedule.map(x=>x.rank),[3,2,1]);
 assert.equal(opening.leaderboard.length,0);
 for(const [i,p] of [c,b,a].entries()){
  const at=opening.podiumSchedule[i].at;
  assert.equal(g.playerView(s,p.playerId,at-1).rank,undefined);
  assert.equal(g.playerView(s,p.playerId,at).rank,3-i);
  assert.equal(g.publicView(s,at).leaderboard.length,i+1);
 }
});
test('podium omits unoccupied places and gives tied winners the same reveal',()=>{
 const {s,players}=played(2);s.players[1].score=s.players[0].score;
 g.advance(s,10000);g.advance(s,14000);
 const {podiumSchedule}=g.publicView(s,14000);
 assert.deepEqual(podiumSchedule.map(x=>x.rank),[1]);
 const at=podiumSchedule[0].at;
 for(const p of players){assert.equal(g.playerView(s,p.playerId,at-1).rank,undefined);assert.equal(g.playerView(s,p.playerId,at).rank,1);}
});
test('score audio and podium cues use future offsets; a late view never replays a prior place',()=>{
 const board={phase:'leaderboard',scoreStartsAt:5000,serverNow:4600};
 assert.deepEqual(audio.scoreSoundWindow(board,2000,2200),{startIn:200,elapsed:0,endIn:1220});
 assert.equal(audio.scoreSoundWindow({...board,serverNow:7000},2000,2200),null);
 const podium={phase:'podium',serverNow:2500,podiumSchedule:[{rank:3,at:1000},{rank:2,at:3000},{rank:1,at:4300}]};
 assert.deepEqual(audio.futurePodiumCues(podium,10000,10100),[{rank:2,startIn:400},{rank:1,startIn:1700}]);
});
test('next and podium cannot skip the score reveal window',()=>{
 const {s}=played();g.advance(s,10000);
 const begin=g.publicView(s,11000);
 assert.equal(begin.scoreEndsAt,12220);
 const {actionLabel}=require('../public/game-classroom-control');
 assert.equal(actionLabel(begin),null);
 assert.equal(client.nextPollDelay({...begin,serverNow:11900},1000,1000),340);
 assert.throws(()=>g.advance(s,begin.scoreEndsAt-1),/score reveal/i);
 assert.equal(actionLabel(g.publicView(s,begin.scoreEndsAt)),'Show Podium');
 g.advance(s,begin.scoreEndsAt);
 assert.equal(s.phase,'podium');
});
test('projector music mixes a future count cue once and schedules only remaining podium cues',async()=>{
 const calls=[];let time=0;
 const button={setAttribute(){},addEventListener(_,fn){this.click=fn;}};
 const slider={addEventListener(){}};
 const engine={resume:async()=>{},volume(){},stop(){},scoreboard:(...a)=>calls.push(['scores',...a]),
  overlay:(...a)=>calls.push(['overlay',...a]),podium:(...a)=>calls.push(['podium',...a])};
 const sound=audio.create({button,slider},{storage:null,now:()=>time,engine:()=>engine});
 const update=(phase,serverNow,fields={},cue)=>{time=serverNow;sound.update({phase,id:'fake',questionIndex:1,serverNow,...fields},cue);};
 update('leaderboard',1000,{scoreStartsAt:2200});
 assert.equal(calls.length,0);
 await button.click();
 update('leaderboard',2000,{scoreStartsAt:2200});
 update('leaderboard',2300,{scoreStartsAt:2200},'lead');
 update('leaderboard',2400,{scoreStartsAt:2200},'lead');
 assert.deepEqual(calls,[['scores','fake:scores:1',{startIn:1200,elapsed:0,endIn:2220}],['overlay','lead',920]]);
 const podiumSchedule=[{rank:3,at:4500},{rank:2,at:6700},{rank:1,at:8900}];
 update('podium',5000,{podiumSchedule},'podium');
 update('podium',5100,{podiumSchedule},'podium');
 assert.deepEqual(calls.slice(2),[['podium','fake:podium:1',[{rank:2,startIn:1700},{rank:1,startIn:3900}],true]]);
 sound.stop();
});
