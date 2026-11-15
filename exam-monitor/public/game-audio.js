/* Examio's original background music and local classroom sound effects. */
(function(root){
 'use strict';
 const tracks=[
  {name:'Neon Pursuit',bpm:142,root:45,wave:'sawtooth',notes:[0,7,12,7,3,10,15,10,5,12,17,12,7,14,19,14],bass:[0,0,3,5],hat:2},
  {name:'Pulse Reactor',bpm:156,root:38,wave:'square',notes:[0,12,7,15,0,10,7,12,5,17,12,19,3,15,10,17],bass:[0,5,3,7],hat:1},
  {name:'Midnight Circuit',bpm:132,root:42,wave:'triangle',notes:[12,7,0,7,10,5,0,5,15,10,3,10,14,9,2,9],bass:[0,-2,3,2],hat:2},
  {name:'Final Chase',bpm:168,root:43,wave:'sawtooth',notes:[0,3,7,10,12,10,7,3,5,8,12,15,14,10,7,2],bass:[0,3,5,7],hat:1}
 ];
 const showSounds=Object.freeze({
  gong:{url:'/game-sounds/responses-closed.mp3',duration:3.25,level:1},
  fanfare:{url:'/game-sounds/gold-fanfare.mp3',duration:2.85,level:.66},
  cheer:{url:'/game-sounds/podium-cheering.mp3',duration:4.8,level:.72}
 });
 function podiumSoundEvents(placements){
  const events=[];
  for(const {rank,startIn} of placements){
   if(rank===1&&startIn>=3000)events.push({kind:'fanfare',startIn:startIn-3000,duration:2.85});
   else if(rank===1&&startIn>=900)events.push({kind:'fanfare',startIn:0,duration:(startIn-120)/1000});
   events.push({kind:'cheer',startIn,duration:rank===1?4.8:2.025,rank});
  }
  return events.sort((a,b)=>a.startIn-b.startIn);
 }
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
 const phaseOrder=['lobby','intro','media','countdown','question','responses-closed','reveal','leaderboard','podium','closed'];
 function isStaleView(next,previous){
  if(!previous||next.id!==previous.id||!Number.isFinite(next.serverNow)||!Number.isFinite(previous.serverNow))return false;
  if(next.serverNow<previous.serverNow||next.questionIndex<previous.questionIndex)return true;
  return next.questionIndex===previous.questionIndex&&phaseOrder.indexOf(next.phase)<phaseOrder.indexOf(previous.phase);
 }
 const activeRoundPhases=['intro','countdown','question'];
 function freshGong(previous,next){
  if(!previous||next.id!==previous.id||previous.questionIndex!==next.questionIndex||
    !activeRoundPhases.includes(previous.phase)||!['responses-closed','reveal','leaderboard'].includes(next.phase)||
    !['timeout','all-answered'].includes(next.roundEndReason)||!Number.isFinite(next.roundEndedAt)||
    !Number.isFinite(next.serverNow))return false;
  const elapsed=next.serverNow-next.roundEndedAt;
  // A delayed poll may first see the vote chart, just after the 3.8s close scene.
  // Give that transition one polling interval of grace, but never replay an old close.
  const grace=Number.isFinite(next.revealAt)?Math.max(3500,Math.min(5000,next.revealAt-next.roundEndedAt+1000)):3500;
  return elapsed>=0&&elapsed<=grace;
 }
 function webEngine(){
  const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)throw new Error('Sound is not supported by this browser.');
  const ctx=new Audio(),master=ctx.createGain(),compressor=ctx.createDynamicsCompressor();master.gain.value=.35;master.connect(compressor);compressor.connect(ctx.destination);
  let bus=null,timer=null,closeTimer=null,activeKey=null,gongBus=null,gongTimer=null;
  const nodes=new Set(),gongNodes=new Set();
  const buffers=new Map(), assetRequests=new AbortController();
  if(root.document&&root.fetch&&ctx.decodeAudioData)for(const [kind,{url}] of Object.entries(showSounds)){
   root.fetch(url,{signal:assetRequests.signal}).then(r=>{if(!r.ok)throw new Error('Audio clip unavailable');return r.arrayBuffer();})
    .then(data=>ctx.decodeAudioData(data)).then(buffer=>buffers.set(kind,buffer)).catch(()=>{});
  }
  const noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.25),ctx.sampleRate);const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
  function silence(output,voices){
   if(output){output.gain.cancelScheduledValues(ctx.currentTime);output.gain.setValueAtTime(0,ctx.currentTime);output.disconnect();}
   for(const n of voices){try{n.stop();n.disconnect();}catch{}}voices.clear();
  }
  function stopMusic(){clearInterval(timer);clearTimeout(closeTimer);timer=null;closeTimer=null;activeKey=null;silence(bus,nodes);bus=null;}
  function stopGong(){clearTimeout(gongTimer);gongTimer=null;silence(gongBus,gongNodes);gongBus=null;}
  function stop(){stopMusic();stopGong();}
  function source(n,g,start,end,output=bus,voices=nodes){n.connect(g);g.connect(output);voices.add(n);n.onended=()=>{voices.delete(n);n.disconnect();g.disconnect();};n.start(start);n.stop(end);}
  function sample(kind,t,duration=showSounds[kind].duration,output=bus,voices=nodes){
   const buffer=buffers.get(kind);if(!buffer)return false;
   const n=ctx.createBufferSource(),g=ctx.createGain(),level=showSounds[kind].level,end=t+Math.min(duration,buffer.duration);
   n.buffer=buffer;g.gain.setValueAtTime(level,t);g.gain.setValueAtTime(level,Math.max(t,end-.25));g.gain.linearRampToValueAtTime(0,end);
   source(n,g,t,end,output,voices);return true;
  }
  function tone(midi,t,duration,level,wave='triangle',attack=.008,output=bus,voices=nodes){const o=ctx.createOscillator(),g=ctx.createGain();o.type=wave;o.frequency.value=440*2**((midi-69)/12);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+duration);source(o,g,t,t+duration+.01,output,voices);}
  function kick(t){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(42,t+.14);g.gain.setValueAtTime(.7,t);g.gain.exponentialRampToValueAtTime(.0001,t+.22);source(o,g,t,t+.23);}
  function hiss(t,snare){const n=ctx.createBufferSource(),g=ctx.createGain(),filter=ctx.createBiquadFilter();n.buffer=noise;filter.type='highpass';filter.frequency.value=snare?1300:6500;n.connect(filter);filter.connect(g);g.connect(bus);nodes.add(n);n.onended=()=>{nodes.delete(n);n.disconnect();filter.disconnect();g.disconnect();};g.gain.setValueAtTime(snare?.2:.07,t);g.gain.exponentialRampToValueAtTime(.0001,t+(snare?.14:.045));n.start(t);n.stop(t+(snare?.15:.05));}
  function question(key,index,window,elapsed){
   if(activeKey===key)return;stopMusic();activeKey=key;bus=ctx.createGain();bus.connect(master);
   const start=ctx.currentTime+window.startIn/1000,end=ctx.currentTime+window.endIn/1000;
   // Audio-thread automation enforces silence at deadline even if JS timers stall.
   bus.gain.setValueAtTime(0,ctx.currentTime);bus.gain.setValueAtTime(.8,start);bus.gain.setValueAtTime(0,end);
   const track=tracks[index],step=60/track.bpm/4,origin=start-Math.max(0,elapsed)/1000;let cursor=Math.max(0,Math.ceil((ctx.currentTime-origin)/step));
   function schedule(){if(!bus||ctx.currentTime>=end){stopMusic();return;}while(origin+cursor*step<Math.min(end,ctx.currentTime+.16)){const t=origin+cursor*step,n=cursor%16,bar=Math.floor(cursor/16)%4;if(t>=ctx.currentTime&&t>=start){tone(track.root+12+track.notes[n],t,step*.8,.09,track.wave);if(n%4===0){kick(t);tone(track.root+track.bass[bar],t,step*3.2,.26,'triangle');}if(n%8===4)hiss(t,true);if(n%track.hat===0)hiss(t,false);if(n===0)for(const interval of [0,3,7])tone(track.root+24+track.bass[bar]+interval,t,step*12,.018,'sine');}cursor++;}}
   schedule();timer=setInterval(schedule,25);closeTimer=setTimeout(stopMusic,window.endIn+30);
  }
  function loop(key,score,window){
   if(activeKey===key)return;stopMusic();activeKey=key;bus=ctx.createGain();bus.gain.value=.7;bus.connect(master);
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
   stopGong();gongBus=ctx.createGain();gongBus.gain.value=1;gongBus.connect(master);
   const sampled=sample('gong',t,showSounds.gong.duration,gongBus,gongNodes);
   if(sampled){gongTimer=setTimeout(stopGong,(t-ctx.currentTime+showSounds.gong.duration)*1000+45);return;}
   // A mallet strike, longer low bronze resonance and a brighter, brief shimmer.
   [[36,.34,2.42],[43.23,.23,2.25],[50.71,.15,1.74],[56.48,.14,1.32],[63.14,.11,1.09],[72.37,.075,.47],[80.92,.055,.20]]
    .forEach(([pitch,level,length],i)=>tone(pitch,t,length,level,'sine',i===0?.038:.012,gongBus,gongNodes));
   gongTimer=setTimeout(stopGong,(t-ctx.currentTime+2.47)*1000);
  }
  function cue(kind,followup){
   stopMusic();const t=ctx.currentTime+.015;
   if(kind==='gong')gong(t);
   if(kind==='gong'&&!followup)return;
   bus=ctx.createGain();bus.gain.value=.8;bus.connect(master);
   const wait=kind==='gong'?.42:0,tail=wait+fanfare(followup||kind,t+wait);
   closeTimer=setTimeout(stopMusic,Math.ceil(tail*1000));
  }
  function overlay(kind,delay=0){const t=ctx.currentTime+Math.max(.015,delay/1000);if(kind==='gong')gong(t);else if(bus)fanfare(kind,t);}
  function cheer(t,duration){
   // Distant crowd: a rolling mid-frequency bed, layered hand claps, and a few whoops.
   const count=Math.max(1,Math.floor((duration-.42)/.05));
   for(let i=0;i<count;i++){
    const time=t+i*.05+Math.random()*.028;
    const n=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();
    n.buffer=noise;filter.type='bandpass';filter.frequency.value=670+Math.random()*1750;
    n.connect(filter);filter.connect(g);g.connect(bus);nodes.add(n);
    const peak=(.07+Math.random()*.09)*(1-i/count);
    g.gain.setValueAtTime(.001,time);g.gain.linearRampToValueAtTime(peak,time+.022);
    g.gain.exponentialRampToValueAtTime(.0001,time+.21);
    n.onended=()=>{nodes.delete(n);n.disconnect();filter.disconnect();g.disconnect();};
    n.start(time);n.stop(time+.23);
    if(i%7===0)tone(60+i%13,time+.02,.39,peak*.18,'triangle',.13);
   }
  }
  function royalFanfare(t){
   // Original herald call: a dotted rhythm over an open fifth, resolving on the octave.
   const call=[[67,0,.25],[72,.31,.18],[76,.52,.17],[79,.73,.41],[76,1.17,.19],[79,1.41,.18],[84,1.65,.84]];
   for(const [note,when,length] of call){
    const at=t+when;
    tone(note,at,length,.17,'sawtooth',.042);tone(note+12,at+.009,length*.82,.045,'triangle',.035);
    tone(note-12,at+.016,length,.11,'triangle',.046);
   }
   for(const note of [48,55,60,64])tone(note,t+1.66,.87,.074,'triangle',.07);
  }
  function podium(key,placements,finale){
   if(activeKey===key)return;stopMusic();activeKey=key;bus=ctx.createGain();bus.gain.value=.78;bus.connect(master);
   if(!placements.length)return;
   const origin=ctx.currentTime;
   for(const {kind,rank,startIn,duration} of podiumSoundEvents(placements)){
    const t=origin+Math.max(.015,startIn/1000);
    if(sample(kind,t,duration))continue;
    if(kind==='cheer')cheer(t,duration);
    else if(duration>=2.7)royalFanfare(t);
    else fanfare('lead',t);
   }
   const tail=Math.max(...podiumSoundEvents(placements).map(x=>x.startIn+x.duration*1000))+50;
   closeTimer=setTimeout(()=>{if(activeKey===key)stopMusic();},tail);
  }
  return {resume:()=>ctx.resume(),volume:v=>master.gain.setTargetAtTime(v,ctx.currentTime,.02),question,lobby,scoreboard,podium,cue,overlay,stop,dispose(){assetRequests.abort();stop();ctx.close();}};
 }
 function create({button,slider},env={}){
  const now=env.now||Date.now;let storage=env.storage;if(storage===undefined)try{storage=root.localStorage;}catch{}let prefs={volume:.35};try{prefs={...prefs,...JSON.parse(storage?.getItem('examio-game-audio')||'{}')};}catch{}
  let volume=Number.isFinite(Number(prefs.volume))?Math.max(0,Math.min(1,Number(prefs.volume))):.35,muted=prefs.muted===true,enabled=false,activating=false,engine=null,view=null,received=0,session=null,pick=shuffleBag(),selected=new Map(),lastCue=null,destroyed=false,mode=null;
  const later=env.setTimeout||setTimeout,cancel=env.clearTimeout||clearTimeout;let musicTimer=null;
  function clearMusicTimer(){if(musicTimer!==null)cancel(musicTimer);musicTimer=null;}
  function label(){button.textContent=enabled?'Mute sound':muted?'Unmute sound':'Enable sound';button.setAttribute('aria-pressed',String(enabled));}
  function save(){try{storage?.setItem('examio-game-audio',JSON.stringify({volume,muted}));}catch{}}
  function sync(cue,gong=false){
   clearMusicTimer();
   if(destroyed||!engine)return;
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
    // A response sent before the local completion timer may arrive afterward.
    if(mode===key+':music')return;
    if(Number.isFinite(view.podiumCompleteAt)&&Number.isFinite(view.serverNow)){
     const remaining=view.podiumCompleteAt-(view.serverNow+Math.max(0,now()-received));
     if(remaining<=0&&engine.scoreboard){
      if(mode!==key+':music'){mode=key+':music';engine.scoreboard(mode,null);}
      return;
     }
     if(remaining>0)musicTimer=later(()=>sync(),remaining);
    }
    if(mode!==key){mode=key;const future=futurePodiumCues(view,received,now());engine.podium(key,future,future.some(x=>x.rank===1));}
    return;
   }
   const roundClosed=['responses-closed','reveal','leaderboard','podium'].includes(view.phase);
   if(mode&&(mode!=='cue'||!roundClosed)){engine.stop();mode=null;}
   if(gong||cue){mode='cue';if(gong&&cue)engine.cue('gong',cue);else engine.cue(gong?'gong':cue);}
  }
  label();slider.min='0';slider.max='100';slider.step='1';slider.value=String(Math.round(volume*100));
  button.addEventListener('click',async()=>{
   if(destroyed||activating)return;
   if(enabled){clearMusicTimer();enabled=false;muted=true;mode=null;engine?.stop();save();label();return;}
   activating=true;
   try{if(!engine)engine=(env.engine||webEngine)();await engine.resume();if(destroyed)return;enabled=true;muted=false;save();label();sync();}
   catch{enabled=false;button.textContent='Sound unavailable';button.setAttribute('aria-pressed','false');}
   finally{activating=false;}
  });
  slider.addEventListener('input',()=>{volume=Math.max(0,Math.min(1,Number(slider.value)/100));save();sync();});
  return {canAutoEnable:()=>!enabled&&!activating&&!destroyed&&!muted&&volume>0,update(next,cue){
   if(destroyed||isStaleView(next,view))return;
   if(next.id!==session){session=next.id;pick=shuffleBag();selected=new Map();lastCue=null;mode=null;engine?.stop();}
   if(view&&next.id===view.id&&next.questionIndex!==view.questionIndex&&
     ['responses-closed','reveal','leaderboard','podium'].includes(view.phase)){mode=null;engine?.stop();}
   const gong=freshGong(view,next);
   if((cue==='lead'&&next.phase==='leaderboard')||(cue==='podium'&&next.phase==='podium')){
    const key=next.id+':'+next.questionIndex+':'+cue;if(lastCue===key)cue=null;else lastCue=key;
   }else cue=null;
   view=next;received=now();sync(cue,gong);
  },stop(){clearMusicTimer();destroyed=true;if(engine?.dispose)engine.dispose();else engine?.stop();enabled=false;label();}};
 }
 const api={create,tracks,shuffleBag,windowFor,isStaleView,scoreSoundWindow,futurePodiumCues,showSounds,podiumSoundEvents};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.GameAudio=api;
})(typeof window==='undefined'?globalThis:window);
