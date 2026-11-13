const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)});
 try{
 const page=await browser.newPage({viewport:{width:1100,height:900}});
 const html=fs.readFileSync('public/professor.html','utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
 await page.route('**/*',route=>{const url=new URL(route.request().url());const file='public'+url.pathname;if(url.pathname==='/'||url.pathname==='/professor.html')return route.fulfill({contentType:'text/html',body:html});if(fs.existsSync(file))return route.fulfill({path:file});return route.fulfill({status:404,body:''});});
 await page.goto('http://localhost/professor.html?signup=1');
 await page.addScriptTag({path:'public/registration.js'});
 await page.evaluate(()=>{
 window.calls=[];window.session=null;window.done=0;
 const auth={auth:{
 signUp:async data=>{calls.push({method:'signup',data});return {data:{session:null},error:null};},
 signInWithOAuth:async data=>{calls.push({method:'google',data});return {error:null};},
 resend:async data=>{calls.push({method:'resend',data});return {error:null};},
 verifyOtp:async data=>{calls.push({method:'verify',data});if(data.token!=='123456')return {error:{message:'Token has expired or is invalid'}};return {data:{session:{user:{user_metadata:{examio_registration:calls.find(c=>c.method==='signup').data.options.data.examio_registration}}}},error:null};}
 }};
 window.registration=createExamioRegistration({auth,api:async(route,method,data)=>{calls.push({route,method,data});return route==='/settings'?{profile:{}}:{};},onComplete(){done++;}});
 });
 await page.locator('#reg-first-name').fill('Alex');await page.locator('#reg-last-name').fill('Kim');await page.locator('#reg-email').fill('alex@example.com');await page.locator('#reg-email-confirm').fill('wrong@example.com');await page.locator('#reg-password').fill('secure-test-password');await page.locator('#reg-password-confirm').fill('secure-test-password');await page.locator('#reg-next').click();assert.equal(await page.locator('[data-registration-step="1"]').isVisible(),true);
 await page.locator('#reg-email-confirm').fill('alex@example.com');await page.locator('#reg-next').click();await page.locator('#reg-institution').fill('Sejong University');await page.locator('#reg-next').click();
 await page.locator('#reg-terms').check();await page.locator('#reg-finish').click();assert.equal(await page.evaluate(()=>calls.filter(c=>c.method==='signup').length),0);
 await page.locator('#reg-role').selectOption('professor');await page.locator('#reg-finish').click();await page.locator('#registration-verify:not([hidden])').waitFor();
 assert.equal(await page.evaluate(()=>calls.find(c=>c.method==='signup').data.options.data.examio_registration.role),'professor');
 assert.equal(await page.locator('#reg-password').inputValue(),'');
 await page.locator('#reg-code').fill('000000');await page.locator('#reg-verify-submit').click();await page.getByText('Token has expired or is invalid',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>done),0);
 await page.locator('#reg-code').fill('123456');await page.locator('#reg-verify-submit').click();await page.waitForFunction(()=>done===1);assert.equal(await page.evaluate(()=>calls.find(c=>c.route==='/registration').data.role),'professor');
 await page.goto('http://localhost/professor.html?signup=1');await page.addScriptTag({path:'public/registration.js'});await page.evaluate(()=>{window.calls=[];window.ui=createExamioRegistration({auth:{auth:{signInWithOAuth:async data=>{calls.push(data);return {error:null};}}},api:async()=>({profile:{}}),onComplete(){}});});await page.locator('#reg-google').click();assert.match(await page.evaluate(()=>calls[0].options.redirectTo),/signup=1/);
 await page.evaluate(()=>ui.resume({user:{email:'google@example.com',user_metadata:{given_name:'Google',family_name:'Teacher'}}}));assert.equal(await page.locator('#reg-email').inputValue(),'google@example.com');assert.equal(await page.locator('#reg-credentials').isHidden(),true);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'../.tmp/registration-mobile.png',fullPage:true});
 // Google can create an identity from the ordinary login button too.
 await page.goto('http://localhost/professor.html');await page.addScriptTag({path:'public/registration.js'});
 await page.evaluate(async()=>{window.ui=createExamioRegistration({auth:{},api:async()=>({profile:{},registrationRequired:true}),onComplete(){}});await ui.resume({user:{email:'new-google@example.com',user_metadata:{given_name:'New',family_name:'Google'}}});});
 assert.equal(await page.locator('#registration').isVisible(),true);assert.equal(await page.locator('#reg-first-name').inputValue(),'New');
 await page.evaluate(async()=>{window.legacy=createExamioRegistration({auth:{},api:async()=>({profile:{},registrationRequired:false}),onComplete(){}});window.legacyBlocked=await legacy.resume({user:{email:'legacy@example.com',user_metadata:{}}});});assert.equal(await page.evaluate(()=>legacyBlocked),false);assert.equal(await page.locator('#registration').isHidden(),true);
 console.log('Registration browser checks passed: step validation, signup metadata, wrong/correct OTP, Google profile continuation, mobile overflow.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
