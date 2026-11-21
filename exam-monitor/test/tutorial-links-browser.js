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
  const runtime=createApp({store,config,settingsOptions:{sendMail:null,removeAccount:null,supportAdminEmail:'professor@example.com',helpConfigured:true,helpAssistant:async()=>({answer:'Choose Launch, then Start test when everyone has joined.',topics:[]})},completeAnswers:require('../answer-key').createAnswerCompleter(aiOptions),importWithAI:require('../answer-key').createAIImporter(aiOptions),aiConfigured:true,generate:async ({source,count})=>({test:{title:'AI review draft',questions:[{id:'ai_q',type:'blank',text:'The capital is ____',acceptedAnswers:['Paris'],caseSensitive:false,evidence:source}]},warnings:['Review this AI draft.']}),verifyUser:async token=>token===jwt?{id:'alice',email:'professor@example.com'}:token===bobJwt?{id:'bob',email:'bob@example.com'}:null,sweepInterval:500});
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
    await context.route('https://www.youtube-nocookie.com/**',r=>r.fulfill({contentType:'text/html',body:'Tutorial video fixture'}));
    await page.goto(base+'/');
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});
      const link=page.locator('[data-tutorial=signup]');await link.click();
      assert.match(await page.locator('.tutorial-video-player iframe').getAttribute('src'),/oSKQeSRrffY/);
      assert.equal(await page.locator('.tutorial-video-dialog').evaluate(el=>el.getBoundingClientRect().right<=innerWidth),true);
      await page.keyboard.press('Escape');await page.locator('.tutorial-video-player iframe').waitFor({state:'detached'});
      assert.equal(await link.evaluate(el=>el===document.activeElement),true);
    }
    await store.saveProfile('alice',{firstName:'Alice',registrationComplete:true});
    await page.route('**/auth-client.js',r=>r.fulfill({contentType:'text/javascript',body:'window.createOnScreenAuth=()=>({auth:{onAuthStateChange(){},async getSession(){return {data:{session:{access_token:'+JSON.stringify(jwt)+',user:{id:"alice",email:"professor@example.com"}}}}}}});'}));
    await page.goto(base+'/professor.html');await page.locator('#workspace').waitFor({state:'visible'});
    await page.locator('#tour-dialog').waitFor({state:'visible'});await page.locator('#tour-skip').click();await page.locator('#tour-dialog').waitFor({state:'hidden'});
    for(const [container,key,id] of [['#calculator-card','calculator','Z4LchHDBZBs'],['#launch-tests .folder[data-folder-id=""]','launch','xUPe_R1VbOQ']]){
      const folder=page.locator(container),link=folder.locator('[data-tutorial='+key+']');
      if(await folder.getAttribute('open')!==null)await folder.locator('summary').first().click();
      assert.equal(await link.isVisible(),false);
      await folder.locator('summary').first().click();assert.equal(await link.isVisible(),true);
      await link.click();assert.ok((await page.locator('.tutorial-video-player iframe').getAttribute('src')).includes(id));
      await page.getByRole('button',{name:'Close tutorial video',exact:true}).click();
      await page.locator('.tutorial-video-player iframe').waitFor({state:'detached'});
      await folder.locator('summary').first().click();assert.equal(await link.isVisible(),false);
    }
    assert.equal(await page.locator('#library-tests [data-tutorial=launch]').count(),0);
    assert.equal(await page.locator('.topbar #take-tour').isVisible(),page.viewportSize().width>720);
    for(const [tab,key,id] of [['library','create','bKF0W2XEQso'],['results','results','kFL3qrujLxQ']]){
      await page.locator('[data-tab='+tab+']').click();
      const link=page.locator('#'+tab+' [data-tutorial='+key+']');await link.click();
      assert.ok((await page.locator('.tutorial-video-player iframe').getAttribute('src')).includes(id));
      await page.keyboard.press('Escape');await page.locator('.tutorial-video-player iframe').waitFor({state:'detached'});
    }
    await page.setViewportSize({width:1440,height:900});await page.locator('#take-tour').click();await page.locator('#tour-dialog').waitFor({state:'visible'});await page.locator('#tour-skip').click();
    await page.locator('[data-tab=games]').click();
    await page.locator('[data-tab=gradebooks]').click();
    await page.locator('#gradebook-list summary').waitFor();
    assert.equal(await page.locator('#gradebook-list details').evaluate(el=>el.open),false);
    await page.locator('#gradebook-list summary').click();
    assert.equal(await page.locator('#gradebook-list tbody tr').count(),15);
    assert.deepEqual(await page.locator('#gradebook-list th').allTextContents(),['Student name','Student number']);
    await page.locator('#gradebook-new').click();await page.locator('#gradebook-create input').fill('Biology 101');await page.locator('#gradebook-create [type=submit]').click();
    await page.locator('#gradebook-list summary').filter({hasText:'Biology 101'}).waitFor();
    await page.locator('[data-tab=library]').click();await page.locator('[data-tab=gradebooks]').click();
    await page.locator('#gradebook-list summary').filter({hasText:'Biology 101'}).waitFor();
    await page.locator('[data-tab=games]').click();
    const games=page.frameLocator('#game-workspace-frame');
    const gameLink=games.locator('[data-tutorial=games]');await gameLink.waitFor({state:'visible'});await gameLink.click();
    assert.ok((await games.locator('.tutorial-video-player iframe').getAttribute('src')).includes('7Ig0TopMwnk'));
    await games.getByRole('button',{name:'Close tutorial video'}).click();
    for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}

    await page.setViewportSize({width:1440,height:900});await page.locator('[data-tab=library]').click();await page.screenshot({path:path.join(out,'tutorial-header-desktop.png')});
    await page.setViewportSize({width:390,height:900});await page.screenshot({path:path.join(out,'tutorial-header-mobile.png')});
    console.log('Tutorial links verified: desktop/mobile, correct video IDs, Escape/close cleanup, focus return, collapsed visibility.');
  } finally {await browser.close();await runtime.close();await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
