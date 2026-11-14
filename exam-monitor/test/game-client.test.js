const test=require('node:test'),assert=require('node:assert/strict');
const client=require('../public/game-client');
test('countdown uses server offset and never goes negative',()=>{assert.equal(client.secondsLeft(5000,2000,1000,1500),3);assert.equal(client.secondsLeft(5000,2000,1000,9000),0);});
test('resume tokens are generated before joining and survive reload',()=>{const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};let n=0;const a=client.resumeRecord(storage,'game',()=>String(++n).repeat(64));assert.equal(a.resumeToken,'1'.repeat(64));assert.deepEqual(client.resumeRecord(storage,'game',()=>String(++n)),a);assert.equal(n,1);});
test('resume records are isolated by game and reject corrupt storage',()=>{const values=new Map([['examio-game:a','bad']]),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};assert.equal(client.resumeRecord(storage,'a',()=> 'a'.repeat(64)).resumeToken,'a'.repeat(64));assert.equal(client.resumeRecord(storage,'b',()=> 'b'.repeat(64)).resumeToken,'b'.repeat(64));});
test('game editor preserves images and independent option identity',()=>{const q=client.newQuestion();assert.equal(q.options.length,4);assert.equal(new Set(q.options.map(o=>o.id)).size,4);assert.equal(q.durationSeconds,20);});
test('media rendering rejects unsafe protocols and uses YouTube privacy embeds',()=>{assert.equal(client.mediaSource({type:'image',url:'javascript:alert(1)'}),null);assert.equal(client.mediaSource({type:'youtube',url:'https://www.youtube.com/watch?v=abcdefghijk'}),'https://www.youtube-nocookie.com/embed/abcdefghijk');assert.equal(client.mediaSource({type:'youtube',url:'https://evil.example/watch?v=abcdefghijk'}),null);assert.equal(client.mediaSource({type:'video',url:'https://example.com/video.mp4'}),'https://example.com/video.mp4');});
test('expired sessions forget local player identity while network failures preserve it',()=>{const values=new Map([['examio-game:a','private'],['examio-game:b','other']]),storage={removeItem:k=>values.delete(k)};assert.equal(client.forgetExpiredSession(storage,'a',503),false);assert.equal(values.get('examio-game:a'),'private');assert.equal(client.forgetExpiredSession(storage,'a',410),true);assert.equal(values.has('examio-game:a'),false);assert.equal(values.get('examio-game:b'),'other');values.set('examio-game:a','private');assert.equal(client.forgetExpiredSession(storage,'a',404),true);assert.equal(values.has('examio-game:a'),false);});

test('round timer reads the authoritative window and flags the final five seconds',()=>{
 const v={phase:'question',startsAt:3000,deadlineAt:23000,serverNow:16000};
 assert.deepEqual(client.roundTime(v,800,800),{seconds:7,progress:.35,urgent:false,label:'SECONDS LEFT'});
 assert.deepEqual(client.roundTime(v,800,2800),{seconds:5,progress:.25,urgent:true,label:'SECONDS LEFT'});
 assert.deepEqual(client.roundTime(v,800,9000),{seconds:0,progress:0,urgent:true,label:'SECONDS LEFT'});
 assert.deepEqual(client.roundTime({...v,phase:'countdown',serverNow:1000},800,800),{seconds:2,progress:2/3,urgent:false,label:'GET READY'});
 assert.equal(client.roundTime({...v,phase:'reveal'},800,800),null);
 assert.equal(client.roundTime({...v,deadlineAt:null},800,800),null);
});
