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
 const SCORE_MS=root.GameClient?.SCORE_DURATION_MS??1020;
 function scoreSoundWindow(view,received,now){
  if(view?.phase!=='leaderboard'||![view.scoreStartsAt,view.serverNow].every(Number.isFinite))return null;
  const delta=view.scoreStartsAt-(view.serverNow+Math.max(0,now-received));
  if(delta<=-SCORE_MS)return null;
  return {startIn:Math.max(0,delta),elapsed:Math.max(0,-delta),endIn:delta+SCORE_MS};
 }
 function futurePodiumCues(view,received,now){
  if(view?.phase!=='podium'||!Number.isFinite(view.serverNow)||!Array.isArray(view.podiumSchedule))return [];
  const serverNow=view.serverNow+Math.max(0,now-received);
  return view.podiumSchedule.filter(x=>Number.isFinite(x.at)&&x.at>=serverNow&&[1,2,3].includes(x.rank))
   .map(x=>({rank:x.rank,startIn:x.at-serverNow}));
 }
 const phaseOrder=['lobby','media','countdown','question','reveal','leaderboard','podium','closed'];
 function isStaleView(next,previous){
  if(!previous||next.id!==previous.id||!Number.isFinite(next.serverNow)||!Number.isFinite(previous.serverNow))return false;
  if(next.serverNow<previous.serverNow||next.questionIndex<previous.questionIndex)return true;
  return next.questionIndex===previous.questionIndex&&phaseOrder.indexOf(next.phase)<phaseOrder.indexOf(previous.phase);
 }
 function freshGong(previous,next){
  return Boolean(previous&&next.id===previous.id&&previous.questionIndex===next.questionIndex&&
    ['countdown','question'].includes(previous.phase)&&['reveal','leaderboard'].includes(next.phase)&&
    ['timeout','all-answered'].includes(next.roundEndReason)&&Number.isFinite(next.roundEndedAt)&&
    next.serverNow>=next.roundEndedAt&&next.serverNow-next.roundEndedAt<=3500);
 }
 function webEngine(){
  const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)throw new Error('Sound is not supported by this browser.');
  const ctx=new Audio(),master=ctx.createGain(),compressor=ctx.createDynamicsCompressor();master.gain.value=.35;master.connect(compressor);compressor.connect(ctx.destination);
  let bus=null,timer=null,closeTimer=null,nodes=new Set(),activeKey=null;
  const noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.25),ctx.sampleRate);const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
  function stop(){clearInterval(timer);clearTimeout(closeTimer);timer=null;closeTimer=null;activeKey=null;if(bus){bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setValueAtTime(0,ctx.currentTime);bus.disconnect();bus=null;}for(const n of nodes){try{n.stop();n.disconnect();}catch{}}nodes.clear();}
  function source(n,g,start,end){n.connect(g);g.connect(bus);nodes.add(n);n.onended=()=>{nodes.delete(n);n.disconnect();g.disconnect();};n.start(start);n.stop(end);}
  function tone(midi,t,duration,level,wave='triangle',attack=.008){const o=ctx.createOscillator(),g=ctx.createGain();o.type=wave;o.frequency.value=440*2**((midi-69)/12);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+duration);source(o,g,t,t+duration+.01);}
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
  function loop(key,score,window){
   if(activeKey===key)return;stop();activeKey=key;bus=ctx.createGain();bus.gain.value=.7;bus.connect(master);
   const chords=score?[[48,55,59,64],[43,50,57,62],[45,52,60,64],[41,48,57,60]]
    :[[48,55,60,64],[50,57,62,65],[45,52,57,60],[43,50,58,62]];
   const main=score?[[72,,76,,79,,,76],[74,,,77,79,,,77],[72,,76,,,81,,79],[72,,,76,77,,,74]]
    :[[72,76,79,,84,79,76,74],[74,,77,81,84,,81,77],[72,76,81,84,,81,79,76],[74,,77,,82,79,77,74]];
   const step=60/(score?104:128)/2,origin=ctx.currentTime+.025;let cursor=0;
   function schedule(){cursor=Math.max(cursor,Math.ceil((ctx.currentTime-origin)/step));while(origin+cursor*step<ctx.currentTime+.16){const t=origin+cursor*step,n=cursor%8,bar=Math.floor(cursor/8)%chords.length,c=chords[bar];if(t>=ctx.currentTime){
    if(n%4===0){kick(t);tone(c[0],t,step*2.9,.16,'triangle');}
    if(n===2||n===6)hiss(t,true);else if(!score||n%2===0)hiss(t,false);
    if(n===1||n===5)for(const note of c.slice(1))tone(note,t,step*1.3,.025,'triangle',.02);
    const note=main[bar][n];if(note)tone(note,t,step*(score?1.8:1.2),score?.045:.08,'triangle');
   }cursor++;}}
   schedule();timer=setInterval(schedule,25);
   if(window){
    const start=ctx.currentTime+(window.startIn-window.elapsed)/1000;
    for(let i=0;i<16;i++){
     const t=start+i*.063;if(t<ctx.currentTime+.007)continue;
     const pitch=84+[0,5,7,10,12,10,14,17][i%8];
     tone(pitch,t,.075,.075,'square',.004);tone(pitch-12,t,.055,.055,'triangle',.004);
    }
   }
  }
  function lobby(key){loop(key,false);}
  function scoreboard(key,window){loop(key,true,window);}
  function fanfare(kind,t){const notes=kind==='podium'?[60,64,67,72,67,72,76,79]:[67,71,74,79];notes.forEach((n,i)=>{tone(n,t+i*.12,.32,.16,'triangle');tone(n-12,t+i*.12,.35,.07,'sine');});return notes.length*.12+.5;}
  function gong(t){
   // Inharmonic partials give a struck metal onset and warmly decaying body.
   [[38,.26,1.3],[45.3,.16,1.01],[52.8,.12,.9],[59.2,.08,.64],[64.9,.055,.48],[72.4,.045,.24],[81.1,.024,.15]].forEach(([pitch,level,length])=>tone(pitch,t,length,level,'sine',.006));
  }
  function cue(kind,followup){
   stop();bus=ctx.createGain();bus.gain.value=.8;bus.connect(master);const t=ctx.currentTime+.015;
   let tail;
   if(kind==='gong'){
    gong(t);tail=1.36;
    if(followup)tail=Math.max(tail,.42+fanfare(followup,t+.42));
   }else tail=fanfare(kind,t);
   closeTimer=setTimeout(stop,Math.ceil(tail*1000));
  }
  function overlay(kind,delay=0){if(!bus)return;const t=ctx.currentTime+Math.max(.015,delay/1000);if(kind==='gong')gong(t);else fanfare(kind,t);}
  function podium(key,placements,finale){
   if(activeKey===key)return;stop();activeKey=key;bus=ctx.createGain();bus.gain.value=.78;bus.connect(master);
   if(!placements.length)return;
   const origin=ctx.currentTime;
   for(const {rank,startIn} of placements){
    const t=origin+Math.max(.015,startIn/1000);
    for(let i=0;i<(rank===1?27:17);i++){
     hiss(t+i*.047+Math.random()*.036,i%3===0);
    }
    const notes=rank===3?[64,67,72]:rank===2?[65,69,74]:[60,67,72,76,79,84];
    notes.forEach((note,i)=>{tone(note,t+i*.112,.39,rank===1?.16:.10,'triangle');if(rank===1)tone(note-12,t+i*.112,.52,.09,'sine');});
   }
   const tail=Math.max(...placements.map(x=>x.startIn))+(finale?1900:1500);
   closeTimer=setTimeout(stop,tail);
  }
  return {resume:()=>ctx.resume(),volume:v=>master.gain.setTargetAtTime(v,ctx.currentTime,.02),question,lobby,scoreboard,podium,cue,overlay,stop,dispose(){stop();ctx.close();}};
 }
 function create({button,slider},env={}){
  const now=env.now||Date.now;let storage=env.storage;if(storage===undefined)try{storage=root.localStorage;}catch{}let prefs={volume:.35};try{prefs={...prefs,...JSON.parse(storage?.getItem('examio-game-audio')||'{}')};}catch{}
  let volume=Number.isFinite(Number(prefs.volume))?Math.max(0,Math.min(1,Number(prefs.volume))):.35,enabled=false,engine=null,view=null,received=0,session=null,pick=shuffleBag(),selected=new Map(),lastCue=null,destroyed=false,mode=null;
  function label(){button.textContent=enabled?'Mute sound':'Enable sound';button.setAttribute('aria-pressed',String(enabled));}
  function save(){try{storage?.setItem('examio-game-audio',JSON.stringify({volume}));}catch{}}
  function sync(cue,gong=false){
   if(!engine)return;
   if(!enabled||volume===0){if(mode)engine.stop();mode=null;return;}
   engine.volume(volume);if(!view)return;
   if(view.phase==='lobby'){
    if(mode!=='lobby'){mode='lobby';engine.lobby(view.id+':lobby');}
    return;
   }
   const window=windowFor(view,received,now());
   if(window){
    const key=view.id+':'+view.questionIndex;
    if(!selected.has(key))selected.set(key,pick());
    if(mode!==key){mode=key;engine.question(key,selected.get(key),window,Math.max(0,view.serverNow+now()-received-view.startsAt));}
    return;
   }
   if(view.phase==='leaderboard'&&Number.isFinite(view.scoreStartsAt)&&engine.scoreboard){
    const key=view.id+':scores:'+view.questionIndex, sound=scoreSoundWindow(view,received,now());
    if(mode!==key){mode=key;engine.scoreboard(key,sound);}
    if(gong)engine.overlay?.('gong');
    if(cue==='lead')engine.overlay?.('lead',sound?.endIn??0);
    return;
   }
   if(view.phase==='podium'&&Array.isArray(view.podiumSchedule)&&engine.podium){
    const key=view.id+':podium:'+view.questionIndex;
    if(mode!==key){mode=key;const future=futurePodiumCues(view,received,now());engine.podium(key,future,future.some(x=>x.rank===1));}
    return;
   }
   const roundClosed=['reveal','leaderboard','podium'].includes(view.phase);
   if(mode&&(mode!=='cue'||!roundClosed)){engine.stop();mode=null;}
   if(gong||cue){mode='cue';if(gong&&cue)engine.cue('gong',cue);else engine.cue(gong?'gong':cue);}
  }
  label();slider.min='0';slider.max='100';slider.step='1';slider.value=String(Math.round(volume*100));
  button.addEventListener('click',async()=>{if(destroyed)return;if(enabled){enabled=false;mode=null;engine?.stop();label();return;}try{if(!engine)engine=(env.engine||webEngine)();await engine.resume();if(destroyed)return;enabled=true;label();sync();}catch{enabled=false;button.textContent='Sound unavailable';button.setAttribute('aria-pressed','false');}});
  slider.addEventListener('input',()=>{volume=Math.max(0,Math.min(1,Number(slider.value)/100));save();sync();});
  return {update(next,cue){
   if(destroyed||isStaleView(next,view))return;
   if(next.id!==session){session=next.id;pick=shuffleBag();selected=new Map();lastCue=null;mode=null;engine?.stop();}
   const gong=freshGong(view,next);
   if((cue==='lead'&&next.phase==='leaderboard')||(cue==='podium'&&next.phase==='podium')){
    const key=next.id+':'+next.questionIndex+':'+cue;if(lastCue===key)cue=null;else lastCue=key;
   }else cue=null;
   view=next;received=now();sync(cue,gong);
  },stop(){destroyed=true;if(engine?.dispose)engine.dispose();else engine?.stop();enabled=false;label();}};
 }
 const api={create,tracks,shuffleBag,windowFor,isStaleView,scoreSoundWindow,futurePodiumCues};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.GameAudio=api;
})(typeof window==='undefined'?globalThis:window);
