const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createStore}=require('../store');
const {createStarterTest}=require('../onboarding');

test('first-login setup is durable, private, idempotent and never restores a deleted starter',async()=>{
 const db=new PGlite();let queue=Promise.resolve();
 const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};
 try{const store=createStore(pool);await store.init();
 const first=await Promise.all(Array.from({length:4},()=>store.initializeOnboarding('new',createStarterTest())));
 assert.ok(first.every(s=>s.version===1&&!s.tourDismissed));const tests=await store.listTests('new');assert.equal(tests.length,1);assert.equal(tests[0].title,'Practice Test');assert.equal(tests[0].folderId,null);assert.equal(tests[0].questions.length,2);assert.equal(tests[0].questions[1].text,'What is 2 + 2?');assert.equal(tests[0].questions[1].options.find(o=>o.id===tests[0].questions[1].correctOptionId).text,'4');
 await store.initializeOnboarding('other',createStarterTest());const other=(await store.listTests('other'))[0];assert.notEqual(other.id,tests[0].id);assert.notEqual(other.questions[0].id,tests[0].questions[0].id);
 await store.dismissOnboarding('new');const restarted=createStore(pool);await restarted.init();assert.equal((await restarted.initializeOnboarding('new',createStarterTest())).tourDismissed,true);assert.equal((await restarted.initializeOnboarding('other',createStarterTest())).tourDismissed,false);
 await restarted.deleteTest('new',tests[0].id);await restarted.initializeOnboarding('new',createStarterTest());assert.deepEqual(await restarted.listTests('new'),[]);
 await store.saveTest('existing',{id:'old',title:'My own test',questions:[]});assert.equal((await store.initializeOnboarding('existing',createStarterTest())).tourDismissed,true);assert.equal((await store.listTests('existing')).length,1);await store.deleteTest('existing','old');await store.initializeOnboarding('existing',createStarterTest());assert.deepEqual(await store.listTests('existing'),[]);
 await store.createSession({id:'past',ownerId:'past',phase:'ended',deletedAt:Date.now(),students:[]});assert.equal((await store.initializeOnboarding('past',createStarterTest())).tourDismissed,true);assert.deepEqual(await store.listTests('past'),[]);
 const collision=createStarterTest();collision.id=other.id;await assert.rejects(store.initializeOnboarding('retry',collision));assert.equal((await store.initializeOnboarding('retry',createStarterTest())).tourDismissed,false);assert.equal((await store.listTests('retry')).length,1,'A failed seed rolls back the marker and permits retry');
 }finally{await db.close();}
});

test('onboarding API authenticates and isolates setup and dismissal',async()=>{
 const {once}=require('node:events');const {createApp}=require('../server');const db=new PGlite();const pool={query:(...a)=>db.query(...a),connect:async()=>({query:(...a)=>db.query(...a),release(){}})};const store=createStore(pool);await store.init();
 const app=createApp({store,verifyUser:async token=>['a','b'].includes(token)?{id:token}:null,sweepInterval:60000});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 const request=async(route,token='a')=>{const r=await fetch(`http://127.0.0.1:${app.server.address().port}/api/${route}`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});return {status:r.status,data:await r.json()};};
 try{assert.equal((await request('onboarding','invalid')).status,401);assert.equal((await request('onboarding/dismiss')).status,409);assert.equal((await request('onboarding')).data.tourDismissed,false);assert.equal((await request('onboarding/dismiss')).data.tourDismissed,true);assert.equal((await request('onboarding')).data.tourDismissed,true);assert.equal((await request('onboarding','b')).data.tourDismissed,false);assert.equal((await store.listTests('a')).length,1);assert.equal((await store.listTests('b')).length,1);
 }finally{await app.close();await db.close();}
});
