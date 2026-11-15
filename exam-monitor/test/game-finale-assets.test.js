const {existsSync, readFileSync} = require('node:fs');
const {join} = require('node:path');
const {createHash} = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const client = require('../public/game-client');
const audio = require('../public/game-audio');

test('question intros use the numbered artwork, with a numeric fallback after question 25', () => {
  const digests=new Set();
  for (let i = 0; i < 25; i++) {
    const asset = client.introArtwork({phase:'intro',questionIndex:i});
    assert.equal(asset, '/game-intro/question-' + (i + 1) + '.webp');
    const bytes=readFileSync(join(__dirname, '../public', asset));
    assert.ok(bytes.length < 120000);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    digests.add(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(digests.size,25,'every ordinal uses distinct artwork');
  assert.equal(client.introArtwork({phase:'intro',questionIndex:25}), null);
  assert.equal(client.introArtwork({phase:'question',questionIndex:1}), null);
});
test('real audio files are matched to round gong, pre-gold fanfare, and every reveal', () => {
  for (const key of ['gong', 'fanfare', 'cheer']) {
    assert.ok(existsSync(join(__dirname, '../public', audio.showSounds[key].url)));
  }
  const events = audio.podiumSoundEvents([{rank:3,startIn:1900},{rank:2,startIn:5500},{rank:1,startIn:10000}]);
  assert.deepEqual(events.map(e=>[e.kind,e.startIn]), [['cheer',1900],['cheer',5500],['fanfare',7000],['cheer',10000]]);
  assert.deepEqual(audio.podiumSoundEvents([{rank:1,startIn:170}]).map(e=>[e.kind,e.startIn]), [['cheer',170]]);
  assert.ok(audio.showSounds.gong.duration * 1000 < 3800);
});
test('classroom audio plays decoded local clips at round close and on the live podium schedule', async () => {
  const played=[],originalFetch=global.fetch,originalDocument=global.document,originalAudio=global.AudioContext;
  const param=()=>({value:0,setValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){},linearRampToValueAtTime(){}});
  class Context {
    constructor(){this.currentTime=10;this.sampleRate=100;this.destination={};}
    createGain(){return {gain:param(),connect(){},disconnect(){}};}
    createDynamicsCompressor(){return {connect(){}};}
    createBuffer(){return {getChannelData:()=>new Float32Array(25)};}
    createBufferSource(){return {connect(){},disconnect(){},start(at){played.push([this.buffer.path,Math.round(at*1000)]);},stop(){}};}
    decodeAudioData(path){return Promise.resolve({path,duration:4});}
    resume(){return Promise.resolve();}
    close(){return Promise.resolve();}
  }
  global.document={};
  global.fetch=async path=>({ok:true,arrayBuffer:async()=>path});
  global.AudioContext=Context;
  const button={setAttribute(){},addEventListener(_,f){this.click=f;}},slider={addEventListener(){}};
  const ctl=audio.create({button,slider},{now:()=>0,storage:null});
  try{
    ctl.update({id:'s',phase:'question',questionIndex:0,serverNow:3600,startsAt:3000,deadlineAt:3500});
    await button.click();
    await new Promise(resolve=>setImmediate(resolve));
    ctl.update({id:'s',phase:'responses-closed',questionIndex:0,serverNow:3700,revealAt:7200,roundEndedAt:3500,roundEndReason:'timeout'});
    const podium={id:'s',phase:'podium',questionIndex:0,serverNow:10000,podiumSchedule:[
      {rank:3,at:11900},{rank:2,at:15500},{rank:1,at:20000}
    ]};
    ctl.update(podium);
    ctl.update({...podium,serverNow:10100});
    assert.deepEqual(played,[
      [audio.showSounds.gong.url,10015],
      [audio.showSounds.cheer.url,11900],
      [audio.showSounds.cheer.url,15500],
      [audio.showSounds.fanfare.url,17000],
      [audio.showSounds.cheer.url,20000]
    ]);
  }finally{
    ctl.stop();global.fetch=originalFetch;
    if(originalDocument===undefined)delete global.document;else global.document=originalDocument;
    if(originalAudio===undefined)delete global.AudioContext;else global.AudioContext=originalAudio;
  }
});
