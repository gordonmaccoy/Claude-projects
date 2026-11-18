const {test}=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events'),{PGlite}=require('@electric-sql/pglite'),{io}=require('socket.io-client');
const {createStore}=require('../store'),{createApp}=require('../server');
test('reconnect API locks are persistent, visible, owner-controlled and independent of FAIL',async t=>{
 const db=new PGlite();let queue=Promise.resolve();const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};
 const store=createStore(pool);await store.init();await store.saveTest('owner',{id:'quiz',title:'Quiz',questions:[{id:'q',text:'2+2?',options:[{id:'a',text:'4'},{id:'b',text:'5'}],correctOptionId:'a'}]});
 const runtime=createApp({store,verifyUser:async token=>['owner','other'].includes(token)?{id:token,email:token+'@example.com'}:null,sweepInterval:0});runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');const base='http://127.0.0.1:'+runtime.server.address().port,sockets=[];
 const request=async(route,body={},token='owner')=>{const r=await fetch(base+'/api'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 const socket=async()=>{const s=io(base,{transports:['websocket'],forceNew:true});sockets.push(s);await once(s,'connect');return s;};
 const emit=(s,event,data={})=>new Promise((resolve,reject)=>s.timeout(3000).emit(event,data,(error,result)=>error?reject(error):resolve(result)));
 // Wait for disconnect persistence, not for the ten-second grace period.
 const disconnected=async(s,id)=>{s.disconnect();const until=Date.now()+3000;while(Date.now()<until){const st=(await store.getSession(id)).students[0];if(st.connectionId===null)return st;await new Promise(r=>setImmediate(r));}throw new Error('Disconnect did not persist');};
 const setup=async(options={})=>{const created=await request('/sessions',{testId:'quiz',durationMinutes:10,...options});assert.ok(created.status>=200&&created.status<300);const session=created.body,s=await socket(),joined=await emit(s,'student:join',{sessionId:session.id,name:'Alex',number:'001',resumeToken:'persisted-private-client-token-1234567890'});assert.equal(joined.ok,true);return {session,s,joined};};
 const watch=async(session)=>{const professor=await socket(),display=await socket();return {private:(await emit(professor,'professor:watch',{sessionId:session.id,token:'owner'})).view,public:(await emit(display,'display:watch',{sessionId:session.id,token:session.displayToken})).view};};
 try{
 await t.test('disconnect sweep marks offline; return awaits owner unlock and preserves draft',async()=>{
  const {session,s,joined}=await setup(),path='/sessions/'+session.id;await request(path+'/start');assert.equal((await emit(s,'student:draft',{answers:{q:'a'},questionId:'q'})).ok,true);
  const st=await disconnected(s,session.id);assert.equal(typeof st.disconnectSince,'number');assert.ok(st.disconnectSince>0);
  await store.mutate(session.id,x=>{x.students[0].disconnectSince=Date.now()-10001;});await runtime.tick();
  let views=await watch(session);assert.equal(views.private.students[0].recoveryState,'offline');assert.equal(views.public.students[0].recoveryState,'offline');
  const returned=await socket(),resume=await emit(returned,'student:join',{sessionId:session.id,resumeToken:joined.resumeToken});assert.equal(resume.ok,true);assert.equal(resume.studentId,joined.studentId);assert.equal(resume.view.recoveryLocked,true);assert.deepEqual(resume.view.draft,{q:'a'});
  views=await watch(session);assert.equal(views.private.students[0].recoveryState,'awaiting-unlock');assert.equal(views.public.students[0].recoveryState,'awaiting-unlock');
  assert.equal((await emit(returned,'student:draft',{answers:{q:'b'}})).ok,false);assert.equal((await emit(returned,'student:submit',{answers:{q:'b'}})).ok,false);
  const saved=await store.getSession(session.id);assert.deepEqual(saved.students[0].draft,{q:'a'});assert.equal(saved.students[0].submission,null);
  assert.equal((await request(path+'/unlock-reconnect',{studentId:joined.studentId},'invalid')).status,401);assert.equal((await request(path+'/unlock-reconnect',{studentId:joined.studentId},'other')).status,404);assert.equal((await emit(returned,'student:sync')).view.recoveryLocked,true);
  assert.equal((await request(path+'/unlock-reconnect',{studentId:joined.studentId})).status,200);assert.equal((await emit(returned,'student:sync')).view.recoveryLocked,false);assert.equal((await emit(returned,'student:submit',{answers:{q:'a'}})).ok,true);
 });
 await t.test('one-at-a-time answers stay locked on reconnect even when inactivity FAIL is switched off',async()=>{
  const {session,s,joined}=await setup({deliveryType:'one',security:{inactivityFail:true}}),path='/sessions/'+session.id;
  await request(path+'/start');await disconnected(s,session.id);
  await store.mutate(session.id,x=>{x.students[0].disconnectSince=Date.now()-10001;});
  const returned=await socket(),resumed=await emit(returned,'student:join',{sessionId:session.id,resumeToken:joined.resumeToken});
  assert.equal(resumed.view.recoveryLocked,true);assert.equal(resumed.view.failed,false);assert.equal(resumed.view.flow.type,'one');assert.equal(resumed.view.test,null);
  assert.equal((await request(path+'/inactivity-fail',{enabled:false})).status,200);
  assert.equal((await emit(returned,'student:sync')).view.recoveryLocked,true);
  for(const [event,body] of [['student:answer',{questionId:'q',answer:'a'}],['student:next-question',{questionId:'q'}]])assert.match((await emit(returned,event,body)).error,/activity is locked/);
  assert.equal((await request(path+'/unlock-reconnect',{studentId:joined.studentId})).status,200);
  const unlocked=(await emit(returned,'student:sync')).view;assert.equal(unlocked.recoveryLocked,false);assert.equal(unlocked.test.questions[0].id,'q');
  assert.equal((await emit(returned,'student:answer',{questionId:'q',answer:'a'})).ok,true);
 });
 await t.test('reconnect itself enforces timeout and unlock cannot clear independent FAIL',async()=>{
  const {session,s,joined}=await setup(),path='/sessions/'+session.id;await request(path+'/start');await disconnected(s,session.id);const failedAt=Date.now()-20000;
  await store.mutate(session.id,x=>{Object.assign(x.students[0],{disconnectSince:Date.now()-10001,failedAt,overrideAt:null});});
  const returned=await socket(),resume=await emit(returned,'student:join',{sessionId:session.id,resumeToken:joined.resumeToken});assert.equal(resume.ok,true);assert.equal(resume.view.recoveryLocked,true);assert.equal(resume.view.failed,true);
  assert.equal((await request(path+'/unlock-reconnect',{studentId:joined.studentId})).status,200);const synced=await emit(returned,'student:sync');assert.equal(synced.view.recoveryLocked,false);assert.equal(synced.view.failed,true);
  const saved=await store.getSession(session.id);assert.equal(saved.students[0].failedAt,failedAt);assert.equal(saved.students[0].overrideAt,null);assert.equal((await emit(returned,'student:draft',{answers:{q:'a'}})).ok,false);assert.equal((await emit(returned,'student:submit',{answers:{q:'a'}})).ok,false);
 });
 await t.test('waiting, paused and brief running disconnects do not lock',async()=>{
  const {session,s,joined}=await setup(),path='/sessions/'+session.id;let st=await disconnected(s,session.id);assert.equal(st.disconnectSince??null,null);
  let current=await socket();await emit(current,'student:join',{sessionId:session.id,resumeToken:joined.resumeToken});await request(path+'/start');await disconnected(current,session.id);await store.mutate(session.id,x=>{x.students[0].disconnectSince=Date.now()-100;});
  current=await socket();const brief=await emit(current,'student:join',{sessionId:session.id,resumeToken:joined.resumeToken});assert.equal(brief.view.recoveryLocked,false);await request(path+'/pause');st=await disconnected(current,session.id);assert.equal(st.disconnectSince??null,null);
 });
 await t.test('calculator, security-disabled and submitted attempts never gain reconnect locks',async()=>{
  for(const options of [{mode:'calculator'},{security:{enabled:false}},{}]){
   const {session,s,joined}=await setup(options);if(options.mode!=='calculator')await request('/sessions/'+session.id+'/start');
   const submitted=!options.mode&&!options.security;
   if(submitted)assert.equal((await emit(s,'student:submit',{answers:{q:'a'}})).ok,true);
   const before=await store.getSession(session.id),st=await disconnected(s,session.id);assert.equal(st.disconnectSince??null,null);
   // Even stale legacy markers cannot turn an excluded attempt into a reconnect lock.
   await store.mutate(session.id,x=>{x.students[0].disconnectSince=Date.now()-10001;});await runtime.tick();
   const returned=await socket(),resume=await emit(returned,'student:join',{sessionId:session.id,resumeToken:joined.resumeToken});assert.equal(resume.ok,true);assert.equal(resume.view.recoveryLocked,false);
   if(submitted)assert.deepEqual((await store.getSession(session.id)).students[0].submission,before.students[0].submission);
  }
 });
 await t.test('disconnect during initial enrollment persistence is recorded before identity binding',{timeout:5000},async()=>{
  const created=await request('/sessions',{testId:'quiz',durationMinutes:10}),session=created.body;
  assert.equal(created.status,200);await request('/sessions/'+session.id+'/start');
  const client=await socket(),serverSocket=runtime.io.sockets.sockets.get(client.id),connectionId=client.id;
  const originalMutate=store.mutate;let releaseJoin,reportPersisted,held=false;
  const persisted=new Promise(resolve=>{reportPersisted=resolve;}),release=new Promise(resolve=>{releaseJoin=resolve;});
  // Commit the enrollment normally, but keep its result from reaching the socket handler.
  store.mutate=async(...args)=>{const result=await originalMutate.apply(store,args);if(args[0]===session.id&&result.result?.studentId&&!held){held=true;reportPersisted(result);await release;}return result;};
  try{
   client.emit('student:join',{sessionId:session.id,name:'Race',number:'002',resumeToken:'initial-enrollment-race-private-token-123456'},()=>{});
   const committed=await persisted;assert.equal(committed.session.students.length,1);assert.equal(committed.session.students[0].connectionId,connectionId);assert.equal(serverSocket.data.student,undefined);
   const serverDisconnected=once(serverSocket,'disconnect');client.disconnect();await serverDisconnected;
   assert.equal(serverSocket.connected,false);assert.equal(serverSocket.data.student,undefined);
   // The ordinary disconnect handler had no enrollment identity, so it cannot fix this row.
   assert.equal((await store.getSession(session.id)).students[0].connectionId,connectionId);
   releaseJoin();const offline=await disconnected(client,session.id);
   assert.equal(offline.id,committed.result.studentId);assert.equal(offline.connectionId,null);assert.equal(offline.lastSeen,committed.session.students[0].lastSeen);assert.equal(typeof offline.disconnectSince,'number');assert.ok(offline.disconnectSince>0);
   assert.equal((await store.getSession(session.id)).students.length,1);
  }finally{releaseJoin();store.mutate=originalMutate;}
 });
 }finally{for(const s of sockets)s.disconnect();await runtime.close();await db.close();}
});
