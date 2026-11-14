const test=require('node:test'),assert=require('node:assert/strict');
const audio=require('../public/game-audio');
test('four distinct original scores shuffle without repeats and avoid adjacent repeats across bags',()=>{assert.equal(audio.tracks.length,4);assert.equal(new Set(audio.tracks.map(t=>JSON.stringify(t.notes))).size,4);const next=audio.shuffleBag(()=>0.4);const picks=Array.from({length:20},next);for(let i=0;i<20;i+=4)assert.equal(new Set(picks.slice(i,i+4)).size,4);for(let i=1;i<picks.length;i++)assert.notEqual(picks[i],picks[i-1]);});
test('question window uses server timestamp, excludes media/reveal/podium and stops at deadline',()=>{const v={phase:'countdown',startsAt:4000,deadlineAt:24000,serverNow:1000};assert.deepEqual(audio.windowFor(v,5000,6000),{startIn:2000,endIn:22000});assert.equal(audio.windowFor(v,5000,28000),null);for(const phase of ['media','lobby','reveal','leaderboard','podium','closed'])assert.equal(audio.windowFor({...v,phase},5000,5000),null);assert.equal(audio.windowFor({...v,deadlineAt:NaN},5000,5000),null);});
test('controller is silent before explicit enable and stops in non-question phases',async()=>{let now=0,created=0;const button={textContent:'',setAttribute(){},addEventListener(_e,f){this.click=f;}},slider={value:'50',addEventListener(_e,f){this.input=f;}};const calls=[];const engine={resume:async()=>{},volume:v=>calls.push(['volume',v]),question:(...a)=>calls.push(['question',...a]),cue:c=>calls.push(['cue',c]),stop:()=>calls.push(['stop'])};const ctl=audio.create({button,slider},{now:()=>now,storage:null,engine:()=>{created++;return engine;}});ctl.update({id:'s',questionIndex:0,phase:'countdown',startsAt:3000,deadlineAt:23000,serverNow:0});assert.equal(created,0);await button.click();assert.equal(created,1);assert.equal(calls.filter(c=>c[0]==='question').length,1);ctl.update({id:'s',questionIndex:1,phase:'media',serverNow:1000},'lead');assert.equal(calls.at(-1)[0],'stop');ctl.update({id:'s',questionIndex:1,phase:'podium',serverNow:2000},'podium');ctl.update({id:'s',questionIndex:1,phase:'podium',serverNow:3000},'podium');assert.equal(calls.filter(c=>c[0]==='cue').length,1);await button.click();assert.equal(calls.at(-1)[0],'stop');ctl.stop();});
test('audio thread schedules hard deadline silence before question begins without relying on polling',async()=>{
 const gains=[];class Context{constructor(){this.currentTime=10;this.sampleRate=100;this.destination={};}createGain(){const events=[];const gain={value:0,setValueAtTime:(v,t)=>events.push([v,t]),cancelScheduledValues(){},setTargetAtTime(){}};gains.push(events);return {gain,connect(){},disconnect(){}};}createDynamicsCompressor(){return {connect(){}};}createBuffer(){return {getChannelData:()=>new Float32Array(25)};}resume(){return Promise.resolve();}close(){return Promise.resolve();}}
 global.AudioContext=Context;const button={setAttribute(){},addEventListener(_,f){this.click=f;}},slider={addEventListener(){}};const ctl=audio.create({button,slider},{now:()=>0,storage:null});
 try{ctl.update({id:'s',questionIndex:0,phase:'countdown',serverNow:1000,startsAt:4000,deadlineAt:24000});await button.click();assert.deepEqual(gains[1],[[0,10],[.8,13],[0,33]]);}finally{ctl.stop();delete global.AudioContext;}
});
test('lobby, question, gong and both fanfares start every source before scheduling stop',async()=>{
 let starts=0,stops=0;const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}});
 const source=()=>{let started=false;return {frequency:param(),connect(){},disconnect(){},start(){assert.equal(started,false);started=true;starts++;},stop(){assert.ok(started,'AudioScheduledSourceNode.stop before start');stops++;}};};
 class Context{constructor(){this.currentTime=10;this.sampleRate=100;this.destination={};}createGain(){return {gain:param(),connect(){},disconnect(){}};}createDynamicsCompressor(){return {connect(){}};}createBuffer(){return {getChannelData:()=>new Float32Array(25)};}createOscillator(){return source();}createBufferSource(){return source();}createBiquadFilter(){return {frequency:param(),connect(){},disconnect(){}};}resume(){return Promise.resolve();}close(){return Promise.resolve();}}
 global.AudioContext=Context;const button={setAttribute(){},addEventListener(_,f){this.click=f;}},slider={addEventListener(){}};const ctl=audio.create({button,slider},{now:()=>0,storage:null});
 try{ctl.update({id:'s',questionIndex:-1,phase:'lobby',serverNow:0});await button.click();assert.ok(starts>=4,'lobby synth starts notes immediately');const lobbyNotes=starts;ctl.update({id:'s',questionIndex:0,phase:'question',serverNow:4000,startsAt:4000,deadlineAt:24000});assert.ok(starts-lobbyNotes>=4,'question notes/drums started');assert.notEqual(button.textContent,'Sound unavailable');let previous=starts;ctl.update({id:'s',questionIndex:0,phase:'reveal',serverNow:24100,roundEndedAt:24000,roundEndReason:'timeout'});assert.equal(starts-previous,7);previous=starts;ctl.update({id:'s',questionIndex:0,phase:'leaderboard',serverNow:25000},'lead');assert.equal(starts-previous,8);previous=starts;ctl.update({id:'s',questionIndex:0,phase:'podium',serverNow:26000},'podium');assert.equal(starts-previous,16);assert.ok(stops>=starts);}finally{ctl.stop();delete global.AudioContext;}
});
test('sound can be enabled before the first network view arrives',async()=>{
 const button={setAttribute(){},addEventListener(_,f){this.click=f;}},slider={addEventListener(){}};let notes=0;const engine={resume:async()=>{},volume(){},stop(){},question(){notes++;}};
 const ctl=audio.create({button,slider},{now:()=>0,storage:null,engine:()=>engine});await button.click();assert.equal(button.textContent,'Mute sound');assert.equal(notes,0);ctl.update({id:'s',phase:'question',questionIndex:0,serverNow:3000,startsAt:3000,deadlineAt:23000});assert.equal(notes,1);ctl.stop();
});
function testController(){
 let current=0;const calls=[];
 const button={textContent:'',setAttribute(){},addEventListener(_,f){this.click=f;}};
 const slider={value:'35',addEventListener(_,f){this.input=f;}};
 const engine={resume:async()=>{},volume(){},stop:()=>calls.push(['stop']),lobby:(...args)=>calls.push(['lobby',...args]),question:(...args)=>calls.push(['question',...args]),cue:(...args)=>calls.push(['cue',...args])};
 const ctl=audio.create({button,slider},{now:()=>current,storage:null,engine:()=>engine});
 const tick=(phase,serverNow,fields={},cue)=>{current=serverNow;ctl.update({id:'live',questionIndex:0,phase,serverNow,...fields},cue);};
 const named=name=>calls.filter(c=>c[0]===name);
 return {ctl,button,slider,calls,tick,named};
}
test('lobby loop requires explicit sound and transitions to silent preroll, then timed music',async()=>{
 const {ctl,button,tick,named,calls}=testController();
 tick('lobby',1000,{questionIndex:-1});assert.equal(named('lobby').length,0);await button.click();assert.equal(named('lobby').length,1);
 tick('lobby',1150,{questionIndex:-1});assert.equal(named('lobby').length,1);
 tick('media',1200);assert.deepEqual(calls.at(-1),['stop']);
 tick('countdown',2000,{startsAt:7000,deadlineAt:27000});assert.equal(named('question').length,1);assert.deepEqual(named('question')[0][3],{startIn:5000,endIn:25000});
 tick('question',7100,{startsAt:7000,deadlineAt:27000});assert.equal(named('question').length,1,'native scheduler must not restart a playing track on phase update');ctl.stop();
});
test('gong plays once for each fresh round close, including a skipped reveal, but not stale or duplicate views',async()=>{
 const {ctl,button,tick,named}=testController();await button.click();
 tick('question',1000,{startsAt:900,deadlineAt:6000});
 tick('reveal',1600,{roundEndedAt:1500,roundEndReason:'all-answered'});
 tick('reveal',1800,{roundEndedAt:1500,roundEndReason:'all-answered'});
 tick('question',1700,{startsAt:900,deadlineAt:6000});
 tick('leaderboard',2000,{roundEndedAt:1500,roundEndReason:'all-answered'},'lead');
 assert.deepEqual(named('cue'),[['cue','gong'],['cue','lead']]);
 assert.equal(named('question').length,1);
 tick('question',8000,{questionIndex:1,startsAt:7000,deadlineAt:9000});
 tick('leaderboard',9250,{questionIndex:1,roundEndedAt:9000,roundEndReason:'timeout'});
 tick('leaderboard',9500,{questionIndex:1,roundEndedAt:9000,roundEndReason:'timeout'});
 assert.deepEqual(named('cue').at(-1),['cue','gong']);assert.equal(named('cue').filter(c=>c[1]==='gong').length,2);
 tick('question',11000,{questionIndex:2,startsAt:10000,deadlineAt:12000});
 tick('reveal',21000,{questionIndex:2,roundEndedAt:12000,roundEndReason:'timeout'});
 assert.equal(named('cue').filter(c=>c[1]==='gong').length,2);ctl.stop();
});
test('reload and unmute never replay a completed round',async()=>{
 const {ctl,button,tick,named}=testController();
 tick('reveal',2000,{roundEndedAt:1900,roundEndReason:'all-answered'});await button.click();
 tick('reveal',2100,{roundEndedAt:1900,roundEndReason:'all-answered'});
 tick('question',7000,{questionIndex:1,startsAt:6900,deadlineAt:10000});await button.click();
 tick('reveal',7300,{questionIndex:1,roundEndedAt:7200,roundEndReason:'all-answered'});await button.click();
 assert.deepEqual(named('cue'),[]);ctl.stop();
});
