const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {createApp}=require('../server');
async function setup(t,operation){
 const runtime=createApp({store:{accountState:async()=> 'active'},verifyUser:async token=>({id:token}),sweepInterval:0,aiConfigured:true,generate:operation,importWithAI:operation,completeAnswers:operation});
 runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');t.after(()=>runtime.close());
 return async(route,who='alice')=>{const r=await fetch(`http://127.0.0.1:${runtime.server.address().port}/api/${route}`,{method:'POST',headers:{Authorization:`Bearer ${who}`,'Content-Type':'application/json'},body:JSON.stringify({source:'A question',test:{}})});return {status:r.status,body:await r.json(),retry:r.headers.get('retry-after')};};
}
test('failed AI operations do not block subsequent successful operations',async t=>{
 let fail=true;const request=await setup(t,async()=>{if(fail)throw Error('provider failed');return {test:{}};});
 for(const route of ['generate','import-ai','answer-key','generate','answer-key','import-ai'])assert.equal((await request(route)).status,400);
 fail=false;for(let i=0;i<6;i++)assert.equal((await request(['generate','import-ai','answer-key'][i%3])).status,200);
 assert.equal((await request('generate')).status,200);
 assert.equal((await request('generate','bob')).status,200);
});
test('busy requests have their own message',async t=>{
 let release,started;const ready=new Promise(r=>started=r);let first=true;
 const request=await setup(t,async()=>{if(first){first=false;started();await new Promise(r=>release=r);}return {test:{}};});
 const pending=request('generate');await ready;const busy=await request('answer-key');release();await pending;
 assert.equal(busy.status,429);assert.equal(busy.body.code,'AI_BUSY');assert.match(busy.body.error,/in progress/i);
 for(let i=0;i<4;i++)assert.equal((await request('generate')).status,200);
 assert.equal((await request('generate')).status,200);
});
test('repeated failed retries retain separate short-term abuse protection',async t=>{
 const request=await setup(t,async()=>{throw Error('bad input');});
 for(let i=0;i<20;i++)assert.equal((await request('generate')).status,400);
 const limit=await request('generate');assert.equal(limit.status,429);assert.equal(limit.body.code,'AI_RETRY_LIMIT');assert.ok(Number(limit.retry)>0);
});
test('more than five successful requests are allowed and an in-flight lock survives a window boundary',async t=>{
 const originalNow=Date.now;let now=originalNow();Date.now=()=>now;t.after(()=>{Date.now=originalNow;});
 let release,started;let block=false;const ready=new Promise(r=>started=r);
 const request=await setup(t,async()=>{if(block){block=false;started();await new Promise(r=>release=r);}return {test:{}};});
 for(let i=0;i<4;i++)assert.equal((await request('generate')).status,200);
 block=true;const pending=request('generate');await ready;now+=3600001;
 const busy=await request('generate');release();await pending;assert.equal(busy.body.code,'AI_BUSY');
 for(let i=0;i<5;i++)assert.equal((await request('generate')).status,200);
 assert.equal((await request('generate')).status,200);
});
test('rapid-retry protection resets after a minute',async t=>{
 const originalNow=Date.now;let now=originalNow();Date.now=()=>now;t.after(()=>{Date.now=originalNow;});
 let fail=true;const request=await setup(t,async()=>{if(fail)throw Error('failed');return {test:{}};});
 for(let i=0;i<20;i++)assert.equal((await request('answer-key')).status,400);
 assert.equal((await request('generate')).body.code,'AI_RETRY_LIMIT');now+=60001;fail=false;
 for(let i=0;i<5;i++)assert.equal((await request('import-ai')).status,200);
 assert.equal((await request('generate')).status,200);
});
test('serialization failures do not trigger an hourly lockout',async t=>{
 let fail=true;const request=await setup(t,async()=>{if(fail){const result={};result.self=result;return result;}return {test:{}};});
 for(let i=0;i<6;i++)assert.equal((await request('generate')).status,400);
 fail=false;for(let i=0;i<6;i++)assert.equal((await request('answer-key')).status,200);
});
