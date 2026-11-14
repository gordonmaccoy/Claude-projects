// Optional visual/end-to-end check: CHROME_BIN=/usr/bin/chromium node test/game-browser.js
const assert=require('node:assert/strict'),{once}=require('node:events');
const {chromium}=require('playwright'),{PGlite}=require('@electric-sql/pglite'),{createStore}=require('../store'),{createApp}=require('../server');
(async()=>{
 const db=new PGlite();let queue=Promise.resolve();const pool={async connect(){const before=queue;let release;queue=new Promise(r=>release=r);await before;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};
 const store=createStore(pool);await store.init();const runtime=createApp({store,sweepInterval:100,config:{url:'http://localhost',key:'test-public-key'},verifyUser:async token=>token==='game-teacher-token'?{id:'game-teacher',email:'teacher@example.com'}:null});runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');let browser;
 try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN});const host=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];host.on('pageerror',e=>errors.push(e.message));
 await host.route('**/auth-client.js',route=>route.fulfill({contentType:'text/javascript',body:`window.createOnScreenAuth=()=>({auth:{async getSession(){return {data:{session:{access_token:'game-teacher-token'}}}}}});`}));
 const base='http://127.0.0.1:'+runtime.server.address().port;
 await host.goto(base+'/game-library.html');
 const sample=host.locator('.game-card').filter({hasText:'Sample Game: Easy Quiz'});
 await sample.waitFor();assert.equal(await sample.count(),1);
 assert.equal(await host.getByRole('button',{name:'Add sample game'}).count(),0);
 await host.locator('#new-game').click();await host.locator('#title').fill('Browser game');await host.locator('#questions textarea').first().fill('Which is correct?');const inputs=host.locator('.option-edit input:not([type=radio])');for(let i=0;i<4;i++)await inputs.nth(i).fill('Choice '+(i+1));await host.locator('.option-edit input[type=radio]').first().check();
 await host.locator('#add-question').click();
 const nextQuestion=host.locator('#questions .question-card').nth(1);
 await nextQuestion.locator('textarea').first().fill('What is 1 plus 1?');
 for(let i=0;i<4;i++)await nextQuestion.locator('.option-edit input:not([type=radio])').nth(i).fill(String(i+2));
 await nextQuestion.locator('.option-edit input[type=radio]').first().check();
 await host.locator('#save-game').click();
 const custom=host.locator('.game-card').filter({hasText:'Browser game'});
 const popup=host.waitForEvent('popup');await custom.getByRole('button',{name:'Launch Game'}).click();const classroom=await popup;classroom.on('pageerror',e=>errors.push(e.message));await host.waitForURL('**/game-host.html?session=*');assert.equal(await host.locator('#pin,#qr').count(),0);await classroom.locator('#pin').filter({hasText:/\d{6}/}).waitFor();const pin=await classroom.locator('#pin').textContent();await classroom.locator('#qr').waitFor();
 // A copied viewer URL cannot control the game, even from another tab in this same profile.
 assert.equal((new URL(classroom.url())).hash.split('/').length,2);
 const viewer=await host.context().newPage();
 await viewer.goto(classroom.url());await viewer.locator('#qr').waitFor();
 await viewer.waitForTimeout(1800);
 assert.equal(await viewer.locator('#classroom-advance').isVisible(),false);
 await viewer.close();
 await classroom.getByRole('button',{name:'Enable sound'}).click();
 await classroom.getByRole('button',{name:'Mute sound'}).waitFor();
 await classroom.getByRole('slider',{name:'Volume'}).fill('25');
 const player=await browser.newPage({viewport:{width:360,height:640}});player.on('pageerror',e=>errors.push(e.message));await player.goto(base+'/game-player.html');await player.locator('#join-pin').fill(pin);await player.locator('#nickname').fill('Test player');await player.locator('[data-avatar="avatar-12"]').click();await player.locator('#join-form .primary').click();await player.locator('#play-area:not([hidden])').waitFor();await classroom.getByRole('button',{name:'Start Game',exact:true}).click();await player.locator('button.choice').first().waitFor();
 await classroom.locator('#stage[data-phase=question]').waitFor();
 for(const page of [classroom,player]){
  await page.locator('#round-timer:not([hidden])').waitFor();
  assert.match(await page.locator('#round-timer .round-timer-value').textContent(),/^\d+$/);
  assert.equal(await page.locator('#round-timer .round-timer-label').textContent(),'SECONDS LEFT');
 }
 assert.equal(await player.locator('#game-audio-controls').count(),0);assert.equal(await player.locator('#game-title,.player-note,.roster').count(),0);assert.equal(await player.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true);const layout=await player.locator('#stage').evaluate(n=>({content:n.scrollHeight,box:n.clientHeight}));assert.ok(layout.content<=layout.box+1);await player.locator('button.choice').first().click();await player.getByText(/Correct! \+/).waitFor();
 await player.locator('#round-timer').waitFor({state:'hidden'});await classroom.getByRole('button',{name:'Show Leaderboard',exact:true}).click();await player.getByText('Your place: #1').waitFor();
 await classroom.locator('#celebration:not([hidden]) .celebration-name').filter({hasText:'Test player'}).waitFor();
 assert.equal(await player.locator('.rankings').count(),0);assert.match(await player.locator('#score').textContent(),/pts/);const score=await player.locator('#score').textContent();
 await player.reload();await player.getByText('Your place: #1').waitFor();assert.equal(await player.locator('.rankings').count(),0);assert.equal(await player.locator('#score').textContent(),score);await classroom.getByRole('button',{name:'Next Question',exact:true}).click();
 await player.getByText('What is 1 plus 1?',{exact:true}).waitFor();
 await player.locator('button.choice').first().click();
 await player.getByText(/Correct! \+/).waitFor();
 await classroom.getByRole('button',{name:'Show Leaderboard',exact:true}).click();
 await classroom.getByRole('button',{name:'Show Podium',exact:true}).click();await player.getByText('Final place: #1').waitFor();await classroom.locator('.podium-place[data-place="1"] .player-avatar').waitFor();
 await classroom.locator('#stage > .celebration-beams').waitFor();assert.equal(await player.locator('.podium').count(),0);assert.deepEqual(errors,[]);
 console.log('Game browser flow passed: library creation, join/avatar, countdown, answer, leaderboard, reload/score, podium.');
 }finally{if(browser)await browser.close();await runtime.close();await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
