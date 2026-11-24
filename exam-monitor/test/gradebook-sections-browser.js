const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { PGlite } = require('@electric-sql/pglite');
const { createStore } = require('../store');
const { createApp } = require('../server');

async function main() {
  const db = new PGlite(); let queue = Promise.resolve();
  async function lease() { const before = queue; let release; queue = new Promise(r => release=r); await before; return { query:(...a)=>db.query(...a), release }; }
  const pool={connect:lease,query:async(...a)=>{const c=await lease();try{return await c.query(...a);}finally{c.release();}}};
  const store=createStore(pool);await store.init();
  const jwt=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:'alice',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.signature`;
  const config={url:'http://127.0.0.1:1',key:'development-test-public-key'};
  const bobJwt=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:'bob',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.signature`;
  const aiOptions={key:'test-private',model:'test-model',fetch:async(url,opts)=>{const body=JSON.parse(opts.body),input=JSON.parse(body.input);const value=body.text.format.name==='test_answer_key'?{answers:input.questions.map(q=>({questionId:q.id,correctOptionId:q.type==='blank'?null:q.options[/stereo on|vacation last|surfboard/.test(q.text)?1:0].id,acceptedAnswers:q.type==='blank'?['answer']:[],uncertain:false,explanation:'AI rationale for professor review.'}))}:{isTest:false,title:'Not a test',questions:[]};return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})};}};
  const runtime=createApp({store,config,adminOptions:{ownerEmail:'professor@example.com'},settingsOptions:{sendMail:null,removeAccount:null,supportAdminEmail:'professor@example.com',helpConfigured:true,helpAssistant:async()=>({answer:'Choose Launch, then Start test when everyone has joined.',topics:[]})},completeAnswers:require('../answer-key').createAnswerCompleter(aiOptions),importWithAI:require('../answer-key').createAIImporter(aiOptions),aiConfigured:true,generate:async ({source,count})=>({test:{title:'AI review draft',questions:[{id:'ai_q',type:'blank',text:'The capital is ____',acceptedAnswers:['Paris'],caseSensitive:false,evidence:source}]},warnings:['Review this AI draft.']}),verifyUser:async token=>token===jwt?{id:'alice',email:'professor@example.com'}:token===bobJwt?{id:'bob',email:'bob@example.com'}:null,sweepInterval:500});
  runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');const base=`http://127.0.0.1:${runtime.server.address().port}`;config.origin=base;config.url=base;
  const executablePath=process.env.CHROME_BIN || (process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
  const browser=await chromium.launch({headless:true,executablePath});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const page=await context.newPage();
  await context.addInitScript(({jwt})=>localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:jwt,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'alice',email:'professor@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}})),{jwt});
  // Embedded browsers may ignore named targets. Reuse must still work without them.
  await context.addInitScript(()=> { const open=window.open.bind(window); window.open=(url,name,features)=>open(url,'_blank',features); });
  await context.addInitScript(()=>{window.prompt=()=>{throw new Error('prompt() is not supported');};});
  page.on('dialog',d=>d.accept());
  async function enterForm(value){await page.locator('#entry-value').fill(value);await page.locator('#entry-save').click();await page.locator('#entry-dialog').waitFor({state:'hidden'});}
  const out=path.join(__dirname,'../../.tmp/onscreen-v2');fs.mkdirSync(out,{recursive:true});
  try {
    let sectionBook=await store.createGradebook('alice',{name:'Online section check',students:[{name:'Amy',number:'001'}]});
    sectionBook=await store.changeGradebook('alice',sectionBook.id,{action:'setup',revision:0,categories:[{id:'online',name:'Online Class',weight:10},{id:'other',name:'Other',weight:90}],quizCategoryId:'online'});
    sectionBook=await store.changeGradebook('alice',sectionBook.id,{action:'add-assessment',revision:sectionBook.revision,categoryId:'online',title:'Existing quiz',total:100});
    sectionBook=await store.changeGradebook('alice',sectionBook.id,{action:'grade',revision:sectionBook.revision,sessionId:sectionBook.assessments[0].sessionId,studentId:sectionBook.students[0].id,score:80});
    await store.saveProfile('alice',{firstName:'Alice',registrationComplete:true});
    await page.route('**/auth-client.js',r=>r.fulfill({contentType:'text/javascript',body:'window.createOnScreenAuth=()=>({auth:{onAuthStateChange(){},async getSession(){return {data:{session:{access_token:'+JSON.stringify(jwt)+',user:{id:"alice",email:"professor@example.com"}}}}}}});'}));
    await page.goto(base+'/professor.html');await page.locator('#workspace').waitFor({state:'visible'});
    await page.locator('#tour-dialog').waitFor({state:'visible'});await page.locator('#tour-skip').click();await page.locator('#tour-dialog').waitFor({state:'hidden'});
await page.locator('[data-tab=gradebooks]').click();
    const book=page.locator('.gradebook-folder').filter({hasText:'Online section check'});await book.locator(':scope > summary').click();await book.getByRole('button',{name:'Online Class 10%',exact:true}).click();
    await book.getByRole('button',{name:'Sections setup',exact:true}).click();const dialog=page.locator('dialog[open]');
    await dialog.getByRole('button',{name:'Add section',exact:true}).click();await dialog.getByLabel('Section name',{exact:true}).first().fill('Online Quizzes');await dialog.getByLabel('Section percent of final grade').first().fill('5');
    await dialog.getByRole('button',{name:'Add section',exact:true}).click();await dialog.getByLabel('Section name',{exact:true}).nth(1).fill('Online Attendance');await dialog.getByLabel('Section percent of final grade').nth(1).fill('5');
    await dialog.getByRole('button',{name:'Save sections',exact:true}).click();await dialog.waitFor({state:'detached'});
    await book.getByRole('button',{name:'Online Quizzes 5%',exact:true}).click();assert.equal(await book.locator('.gradebook-grade-input').inputValue(),'80');
    await book.getByRole('button',{name:'Online Attendance 5%',exact:true}).click();await book.getByRole('button',{name:'Add grade column',exact:true}).click();
    await dialog.getByLabel('Assessment title').fill('Week 1 attendance');await dialog.getByLabel('Maximum score').fill('10');await dialog.getByRole('button',{name:'Add column',exact:true}).click();await dialog.waitFor({state:'detached'});
    await book.locator('.gradebook-grade-input').fill('10');await book.locator('.gradebook-grade-input').press('Enter');await page.waitForFunction(id=>document.querySelector('[data-id="'+id+'"] .gradebook-total')?.textContent==='10 / 10',sectionBook.id);
    await book.getByRole('button',{name:'Category Summary',exact:true}).click();assert.match(await book.locator('tbody').textContent(),/9 [/] 10/);
    await book.getByRole('button',{name:'Class Summary',exact:true}).click();assert.match(await book.locator('tbody').textContent(),/9 [/] 10/);
    await page.reload();await page.locator('[data-tab=gradebooks]').click();await book.locator(':scope > summary').click();await book.getByRole('button',{name:'Online Class 10%',exact:true}).click();assert.match(await book.locator('tbody').textContent(),/9 [/] 10/);
    await book.getByRole('button',{name:'Sections setup',exact:true}).click();assert.equal(await dialog.getByLabel('Section for Week 1 attendance').inputValue(),(await store.getGradebook('alice',sectionBook.id)).assessments[1].sectionId);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    await book.locator('.gradebook-menu > summary').click();await book.getByRole('button',{name:'Duplicate Blank Gradebook',exact:true}).click();const blank=page.locator('.gradebook-folder').filter({hasText:'Online section check (blank copy)'});await blank.waitFor();assert.ok((await blank.locator(':scope > summary').textContent()).includes('(0)'));await blank.locator(':scope > summary').click();await blank.getByRole('button',{name:'Online Class 10%',exact:true}).click();await blank.getByRole('button',{name:'Online Attendance 5%',exact:true}).click();assert.match(await blank.textContent(),/Week 1 attendance/);assert.equal(await blank.locator('tbody tr').count(),0);
    await page.screenshot({path:path.join(out,'weighted-sections.png')});assert.deepEqual(errors,[]);
    const exam=require('../exam'),quiz=exam.newSession('alice',{title:'Imported quiz',questions:[{id:'q',text:'Q',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]});exam.join(quiz,{name:'Amy',number:'001'});await store.createSession(quiz);
    let imported=await store.sendResultsToGradebook('alice',sectionBook.id,quiz.id);const category=imported.book.categories.find(c=>c.id==='online');assert.equal(imported.book.assessments.find(a=>a.sessionId===quiz.id).sectionId,category.importSectionId);
    const moved=await store.changeGradebook('alice',sectionBook.id,{action:'sections',revision:imported.book.revision,categoryId:'online',sections:category.sections,importSectionId:category.importSectionId,assignments:imported.book.assessments.map(a=>({sessionId:a.sessionId,sectionId:a.sessionId===quiz.id?category.sections[1].id:a.sectionId}))});
    imported=await store.sendResultsToGradebook('alice',sectionBook.id,quiz.id);assert.equal(imported.book.assessments.find(a=>a.sessionId===quiz.id).sectionId,category.sections[1].id);
    console.log('Weighted sections UI verified: setup, existing assignments, section grading, summary, reload.');
  } finally {await browser.close();await runtime.close();await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

