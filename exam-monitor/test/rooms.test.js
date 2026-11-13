const {test}=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite'),{once}=require('node:events');
const {createStore}=require('../store'),{createApp}=require('../server'),exam=require('../exam');
test('room names normalize safely, generate silly names and survive active-session reservation',async()=>{
 const rooms=require('../rooms');assert.equal(rooms.roomName('  Orange   SOCKS ').key,'orange socks');assert.equal(rooms.roomName('강의실 １').key,'강의실 1');
 for(const input of ['', 'x'.repeat(51),'<script>',{},'bad\nroom'])assert.throws(()=>rooms.roomName(input));
 const random=rooms.generateRoomName();assert.match(random.name,/^[A-Za-z]+ [A-Za-z]+ \d{4}$/);
 const db=new PGlite(),pool={query:(...a)=>db.query(...a),connect:async()=>({query:(...a)=>db.query(...a),release(){}})},store=createStore(pool);await store.init();let runtime;
 try{
 const s=exam.newSession('teacher',null,Date.now(),{roomName:'Orange Socks'});await store.createSession(s);assert.equal((await store.findRoom('orange socks')).id,s.id);
 await assert.rejects(store.createSession(exam.newSession('other',null,Date.now(),{roomName:'ORANGE  SOCKS'})),e=>e.code==='23505');
 assert.equal((await createStore(pool).findRoom('orange socks')).roomName,'Orange Socks');
 runtime=createApp({store,verifyUser:async token=>token==='teacher'?{id:'teacher',email:'teacher@example.com'}:null,sweepInterval:0});runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');const base='http://127.0.0.1:'+runtime.server.address().port;
 const lookup=async roomName=>{const r=await fetch(base+'/api/rooms/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomName})});return {status:r.status,body:await r.json()};};
 const found=await lookup('  orange SOCKS ');assert.equal(found.status,200);assert.deepEqual(found.body,{joinUrl:'/student.html?session='+s.id});assert.ok(!JSON.stringify(found.body).includes(s.displayToken));
 assert.equal((await lookup('<script>')).status,400);assert.equal((await lookup('No Such Room')).status,404);
 const collision=await fetch(base+'/api/sessions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer teacher'},body:JSON.stringify({mode:'calculator',roomName:'Orange Socks'})});assert.equal(collision.status,409);
 await store.mutate(s.id,session=>{session.phase='ended';});assert.equal((await lookup('Orange Socks')).status,404);
 const next=exam.newSession('other',null,Date.now(),{roomName:'Orange Socks'});await store.createSession(next);assert.equal((await lookup('Orange Socks')).body.joinUrl,'/student.html?session='+next.id);
 const auto=await fetch(base+'/api/sessions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer teacher'},body:JSON.stringify({mode:'calculator'})});assert.equal(auto.status,200);assert.match((await auto.json()).roomName,/\d{4}$/);
 }finally{if(runtime)await runtime.close();await db.close();}
});
