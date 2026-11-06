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
  const runtime=createApp({store,config,verifyUser:async token=>token===jwt?{id:'alice',email:'professor@example.com'}:token===bobJwt?{id:'bob',email:'bob@example.com'}:null,sweepInterval:500});
  runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');const base=`http://127.0.0.1:${runtime.server.address().port}`;config.origin=base;config.url=base;
  const executablePath=process.env.CHROME_BIN || (process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
  const browser=await chromium.launch({headless:true,executablePath});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const page=await context.newPage();
  await context.addInitScript(({jwt})=>localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:jwt,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'alice',email:'professor@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}})),{jwt});
  // Embedded browsers may ignore named targets. Reuse must still work without them.
  await context.addInitScript(()=> { const open=window.open.bind(window); window.open=(url,name,features)=>open(url,'_blank',features); });
  page.on('dialog',d=>d.accept('Approved interruption'));
  const out=path.join(__dirname,'../../.tmp/onscreen-v2');fs.mkdirSync(out,{recursive:true});
  try {
    await page.goto(base+'/professor.html');await page.locator('#workspace').waitFor({state:'visible'});
    await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Create new test',exact:true}).click();
    await page.locator('#tb-title').fill('Economics · Week 3');await page.locator('.tb-q-text').fill('What is 2 + 2?');
    await page.locator('.tb-opt-text').nth(0).fill('4');await page.locator('.tb-opt-text').nth(1).fill('5');await page.locator('#tb-questions input[type=radio]').first().check();
    await page.getByRole('button',{name:'Save to library'}).click();await page.locator('#test-builder').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Launch',exact:true}).click();
    const popupPromise=context.waitForEvent('page');await page.getByRole('button',{name:'Launch test ↗'}).click();const display=await popupPromise;
    await display.locator('#qr-toggle').waitFor({state:'visible'});
    await page.locator('#display-open').click();
    await page.waitForFunction(()=>!document.getElementById('display-open').disabled);
    assert.equal(context.pages().length,2,'Open classroom display must reuse the window created by Launch');
    await page.locator('#display-open').click();
    await page.waitForFunction(()=>!document.getElementById('display-open').disabled);
    assert.equal(context.pages().length,2,'Repeated display requests must not create extra windows');
    await display.locator('#qr-toggle').waitFor({state:'visible'});
    await page.reload(); await page.locator('#workspace').waitFor({state:'visible'});
    await page.locator('#active-sessions').getByRole('button').first().click();
    await page.locator('#display-open').click();
    await page.waitForFunction(()=>!document.getElementById('display-open').disabled);
    assert.equal(context.pages().length,2,'Existing classroom must also be reused after professor reload');
    await display.locator('#qr-toggle').click();assert.equal(await display.locator('#qr-toggle').getAttribute('aria-expanded'),'true');await display.locator('#qr-toggle').click();
    const session=(await store.listSessions('alice'))[0];
    const studentContext=await browser.newContext({viewport:{width:390,height:844}});const student=await studentContext.newPage();student.on('pageerror',e=>errors.push(e.message));student.on('dialog',d=>d.accept());
    await student.goto(base+`/student.html?session=${session.id}`);await student.locator('#number-input').fill('001234');await student.locator('#name-input').fill('Kim Minjun');await student.getByRole('button',{name:'Join',exact:true}).click();await student.locator('#waiting-section').waitFor({state:'visible'});
    await page.bringToFront();await page.getByRole('button',{name:'Start test',exact:true}).click();
    await student.bringToFront();await student.locator('.tq-option').first().waitFor({state:'visible'});await student.locator('.tq-option').first().click();
    await student.getByRole('button',{name:'Submit Answers'}).click();await student.locator('#test-done').waitFor({state:'visible'});
    assert.match(await student.locator('#done-score').textContent(),/1 \/ 1 · 100%/);
    await student.reload();await student.locator('#test-done').waitFor({state:'visible'});assert.match(await student.locator('#done-score').textContent(),/100%/);
    await display.bringToFront();await display.getByText('Kim Minjun',{exact:true}).waitFor();assert.equal((await display.locator('body').textContent()).includes('001234'),false);
    await display.screenshot({path:path.join(out,'classroom.png'),fullPage:true});
    await student.screenshot({path:path.join(out,'student-result.png'),fullPage:true});
    await page.bringToFront();await page.locator('#live-students').getByText('1 / 1 · 100%',{exact:true}).waitFor();await page.screenshot({path:path.join(out,'professor.png'),fullPage:true});
    await page.getByRole('button',{name:'Results',exact:true}).click();await page.getByRole('button',{name:'View results',exact:true}).click();await page.locator('#result-detail').waitFor({state:'visible'});
    const downloadPromise=page.waitForEvent('download');await page.locator('#result-export').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.xlsx$/);
    assert.equal(await page.locator('#result-delete').isVisible(),false,'Running test results cannot be deleted');
    await page.getByRole('button',{name:'Launch',exact:true}).click();
    await page.locator('#session-end').click();
    await page.getByRole('button',{name:'Results',exact:true}).click();
    await page.getByRole('button',{name:'View results',exact:true}).click();
    await page.locator('#result-delete').click();
    await page.getByText('No test results yet',{exact:true}).waitFor();
    assert.equal(await page.locator('#result-detail').isVisible(),false);
    await page.getByRole('button',{name:'Launch',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Launch calculator',exact:true}).count(),0);
    await page.locator('#calculator-launch').click();
    await page.locator('#dashboard').waitFor({state:'visible'});
    await display.getByRole('heading',{name:'Classroom calculator',exact:true}).waitFor({state:'visible',timeout:5000});
    assert.equal(context.pages().length,2,'Launching calculator after a test must reuse the same classroom window');
    assert.equal(await page.locator('#calculator-card').isVisible(),false,'Only one calculator open-display control is shown');
    assert.equal(await page.locator('#live-export').isVisible(),false);
    assert.equal((await page.locator('#live-students').textContent()).includes('Score'),false);
    assert.equal((await page.locator('#live-summary').textContent()).includes('submitted'),false);
    await page.screenshot({path:path.join(out,'calculator-controls.png'),fullPage:true});
    await display.close();
    const replacementPromise=context.waitForEvent('page'); await page.locator('#display-open').click();
    const replacement=await replacementPromise; await replacement.locator('#qr-toggle').waitFor({state:'visible'});
    assert.equal(context.pages().length,2,'A closed display can be reopened without extra windows');
    await page.locator('#session-end').click();
    await page.getByRole('button',{name:'Results',exact:true}).click();
    await page.getByText('No test results yet',{exact:true}).waitFor();
    await context.route(base+'/auth/v1/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(route.request().url().includes('/token')?{access_token:bobJwt,refresh_token:'bob-refresh',expires_in:3600,token_type:'bearer',user:{id:'bob',email:'bob@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}}:{})}));
    await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Edit',exact:true}).click();
    await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.locator('#login').waitFor({state:'visible'});
    await page.locator('#email').fill('bob@example.com');await page.locator('#password').fill('test-password-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#workspace').waitFor({state:'visible'});
    assert.equal(await page.locator('#test-builder').isVisible(),false,'Previous professor test editor must be cleared');
    await page.getByRole('button',{name:'Launch',exact:true}).click();assert.equal(await page.locator('#dashboard').isVisible(),false,'Previous professor student records must be cleared');
    await page.getByRole('button',{name:'Results',exact:true}).click();assert.equal(await page.locator('#result-detail').isVisible(),false,'Previous professor results must be cleared');
    assert.deepEqual(errors,[]);console.log('Browser smoke passed: classroom reuse with ignored window names and professor reload; test lifecycle, privacy, Excel, result deletion, calculator without grades/results.');
    console.log('Screenshots:',out);
    await studentContext.close();
  } catch(error) {
    console.error('Browser diagnostics:', JSON.stringify({ errors, notice:await page.locator('#notice').textContent(),
      sessions:(await store.listSessions('alice')).map(s=>({mode:s.mode,phase:s.phase,title:s.test?.title})),
      dashboard:await page.locator('#session-title').textContent(),
      pages:await Promise.all(context.pages().map(async p=>({ title:await p.title(), url:p.url().split('#')[0], phase:await p.evaluate(()=>document.getElementById('phase')?.textContent || null) }))) }));
    throw error;
  } finally { await browser.close();await runtime.close();await db.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
