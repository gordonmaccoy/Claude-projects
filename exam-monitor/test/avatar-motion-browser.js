// Local-only CSS/layout check: CHROME_BIN=/usr/bin/chromium node test/avatar-motion-browser.js
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),express=require('express');
(async()=>{
 const app=express();app.use(express.static(path.join(__dirname,'../public')));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN});const page=await browser.newPage();
  const base='http://127.0.0.1:'+server.address().port;
  const ids=require('../public/game-avatars').ids;
  for(const width of [360,1920]){
   await page.setViewportSize({width,height:width===360?800:1080});await page.goto(base+'/motion-test');
   await page.setContent(`<style>${fs.readFileSync(path.join(__dirname,'../public/game.css'),'utf8')}\n${fs.readFileSync(path.join(__dirname,'../public/game-avatar-motion.css'),'utf8')}</style><main><div class="avatar-picker">${ids.map(id=>`<button aria-label="${id}"><img src="${base}/game-avatars/${id}-thumb.webp"></button>`).join('')}</div><img class="player-avatar feature-avatar" style="width:180px;height:180px;margin:16px" src="${base}/game-avatars/avatar-50-feature.webp"></main>`);
   await page.emulateMedia({reducedMotion:'no-preference'});
   const result=await page.locator('.avatar-picker img').evaluateAll(imgs=>imgs.map(n=>{const s=getComputedStyle(n);return {name:s.animationName,duration:s.animationDuration};}));
   assert.equal(result.length,50);assert.ok(result.every(r=>r.name.startsWith('examio-avatar-')));assert.equal(new Set(result.map(r=>r.name)).size,3);assert.equal(new Set(result.map(r=>r.duration)).size,5);
   const before=await page.locator('.avatar-picker button').first().boundingBox();await page.waitForTimeout(250);assert.deepEqual(await page.locator('.avatar-picker button').first().boundingBox(),before);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.emulateMedia({reducedMotion:'reduce'});assert.ok(await page.locator('.player-avatar,.avatar-picker img').evaluateAll(imgs=>imgs.every(n=>getComputedStyle(n).animationName==='none'&&getComputedStyle(n).transform==='none')));
  }
  console.log('Avatar motion: all 50, varied timing, stable phone/projector layout, reduced motion passed.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
