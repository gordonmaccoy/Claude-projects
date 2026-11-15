const test=require('node:test'),assert=require('node:assert/strict');
const audio=require('../public/game-audio');
const fs=require('node:fs');
const path=require('node:path');
test('applause is 50 percent longer with room for a separate gold fanfare',()=>{
 const events=audio.podiumSoundEvents([{rank:3,startIn:1900},{rank:2,startIn:5500},{rank:1,startIn:10700}]);
 assert.deepEqual(events.filter(e=>e.kind==='cheer').map(e=>e.duration),[2.025,2.025,4.8]);
 const silver=events.find(e=>e.rank===2),fanfare=events.find(e=>e.kind==='fanfare');
 assert.ok(fanfare.startIn>silver.startIn+silver.duration*1000);
 assert.equal(audio.showSounds.cheer.duration,4.8);
 const bytes=fs.readFileSync(path.join(__dirname,'../public/game-sounds/podium-cheering.mp3'));
 assert.equal(bytes.subarray(0,3).toString(),'ID3');assert.ok(bytes.length>70000,'full-length local MP3 asset is packaged');
});
function setup(){let now=0,id=0;const timers=new Map(),calls=[];
 const button={setAttribute(){},addEventListener(_,fn){this.click=fn;}},slider={addEventListener(_,fn){this.input=fn;}};
 const engine={resume:async()=>{},volume:v=>calls.push(['volume',v]),stop:()=>calls.push(['stop']),podium:(...a)=>calls.push(['podium',...a]),scoreboard:(...a)=>calls.push(['music',...a])};
 const ctl=audio.create({button,slider},{storage:null,now:()=>now,engine:()=>engine,setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)});
 const update=(time,phase='podium')=>{now=time;ctl.update({id:'s',questionIndex:2,phase,serverNow:time,podiumSchedule:[{rank:1,at:3500}],podiumCompleteAt:8500});};
 const advance=time=>{now=time;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}};
 return {ctl,button,slider,calls,update,advance,timers};}
test('post-podium music starts at complete without a new poll, once, without ticks; stops on exit',async()=>{
 const x=setup();x.update(0);await x.button.click();assert.equal(x.calls.filter(c=>c[0]==='podium').length,1);
 x.advance(8499);assert.equal(x.calls.filter(c=>c[0]==='music').length,0);
 x.advance(8500);assert.deepEqual(x.calls.filter(c=>c[0]==='music'),[['music','s:podium:2:music',null]]);
 x.update(8490);assert.equal(x.calls.filter(c=>c[0]==='podium').length,1,'late in-flight view cannot restart ceremony');
 x.update(8600);x.advance(15000);assert.equal(x.calls.filter(c=>c[0]==='music').length,1);
 x.update(16000,'closed');assert.equal(x.calls.at(-1)[0],'stop');assert.equal(x.timers.size,0);x.ctl.stop();
});
test('mute, zero volume and disposal cancel pending music; late enable starts music not cheers',async()=>{
 const x=setup();x.update(0);await x.button.click();await x.button.click();x.advance(9000);assert.equal(x.calls.filter(c=>c[0]==='music').length,0);
 await x.button.click();assert.equal(x.calls.filter(c=>c[0]==='music').length,1);assert.equal(x.calls.filter(c=>c[0]==='podium').length,1);
 x.slider.value='0';x.slider.input();assert.equal(x.calls.at(-1)[0],'stop');x.slider.value='60';x.slider.input();assert.equal(x.calls.filter(c=>c[0]==='music').length,2);assert.ok(x.calls.some(c=>c[0]==='volume'&&c[1]===.6));x.ctl.stop();assert.equal(x.timers.size,0);
 const y=setup();y.update(0);await y.button.click();y.ctl.stop();y.advance(9000);assert.equal(y.calls.filter(c=>c[0]==='music').length,0);
});
test('native sample tails and obsolete podium stop timer cannot tear down the music loop',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');let now=0,id=0;const timeouts=new Map(),intervals=new Map(),sources=[],gains=[];
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}});
 const source=()=>{const n={frequency:param(),connect(){},disconnect(){},start(t){this.started=t;},stop(t){(this.stops??=[]).push(t);}};sources.push(n);return n;};
 class Context{constructor(){this.currentTime=0;this.sampleRate=100;this.destination={};}createGain(){const g={gain:param(),connect(){},disconnect(){this.disconnected=true;}};gains.push(g);return g;}createDynamicsCompressor(){return {connect(){}};}createBuffer(){return {getChannelData:()=>new Float32Array(25)};}createBufferSource(){return source();}createOscillator(){return source();}createBiquadFilter(){return {frequency:param(),connect(){},disconnect(){}};}decodeAudioData(){return Promise.resolve({duration:4.8});}resume(){return Promise.resolve();}close(){return Promise.resolve();}}
 const later=(fn,ms)=>{timeouts.set(++id,{fn,ms});return id;};
 const context={AudioContext:Context,document:{},fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}),AbortController,Date,Math,setTimeout:later,clearTimeout:i=>timeouts.delete(i),setInterval:fn=>{intervals.set(++id,fn);return id;},clearInterval:i=>intervals.delete(i)};context.window=context;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/game-audio.js'),'utf8'),context);
 const button={setAttribute(){},addEventListener(_,fn){this.click=fn;}},slider={addEventListener(){}};
 const ctl=context.GameAudio.create({button,slider},{storage:null,now:()=>now});await button.click();await new Promise(r=>setImmediate(r));
 ctl.update({id:'s',phase:'podium',questionIndex:0,serverNow:0,podiumSchedule:[{rank:3,at:1900},{rank:2,at:5500},{rank:1,at:10700}],podiumCompleteAt:15700});
 const clips=sources.filter(n=>n.buffer?.duration);
 assert.equal(clips.length,4);assert.ok(clips.some(n=>Math.abs(n.stops[0]-n.started-4.8)<.00001));assert.equal(clips.filter(n=>Math.abs(n.stops[0]-n.started-2.025)<.00001).length,2);
 const oldStop=[...timeouts.values()].find(t=>t.ms===15550).fn;
 now=15700;ctl.update({id:'s',phase:'podium',questionIndex:0,serverNow:15700,podiumSchedule:[{rank:1,at:10700}],podiumCompleteAt:15700});
 assert.equal(intervals.size,1);const musicBus=gains.findLast(g=>g.gain.value===.7);assert.ok(musicBus);oldStop();assert.equal(intervals.size,1);assert.notEqual(musicBus.disconnected,true);
 // The score music creates percussion/melody, but never the square-wave coin tick overlay.
 assert.ok(sources.filter(n=>!n.buffer).every(n=>n.type!=='square'));ctl.stop();assert.equal(intervals.size,0);
});
