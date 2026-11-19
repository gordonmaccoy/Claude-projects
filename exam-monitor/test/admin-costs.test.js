const {test}=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createCostStore}=require('../cost-store');
test('cost ledger separates invoices from estimates and snapshots model rates',async()=>{
 const db=new PGlite(),costs=createCostStore(db);await costs.init();
 try{
  const month=new Date().toISOString().slice(0,7);
  await costs.methods.recordAIUsage({model:'example-model',feature:'generate',input:1000000,cached:250000,output:100000,status:'completed'});
  let result=await costs.methods.adminCosts(month);assert.equal(result.ai.unpriced,1);assert.equal(result.ai.estimated_usd,0);
  await costs.methods.adminSaveRate('owner',{model:'example-model',input:2,cached:1,output:8});
  await costs.methods.recordAIUsage({model:'example-model',feature:'generate',input:1000000,cached:250000,output:100000,status:'completed'});
  await costs.methods.adminSaveCost('owner',{month,provider:'Railway',amount:12.50,kind:'actual',note:'Invoice'});
  await costs.methods.adminSaveCost('owner',{month,provider:'Railway',amount:15,kind:'actual',note:'Corrected invoice'});
  result=await costs.methods.adminCosts(month);assert.equal(result.entries.length,1);assert.equal(result.entries[0].amount,15);assert.equal(result.ai.requests,2);assert.equal(result.ai.unpriced,1);assert.equal(result.ai.estimated_usd,2.55);
  await assert.rejects(costs.methods.adminSaveCost('owner',{month,provider:'Railway',amount:-1,kind:'actual',note:''}));
  await assert.rejects(costs.methods.adminCosts('2026-99'));
  await assert.rejects(costs.methods.adminSaveRate('owner',{model:'x',input:1,cached:2,output:1}));
 }finally{await db.close();}
});
test('AI telemetry records tokens without prompts or answers and isolates concurrent contexts',async()=>{
 const {withAIUsage}=require('../ai-usage'),{structuredRequest}=require('../ai-provider');
 const one=[],two=[];
 const request=async()=>({ok:true,json:async()=>({status:'completed',usage:{input_tokens:100,output_tokens:30,input_tokens_details:{cached_tokens:20}},output:[{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}]})});
 await Promise.all([one,two].map(records=>withAIUsage({recordAIUsage:async e=>records.push(e)},()=>structuredRequest({key:'secret',model:'test',request,name:'short_answer_grade',instructions:'private',input:'private answer',schema:{}}))));
 for(const rows of [one,two]){assert.equal(rows.length,1);assert.equal(rows[0].input,100);assert.equal(rows[0].cached,20);assert.equal(rows[0].output,30);assert.equal(JSON.stringify(rows).includes('private'),false);assert.equal(JSON.stringify(rows).includes('secret'),false);}
});
