const {test}=require('node:test');
const assert=require('node:assert/strict');
const exam=require('../exam');
const {PGlite}=require('@electric-sql/pglite');
const {createStore}=require('../store');
function fixture(){const s=exam.newSession('p',{title:'Quiz',questions:[{id:'q',text:'?',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]},0,{durationMinutes:1});exam.join(s,{number:'1',name:'Kim'},0);exam.start(s,1000);return s;}
test('pause freezes timer and monitoring across persistence, resume grants fresh grace',()=>{
 const s=fixture(),st=s.students[0];st.draft={q:'a'};exam.visibility(s,st.id,false,2000);
 exam.pause(s,'p',4000);assert.equal(s.phase,'paused');assert.equal(s.remainingMs,57000);assert.equal(s.deadlineAt,null);
 assert.equal(exam.sweep(s,100000),false);assert.equal(st.failedAt,null);assert.throws(()=>exam.submit(s,st.id,{},100000),/not running/);
 const restored=JSON.parse(JSON.stringify(s));exam.resume(restored,'p',100000);assert.equal(restored.deadlineAt,157000);assert.deepEqual(restored.students[0].draft,{q:'a'});
 exam.sweep(restored,105000);assert.equal(restored.students[0].failedAt,null);exam.sweep(restored,105001);assert.ok(restored.students[0].failedAt);
});
test('pause preserves existing failures and submissions, forbids wrong owner and wrong phases',()=>{
 const s=fixture();assert.throws(()=>exam.pause(s,'other',2000),/not found/);s.students[0].failedAt=1500;
 exam.pause(s,'p',2000);assert.equal(exam.studentView(s,s.students[0]).phase,'paused');assert.equal(exam.privateView(s,9000).remainingMs,59000);assert.equal(exam.publicView(s,9000).remainingMs,59000);
 assert.throws(()=>exam.pause(s,'p',3000));exam.extend(s,'p',1,9000);assert.equal(s.remainingMs,119000);exam.resume(s,'p',10000);assert.equal(s.students[0].failedAt,1500);assert.throws(()=>exam.resume(s,'p',11000));
});
test('folder order is complete, owner scoped, durable and rejects duplicates atomically',async()=>{
 const db=new PGlite(),pool={query:(...a)=>db.query(...a),connect:async()=>({query:(...a)=>db.query(...a),release(){}})};
 try{const store=createStore(pool);await store.init();const a=await store.createFolder('p','A'),b=await store.createFolder('p','B'),other=await store.createFolder('other','C');
 assert.equal(await store.orderFolders('p',[b.id,a.id]),true);assert.deepEqual(await createStore(pool).listFolders('p'),[b,a]);
 for(const ids of [[a.id],[a.id,a.id],[a.id,other.id]])assert.equal(await store.orderFolders('p',ids),false);
 assert.deepEqual(await store.listFolders('p'),[b,a]);assert.deepEqual(await store.listFolders('other'),[other]);
 }finally{await db.close();}
});
test('pause/resume APIs enforce ownership, reject paused writes and recover paused enrollment',async()=>{
 const {once}=require('node:events'),{io}=require('socket.io-client'),{createApp}=require('../server');
 const db=new PGlite();let queue=Promise.resolve();async function lease(){const prev=queue;let release;queue=new Promise(r=>release=r);await prev;return{query:(...a)=>db.query(...a),release};}
 const pool={connect:lease,query:async(...a)=>{const c=await lease();try{return await c.query(...a);}finally{c.release();}}};const store=createStore(pool);await store.init();
 const runtime=createApp({store,verifyUser:async token=>token?{id:token}:null,sweepInterval:0});runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');const base='http://127.0.0.1:'+runtime.server.address().port;
 const req=async(path,method='POST',body={},who='p')=>{const r=await fetch(base+'/api'+path,{method,headers:{Authorization:'Bearer '+who,'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)});return{status:r.status,body:await r.json()};};
 const socket=io(base,{transports:['websocket']});await Promise.race([once(socket,'connect'),new Promise((_,reject)=>setTimeout(()=>reject(Error('socket connect timeout')),5000))]);const emit=(name,data)=>new Promise((resolve,reject)=>socket.timeout(5000).emit(name,data,(err,res)=>err?reject(err):resolve(res)));
 try{const s=fixture();s.students=[];s.deadlineAt=Date.now()+60000;await store.createSession(s);const enrollment=await emit('student:join',{sessionId:s.id,number:'001',name:'Kim'});assert.equal(enrollment.ok,true);await emit('student:draft',{answers:{q:'a'},questionId:'q'});
 assert.equal((await req('/sessions/'+s.id+'/pause','POST',{},'other')).status,404);const paused=await req('/sessions/'+s.id+'/pause');assert.equal(paused.body.phase,'paused');assert.ok(paused.body.remainingMs>0);
 assert.equal((await emit('student:draft',{answers:{q:'b'},questionId:'q'})).ok,false);assert.equal((await emit('student:submit',{answers:{q:'a'}})).ok,false);
 const resumed=await emit('student:join',{sessionId:s.id,resumeToken:enrollment.resumeToken});assert.equal(resumed.view.phase,'paused');assert.equal(resumed.view.test,null);assert.equal((await createStore(pool).getSession(s.id)).phase,'paused');
 assert.equal((await req('/sessions/'+s.id+'/resume')).body.phase,'running');assert.equal((await emit('student:sync',{})).view.test.questions.length,1);assert.deepEqual((await store.getSession(s.id)).students[0].draft,{q:'a'});
 await req('/sessions/'+s.id+'/pause');assert.equal((await req('/sessions/'+s.id+'/end')).body.phase,'ended');
 const a=await req('/folders','POST',{name:'A'}),b=await req('/folders','POST',{name:'B'});assert.equal((await req('/folder-order','PUT',{ids:[b.body.id,a.body.id]})).status,200);assert.deepEqual((await req('/folders','GET')).body.map(f=>f.id),[b.body.id,a.body.id]);assert.equal((await req('/folder-order','PUT',{ids:[a.body.id,a.body.id]})).status,400);
 }finally{socket.disconnect();await runtime.close();await db.close();}
});

test('untimed pauses preserve submissions and do not introduce a timer',()=>{
 const s=fixture();s.deadlineAt=null;s.durationMinutes=0;exam.submit(s,s.students[0].id,{q:'a'},2000);const submission=JSON.stringify(s.students[0].submission);
 exam.pause(s,'p',3000);assert.equal(s.remainingMs,null);assert.throws(()=>exam.extend(s,'p',1,4000),/Invalid timer/);exam.resume(s,'p',900000);assert.equal(s.deadlineAt,null);assert.equal(JSON.stringify(s.students[0].submission),submission);
});
