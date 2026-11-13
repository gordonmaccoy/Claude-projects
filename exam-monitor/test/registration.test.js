const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateRegistration,validateProfile}=require('../settings-service');
const profile={firstName:'Alex',lastName:'Kim',institution:'My University',organizationType:'university',role:'professor',phone:'',termsAccepted:true};
test('registration requires a known descriptive role and explicit consent, validates optional fields',()=>{
 for(const role of ['teacher','professor','admin','it'])assert.equal(validateRegistration({...profile,role}).role,role);
 for(const role of ['',undefined,'owner'])assert.throws(()=>validateRegistration({...profile,role}),/role/i);
 for(const termsAccepted of [false,undefined,'true'])assert.throws(()=>validateRegistration({...profile,termsAccepted}),/agree/i);
 assert.equal(validateRegistration({...profile,phone:'+82 10 1234 5678'}).phone,'+82 10 1234 5678');
 assert.throws(()=>validateRegistration({...profile,phone:'x'.repeat(41)}));
 assert.equal(validateProfile({firstName:'Legacy'}).firstName,'Legacy');
 assert.throws(()=>validateProfile({...profile,role:'owner'}),/role/i);
});
test('registration endpoint saves only the signed-in profile and preserves consent through later settings edits',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),{createStore}=require('../store'),{createApp}=require('../server'),{once}=require('node:events');
 const db=new PGlite();let queue=Promise.resolve();const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};
 const store=createStore(pool);await store.init();const runtime=createApp({store,sweepInterval:0,config:{},verifyUser:async token=>['a','b'].includes(token)?{id:token,email:token+'@example.com'}:null});
 runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
 async function request(route,body,token='a',method='POST'){const response=await fetch(`http://127.0.0.1:${runtime.server.address().port}/api/${route}`,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
 try{
 const fresh=await request('settings',undefined,'a','GET');assert.equal(fresh.data.registrationRequired,true);
 await store.initializeOnboarding('b',require('../onboarding').createStarterTest());assert.equal((await request('settings',undefined,'b','GET')).data.registrationRequired,false);
 assert.equal((await request('registration',profile,'invalid')).status,401);
 assert.equal((await request('registration',{...profile,role:''})).status,400);
 const saved=await request('registration',{...profile,ownerId:'b',termsAcceptedAt:'fake'});assert.equal(saved.status,200);assert.equal(saved.data.registrationComplete,true);assert.notEqual(saved.data.termsAcceptedAt,'fake');assert.equal((await store.getAccount('b')).profile.registrationComplete,undefined);
 const edited=await request('profile',{firstName:'Updated'},'a','PUT');assert.equal(edited.data.role,'professor');assert.equal(edited.data.termsAcceptedAt,saved.data.termsAcceptedAt);assert.equal(edited.data.registrationComplete,true);
 const denied=await request('support/requests',undefined,'b','GET');assert.equal(denied.status,403);
 }finally{await runtime.close();await db.close();}
});
