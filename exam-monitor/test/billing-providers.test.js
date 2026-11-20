const {test}=require('node:test'),assert=require('node:assert/strict');
const {openaiCosts,railwayCosts}=require('../billing-providers');
const now=new Date('2026-11-20T00:00:00Z');
test('OpenAI follows pagination and filters the Examio project without reading prompts',async()=>{
 const urls=[];const request=async url=>{urls.push(String(url));return {ok:true,json:async()=>({data:[{results:[{amount:{value:urls.length,currency:'usd'}}]}],has_more:urls.length===1,next_page:'next'})};};
 const r=await openaiCosts({OPENAI_BILLING_KEY:'secret',OPENAI_BILLING_PROJECT_ID:'proj_examio'},'2026-11',request,now);
 assert.equal(r.amount,3);assert.equal(urls.length,2);assert.match(urls[0],/proj_examio/);assert.match(urls[1],/page=next/);assert.equal(JSON.stringify(r).includes('secret'),false);
});
test('unknown currencies and failed providers cannot turn into zero cost',async()=>{
 await assert.rejects(openaiCosts({OPENAI_BILLING_KEY:'x',OPENAI_BILLING_PROJECT_ID:'p'},'2026-11',async()=>({ok:true,json:async()=>({data:[{results:[{amount:{value:1,currency:'eur'}}]}],has_more:false})}),now));
 await assert.rejects(railwayCosts({RAILWAY_BILLING_TOKEN:'x',RAILWAY_BILLING_WORKSPACE_ID:'w'},async()=>({ok:false,status:401}),now));
});
test('Railway preserves its billing period and workspace scope and reports budget alerts',async()=>{
 const r=await railwayCosts({RAILWAY_BILLING_TOKEN:'x',RAILWAY_BILLING_WORKSPACE_ID:'w'},async()=>({ok:true,json:async()=>({data:{workspace:{name:'Workspace',customer:{currentUsage:80,billingPeriod:{start:'2026-11-01T00:00:00Z',end:'2026-12-01T00:00:00Z'},usageLimit:{softLimit:75,hardLimit:100,isOverLimit:false}}}}})}),now);
 assert.equal(r.amount,80);assert.equal(r.scope,'Railway workspace (all projects)');assert.equal(r.forecast>80,true);assert.equal(r.alerts.length>0,true);
});
