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
 assert.deepEqual(client.roundTime({...v,phase:'countdown',serverNow:1000},800,800),{seconds:2,progress:.4,urgent:false,label:'READING TIME'});
 assert.equal(client.roundTime({...v,phase:'reveal'},800,800),null);
 assert.equal(client.roundTime({...v,deadlineAt:null},800,800),null);
});

test('game creator sends files as authenticated multipart without overriding the boundary',()=>{
 const form=new FormData();form.append('file',new Blob(['example'],{type:'application/pdf'}),'review.pdf');
 const controller=new AbortController();
 const init=client.requestInit(form,{Authorization:'Bearer test-token'},'POST',{signal:controller.signal});
 assert.equal(init.body,form);assert.equal(init.signal,controller.signal);
 assert.deepEqual(init.headers,{Authorization:'Bearer test-token'});
});
test('game creator sends pasted text as JSON and omits empty request bodies',()=>{
 const headers={Authorization:'Bearer test-token'};
 assert.deepEqual(client.requestInit({source:'1. Test?'},headers,'POST'),{method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{"source":"1. Test?"}'});
 assert.deepEqual(client.requestInit(undefined,headers,'GET'),{method:'GET',headers,body:undefined});
});

test('answer slots are distinct with accessible labels and bounded count',()=>{
 assert.deepEqual(client.choiceSlots(5).map(v=>v.label),['Choice A, triangle','Choice B, diamond','Choice C, circle','Choice D, square','Choice E, star']);
 assert.deepEqual(client.choiceSlots(2).map(v=>v.slot),[0,1]);
 assert.deepEqual(client.choiceSlots(6),[]);
 assert.deepEqual(client.choiceSlots('4'),[]);
});
test('player stages distinguish incorrect and unanswered outcomes without needing question data',()=>{
 assert.equal(client.resultKind({answer:{correct:true,points:900}}),'correct');
 assert.equal(client.resultKind({answer:{correct:false,points:0}}),'wrong');
 assert.equal(client.resultKind({roundEndReason:'timeout'}),'timeout');
 assert.equal(client.resultKind({roundEndReason:'all-answered'}),'unanswered');
});
test('live views reject older polls and backwards phase changes',()=>{
 const a={id:'x',phase:'reveal',questionIndex:0,serverNow:55};
 assert.equal(client.isOlderView({...a,phase:'question'},a),true);
 assert.equal(client.isOlderView({...a,serverNow:54},a),true);
 assert.equal(client.isOlderView({...a,phase:'leaderboard'},a),false);
 assert.equal(client.isOlderView({...a,phase:'countdown',questionIndex:1},a),false);
});
test('projector ranking movement orders by previous ranks without rearranging the final order',()=>{
 const rows=[{id:'a',rank:1,previousRank:3},{id:'b',rank:2,previousRank:1},{id:'c',rank:3,previousRank:2}];
 assert.deepEqual(client.priorRows(rows).map(r=>r.id),['b','c','a']);
 assert.deepEqual(rows.map(r=>r.id),['a','b','c']);
});

test('live poll can align to a phase boundary without scheduling a tight loop',()=>{
 const v={phase:'countdown',startsAt:3200,serverNow:3000};
 assert.equal(client.nextPollDelay(v,800,800),220);
 assert.equal(client.nextPollDelay(v,800,1200),150);
 assert.equal(client.nextPollDelay({...v,phase:'reveal'},800,800),1000);
});

test('all Game Mode pages load the shared Examio wordmark styles',()=>{
 const fs=require('node:fs');
 for(const page of ['game-library','game-host','game-display','game-player']){
  const html=fs.readFileSync('public/'+page+'.html','utf8');
  assert.ok(html.includes('href="/examio.css"'),page);
  assert.match(html,/class="brand"[^>]*>.*<strong>Examio<\/strong>/);
 }
 const css=fs.readFileSync('public/game.css','utf8');
 const mark=css.match(/\.brand strong\{([^}]+)\}/)?.[1]||'';
 for(const property of ['size','weight','tracking'])assert.ok(mark.includes('var(--examio-wordmark-'+property+')'));
});
