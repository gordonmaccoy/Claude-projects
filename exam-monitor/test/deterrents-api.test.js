const {test}=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events'),{PGlite}=require('@electric-sql/pglite'),{io}=require('socket.io-client');
const {createStore}=require('../store'),{createApp}=require('../server');
test('security launch policy persists and socket reports are enrollment-bound, deduplicated and gated by phase',async()=>{
 const db=new PGlite();let queue=Promise.resolve();const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};
 const store=createStore(pool);await store.init();await store.saveTest('p',{id:'quiz',title:'Quiz',questions:[{id:'q',text:'2+2?',options:[{id:'a',text:'4'},{id:'b',text:'5'}],correctOptionId:'a'}]});
 const runtime=createApp({store,verifyUser:async token=>token==='p'?{id:'p',email:'p@example.com'}:null,sweepInterval:0});runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');const base='http://127.0.0.1:'+runtime.server.address().port,sockets=[];
 const request=async(route,body)=>{const r=await fetch(base+'/api'+route,{method:'POST',headers:{Authorization:'Bearer p','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 const socket=async()=>{const s=io(base,{transports:['websocket'],forceNew:true});sockets.push(s);await once(s,'connect');return s;};
 const emit=(s,event,data)=>new Promise((resolve,reject)=>s.timeout(3000).emit(event,data,(error,result)=>error?reject(error):resolve(result)));
 try{
 assert.equal((await request('/sessions',{testId:'quiz',security:{enabled:'false'}})).status,400);
 const {body:session}=await request('/sessions',{testId:'quiz',security:{inactivityFail:false,shuffleQuestions:true,copyPaste:false}});assert.equal(session.security.copyPaste,false);assert.equal((await createStore(pool).getSession(session.id)).security.shuffleQuestions,true);
 const a=await socket(),b=await socket(),outsider=await socket();assert.equal((await emit(outsider,'student:security',{type:'focus-lost'})).ok,false);
 const ja=await emit(a,'student:join',{sessionId:session.id,name:'Alice',number:'001'}),jb=await emit(b,'student:join',{sessionId:session.id,name:'Bob',number:'002'});assert.equal(ja.view.security.copyPaste,false);
 await emit(a,'student:security',{type:'focus-lost'});assert.deepEqual((await store.getSession(session.id)).students[0].events,[]);
 await request('/sessions/'+session.id+'/start',{});
 await emit(a,'student:security',{type:'focus-lost',studentId:jb.studentId});await emit(a,'student:security',{type:'focus-lost'});let saved=await store.getSession(session.id);assert.deepEqual(saved.students[0].events.map(e=>e.type),['focus-lost']);assert.deepEqual(saved.students[1].events,[]);
 assert.equal((await emit(a,'student:security',{type:'fail'})).ok,false);await emit(a,'student:visibility',{visible:false,security:{enabled:false}});saved=await store.getSession(session.id);assert.equal(saved.students[0].events.at(-1).type,'hidden');
 await request('/sessions/'+session.id+'/pause',{});const n=saved.students[0].events.length;await emit(a,'student:security',{type:'focus-returned'});await emit(a,'student:visibility',{visible:true});assert.equal((await store.getSession(session.id)).students[0].events.length,n);
 await request('/sessions/'+session.id+'/resume',{});await emit(a,'student:submit',{answers:{q:'a'}});await emit(a,'student:security',{type:'fullscreen-entered'});assert.equal((await store.getSession(session.id)).students[0].events.length,n);
 const off=(await request('/sessions',{testId:'quiz',security:{enabled:false}})).body,c=await socket();await emit(c,'student:join',{sessionId:off.id,name:'No monitoring',number:'1'});await request('/sessions/'+off.id+'/start',{});await emit(c,'student:visibility',{visible:false});await emit(c,'student:security',{type:'focus-lost'});const view=await emit(c,'student:sync',{});assert.ok(Object.values(view.view.security).every(v=>v===false));assert.deepEqual((await store.getSession(off.id)).students[0].events,[]);
 }finally{for(const s of sockets)s.disconnect();await runtime.close();await db.close();}
});
