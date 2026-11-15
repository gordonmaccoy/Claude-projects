// Synthetic local regression: CHROME_BIN=/usr/bin/chromium node test/game-large-launch-browser.js
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {chromium}=require('playwright');
const {PGlite}=require('@electric-sql/pglite');
const {createStore}=require('../store');
const {createApp}=require('../server');
(async()=>{
 const db=new PGlite();let queue=Promise.resolve();
 const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...args)=>db.query(...args),release};},async query(...args){const client=await this.connect();try{return await client.query(...args);}finally{client.release();}}};
 const store=createStore(pool);await store.init();
 const token='synthetic-large-class-teacher';
 const runtime=createApp({store,sweepInterval:100,config:{url:'http://localhost',key:'synthetic-key'},verifyUser:async value=>value===token?{id:'large-class-teacher',email:'synthetic@example.com'}:null});
 runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
 const base='http://127.0.0.1:'+runtime.server.address().port;let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN});
  const context=await browser.newContext({viewport:{width:1280,height:900}}),errors=[];
  // Never call live services. Only the local auth facade is replaced; app and database are real.
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await context.route('**/auth-client.js',route=>route.fulfill({contentType:'text/javascript',body:`window.createOnScreenAuth=()=>({auth:{async getSession(){return {data:{session:{access_token:${JSON.stringify(token)}}}}}}});`}));
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  const host=await context.newPage();host.setDefaultTimeout(15000);await host.goto(base+'/game-library.html');
  const sample=host.locator('.game-card').filter({hasText:'Sample Game: Easy Quiz'});await sample.waitFor();
  const headers={Authorization:'Bearer '+token};
  async function readSession(id){const response=await context.request.get(base+'/api/game-sessions/'+id,{headers});assert.equal(response.status(),200);const hostView=await response.json();assert.equal(hostView.id,id);const lobby=await context.request.get(base+'/game-api/'+id+'/lobby');assert.equal(lobby.status(),200);return lobby.json();}
  async function launch(large){
   await sample.getByRole('button',{name:'Launch Game',exact:true}).click();
   const dialog=host.locator('#launch-dialog');await dialog.waitFor();
   const setting=dialog.locator('#launch-large-class');assert.equal(await setting.isVisible(),true,'large class belongs inside launch confirmation');
   assert.equal(await dialog.locator('#launch-require-names').isVisible(),true);
   assert.equal(await setting.isChecked(),false,'every new launch defaults to 30 characters');
   if(large)await setting.check();
   const posted=host.waitForResponse(response=>response.url()===base+'/api/game-sessions'&&response.request().method()==='POST');
   const popup=host.waitForEvent('popup');await dialog.locator('#confirm-launch').click();
   const response=await posted;assert.equal(response.status(),200);
   assert.equal(response.request().postDataJSON().largeClass,large);
   assert.equal(response.request().postDataJSON().requireNames,true);
   const session=await response.json(),classroom=await popup;
   await host.waitForURL('**/game-library.html?session='+session.id);
   assert.equal((await readSession(session.id)).largeClass,large);
   await classroom.locator('#qr').waitFor();return {session,classroom};
  }
  async function verifyClassroom(classroom,id){
   await classroom.locator('#qr').waitFor();
   assert.equal(await classroom.locator('#qr').getAttribute('src'),'/game-api/'+id+'/qr');
   const qr=await context.request.get(base+'/game-api/'+id+'/qr');assert.equal(qr.status(),200);assert.match(qr.headers()['content-type'],/image\/png/);
   const roomName=await classroom.locator('#room-name').textContent();
   const resolved=await context.request.post(base+'/api/rooms/resolve',{data:{roomName}});assert.equal(resolved.status(),200);
   const {joinUrl}=await resolved.json();assert.equal(new URL(joinUrl,base).searchParams.get('session'),id);return joinUrl;
  }
  const first=await launch(true),joinUrl=await verifyClassroom(first.classroom,first.session.id);
  const phone=await context.newPage();await phone.setViewportSize({width:390,height:844});await phone.goto(new URL(joinUrl,base).href);
  await phone.locator('#avatar-picker button').first().waitFor();assert.equal(await phone.locator('#avatar-picker button').count(),30);
  assert.equal(await phone.locator('#avatar-pages').isVisible(),true);
  assert.equal(await phone.locator('#avatar-range').textContent(),'Characters 1–30 of 50');
  await phone.locator('#avatar-next').click();assert.equal(await phone.locator('#avatar-picker button').count(),20);
  assert.equal(await phone.locator('#avatar-range').textContent(),'Characters 31–50 of 50');
  assert.equal(await phone.locator('#avatar-picker button').first().getAttribute('data-avatar'),'avatar-31');
  assert.equal(await phone.locator('#avatar-picker button').last().getAttribute('data-avatar'),'avatar-50');
  const second=await launch(false);assert.notEqual(first.session.id,second.session.id);await verifyClassroom(second.classroom,second.session.id);
  await host.locator('#active-games a').evaluateAll((links,id)=>links.find(a=>new URL(a.href).searchParams.get('session')===id).click(),first.session.id);
  await host.waitForURL('**/game-library.html?session='+first.session.id);
  const displayLink=host.locator('#display-link');await displayLink.waitFor();
  await host.waitForFunction(id=>{const link=document.getElementById('display-link');return link?.href&&decodeURIComponent(new URL(link.href).hash).includes(id);},first.session.id);
  const reopenedPromise=host.waitForEvent('popup');await displayLink.click();const reopened=await reopenedPromise;
  await verifyClassroom(reopened,first.session.id);
  assert.equal((await readSession(first.session.id)).largeClass,true,'switching sessions preserves original launch settings');
  assert.equal((await readSession(second.session.id)).largeClass,false);
  assert.deepEqual(errors,[]);
  console.log('PASS: modal launch settings, actual POST/server largeClass, 30+20 picker, QR/room resolution, default reset and original-session classroom reopening.');
 }finally{if(browser)await browser.close();await runtime.close();await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
