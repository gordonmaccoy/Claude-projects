const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PDFDocument}=require('pdf-lib');
const {createExportMailer}=require('../results-email');
const {resultsPdf}=require('../results-pdf');
const session={id:'ABC123',mode:'test',phase:'ended',test:{title:'한국어 성적',questions:[]},students:[]};
test('result PDF produces branded readable pages for Korean and long detailed content',async()=>{
 const copy=structuredClone(session);copy.test.questions=Array.from({length:45},(_,i)=>({id:String(i),type:'blank',text:'한국어 긴 문제 '.repeat(15),acceptedAnswers:['정답']}));
 const bytes=await resultsPdf(copy,true);assert.equal(bytes.subarray(0,4).toString(),'%PDF');const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>2);assert.match(pdf.getTitle(),/한국어/);
});
test('email validates, deduplicates concurrent sends and rate limits with no real provider',async()=>{
 let calls=0,release;const mail=createExportMailer({key:'test',from:'Examio <exam@example.com>',transport:async payload=>{calls++;assert.equal(payload.to[0],'other@example.com');assert.match(payload.attachments[0].content,/^UEs/);await new Promise(r=>release=r);return {id:'mail1'};},maxPerHour:1});
 await assert.rejects(()=>mail.send({session,user:{id:'owner'},email:'bad',detail:false,requestId:'request-0001'}),e=>e.status===400);
 const input={session,user:{id:'owner'},email:'other@example.com',detail:false,requestId:'request-0001'};const first=mail.send(input);const second=mail.send(input);await new Promise(r=>setImmediate(r));release();assert.deepEqual(await first,await second);assert.equal(calls,1);
 await assert.rejects(()=>mail.send({...input,requestId:'request-0002'}),e=>e.status===429);
 await assert.rejects(()=>mail.send({...input,email:'changed@example.com'}),e=>e.status===409);
});
test('missing email configuration fails without invoking transport',async()=>{const mail=createExportMailer({key:'',from:''});assert.equal(mail.configured,false);await assert.rejects(()=>mail.send({session,user:{id:'a'},email:'a@example.com',detail:false,requestId:'request-0001'}),e=>e.status===503);});
test('HTTP export endpoints protect ownership, serve PDF and send validated workbook attachments',async()=>{
 const {createApp}=require('../server');const {once}=require('node:events');const owned={...session,ownerId:'owner'};let deliveries=0;
 const store={accountState:async()=> 'active',getSession:async id=>id==='ABC123'?owned:null,mutate:async(id,fn)=>{fn(owned);return {session:owned};}};
 const running=createApp({store,verifyUser:async token=>token?{id:token,email:'owner@example.com'}:null,sweepInterval:0,exportEmailOptions:{key:'fake',from:'exam@example.com',transport:async payload=>{assert.deepEqual(payload.to,['owner@example.com']);deliveries++;return {id:'safe-test'};}}});running.server.listen(0,'127.0.0.1');await once(running.server,'listening');const base='http://127.0.0.1:'+running.server.address().port;
 const request=(path,token='owner',body)=>fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{const cfg=await (await request('/api/config')).json();assert.equal(cfg.exportEmailConfigured,true);assert.equal(JSON.stringify(cfg).includes('fake'),false);
 assert.equal((await request('/api/sessions/ABC123/export?format=pdf','stranger')).status,404);
 const pdf=await request('/api/sessions/ABC123/export?format=pdf');assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(),'%PDF');
 const input={email:'recipient@example.com',detail:true,requestId:'http-request-1'};assert.equal((await request('/api/sessions/ABC123/email-export','stranger',input)).status,404);assert.equal(deliveries,0);assert.equal((await request('/api/sessions/ABC123/email-export','owner',input)).status,400);assert.equal(deliveries,0);assert.equal((await request('/api/sessions/ABC123/email-export','owner',{detail:true,requestId:'http-request-own'})).status,200);assert.equal(deliveries,1);
 }finally{await new Promise(resolve=>running.io.close(resolve));}
});
