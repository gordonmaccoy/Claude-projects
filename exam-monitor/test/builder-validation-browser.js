const assert=require('node:assert/strict'),{once}=require('node:events');
const {chromium}=require('playwright'),{PGlite}=require('@electric-sql/pglite'),{createStore}=require('../store'),{createApp}=require('../server'),exam=require('../exam');
(async()=>{
 const db=new PGlite();let queue=Promise.resolve();const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};
 const store=createStore(pool);await store.init();const owner='dashboard-teacher';await store.saveProfile(owner,{firstName:'Dashboard',registrationComplete:true});
 const folders=await Promise.all(['Alpha','Beta'].map(name=>store.createFolder(owner,name)));
 const quiz=exam.validateTest({title:'Dashboard fixture',questions:[{id:'q1',text:'First question',options:[{id:'a',text:'Correct option'},{id:'b',text:'Other option'}],correctOptionId:'a'},{id:'q2',type:'blank',text:'Second question',acceptedAnswers:['yes']}]});
 await store.saveTest(owner,{...quiz,id:'fixture-quiz',folderId:folders[0].id});
 const runtime=createApp({store,aiConfigured:true,importWithAI:async () => ({test: {title: 'Imported quiz', questions: Array.from({length: 8}, (_, i) => ({id: 'import-'+i, type: 'blank', text: 'Question '+(i+1)+' ____', acceptedAnswers: i === 0 ? [] : ['answer']}))}, warnings: ['Question 1: review the answer. AI is uncertain.']}),sweepInterval:0,config:{url:'http://localhost',key:'test-public-key'},verifyUser:async token=>token==='verified-test-token'?{id:owner,email:'teacher@example.com'}:null});runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
 let browser;
 try { browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/auth-client.js',route=>route.fulfill({contentType:'text/javascript',body:`window.createOnScreenAuth=()=>({auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},async getSession(){return {data:{session:{access_token:'verified-test-token',user:{id:'${owner}',email:'teacher@example.com'}}}}}}});`}));
 await page.goto('http://127.0.0.1:'+runtime.server.address().port+'/professor.html');await page.locator('#workspace:not([hidden])').waitFor();await page.waitForFunction(()=>document.querySelector('#launch-tests .card'));
 await page.locator('#tour-dialog').evaluate(el=>{if(el.open)el.close();});


 for (const viewport of [{width:1280,height:720},{width:390,height:844}]) {
  await page.setViewportSize(viewport);
  await page.locator('[data-tab="library"]').click();
  await page.locator('#new-test').click();
  await page.locator('#new-title').fill('Import missing key '+viewport.width);
  await page.locator('#new-folder-choice').selectOption(folders[0].id);
  await page.locator('#create-paste').click();
  await page.locator('#import-source').fill('1. Question 1 ____');
  await page.locator('#ai-consent').check();
  await page.locator('#import-submit').click();
  await page.locator('#test-builder:not([hidden])').waitFor();
  assert.match(await page.locator('.tb-q-card').first().textContent(), /needs a correct answer/);
  const before = (await store.listTests(owner)).length;
  await page.locator('#tb-start-btn').click();
  await page.waitForFunction(()=>document.activeElement?.classList.contains('tb-accepted'));
  const answer = page.locator('.tb-accepted').first();
  assert.equal(await answer.getAttribute('aria-invalid'),'true');
  assert.equal(await page.locator('.tb-q-error').count(),1);
  assert.match(await page.locator('.tb-q-error').textContent(), /needs a correct answer/);
  await page.waitForFunction(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
  assert.equal((await store.listTests(owner)).length,before,'Invalid draft is not saved');
  // Repeated saves replace the message rather than duplicating it.
  await page.locator('#tb-start-btn').click();
  assert.equal(await page.locator('.tb-q-error').count(),1);
  await answer.fill(Array(21).fill('answer').join('\n'));
  await page.locator('#tb-start-btn').click();
  assert.match(await page.locator('.tb-q-error').textContent(), /at most 20/);
  await answer.fill('x'.repeat(301));
  await page.locator('#tb-start-btn').click();
  assert.match(await page.locator('.tb-q-error').textContent(), /300 characters/);
  await answer.fill('Seoul');
  await page.locator('#tb-start-btn').click();
  await page.locator('#test-builder').waitFor({state:'hidden'});
  const saved=(await store.listTests(owner)).find(t=>t.title==='Import missing key '+viewport.width);
  assert.equal(saved.folderId,folders[0].id);
  assert.deepEqual(saved.questions[0].acceptedAnswers,['Seoul']);
  assert.equal(saved.questions.length,8);
 }
 assert.deepEqual(errors,[]);
 console.log('Imported missing-answer validation: desktop/mobile focus, visible inline guidance, repeated saves, limits and corrected persistence passed.');
 }finally{await browser?.close();await runtime.close();await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
