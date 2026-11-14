const {test}=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite'),{createStore}=require('../store');
test('personal sharing contacts persist, deduplicate, isolate owners, remember recipients and delete with account',async()=>{
 const db=new PGlite();let queue=Promise.resolve();const pool={async connect(){const previous=queue;let release;queue=new Promise(r=>release=r);await previous;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};const store=createStore(pool);await store.init();
 try{const a={id:'a',email:'a@example.com'},b={id:'b',email:'b@example.com'};await store.registerShareIdentity(a);await store.registerShareIdentity(b);
 const contact=await store.saveSharingContact('a',{name:'Mike',email:' MIKE@example.com '});assert.equal(contact.email,'mike@example.com');
 const again=await store.saveSharingContact('a',{name:'Michael',email:'mike@example.com'});assert.equal(again.id,contact.id);assert.equal((await store.listSharingContacts('a')).length,1);assert.equal((await store.listSharingContacts('b')).length,0);
 await assert.rejects(store.saveSharingContact('b',{id:contact.id,name:'Stolen',email:'m@example.com'}),/not found/);
 await store.deleteSharingContact('b',contact.id);assert.equal((await store.listSharingContacts('a')).length,1);
 await assert.rejects(store.saveSharingContact('a',{name:'Bad',email:'not-an-email'}),/email/);
 await assert.rejects(store.saveSharingContact('a',{name:'x'.repeat(101),email:'x@example.com'}),/name/i);
 await store.saveTest('a',{id:'quiz',title:'Quiz',questions:[{id:'q',text:'Question',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]});
 await store.createShare(a,'quiz','mike@example.com',crypto.randomUUID());assert.equal((await store.listSharingContacts('a'))[0].name,'Michael');
 await store.createShare(a,'quiz','unknown@example.com',crypto.randomUUID());assert.equal((await store.listSharingContacts('a')).length,2,'remembering does not reveal account existence');
 const restarted=createStore(pool);await restarted.init();assert.equal((await restarted.listSharingContacts('a')).length,2);
 await store.deleteSharingContact('a',contact.id);assert.equal((await store.listSharingContacts('a')).length,1);
 await store.beginDeletion('a');await store.completeDeletion('a',async()=>{});assert.equal((await db.query('SELECT * FROM onscreen_v2_sharing_contacts WHERE owner_id=$1',['a'])).rows.length,0);
 }finally{await db.close();}
});
