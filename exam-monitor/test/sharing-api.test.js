const {test}=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events');
const {PGlite}=require('@electric-sql/pglite'),{createStore}=require('../store'),{createApp}=require('../server');
test('sharing API verifies accounts, excludes unknown users, accepts once and bounds abuse',async()=>{
 const db=new PGlite();let queue=Promise.resolve();const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};const store=createStore(pool);await store.init();const runtime=createApp({store,sweepInterval:0,verifyUser:async t=>['a','b','c'].includes(t)?{id:t,email:t+'@example.com'}:null});runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
 const req=async(path,method='GET',body,user='a')=>{const r=await fetch(`http://127.0.0.1:${runtime.server.address().port}/api/${path}`,{method,headers:{Authorization:'Bearer '+user,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{await req('me','GET',undefined,'b');await store.saveTest('a',{id:'quiz',title:'Quiz',questions:[{id:'q',text:'Q',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]});
 assert.equal((await req('shares','GET',undefined,'invalid')).status,401);
 assert.equal((await req('tests/quiz/share','POST',{email:'b@example.com',requestId:'bad'})).status,400);
 const body={email:'b@example.com',requestId:crypto.randomUUID()};assert.equal((await req('tests/quiz/share','POST',body)).status,200);await req('tests/quiz/share','POST',body);
 const incoming=(await req('shares','GET',undefined,'b')).data.incoming;assert.equal(incoming.length,1);assert.equal((await req(`shares/${incoming[0].id}/accept`,'POST',{},'c')).status,404);
 const copy=await req(`shares/${incoming[0].id}/accept`,'POST',{},'b');assert.equal(copy.status,200);assert.equal((await req('tests','GET',undefined,'b')).data.length,1);
 for(let i=0;i<19;i++)assert.equal((await req('tests/quiz/share','POST',{email:'unknown'+i+'@example.com',requestId:crypto.randomUUID()})).status,200);
 assert.equal((await req('tests/quiz/share','POST',{email:'b@example.com',requestId:crypto.randomUUID()})).status,429);
 }finally{await runtime.close();await db.close();}
});

test('sharing exposes actionable safe errors without database details',async()=>{
 const {problem}=require('../account-store');const store={accountState:async()=> 'active',activeSessions:async()=>[],createShare:async()=>{throw problem('Sharing limit reached. Please try again later.',429);},acceptShare:async()=>{throw problem('This sharing request is not available.',404);}};
 const runtime=createApp({store,sweepInterval:0,verifyUser:async()=>({id:'a',email:'a@example.com'})});runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
 try{let response=await fetch(`http://127.0.0.1:${runtime.server.address().port}/api/tests/quiz/share`,{method:'POST',headers:{Authorization:'Bearer a','Content-Type':'application/json'},body:JSON.stringify({email:'b@example.com',requestId:crypto.randomUUID()})});assert.match((await response.json()).error,/Sharing limit/);
 response=await fetch(`http://127.0.0.1:${runtime.server.address().port}/api/shares/missing/accept`,{method:'POST',headers:{Authorization:'Bearer a','Content-Type':'application/json'},body:'{}'});assert.match((await response.json()).error,/sharing request/);
 }finally{await runtime.close();}
});
