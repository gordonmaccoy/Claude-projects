const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {join,dirname}=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {io}=require('socket.io-client');
const {createStore}=require('../store');
const {createApp}=require('../server');

test('a normal graded quiz, saved sharing contact and 32-player Game Mode coexist',async()=>{
 const db=new PGlite();let queue=Promise.resolve(),app,socket;
 async function lease(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};}
 const pool={connect:lease,async query(...a){const c=await lease();try{return await c.query(...a);}finally{c.release();}}};
 const owner={id:'teacher-fixture',email:'teacher@example.com'};
 const testDraft={title:'Graded fixture',questions:[{id:'q',text:'Two plus two?',options:[{id:'a',text:'Four'},{id:'b',text:'Five'}],correctOptionId:'a'}]};
 try{
  // CI can use the current schema; release QA injects the exact previous Public store.
  const previous=process.env.EXAMIO_PREVIOUS_PUBLIC_STORE;
  const old=previous?require(previous).createStore(pool):createStore(pool);
  const oldExam=previous?require(join(dirname(previous),'exam.js')):require('../exam');
  await old.init();await old.registerShareIdentity(owner);
  await old.saveTest(owner.id,{...testDraft,id:'existing-graded'});
  await old.saveSharingContact(owner.id,{name:'Synthetic contact',email:'contact@example.com'});

  const store=createStore(pool);await store.init();await store.init();
  app=createApp({store,verifyUser:async token=>token==='fixture-authorized'?owner:null,sweepInterval:0});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base='http://127.0.0.1:'+app.server.address().port;
  const call=async(path,data,auth=true)=>{
   const result=await fetch(base+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer fixture-authorized'}:{})},...(data?{body:JSON.stringify(data)}:{})});
   const body=await result.json();assert.equal(result.status,200,path+' '+JSON.stringify(body).slice(0,100));return body;
  };
  assert.equal((await call('/api/sharing-contacts'))[0].name,'Synthetic contact');
  const graded=await call('/api/sessions',{testId:'existing-graded'});
  const gradedRoute=await call('/api/rooms/resolve',{roomName:graded.roomName},false);
  assert.equal(gradedRoute.joinUrl,'/student.html?session='+graded.id);
  socket=io(base,{transports:['websocket'],forceNew:true});await once(socket,'connect');
  const emit=(name,data)=>new Promise((resolve,reject)=>socket.timeout(3000).emit(name,data,(error,body)=>error?reject(error):resolve(body)));
  assert.ok((await emit('student:join',{sessionId:graded.id,name:'Synthetic graded student',number:'10000'})).ok);
  await call('/api/sessions/'+graded.id+'/start',{});

  const game=await call('/api/games',{...testDraft,title:'Separate ungraded fixture',questions:testDraft.questions.map(q=>({...q,durationSeconds:20}))});
  const session=await call('/api/game-sessions',{gameId:game.id,largeClass:true,requireNames:false});
  const sessionPath='/api/game-sessions/'+session.id,gamePath='/game-api/'+session.id;
  const resolved=await call('/api/rooms/resolve',{roomName:session.roomName},false);
  assert.equal(resolved.joinUrl,'/game-player.html?session='+session.id);
  const players=await Promise.all(Array.from({length:32},async(_,i)=>{
   const resumeToken=String(i).padStart(43,'p'),avatarId='avatar-'+String(i+1).padStart(2,'0');
   const reply=await call(gamePath+'/join',{avatarId,resumeToken},false);
   return {playerId:reply.playerId,resumeToken};
  }));
  assert.equal(new Set(players.map(x=>x.playerId)).size,32);
  assert.equal((await call(sessionPath+'/advance',{expectedPhase:'lobby',questionIndex:-1})).phase,'intro');
  await store.mutateGame(session.id,s=>{s.introEndsAt=Date.now()-6000;});
  const [submitted]=await Promise.all([
   emit('student:submit',{answers:{q:'a'}}),
   ...players.map((p,i)=>call(gamePath+'/answer',{...p,questionIndex:0,slot:i<18?0:1},false))
  ]);
  assert.ok(submitted.ok);assert.equal(submitted.view.result.percentage,100);
  const closed=await call(gamePath+'/display',{displayToken:session.displayToken},false);
  assert.equal(closed.phase,'responses-closed');assert.equal(closed.roundEndReason,'all-answered');
  await store.mutateGame(session.id,s=>{s.revealAt=Date.now()-1;});
  const poll=await call(gamePath+'/display',{displayToken:session.displayToken},false);
  assert.deepEqual(poll.question.counts,{a:18,b:14});
  assert.deepEqual(poll.leaderboard,[]);
  const podium=await call(sessionPath+'/advance',{expectedPhase:'reveal',questionIndex:0});
  assert.equal(podium.phase,'podium');
  await store.mutateGame(session.id,s=>{s.podiumSchedule=s.podiumSchedule.map(x=>({...x,at:Date.now()-1}));s.podiumCompleteAt=Date.now()-1;});
  assert.equal((await call(gamePath+'/display',{displayToken:session.displayToken},false)).leaderboard.length,32);
  await call(sessionPath+'/close',{});

  assert.deepEqual((await call('/api/sessions')).map(s=>s.id),[graded.id]);
  assert.deepEqual((await call('/api/tests')).map(t=>t.id),['existing-graded']);
  assert.equal((await call('/api/sharing-contacts')).length,1);
  await old.init();
  assert.equal(oldExam.privateView((await old.listSessions(owner.id))[0]).students[0].result.percentage,100);
  assert.equal((await old.listSharingContacts(owner.id))[0].name,'Synthetic contact');
 }finally{socket?.close();if(app)await app.close();await db.close();}
});
