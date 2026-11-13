const assert=require('node:assert/strict'),{once}=require('node:events');
const {chromium}=require('playwright'),{PGlite}=require('@electric-sql/pglite'),{createStore}=require('../store'),{createApp}=require('../server');
(async()=>{
 const db=new PGlite();let queue=Promise.resolve();const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};
 const store=createStore(pool);await store.init();const runtime=createApp({store,sweepInterval:0,config:{url:'http://localhost',key:'test-public-key'},verifyUser:async token=>token==='verified-test-token'?{id:'new-professor',email:'new@example.com'}:null});
 runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/auth-client.js',route=>route.fulfill({contentType:'text/javascript',body:`
 window.authEvents=[];window.authSession=null;window.registrationData=null;window.signoutCount=0;
 window.createOnScreenAuth=()=>({auth:{
 onAuthStateChange(fn){authEvents.push(fn);return {data:{subscription:{unsubscribe(){}}}};},
 async getSession(){return {data:{session:authSession}};},
 async signOut(){signoutCount++;authSession=null;authEvents.forEach(fn=>fn('SIGNED_OUT',null));return {error:null};},
 async signInWithPassword(){return {error:{message:'Invalid login credentials'}};},
 async signUp(input){registrationData=input.options.data.examio_registration;return {data:{session:null},error:null};},
 async verifyOtp(){authSession={access_token:'verified-test-token',user:{id:'new-professor',email:'new@example.com',user_metadata:{examio_registration:registrationData}}};authEvents.forEach(fn=>fn('SIGNED_IN',authSession));return {data:{session:authSession},error:null};}
 }});`}));
 const origin='http://127.0.0.1:'+runtime.server.address().port;
 await page.goto(origin+'/professor.html');await page.waitForFunction(()=>document.querySelector('#login-form').onsubmit);await page.locator('#email').fill('new@example.com');await page.locator('#password').fill('wrong-password');await page.locator('#login-form button[type=submit]').click();await page.getByText('Invalid login credentials',{exact:true}).waitFor();
 await page.getByRole('link',{name:'Create account',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#registration-form').onsubmit);
 await page.locator('#reg-first-name').fill('New');await page.locator('#reg-last-name').fill('Teacher');await page.locator('#reg-email').fill('new@example.com');await page.locator('#reg-email-confirm').fill('new@example.com');await page.locator('#reg-password').fill('a-long-test-password');await page.locator('#reg-password-confirm').fill('a-long-test-password');await page.locator('#reg-password-confirm').press('Enter');await page.locator('[data-registration-step="2"]:not([hidden])').waitFor();
 assert.equal(await page.evaluate(()=>registrationData),null);
 await page.locator('#reg-next').click();await page.locator('#reg-role').selectOption('it');await page.locator('#reg-terms').check();await page.locator('#reg-finish').click();await page.locator('#reg-code').fill('123456');await page.locator('#reg-verify-submit').click();await page.locator('#workspace:not([hidden])').waitFor();
 const saved=(await store.getAccount('new-professor')).profile;assert.equal(saved.role,'it');assert.equal(saved.registrationComplete,true);assert.ok(saved.termsAcceptedAt);assert.equal((await store.listTests('new-professor')).length,1);
 await page.locator('#tour-dialog').evaluate(el=>{if(el.open)el.close();});
 assert.equal(await page.locator('#add-practice-test,#calculator-language,#launch-language').count(),0);
 await page.locator('#professor-theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 assert.equal(await page.evaluate(()=>localStorage.getItem('exam-monitor-theme')),'dark');
 await page.evaluate(()=>{window.open=()=>({focus(){},location:{replace(){}}});window.examioLanguage.apply('ko');});
 const calculatorRequest=page.waitForRequest(r=>r.method()==='POST'&&new URL(r.url()).pathname==='/api/sessions');
 await page.locator('#calculator-card > summary').click();
 await page.locator('#calculator-launch').click();assert.equal((await calculatorRequest).postDataJSON().language,'ko');
 await page.waitForFunction(()=>!launching);
 await page.evaluate(()=>openLaunch(library[0]));
 const testRequest=page.waitForRequest(r=>r.method()==='POST'&&new URL(r.url()).pathname==='/api/sessions');
 const testResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/sessions');
 await page.locator('#launch-confirm').click();assert.equal((await testRequest).postDataJSON().language,'ko');const launchedResponse=await testResponse;assert.equal(launchedResponse.ok(),true,await launchedResponse.text());await page.locator('#launch-dialog').waitFor({state:'hidden'});
 await page.locator('#settings-menu summary').click();await page.locator('#signout').click();await page.locator('#signout-dialog').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>signoutCount),0);
 await page.locator('#signout-cancel').click();assert.equal(await page.evaluate(()=>signoutCount),0);assert.equal(await page.locator('#workspace').isVisible(),true);
 await page.locator('#settings-menu summary').click();await page.locator('#signout').click();await page.locator('#signout-confirm').click();await page.locator('#login').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>signoutCount),1);
 assert.deepEqual(errors,[]);
 await page.goto(origin+'/professor.html');await page.waitForFunction(()=>document.querySelector('#login-form').onsubmit);await page.screenshot({path:'../.tmp/examio-login.png',fullPage:true});
 console.log('Registration integration passed: existing login errors, Enter navigation, OTP auth event, real API profile persistence and starter test.');
 }finally{await browser.close();await runtime.close();await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
