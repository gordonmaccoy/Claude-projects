const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
test('student guards respect settings, lifecycle and scope',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)});
 try {
 const page=await browser.newPage();
 await page.setContent('<div id="questions"><p id="prompt" class="tq-text">Question</p><input id="answer"></div><input id="outside"><button id="full">Fullscreen</button><p id="status"></p>');
 await page.addScriptTag({path:path.join(__dirname,'../public/student-security.js')});
 const result=await page.evaluate(async()=>{
  const events=[];const root=document.getElementById('questions');
  const guard=window.examioStudentSecurity({document,window,root,button:document.getElementById('full'),status:document.getElementById('status'),report:type=>events.push(type)});
  const view={mode:'test',phase:'running',security:{enabled:true,textSelection:true,copyPaste:true,focusVisibility:true,fullscreen:true}};
  const blocked=(id,type)=>!document.getElementById(id).dispatchEvent(new Event(type,{bubbles:true,cancelable:true}));
  guard.update(view);const initial=[root.classList.contains('test-copy-guard'),blocked('answer','paste'),blocked('outside','paste'),blocked('prompt','contextmenu')];
  window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));
  guard.update({...view,phase:'paused'});const paused=[blocked('answer','paste'),root.classList.contains('test-copy-guard'),document.getElementById('full').hidden];
  window.dispatchEvent(new Event('blur'));
  guard.update({...view,security:{...view.security,enabled:false}});const disabled=[blocked('answer','paste'),root.classList.contains('test-copy-guard')];
  guard.update({...view,failed:true});window.dispatchEvent(new Event('blur'));
  guard.update({...view,security:{enabled:true,copyPaste:false,textSelection:true}});const independent=[blocked('answer','paste'),blocked('answer','contextmenu'),blocked('answer','dragstart'),blocked('prompt','contextmenu'),blocked('prompt','dragstart')];
  guard.update({...view,result:{}});const submitted=blocked('answer','paste');
  return {initial,paused,disabled,events,independent,submitted};
 });
 assert.deepEqual(result,{initial:[true,true,false,true],paused:[false,false,true],disabled:[false,false],events:['focus-lost','focus-returned'],independent:[false,false,false,true,true],submitted:false});
 }finally{await browser.close();}
});
test('fullscreen is voluntary, reports transitions and handles denial',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)});
 try {
 const page=await browser.newPage();await page.setContent('<div id="questions"></div><button id="full">Fullscreen</button><p id="status"></p>');
 await page.addScriptTag({path:path.join(__dirname,'../public/student-security.js')});
 const result=await page.evaluate(async()=>{
  let full=null,calls=0;const events=[];Object.defineProperty(document,'fullscreenElement',{get:()=>full,configurable:true});Object.defineProperty(document,'fullscreenEnabled',{value:true,configurable:true});
  document.documentElement.requestFullscreen=async()=>{calls++;throw Error('Denied');};
  const button=document.getElementById('full'),status=document.getElementById('status');
  const guard=window.examioStudentSecurity({document,window,root:document.getElementById('questions'),button,status,report:type=>events.push(type)});
  const view={mode:'calculator',phase:'running',security:{enabled:true,fullscreen:true}};
  guard.update(view);const automatic=calls;
  button.click();await new Promise(resolve=>setTimeout(resolve));const denial=status.textContent;guard.update(view);const persisted=status.textContent===denial;
  full=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));document.dispatchEvent(new Event('fullscreenchange'));
  full=null;document.dispatchEvent(new Event('fullscreenchange'));const afterExit=calls;
  guard.update({...view,completed:true});full=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));
  return {automatic,denial,persisted,events,afterExit,hidden:button.hidden};
 });
 assert.equal(result.persisted,true);assert.equal(result.automatic,0);assert.match(result.denial,/could not be opened/);assert.deepEqual(result.events,['fullscreen-entered','fullscreen-exit']);assert.equal(result.afterExit,1);assert.equal(result.hidden,true);
 }finally{await browser.close();}
});

