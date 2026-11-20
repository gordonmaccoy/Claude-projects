const {test}=require('node:test'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
const {createBillingStore}=require('../billing-store');
test('automatic syncing caches reads, preserves last good values on error and never reports disconnected as zero',async()=>{
 const db=new PGlite();let calls=0,fail=false;
 const billing=createBillingStore(db,{env:{OPENAI_BILLING_KEY:'secret',OPENAI_BILLING_PROJECT_ID:'p'},request:async()=>{calls++;if(fail)throw Error('secret');return {ok:true,json:async()=>({data:[{results:[{amount:{value:4,currency:'usd'}}]}],has_more:false})};}});
 try{await billing.init();const month=new Date().toISOString().slice(0,7);await billing.sync(month);await billing.sync(month);assert.equal(calls,1);
 let data=await billing.report(month);assert.equal(data.providers.find(p=>p.provider==='OpenAI').snapshot.amount,4);assert.equal(data.providers.find(p=>p.provider==='Railway').snapshot,null);
 await db.query("UPDATE onscreen_v2_billing_sync SET attempted_at=NOW()-INTERVAL '2 hours'");fail=true;await billing.sync(month);data=await billing.report(month);const row=data.providers.find(p=>p.provider==='OpenAI');assert.equal(row.status,'error');assert.equal(row.snapshot.amount,4);assert.equal(JSON.stringify(data).includes('secret'),false);assert.equal(data.history.length,1);
 }finally{await db.close();}
});
