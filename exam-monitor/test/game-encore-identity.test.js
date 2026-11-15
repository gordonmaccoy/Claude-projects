const {test}=require('node:test');
const assert=require('node:assert/strict');
const game=require('../game');
const quiz={title:'Live review',questions:[{id:'q1',type:'mc',text:'Which?',durationSeconds:20,options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]};
const token=letter=>letter.repeat(40);
const open=options=>game.newSession('owner',quiz,1000,options);

test('launch names default to required and reject malformed settings',()=>{
 const s=open();
 assert.equal(game.lobbyView(s,1000).requireNames,true);
 assert.throws(()=>game.join(s,{avatarId:'avatar-01',resumeToken:token('a')},1001),/nickname/i);
 const r=game.join(s,{nickname:'Student A',avatarId:'avatar-01',resumeToken:token('a')},1001);
 assert.equal(game.playerView(s,r.playerId,1001).nickname,'Student A');
 assert.throws(()=>open({requireNames:'false'}),/require names/i);
});
test('a no-name launch uses its own avatar labels and no client nickname or fallback',()=>{
 const s=open({requireNames:false});
 assert.equal(game.lobbyView(s,1000).requireNames,false);
 assert.throws(()=>game.join(s,{resumeToken:token('a')},1001),/avatar/i);
 const r=game.join(s,{nickname:'Do not keep me',avatarId:'avatar-01',resumeToken:token('a')},1001);
 assert.equal(game.playerView(s,r.playerId,1001).nickname,'Blue Champion');
 assert.equal(game.hostView(s,1001).players[0].nickname,'Blue Champion');
 assert.throws(()=>game.join(s,{avatarId:'avatar-01',resumeToken:token('b')},1002),{status:409});
 assert.equal(game.join(s,{resumeToken:token('a')},1002).playerId,r.playerId);
 assert.equal(game.lobbyView(open(),1000).requireNames,true);
});
test('a player on a fresh device can recover via their claimed avatar only after teacher approval',()=>{
 const s=open({requireNames:false}),original=token('a'),replacement=token('b');
 const originalId=game.join(s,{avatarId:'avatar-02',resumeToken:original},1001).playerId;
 assert.throws(()=>game.requestRecovery(s,{avatarId:'avatar-03',resumeToken:replacement},1003),{status:404});
 s.players[0].score=760;
 const request=game.requestRecovery(s,{avatarId:'avatar-02',resumeToken:replacement},1003);
 assert.equal(game.hostView(s,1003).recoveryRequests[0].nickname,'Orange Bolt');
 assert.throws(()=>game.join(s,{avatarId:'avatar-02',resumeToken:replacement},1004),{status:409});
 game.approveRecovery(s,request.code,originalId,1005);
 assert.equal(game.join(s,{resumeToken:replacement},1006).playerId,originalId);
 assert.equal(game.playerView(s,originalId,1006).score,760);
 assert.throws(()=>game.authenticatePlayer(s,originalId,original),{status:403});
});