test('required fullscreen locks supported browsers and exempts unsupported browsers',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)});
 try{const page=await browser.newPage();await page.setContent('<div id="questions"><input id="answer" value="Saved answer"></div><button id="full"></button><p id="status"></p>');await page.addScriptTag({path:path.join(__dirname,'../public/student-security.js')});
 const value=await page.evaluate(async()=>{let full=null,supported=true;Object.defineProperty(document,'fullscreenElement',{get:()=>full,configurable:true});Object.defineProperty(document,'fullscreenEnabled',{get:()=>supported,configurable:true});document.documentElement.requestFullscreen=async()=>{full=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));};const events=[],root=document.getElementById('questions');const guard=examioStudentSecurity({document,window,root,button:document.getElementById('full'),status:document.getElementById('status'),report:e=>events.push(e)});const view={phase:'running',mode:'test',security:{enabled:true,requireFullscreen:true,fullscreen:false}};guard.update(view);await Promise.resolve();const locked=guard.blocked()&&root.inert&&!document.querySelector('.fullscreen-answer-gate').hidden;document.querySelector('.fullscreen-answer-gate button').click();await Promise.resolve();const entered=!guard.blocked()&&!root.inert;full=null;document.dispatchEvent(new Event('fullscreenchange'));const exited=guard.blocked()&&root.inert;guard.update({...view,phase:'paused'});supported=false;guard.update(view);await Promise.resolve();return {locked,entered,exited,exempt:!guard.blocked()&&!root.inert,events,saved:document.getElementById('answer').value};});assert.deepEqual(value,{locked:true,entered:true,exited:true,exempt:true,events:['fullscreen-entered','fullscreen-exit','fullscreen-unavailable'],saved:'Saved answer'});
 }finally{await browser.close();}
});

test('iPads skip fullscreen enforcement and reporting while other guards stay active',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)});
 try{for(const device of [
  {userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)',platform:'iPad',touch:5,exempt:true},
  {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',platform:'MacIntel',touch:5,exempt:true},
  {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',platform:'MacIntel',touch:0,exempt:false},
  {userAgent:'Mozilla/5.0 (Windows NT 10.0)',platform:'Win32',touch:10,exempt:false}
 ]){
 const page=await browser.newPage();await page.setContent('<div id="questions"><input id="answer" value="Saved answer"></div><button id="full"></button><p id="status"></p>');await page.addScriptTag({path:path.join(__dirname,'../public/student-security.js')});
 const result=await page.evaluate(async device=>{
  for(const [key,value]of Object.entries({userAgent:device.userAgent,platform:device.platform,maxTouchPoints:device.touch}))Object.defineProperty(navigator,key,{value,configurable:true});
  let full=null,calls=0;Object.defineProperty(document,'fullscreenElement',{get:()=>full,configurable:true});Object.defineProperty(document,'fullscreenEnabled',{value:true,configurable:true});document.documentElement.requestFullscreen=async()=>{calls++;};
  const events=[],root=document.getElementById('questions'),button=document.getElementById('full');
  const guard=examioStudentSecurity({document,window,root,button,status:document.getElementById('status'),report:e=>events.push(e)});
  const view={phase:'running',mode:'test',security:{enabled:true,requireFullscreen:true,fullscreen:true,focusVisibility:true,copyPaste:true,textSelection:true}};
  guard.update(view);await Promise.resolve();events.length=0;
  const locked=guard.blocked(),hidden=button.hidden;button.click();await Promise.resolve();
  full=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));full=null;document.dispatchEvent(new Event('fullscreenchange'));guard.syncFullscreen();
  window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));
  const pasteBlocked=!document.getElementById('answer').dispatchEvent(new Event('paste',{bubbles:true,cancelable:true}));
  return {locked,hidden,calls,events,pasteBlocked,selectionGuard:root.classList.contains('test-copy-guard'),saved:document.getElementById('answer').value};
 },device);
 assert.equal(result.locked,!device.exempt);assert.equal(result.hidden,device.exempt);assert.equal(result.calls,device.exempt?0:1);
 assert.deepEqual(result.events,device.exempt?['focus-lost','focus-returned']:['fullscreen-entered','fullscreen-exit','fullscreen-exit','focus-lost','focus-returned']);
 assert.equal(result.pasteBlocked,true);assert.equal(result.selectionGuard,true);assert.equal(result.saved,'Saved answer');await page.close();
 }}finally{await browser.close();}
});
