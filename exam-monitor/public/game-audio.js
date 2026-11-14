/* Original Examio compositions. Web Audio only; no downloads, trackers or student audio. */
(function(root){
 'use strict';
 const tracks=[
  {name:'Neon Pursuit',bpm:142,root:45,wave:'sawtooth',notes:[0,7,12,7,3,10,15,10,5,12,17,12,7,14,19,14],bass:[0,0,3,5],hat:2},
  {name:'Pulse Reactor',bpm:156,root:38,wave:'square',notes:[0,12,7,15,0,10,7,12,5,17,12,19,3,15,10,17],bass:[0,5,3,7],hat:1},
  {name:'Midnight Circuit',bpm:132,root:42,wave:'triangle',notes:[12,7,0,7,10,5,0,5,15,10,3,10,14,9,2,9],bass:[0,-2,3,2],hat:2},
  {name:'Final Chase',bpm:168,root:43,wave:'sawtooth',notes:[0,3,7,10,12,10,7,3,5,8,12,15,14,10,7,2],bass:[0,3,5,7],hat:1}
 ];
 function shuffleBag(random=Math.random){let bag=[],last;return ()=>{if(!bag.length){bag=[0,1,2,3];for(let i=3;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}if(bag[bag.length-1]===last)[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];}return last=bag.pop();};}
 function windowFor(view,received,now){if(!view||!['countdown','question'].includes(view.phase)||![view.startsAt,view.deadlineAt,view.serverNow].every(Number.isFinite))return null;const serverNow=view.serverNow+Math.max(0,now-received);if(view.deadlineAt<=serverNow||view.deadlineAt<=view.startsAt)return null;return {startIn:Math.max(0,view.startsAt-serverNow),endIn:view.deadlineAt-serverNow};}
 function webEngine(){
  const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)throw new Error('Sound is not supported by this browser.');
  const ctx=new Audio(),master=ctx.createGain(),compressor=ctx.createDynamicsCompressor();master.gain.value=.35;master.connect(compressor);compressor.connect(ctx.destination);
  let bus=null,timer=null,closeTimer=null,nodes=new Set(),activeKey=null;
  const noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.25),ctx.sampleRate);const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
  function stop(){clearInterval(timer);clearTimeout(closeTimer);timer=null;closeTimer=null;activeKey=null;if(bus){bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setValueAtTime(0,ctx.currentTime);bus.disconnect();bus=null;}for(const n of nodes){try{n.stop();n.disconnect();}catch{}}nodes.clear();}
  function source(n,g,start,end){n.connect(g);g.connect(bus);nodes.add(n);n.onended=()=>{nodes.delete(n);n.disconnect();g.disconnect();};n.start(start);n.stop(end);}
  function tone(midi,t,duration,level,wave='triangle'){const o=ctx.createOscillator(),g=ctx.createGain();o.type=wave;o.frequency.value=440*2**((midi-69)/12);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);source(o,g,t,t+duration+.01);}
  function kick(t){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(42,t+.14);g.gain.setValueAtTime(.7,t);g.gain.exponentialRampToValueAtTime(.0001,t+.22);source(o,g,t,t+.23);}
  function hiss(t,snare){const n=ctx.createBufferSource(),g=ctx.createGain(),filter=ctx.createBiquadFilter();n.buffer=noise;filter.type='highpass';filter.frequency.value=snare?1300:6500;n.connect(filter);filter.connect(g);g.connect(bus);nodes.add(n);n.onended=()=>{nodes.delete(n);n.disconnect();filter.disconnect();g.disconnect();};g.gain.setValueAtTime(snare?.2:.07,t);g.gain.exponentialRampToValueAtTime(.0001,t+(snare?.14:.045));n.start(t);n.stop(t+(snare?.15:.05));}
  function question(key,index,window,elapsed){
   if(activeKey===key)return;stop();activeKey=key;bus=ctx.createGain();bus.connect(master);
   const start=ctx.currentTime+window.startIn/1000,end=ctx.currentTime+window.endIn/1000;
   // Audio-thread automation enforces silence at deadline even if JS timers stall.
   bus.gain.setValueAtTime(0,ctx.currentTime);bus.gain.setValueAtTime(.8,start);bus.gain.setValueAtTime(0,end);
   const track=tracks[index],step=60/track.bpm/4,origin=start-Math.max(0,elapsed)/1000;let cursor=Math.max(0,Math.ceil((ctx.currentTime-origin)/step));
   function schedule(){if(!bus||ctx.currentTime>=end){stop();return;}while(origin+cursor*step<Math.min(end,ctx.currentTime+.16)){const t=origin+cursor*step,n=cursor%16,bar=Math.floor(cursor/16)%4;if(t>=ctx.currentTime&&t>=start){tone(track.root+12+track.notes[n],t,step*.8,.09,track.wave);if(n%4===0){kick(t);tone(track.root+track.bass[bar],t,step*3.2,.26,'triangle');}if(n%8===4)hiss(t,true);if(n%track.hat===0)hiss(t,false);if(n===0)for(const interval of [0,3,7])tone(track.root+24+track.bass[bar]+interval,t,step*12,.018,'sine');}cursor++;}}
   schedule();timer=setInterval(schedule,25);closeTimer=setTimeout(stop,window.endIn+30);
  }
  function cue(kind){stop();bus=ctx.createGain();bus.gain.value=.8;bus.connect(master);const now=ctx.currentTime+.015,notes=kind==='podium'?[60,64,67,72,67,72,76,79]:[67,71,74,79];notes.forEach((n,i)=>{tone(n,now+i*.12,.32,.16,'triangle');tone(n-12,now+i*.12,.35,.07,'sine');});closeTimer=setTimeout(stop,notes.length*120+500);}
  return {resume:()=>ctx.resume(),volume:v=>master.gain.setTargetAtTime(v,ctx.currentTime,.02),question,cue,stop,dispose(){stop();ctx.close();}};
 }
 function create({button,slider},env={}){
  const now=env.now||Date.now;let storage=env.storage;if(storage===undefined)try{storage=root.localStorage;}catch{}let prefs={volume:.35};try{prefs={...prefs,...JSON.parse(storage?.getItem('examio-game-audio')||'{}')};}catch{}
  let volume=Number.isFinite(Number(prefs.volume))?Math.max(0,Math.min(1,Number(prefs.volume))):.35,enabled=false,engine=null,view=null,received=0,session=null,pick=shuffleBag(),selected=new Map(),lastCue=null,destroyed=false,mode=null;
  function label(){button.textContent=enabled?'Mute sound':'Enable sound';button.setAttribute('aria-pressed',String(enabled));}
  function save(){try{storage?.setItem('examio-game-audio',JSON.stringify({volume}));}catch{}}
  function sync(cue){if(!engine)return;if(!enabled||volume===0){engine.stop();mode=null;return;}engine.volume(volume);if(!view)return;const window=windowFor(view,received,now());if(window){const key=view.id+':'+view.questionIndex;if(!selected.has(key))selected.set(key,pick());mode='question';engine.question(key,selected.get(key),window,Math.max(0,view.serverNow+now()-received-view.startsAt));return;}if(mode==='question'||!['reveal','leaderboard','podium'].includes(view.phase)){engine.stop();mode=null;}if((cue==='lead'&&['reveal','leaderboard'].includes(view.phase))||(cue==='podium'&&view.phase==='podium')){const key=view.id+':'+view.questionIndex+':'+cue;if(lastCue!==key){lastCue=key;mode='cue';engine.cue(cue);}}}
  label();slider.min='0';slider.max='100';slider.step='1';slider.value=String(Math.round(volume*100));
  button.addEventListener('click',async()=>{if(destroyed)return;if(enabled){enabled=false;mode=null;engine?.stop();label();return;}try{if(!engine)engine=(env.engine||webEngine)();await engine.resume();if(destroyed)return;enabled=true;label();sync();}catch{enabled=false;button.textContent='Sound unavailable';button.setAttribute('aria-pressed','false');}});
  slider.addEventListener('input',()=>{volume=Math.max(0,Math.min(1,Number(slider.value)/100));save();sync();});
  return {update(next,cue){if(destroyed)return;if(next.id!==session){session=next.id;pick=shuffleBag();selected=new Map();lastCue=null;mode=null;engine?.stop();}view=next;received=now();sync(cue);},stop(){destroyed=true;if(engine?.dispose)engine.dispose();else engine?.stop();enabled=false;label();}};
 }
 const api={create,tracks,shuffleBag,windowFor};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.GameAudio=api;
})(typeof window==='undefined'?globalThis:window);
