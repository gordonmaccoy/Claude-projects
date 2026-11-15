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
 await host.locator('#new-game').click();await host.locator('#create-title').fill('Browser game');await host.locator('#create-manual').click();await host.locator('#title').fill('Browser game');await host.locator('#questions textarea').first().fill('Which is correct?');const inputs=host.locator('.option-edit input:not([type=radio])');for(let i=0;i<4;i++)await inputs.nth(i).fill('Choice '+(i+1));await host.locator('.option-edit input[type=radio]').first().check();
 await host.locator('#add-question').click();
 const nextQuestion=host.locator('#questions .question-card').nth(1);
 await nextQuestion.locator('textarea').first().fill('What is 1 plus 1?');
 for(let i=0;i<4;i++)await nextQuestion.locator('.option-edit input:not([type=radio])').nth(i).fill(String(i+2));
 await nextQuestion.locator('.option-edit input[type=radio]').first().check();
 await nextQuestion.getByRole('button',{name:'+ Add choice',exact:true}).click();
 await nextQuestion.getByRole('textbox',{name:'Answer E'}).fill('6');
 await nextQuestion.locator('input[type=number]').fill('5');
 await host.locator('#add-question').click();
 const lastQuestion=host.locator('#questions .question-card').nth(2);
 await lastQuestion.locator('textarea').first().fill('Choose the first answer.');
 await lastQuestion.locator('.option-edit button').last().click();
 await lastQuestion.locator('.option-edit button').last().click();
 await lastQuestion.getByRole('textbox',{name:'Answer A'}).fill('First');
 await lastQuestion.getByRole('textbox',{name:'Answer B'}).fill('Second');
 await lastQuestion.locator('.option-edit input[type=radio]').first().check();
 await host.locator('#save-game').click();
 const custom=host.locator('.game-card').filter({hasText:'Browser game'});
 assert.equal(await host.locator('#active-section #launch-large-class').isChecked(),false);await host.locator('#launch-large-class').check();
 await custom.getByRole('button',{name:'Launch Game'}).click();
 assert.equal(await host.locator('#launch-require-names').isChecked(),true);
 const popup=host.waitForEvent('popup');await host.locator('#confirm-launch').click();const classroom=await popup;classroom.on('pageerror',e=>errors.push(e.message));await host.waitForURL('**/game-library.html?session=*');await host.locator('#active-section #game-host-panel').waitFor();assert.equal(await host.locator('#pin,#qr').count(),0);await classroom.locator('#qr').waitFor();assert.equal(await classroom.locator('#pin,#pin-row').count(),0);const roomName=await classroom.locator('#room-name').textContent();assert.match(roomName,/^Game: [A-Za-z]+ [A-Za-z]+$/);
 await host.reload();await host.locator('#active-section #game-host-panel').waitFor();
 // A copied viewer URL cannot control the game, even from another tab in this same profile.
 assert.equal((new URL(classroom.url())).hash.split('/').length,2);
 const viewer=await host.context().newPage();
 await viewer.goto(classroom.url());await viewer.locator('#qr').waitFor();
 await viewer.waitForTimeout(1800);
 assert.equal(await viewer.locator('#classroom-advance').isVisible(),false);
 await viewer.close();
 const enlarge=classroom.getByRole('button',{name:'Enlarge join QR code'}),qrDialog=classroom.getByRole('dialog',{name:'Scan to join the game'});
 await classroom.getByRole('heading',{name:'Waiting for game to start'}).waitFor();
 await enlarge.click();
 await qrDialog.waitFor();
 assert.equal(await classroom.locator('#join-qr-enlarged').getAttribute('src'),await classroom.locator('#qr').getAttribute('src'));
 await classroom.keyboard.press('Escape');await qrDialog.waitFor({state:'hidden'});
 const speaker=classroom.getByRole('button',{name:'Sound controls'});
 await speaker.click();
 await classroom.getByRole('button',{name:'Mute sound'}).waitFor();
 await classroom.getByRole('slider',{name:'Volume'}).fill('25');
 assert.equal(await classroom.locator('#game-volume').evaluate(el=>getComputedStyle(el).writingMode),'vertical-lr');
 await classroom.keyboard.press('Escape');
 assert.equal(await speaker.getAttribute('aria-expanded'),'false');
 const sessionId=new URL(host.url()).searchParams.get('session');
 async function joinPlayer(nickname,avatarId,viaRoomName=false){
  const page=await browser.newPage({viewport:{width:360,height:640}});page.on('pageerror',e=>errors.push(e.message));
  if(viaRoomName){
   await page.goto(base+'/');await page.locator('#room-name').fill(roomName);
   await page.locator('#room-join-form button').click();await page.waitForURL('**/game-player.html?session=*');
  }else{
   // The URL encoded by the projector QR.
   await page.goto(base+'/game-player.html?session='+encodeURIComponent(sessionId));
  }
  await page.locator('#nickname').fill(nickname);
  const avatars=page.locator('#avatar-picker button');await avatars.first().waitFor();assert.equal(await avatars.count(),30);
  if(viaRoomName){
   await page.locator('[data-avatar="avatar-12"].is-taken:disabled').waitFor();
   await page.locator('#avatar-next').click();assert.equal(await avatars.count(),20);
  }
  const picker=page.locator('[data-avatar="'+avatarId+'"]');
  await picker.click();
  const dialog=page.locator('#avatar-preview:visible');
  await dialog.locator('#avatar-preview-back').click();
  assert.equal(await picker.getAttribute('aria-pressed'),'false');
  await picker.click();
  await dialog.locator('#avatar-preview-confirm').click();
  assert.equal(await picker.getAttribute('aria-pressed'),'true');
  await page.locator('#join-form .primary').click();
  await page.locator('#play-area:not([hidden])').waitFor();
  return page;
 }
 const player=await joinPlayer('Alpha','avatar-12'), other=await joinPlayer('Beta','avatar-44',true);
 await classroom.getByText('2 players connected',{exact:true}).waitFor();
 const [startBox,soundBox,playerBox]=await Promise.all([
  classroom.locator('#classroom-advance').boundingBox(),speaker.boundingBox(),
  classroom.locator('.roster-player').first().boundingBox(),
 ]);
 assert.ok(Math.abs(startBox.x+startBox.width/2-classroom.viewportSize().width/2)<2,'Start is centered');
 assert.ok(soundBox.x>classroom.viewportSize().width*.9,'Sound control sits at far right');
 assert.ok(playerBox.width<=210,'Roster tiles do not stretch across the stage');
 const scores=()=>classroom.getByRole('button',{name:'Show Scores',exact:true});
 const next=()=>classroom.getByRole('button',{name:'Next Question',exact:true});
 async function round(prompt,count,choiceText,number) {
  const intro=number===1?'Get ready!':'Get ready for question '+number+'!';
  for(const page of [classroom,player]){
   await page.locator('#stage[data-phase=intro]').getByRole('heading',{name:intro,exact:true}).waitFor();
   const art=page.locator('#stage .intro-artwork img');
   assert.equal(await art.getAttribute('src'),'/game-intro/question-'+number+'.webp');
   assert.equal(await page.locator('#stage .choice').count(),0);
  }
  await classroom.locator('#stage[data-phase=countdown]').getByText(prompt,{exact:true}).waitFor();
  assert.equal(await classroom.locator('#stage .choice').count(),0);
  assert.equal(await player.locator('button.choice').count(),0);
  await classroom.locator('#stage[data-phase=question]').waitFor();
  await player.locator('button.choice').first().waitFor();
  assert.equal(await player.locator('button.choice').count(),count);
  assert.equal(await player.getByText(prompt,{exact:true}).count(),0);
  assert.equal(await player.getByText(choiceText,{exact:true}).count(),0);
  for(const page of [classroom,player]){
   await page.locator('#round-timer:not([hidden])').waitFor();
   assert.match(await page.locator('#round-timer .round-timer-value').textContent(),/^\d+$/);
   assert.equal(await page.locator('#round-timer .round-timer-label').textContent(),'SECONDS LEFT');
  }
  assert.equal(await player.locator('#game-audio-controls,#game-title,.player-note,.roster').count(),0);
  assert.equal(await player.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true);
  const layout=await player.locator('#stage').evaluate(n=>({content:n.scrollHeight,box:n.clientHeight}));assert.ok(layout.content<=layout.box+1);
 }
 await classroom.getByRole('button',{name:'Start Game',exact:true}).click();
 await round('Which is correct?',4,'Choice 1',1);
 await player.locator('button.choice').first().click();await other.locator('button.choice').nth(1).click();
 const closedHeading=classroom.locator('#stage[data-phase=responses-closed]').getByRole('heading',{name:'Responses closed'});
 await closedHeading.waitFor();
 assert.equal(await classroom.locator('.vote-panel').count(),0);
 assert.equal(await scores().isVisible(),false);
 await player.locator('#stage [data-result=correct]').waitFor();await other.locator('#stage [data-result=wrong]').waitFor();
 await classroom.locator('#stage[data-phase=reveal]').waitFor();
 const pollWidth=(await classroom.locator('.vote-panel').boundingBox()).width;
 assert.ok(pollWidth>classroom.viewportSize().width*.7,'projector poll fills most of the display');
 assert.deepEqual(await classroom.locator('.vote-count').allTextContents(),['1','1','0','0']);
 assert.match(await player.locator('#score').textContent(),/^0\b/);
 assert.equal(await player.locator('.round-earned').count(),0);
 assert.equal(await next().isVisible(),false);
 await scores().click();await player.getByText('Your place: #1').waitFor();
 await classroom.locator('#celebration:not([hidden]) .celebration-name').filter({hasText:'Alpha'}).waitFor();
 await next().waitFor();
 const score=await player.locator('#score').textContent();
 await player.reload();await player.getByText('Your place: #1').waitFor();assert.equal(await player.locator('#score').textContent(),score);
 await next().click();await round('What is 1 plus 1?',5,'6',2);
 await other.locator('button.choice').first().click();
 // Remaining player waits past the deadline; the same closure beat then precedes the poll.
 await closedHeading.waitFor();
 assert.equal(await classroom.locator('.vote-panel').count(),0);
 await player.locator('#stage [data-result=timeout]').waitFor();
 await scores().click();await classroom.locator('#stage[data-phase=leaderboard]').waitFor();
 await next().click();await round('Choose the first answer.',2,'First',3);
 await other.locator('button.choice').first().click();await player.locator('button.choice').nth(1).click();
 await closedHeading.waitFor();
 await classroom.locator('#stage[data-phase=reveal]').waitFor();
 await player.locator('#stage [data-result=wrong]').waitFor();
 assert.equal(await scores().isVisible(),false);
 assert.equal(await player.locator('#score').isVisible(),false);
 await classroom.getByRole('button',{name:'Show Podium',exact:true}).click();
 await player.locator('.player-rank-tile[data-place="2"]').waitFor();
 await classroom.locator('.podium-step[data-place="1"] .podium-medal[data-metal="gold"]').waitFor();
 assert.equal(await classroom.locator('.podium-step[data-place="1"] .podium-names strong').textContent(),'Beta');
 assert.equal(await player.locator('.podium,.rankings').count(),0);assert.deepEqual(errors,[]);
 console.log('Game browser flow passed: avatar confirmation, three choice counts, reading, player privacy, early and timeout reveal, scores, reconnect, rank swap and podium.');

 }finally{if(browser)await browser.close();await runtime.close();await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
