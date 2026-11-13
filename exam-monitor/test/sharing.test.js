const {test}=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite'),{createStore}=require('../store');
const {randomUUID}=require('node:crypto');
const quiz={id:'quiz',title:'Review',folderId:'private',students:[{name:'secret'}],questions:[{id:'q',type:'mc',text:'Which?',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a',image:'data:image/png;base64,YQ=='}]};
async function setup(){const db=new PGlite();let queue=Promise.resolve();const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};const store=createStore(pool);await store.init();for(const id of ['a','b','c'])await store.registerShareIdentity({id,email:id+'@example.com'});await store.saveTest('a',{...quiz,folderId:null});return {db,store};}
test('sharing snapshots only quizzes and imports atomically once into recipient folder',async()=>{const {db,store}=await setup();try{
 const user={id:'a',email:'a@example.com'},recipient={id:'b',email:'b@example.com'};
 const key=randomUUID();await store.createShare(user,'quiz','B@EXAMPLE.COM',key);await store.createShare(user,'quiz','B@EXAMPLE.COM',key);
 const inbox=await store.listShares(recipient);assert.equal(inbox.incoming.length,1);assert.equal(inbox.incoming[0].questionCount,1);assert.equal(inbox.incoming[0].snapshot,undefined);
 await store.saveTest('a',{...quiz,title:'Changed',folderId:null});const folder=await store.createFolder('b','My class');
 const [copy,again]=await Promise.all([store.acceptShare(recipient,inbox.incoming[0].id,folder.id),store.acceptShare(recipient,inbox.incoming[0].id,folder.id)]);
 assert.equal(copy.id,again.id);assert.equal(copy.title,'Review');assert.equal(copy.folderId,folder.id);assert.equal(copy.students,undefined);assert.equal(copy.questions[0].correctOptionId,'a');assert.equal(copy.questions[0].image,quiz.questions[0].image);assert.equal((await store.listTests('b')).length,1);assert.equal((await store.listShares(recipient)).incoming.length,0);
 }finally{await db.close();}});
test('sharing prevents cross-account acceptance, folder injection, future signup and email reassignment',async()=>{const {db,store}=await setup();try{
 const a={id:'a',email:'a@example.com'},b={id:'b',email:'b@example.com'},c={id:'c',email:'c@example.com'};
 const known=await store.createShare(a,'quiz','b@example.com',randomUUID()),unknown=await store.createShare(a,'quiz','unknown@example.com',randomUUID());assert.deepEqual(known,unknown);
 const invite=(await store.listShares(b)).incoming[0];await assert.rejects(store.acceptShare(c,invite.id,null),/not available/);const foreign=await store.createFolder('a','Private');await assert.rejects(store.acceptShare(b,invite.id,foreign.id),/folder/);
 await store.registerShareIdentity({id:'new',email:'unknown@example.com'});assert.equal((await store.listShares({id:'new',email:'unknown@example.com'})).incoming.length,0);
 await store.registerShareIdentity({id:'b',email:'new@example.com'});await assert.rejects(store.acceptShare({id:'b',email:'new@example.com'},invite.id,null),/not available/);
 await assert.rejects(store.createShare(c,'quiz','b@example.com',randomUUID()),/not found/);
 }finally{await db.close();}});
test('decline, cancel, expiry and account deletion remove access and snapshots',async()=>{const {db,store}=await setup();try{
 const a={id:'a',email:'a@example.com'},b={id:'b',email:'b@example.com'};
 await store.createShare(a,'quiz',b.email,randomUUID());let id=(await store.listShares(b)).incoming[0].id;await store.declineShare(b,id);await store.declineShare(b,id);await assert.rejects(store.acceptShare(b,id,null),/not available/);
 await store.createShare(a,'quiz',b.email,randomUUID());id=(await store.listShares(b)).incoming[0].id;await store.cancelShare(a,id);await assert.rejects(store.acceptShare(b,id,null),/not available/);
 await store.createShare(a,'quiz',b.email,randomUUID());id=(await store.listShares(b)).incoming[0].id;await db.query('UPDATE onscreen_v2_quiz_shares SET expires_at=NOW()-INTERVAL \'1 day\' WHERE id=$1',[id]);await assert.rejects(store.acceptShare(b,id,null),/not available/);assert.equal((await store.listShares(b)).incoming.length,0);
 await store.beginDeletion('a');await store.completeDeletion('a',async()=>{});assert.equal((await db.query('SELECT * FROM onscreen_v2_quiz_shares WHERE sender_id=$1 OR recipient_id=$1',['a'])).rows.length,0);assert.equal((await db.query('SELECT * FROM onscreen_v2_share_identities WHERE owner_id=$1',['a'])).rows.length,0);
 }finally{await db.close();}});
test('identity deletion cascades invitations and enforces no orphan recipients',async()=>{const {db,store}=await setup();try{await store.createShare({id:'a',email:'a@example.com'},'quiz','b@example.com',randomUUID());await db.query('DELETE FROM onscreen_v2_share_identities WHERE owner_id=$1',['b']);assert.equal((await db.query('SELECT id FROM onscreen_v2_quiz_shares WHERE recipient_id=$1',['b'])).rows.length,0);}finally{await db.close();}});
