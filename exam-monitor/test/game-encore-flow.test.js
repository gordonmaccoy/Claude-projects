const test=require('node:test');
const assert=require('node:assert/strict');
const game=require('../game');
const client=require('../public/game-client');
const {actionLabel}=require('../public/game-classroom-control');

const fixture=media=>({title:'Round flow',questions:[0,1].map(i=>({
 id:'q'+i,text:'Prompt '+i,type:'mc',durationSeconds:10,options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a',
 ...(media&&i===0?{media:{type:'audio',url:'https://example.com/clip.mp3'}}:{})
}))});
const start=(media=false)=>{
 const s=game.newSession('teacher',fixture(media),0);
 const player=game.join(s,{nickname:'A',resumeToken:'a'.repeat(32)},0);
 game.advance(s,100);
 return {s,player};
};

test('the launch intro exposes no prompt or answer controls and precedes the full five-second preview',()=>{
 const {s,player}=start();
 assert.equal(s.phase,'intro');
 let pub=game.publicView(s,100);
 let phone=game.playerView(s,player.playerId,100);
 assert.equal(pub.introEndsAt,2300);
 assert.equal(phone.introEndsAt,pub.introEndsAt);
 assert.equal(pub.question,null);
 assert.equal(phone.question,null);
 assert.equal(actionLabel(pub),null);
 assert.throws(()=>game.advance(s,2299),/wait/i);
 game.sweep(s,2390);
 assert.equal(s.phase,'countdown');
 pub=game.publicView(s,2390);
 assert.equal(pub.startsAt,7300);
 assert.equal(pub.question.text,'Prompt 0');
 assert.equal(pub.question.options,undefined);
 assert.throws(()=>game.answer(s,{...player,questionIndex:0,slot:0},7299),/not open/i);
 game.sweep(s,7300);
 assert.equal(s.phase,'question');
 assert.equal(game.playerView(s,player.playerId,7300).question.slotCount,2);
});

test('the intro yields to optional media, which remains teacher-controlled',()=>{
 const {s}=start(true);
 game.sweep(s,9000);
 assert.equal(s.phase,'media');
 assert.equal(game.publicView(s,9000).media.type,'audio');
 game.sweep(s,12000);
 assert.equal(s.phase,'media');
 assert.equal(actionLabel(game.hostView(s,12000)),'Start Question');
 game.advance(s,13000);
 assert.equal(s.phase,'countdown');
 assert.equal(s.startsAt,18000);
});

test('all answered locks responses instantly, then reveals the poll; the next intro requires teacher action',()=>{
 const {s,player}=start();
 game.answer(s,{...player,questionIndex:0,slot:0},7600);
 const pub=game.publicView(s,7600);
 const phone=game.playerView(s,player.playerId,7600);
 assert.equal(pub.phase,'responses-closed');
 assert.equal(pub.roundEndReason,'all-answered');
 assert.equal(pub.roundEndedAt,7600);
 assert.equal(pub.revealAt,11400);
 assert.equal(pub.question,null);
 assert.equal(pub.leaderboard[0].score,0);
 assert.equal(phone.answer.correct,undefined);
 assert.equal(phone.score,0);
 assert.equal(actionLabel(pub),null);
 assert.throws(()=>game.advance(s,11399),/wait/i);
 game.sweep(s,11400);
 assert.equal(s.phase,'reveal');
 assert.deepEqual(game.publicView(s,11400).question.counts,{a:1,b:0});
 assert.equal(game.playerView(s,player.playerId,11400).answer.correct,true);
 assert.equal(actionLabel(game.hostView(s,11400)),'Show Scores');
 game.advance(s,11000);
 game.sweep(s,20000);
 assert.equal(s.phase,'leaderboard');
 game.advance(s,20000);
 assert.equal(s.questionIndex,1);
 assert.equal(s.phase,'intro');
 assert.equal(game.publicView(s,20000).question,null);
 assert.equal(game.publicView(s,20000).leaderboard[0].score,1000);
});

test('timeout closes on the actual deadline and does not accept a response received at that instant',()=>{
 const {s,player}=start();
 game.sweep(s,17700);
 assert.equal(s.phase,'responses-closed');
 assert.equal(s.roundEndedAt,17300);
 assert.equal(s.roundEndReason,'timeout');
 assert.throws(()=>game.answer(s,{...player,questionIndex:0,slot:0},17300),/not open/i);
 assert.deepEqual(game.answer(s,{...player,questionIndex:0,slot:0},17280),{accepted:true});
 game.sweep(s,21100);
 assert.equal(s.phase,'reveal');
 assert.deepEqual(game.publicView(s,21100).question.counts,{a:1,b:0});
});

test('phones and projector poll near the shared intro and response-close boundaries, rejecting out-of-order views',()=>{
 const session={id:'test',questionIndex:1,serverNow:900};
 const intro={...session,phase:'intro',introEndsAt:1400};
 const read={...session,phase:'countdown',startsAt:6400};
 const closed={...session,phase:'responses-closed',revealAt:1400};
 assert.equal(client.nextPollDelay(intro,100,200),420);
 assert.equal(client.nextPollDelay(closed,100,200),420);
 assert.equal(client.isOlderView(intro,read),true);
 assert.equal(client.isOlderView({...closed,phase:'question'},closed),true);
 assert.equal(client.isOlderView({...closed,phase:'reveal'},closed),false);
 assert.match(client.sceneCopy({...intro,questionIndex:0}).heading,/Get ready!/);
 assert.match(client.sceneCopy(intro).heading,/Question 2/i);
 assert.match(client.sceneCopy(closed).heading,/Responses closed/);
});
