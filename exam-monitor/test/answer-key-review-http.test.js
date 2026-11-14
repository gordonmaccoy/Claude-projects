const {test}=require('node:test'),assert=require('node:assert/strict');
const {once}=require('node:events');const {createApp}=require('../server');
const {createAnswerCompleter,createAIImporter}=require('../answer-key');
test('review request flags and explicit consent gate the real answer/import pipeline',async t=>{
 let calls=0;const options={key:'synthetic',model:'synthetic',fetch:async(url,opts)=>{calls++;const questions=JSON.parse(JSON.parse(opts.body).input).questions;return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answers:questions.map(q=>({questionId:q.id,correctOptionId:q.options[0].id,acceptedAnswers:[],uncertain:false,explanation:'Arithmetic.'}))})}]}]})};}};
 const runtime=createApp({store:{accountState:async()=> 'active'},verifyUser:async token=>token==='teacher'?{id:token}:null,sweepInterval:0,aiConfigured:true,completeAnswers:createAnswerCompleter(options),importWithAI:createAIImporter(options)});
 runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');t.after(()=>runtime.close());
 const input={title:'Math',questions:[{id:'q',type:'mc',text:'What is 2 + 2?',points:1,options:[{id:'a',text:'4'},{id:'b',text:'5'}],correctOptionId:'b'}]};
 async function request(route,body,multipart=false){let payload;if(multipart){payload=new FormData();for(const [k,v] of Object.entries(body))payload.set(k,String(v));}else payload=JSON.stringify(body);const r=await fetch('http://127.0.0.1:'+runtime.server.address().port+'/api/'+route,{method:'POST',headers:{Authorization:'Bearer teacher',...(!multipart?{'Content-Type':'application/json'}:{})},body:payload});return {status:r.status,body:await r.json()};}
 for(const consent of [undefined,false,'true']){const r=await request('answer-key',{test:input,reviewSupplied:true,...(consent===undefined?{}:{consent})});assert.equal(r.status,400);assert.match(r.body.error,/consent/i);}assert.equal(calls,0);
 const defaultResult=await request('answer-key',{test:input,reviewSupplied:'true',consent:true});assert.equal(defaultResult.status,200);assert.equal(calls,0);
 const reviewed=await request('answer-key',{test:input,reviewSupplied:true,consent:true});assert.equal(reviewed.status,200);assert.equal(calls,1);assert.equal(reviewed.body.test.questions[0].correctOptionId,'b');assert.ok(reviewed.body.warnings.some(w=>/different.*4/i.test(w)));
 const source='1. What is 2 + 2?\nA. 4\nB. 5\nAnswer: B';
 for(const multipart of [false,true]){const rejected=await request('import-ai',{source,reviewSupplied:true},multipart);assert.equal(rejected.status,400);assert.match(rejected.body.error,/consent/i);const result=await request('import-ai',{source,reviewSupplied:true,consent:true},multipart);assert.equal(result.status,200);assert.ok(result.body.warnings.some(w=>/different.*4/i.test(w)));}
 assert.equal(calls,3);
});
