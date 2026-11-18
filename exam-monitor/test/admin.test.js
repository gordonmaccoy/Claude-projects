const {test}=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events');
const {PGlite}=require('@electric-sql/pglite'),{createStore}=require('../store'),{createApp}=require('../server');
async function fixture(){const db=new PGlite();let queue=Promise.resolve();const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};const store=createStore(pool);await store.init();return {db,pool,store};}
test('admin owner is fail-closed, bound once to verified identity, never profile role or reused email',async()=>{
 const {db,store}=await fixture();try{
  await store.saveProfile('intruder',{role:'admin'});
  assert.equal(await store.isAdmin({id:'intruder',email:'admin@examio.io'},{}),false);
  const config={ownerEmail:'admin@examio.io'};
  assert.equal(await store.isAdmin({id:'intruder',email:'other@example.com'},config),false);
  assert.equal(await store.isAdmin({id:'owner',email:'ADMIN@examio.io'},config),true);
  assert.equal(await store.isAdmin({id:'replacement',email:'admin@examio.io'},config),false);
  assert.equal(await store.isAdmin({id:'owner',email:'changed@example.com'},config),true);
  assert.equal(await store.isAdmin({id:'owner',email:'changed@example.com'},{}),false);
 }finally{await db.close();}
});
test('admin routes deny teachers; account labels and ticket workflow persist with audit and bounded validation',async()=>{
 const {db,pool,store}=await fixture();
 await store.saveProfile('teacher',{firstName:'Mike',lastName:'Tester',role:'admin'});
 const runtime=createApp({store,sweepInterval:0,adminOptions:{ownerEmail:'admin@examio.io'},verifyUser:async token=>({owner:{id:'owner',email:'admin@examio.io'},teacher:{id:'teacher',email:'mike@example.com'}}[token]||null),settingsOptions:{sendMail:null,removeAccount:null}});
 runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
 const req=async(path,method='GET',body,token='owner')=>{const r=await fetch(`http://127.0.0.1:${runtime.server.address().port}/api/${path}`,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  assert.equal((await req('admin/overview','GET',undefined,'bad')).status,401);
  assert.equal((await req('admin/overview','GET',undefined,'teacher')).status,403);
  assert.equal((await req('admin/accounts/teacher','PATCH',{plan:'pro',note:'bad'},'teacher')).status,403);
  assert.equal((await req('admin/overview')).status,200);
  for(const phase of ['lobby','podium','closed'])await pool.query('INSERT INTO onscreen_v2_game_sessions(id,owner_id,pin,data,expires_at) VALUES($1,$2,$3,$4,$5)',[phase,'teacher',phase,JSON.stringify({phase}),Date.now()+60000]);
  assert.equal((await req('admin/overview')).data.live_games,1);
  assert.equal((await req('admin/accounts?q=Mike')).data.items[0].email,'mike@example.com');
  assert.equal((await req('admin/accounts?q=no-match')).data.total,0);
  assert.equal((await req('admin/accounts/teacher','PATCH',{plan:'pro',note:'Pilot teacher',version:0})).status,200);
  assert.equal((await req('admin/accounts/teacher','PATCH',{plan:'free',note:'stale',version:0})).status,409);
  assert.equal((await req('admin/accounts/teacher','PATCH',{plan:'owner',note:'',version:1})).status,400);
  assert.equal((await req('admin/accounts/teacher','PATCH',{plan:'free',note:'',version:1,role:'owner'})).status,400);
  const list=await req('admin/accounts?q=Mike');assert.equal(list.data.items[0].plan,'pro');assert.equal(list.data.items[0].note,'Pilot teacher');
  const ticket=await store.saveContact('teacher','mike@example.com',{requestId:crypto.randomUUID(),category:'problem',subject:'Upload issue',message:'Help'});
  assert.equal((await req('admin/support/'+ticket.id,'PATCH',{state:'resolved',note:'Handled',version:0})).status,200);
  const tickets=(await req('admin/support?state=resolved')).data.items;assert.equal(tickets[0].status,'queued');assert.equal(tickets[0].state,'resolved');
  assert.equal((await req('admin/support?state=open')).data.total,0);
  assert.equal((await req('admin/support?q=Upload')).data.total,1);
  assert.equal((await req('admin/support?q=missing')).data.total,0);
  assert.equal((await req('admin/audit?q=account.updated')).data.total,1);
  assert.equal((await req('admin/audit?q=missing')).data.total,0);
  assert.equal((await req('admin/accounts?page=-1')).status,400);
  const audit=(await req('admin/audit')).data.items;assert.equal(audit.filter(x=>x.action==='account.updated').length,1);assert.equal(audit.filter(x=>x.action==='support.updated').length,1);assert.equal(JSON.stringify(audit).includes('Pilot teacher'),false);
  await store.beginDeletion('teacher');await store.completeDeletion('teacher',async()=>{});
  assert.equal((await pool.query("SELECT * FROM onscreen_v2_admin_accounts WHERE owner_id='teacher'")).rows.length,0);
  assert.equal((await req('admin/support')).data.total,0);
 }finally{await runtime.close();await db.close();}
});
