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
