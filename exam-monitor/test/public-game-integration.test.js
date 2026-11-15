const test=require('node:test'),assert=require('node:assert/strict');
const {createAnswerCompleter,createAIImporter}=require('../answer-key');
const success=value=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})});
test('Public import defaults retain supplied-key review while default answer completion stays missing-only',async()=>{
 const requests=[];const options={key:'test',model:'test',fetch:async(_url,request)=>{const body=JSON.parse(request.body),questions=JSON.parse(body.input).questions;requests.push(questions);return success({answers:questions.map(q=>({questionId:q.id,correctOptionId:q.options[0].id,acceptedAnswers:[],uncertain:false,explanation:'Arithmetic.'}))});}};
 const quiz={title:'Math',questions:[{id:'q',text:'2+2?',options:[{id:'a',text:'4'},{id:'b',text:'5'}],correctOptionId:'b'}]};
 await createAnswerCompleter(options)(quiz);assert.equal(requests.length,0);
 const importer=createAIImporter(options),source='1. What is 2 + 2?\nA. 4\nB. 5\nAnswer: B';
 const legacy=await importer({source});assert.equal(requests.length,1);assert.ok(requests[0][0].suppliedAnswer);assert.equal(legacy.test.questions[0].correctOptionId,legacy.test.questions[0].options[1].id);assert.match(legacy.test.questions[0].answerExplanation,/supplied answer preserved/i);
 const explicit=await importer({source,reviewSupplied:true});assert.equal(requests.length,2);assert.equal(requests[1][0].suppliedAnswer,undefined);assert.equal(explicit.test.questions[0].correctOptionId,explicit.test.questions[0].options[1].id);assert.ok(!explicit.test.questions[0].answerExplanation);
});
test('additive initialization preserves Public rows and owner deletion clears both contact and game data',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),{createStore}=require('../store'),{createAccountStore}=require('../account-store');const db=new PGlite();
 let queue=Promise.resolve();const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};
 try{const accounts=createAccountStore(pool);await accounts.init();await accounts.methods.saveProfile('owner',{name:'Existing profile'});
 await db.query('CREATE TABLE onscreen_v2_tests(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,data JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
 const original={id:'old',title:'Unchanged academic test',questions:[]};await db.query('INSERT INTO onscreen_v2_tests(id,owner_id,data) VALUES($1,$2,$3)',['old','owner',JSON.stringify(original)]);
 const store=createStore(pool);await store.init();await store.init();assert.deepEqual((await db.query("SELECT data FROM onscreen_v2_tests WHERE id='old'")).rows[0].data,original);assert.equal((await db.query("SELECT game_sample_initialized FROM onscreen_v2_accounts WHERE owner_id='owner'")).rows[0].game_sample_initialized,false);
 for(const owner of ['owner','other']){await store.saveSharingContact(owner,{name:'Friend',email:'friend@example.com'});const folder=await store.createGameFolder(owner,'Review');await store.saveGame(owner,{title:'Game',folderId:folder.id,questions:[{id:'q',text:'Which?',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]});}
 await store.beginDeletion('owner');await store.completeDeletion('owner',async()=>{});for(const table of ['sharing_contacts','games','game_folders']){assert.equal((await db.query('SELECT count(*)::int AS n FROM onscreen_v2_'+table+' WHERE owner_id=$1',['owner'])).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int AS n FROM onscreen_v2_'+table+' WHERE owner_id=$1',['other'])).rows[0].n,1);}
 }finally{await db.close();}
});
