// Local mocked UI test: CHROME_BIN=/usr/bin/chromium node test/game-library-polish-browser.js
const assert=require('node:assert/strict'),express=require('express'),{once}=require('node:events'),{chromium}=require('playwright');
(async()=>{
 const app=express();app.use(express.static(require('node:path').join(__dirname,'../public')));const server=app.listen(0,'127.0.0.1');await once(server,'listening');let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN});const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:'+server.address().port;
  await page.route('**/game-host.html?session=*',r=>r.fulfill({contentType:'text/html',body:'<h1>Host launch destination</h1>'}));
  await page.route('**/auth-client.js',r=>r.fulfill({contentType:'text/javascript',body:"window.createOnScreenAuth=()=>({auth:{async getSession(){return {data:{session:{access_token:'local-test'}}}}}})"}));
  const games=[{id:'one',title:'Economics review',questions:[{id:'q',text:'Question',options:[],correctOptionId:''}]},{id:'two',title:'Another game',questions:[]}];
  await page.route('**/api/**',r=>{const u=new URL(r.request().url());requests.push([u.pathname,r.request().method(),u.search]);const data=u.pathname==='/api/config'?{supabaseUrl:base,supabaseKey:'local-public'}:u.pathname==='/api/games'?games:u.pathname==='/api/game-sessions'&&r.request().method()==='GET'?[{id:'active',title:'Active game',phase:'lobby'}]:u.pathname==='/api/game-sessions'?{id:'new',displayUrl:base+'/classroom-readonly',classroomControlUrl:base+'/classroom-controls'}:{};return r.fulfill({contentType:'application/json',body:JSON.stringify(data)});});
  await page.goto(base+'/game-library.html');await page.locator('.game-card').first().waitFor();
  assert.equal(await page.locator('#sample-game').count(),0);assert.equal(await page.locator('.game-card button:visible').count(),4);
  assert.ok(requests.some(([p,m,q])=>p==='/api/games'&&m==='GET'&&q==='?language=en'));
  assert.match(await page.locator('#active-games a').getAttribute('href'),/session=active/);
  const toggle=page.getByRole('button',{name:'More actions for Economics review'}),panel=page.locator('#game-actions-1');
  await toggle.focus();await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'Edit');await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await toggle.evaluate(n=>n===document.activeElement),true);
  await toggle.click();await page.locator('h1').click();assert.equal(await panel.isVisible(),false);
  await toggle.click();await page.getByRole('button',{name:'More actions for Another game'}).click();assert.equal(await panel.isVisible(),false);
  await toggle.click();page.once('dialog',d=>d.dismiss());await panel.getByRole('button',{name:'Delete',exact:true}).click();assert.equal(requests.filter(([,m])=>m==='DELETE').length,0);
  await toggle.click();page.once('dialog',d=>d.dismiss());await panel.getByRole('button',{name:'Copy to Tests'}).click();assert.equal(requests.filter(([p])=>p.endsWith('/to-test')).length,0);
  await toggle.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.locator('#editor:not([hidden])').waitFor();assert.equal(await page.locator('#title').inputValue(),'Economics review');page.once('dialog',d=>d.accept());await page.locator('#cancel-edit').click();
  for(const viewport of [{width:360,height:640},{width:320,height:480},{width:1280,height:900}]){await page.setViewportSize(viewport);await toggle.click();const box=await panel.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height);await page.keyboard.press('Escape');}
  const popupPromise=page.waitForEvent('popup');await page.locator('.game-card .primary').first().click();const popup=await popupPromise;await popup.waitForURL('**/classroom-controls');await page.waitForURL('**/game-host.html?session=new');assert.equal(await popup.evaluate(()=>window.opener===null),true);
  assert.deepEqual(errors,[]);console.log('Library disclosure tests passed: keyboard, dismissal, cancel actions, editor, mobile bounds, resume and classroom-control launch.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
