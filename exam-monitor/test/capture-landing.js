// Capture the real app with disposable, fictional data. Never use a live account.
const path=require('node:path');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {chromium}=require('playwright');
const {PGlite}=require('@electric-sql/pglite');
const {createStore}=require('../store');
const {createApp}=require('../server');
const exam=require('../exam');

async function main(){
  const db=new PGlite();let queue=Promise.resolve();
  const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...args)=>db.query(...args),release};},async query(...args){const c=await this.connect();try{return await c.query(...args);}finally{c.release();}}};
  const store=createStore(pool);await store.init();
  const owner='landing-demo';
  const questions=[
    ['What is the capital of South Korea?',['Seoul','Beijing','Tokyo'],0],
    ['What is 2 + 2?',['3','4','5'],1],
    ['Choose the correct sentence.',['She study every day.','She studies every day.','She studying every day.'],1],
    ['Complete the sentence: We ____ worked here since 2020.',['have','has','are'],0],
    ['Which word means the opposite of expensive?',['Large','Quiet','Cheap'],2],
    ['Choose the past tense of go.',['Goes','Went','Going'],1],
    ['Complete the sentence: They ____ watching a film.',['is','are','am'],1],
    ['Which sentence describes a future plan?',['I am meeting Sam tomorrow.','I met Sam yesterday.','I meet Sam every day.'],0]
  ].map(([text,choices,key],i)=>({id:'q'+i,type:'mc',points:1,text,options:choices.map((text,j)=>({id:'q'+i+'_'+j,text})),correctOptionId:'q'+i+'_'+key}));
  const test={id:'landing-class-exam',title:'Class Exam',folderId:null,questions};
  await store.saveTest(owner,test);await store.initializeOnboarding(owner,test);await store.dismissOnboarding(owner);
  const now=Date.now(),session=exam.newSession(owner,test,now,{showCorrections:true});
  const names=['Alex','Minji','Daniel','Sofia','Jisoo','Liam','Emma','Noah','Hana','Ethan','Yuna','Olivia','Lucas','Mia','Leo'];
  for(const [i,name] of names.entries()){
    const joined=exam.join(session,{name,number:String(20260001+i)},now);
    const st=exam.student(session,joined.studentId);st.lastSeen=now+3600000;
    st.draft=Object.fromEntries(questions.slice(0,i>=11?8:3+i%5).map((q,j)=>[q.id,(i+j)%4===0?q.options.find(o=>o.id!==q.correctOptionId).id:q.correctOptionId]));
    st.progressQuestionId=Object.keys(st.draft).at(-1);
    if(i>=8&&i<11)st.visible=false;
    if(i>=11&&i<13){st.submission={answers:st.draft,originalScore:exam.scoreAnswers(test,st.draft),submittedAt:now};st.draft={};}
    if(i>=13){st.failedAt=now;st.events.push({type:'fail',at:now,hiddenSince:now-6000});}
  }
  session.phase='running';session.startedAt=now;
  await store.createSession(session);
  const jwt=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(now/1000)+3600})).toString('base64url')}.fixture`;
  const config={url:'',key:'fictional-demo-public'};
  const runtime=createApp({store,config,verifyUser:async t=>t===jwt?{id:owner,email:'professor@example.com'}:null,sweepInterval:0});
  runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
  const base=`http://127.0.0.1:${runtime.server.address().port}`;config.origin=config.url=base;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)});
  const out=path.join(__dirname,'../public/landing');
  try{
    const desktop=await browser.newContext({viewport:{width:1200,height:920},deviceScaleFactor:1.5});
    await desktop.addInitScript(({jwt,owner})=>localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:owner,email:'professor@example.com',app_metadata:{},user_metadata:{}}})),{jwt,owner});
    const display=await desktop.newPage();await display.goto(base+'/classroom.html#'+session.id+'/'+session.displayToken);
    await display.locator('.student').nth(14).waitFor();
    assert.equal(await display.locator('.student').count(),15);
    assert.equal(await display.locator('.student.failed').count(),2);
    assert.equal(await display.locator('.student.submitted').count(),2);
    assert.equal(await display.locator('.student.red:not(.failed)').count(),3);
    // A decorative code cannot send visitors into the disposable capture session.
    const code='<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140"><rect width="140" height="140" rx="10" fill="white"/>'+Array.from({length:25},(_,i)=>`<rect x="${12+i%5*24}" y="${12+Math.floor(i/5)*24}" width="${i%3===0?18:12}" height="${i%3===0?18:12}" rx="${i%3===0?3:6}" fill="${i%2?'#2bc64c':'#0758e8'}"/>`).join('')+'</svg>';
    await display.locator('#qr').evaluate((img,code)=>img.src='data:image/svg+xml;base64,'+btoa(code),code);
    await display.evaluate(()=>document.fonts.ready);await display.screenshot({path:path.join(out,'classroom-preview.png')});
    const professor=await desktop.newPage();await professor.goto(base+'/professor.html');
    await professor.getByRole('button',{name:'Results',exact:true}).click();
    await professor.getByRole('button',{name:'View results',exact:true}).click();
    await professor.locator('#result-details-tab').click();await professor.locator('.answer-grid tbody tr').nth(14).waitFor();
    assert.ok(await professor.locator('.answer-correct').count()>0);assert.ok(await professor.locator('.answer-incorrect').count()>0);
    assert.equal(await professor.locator('#result-title').textContent(),'Class Exam');
    await professor.evaluate(()=>document.fonts.ready);await professor.locator('#result-detail').screenshot({path:path.join(out,'professor-preview.png')});
    const phone=await browser.newContext({viewport:{width:390,height:780},deviceScaleFactor:2});
    const student=await phone.newPage();await student.goto(base+'/student.html?session='+session.id);
    await student.locator('#number-input').fill('20260016');await student.locator('#name-input').fill('Sam');await student.getByRole('button',{name:'Join',exact:true}).click();
    await student.locator('.tq-option').first().waitFor();await student.locator('.tq-option').filter({hasText:'Seoul'}).click();
    assert.ok((await student.locator('body').textContent()).includes('Class Exam'));
    await student.evaluate(()=>document.fonts.ready);await student.screenshot({path:path.join(out,'student-preview.png')});
    // Verify the landing page at desktop and mobile sizes using the new assets.
    const landing=await desktop.newPage();await landing.goto(base+'/');
    await landing.locator('[data-carousel-action="pause"]').click();
    assert.equal(await landing.locator('.preview-card img').count(),3);
    assert.equal(await landing.locator('.site-footer').getByText('Examio monitors page visibility during tests. It does not lock student devices.').count(),0);
    for(const width of [1440,390]){
      await landing.setViewportSize({width,height:1000});
      await landing.screenshot({path:path.join(__dirname,'../../.tmp/landing-'+width+'.png'),fullPage:true});
      assert.ok(await landing.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.ok(await landing.locator('.preview-card img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0)));
    }
    console.log('Captured Class Exam previews. Verified 15 students, mixed statuses, green/red results, and responsive landing page.');
  }finally{await browser.close();await runtime.close();await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
