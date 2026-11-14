const test=require('node:test'),assert=require('node:assert/strict');
const {actionLabel,channelName,relay}=require('../public/game-classroom-control');
test('classroom exposes the existing teacher transition only when phase can advance',()=>{
 const view={questionIndex:0,questionCount:2};
 for(const [phase,label] of [['lobby','Start Game'],['media','Start Question'],['reveal','Show Leaderboard'],['leaderboard','Next Question']]){
  assert.equal(actionLabel({...view,phase}),label);
 }
 assert.equal(actionLabel({...view,phase:'leaderboard',questionIndex:1}),'Show Podium');
 for(const phase of ['countdown','question','podium','closed'])assert.equal(actionLabel({...view,phase}),null);
});
test('relay ignores unknown senders and stale game phases and calls only the owner action',async()=>{
 const view={phase:'leaderboard',questionIndex:0,questionCount:2},calls=[];
 const fn=relay({current:()=>view,advance:async payload=>{calls.push(payload);return {phase:'countdown'};}});
 assert.equal(await fn({kind:'advance',client:'first',request:'first',phase:'leaderboard',questionIndex:0}),null);
 const client='2b0b7421-61bc-4dbc-9f70-de495a550d88',request='b7f53540-1cb5-4939-8084-2b96a59b2be7';
 assert.deepEqual(await fn({kind:'hello',client}),{kind:'authorized',client});
 assert.deepEqual(await fn({kind:'advance',client,request,phase:'reveal',questionIndex:0}),{kind:'reply',client,request,stale:true});
 assert.deepEqual(calls,[]);
 assert.deepEqual(await fn({kind:'advance',client,request,phase:'leaderboard',questionIndex:0}),{kind:'reply',client,request,view:{phase:'countdown'}});
 assert.deepEqual(calls,[{expectedPhase:'leaderboard',questionIndex:0}]);
 assert.notEqual(channelName('a','b'),channelName('b','a'));
});
test('restricted or unsupported browser broadcast channels leave the display read-only',()=>{
 const {openChannel}=require('../public/game-classroom-control');
 const actual=globalThis.BroadcastChannel;
 globalThis.BroadcastChannel=class {constructor(){throw new Error('Disabled');}};
 try {assert.equal(openChannel('game','key'),null);} finally {globalThis.BroadcastChannel=actual;}
 assert.equal(openChannel('game',null),null);
});
