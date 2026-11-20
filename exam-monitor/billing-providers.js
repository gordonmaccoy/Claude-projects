// Server-only billing readers. No model/workload credentials are reused here.
const failure=()=>new Error('Billing sync failed. Check billing access and try again.');
const numeric=n=>typeof n==='number'&&Number.isFinite(n);
async function json(request,url,options={}){
 const response=await request(url,{...options,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw failure();
 return response.json();
}
function forecast(amount,start,end,now){
 const elapsed=now-new Date(start),duration=new Date(end)-new Date(start);
 return elapsed>=86400000&&elapsed<duration?amount*duration/elapsed:null;
}
async function openaiCosts(env,month,request=fetch,now=new Date()){
 const start=new Date(month+'-01T00:00:00Z'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
 if(start>=now)throw failure();
 let page,amount=0;const seen=new Set();
 do{
  const url=new URL('https://api.openai.com/v1/organization/costs');
  for(const [key,value]of Object.entries({start_time:start.getTime()/1000,end_time:Math.floor(Math.min(end,now)/1000),limit:31,'project_ids[]':env.OPENAI_BILLING_PROJECT_ID}))url.searchParams.set(key,value);
  if(page)url.searchParams.set('page',page);
  const result=await json(request,url,{headers:{Authorization:'Bearer '+env.OPENAI_BILLING_KEY}});
  if(!Array.isArray(result.data)||typeof result.has_more!=='boolean')throw failure();
  for(const bucket of result.data){
   if(!Array.isArray(bucket.results))throw failure();
   for(const row of bucket.results){if(!numeric(row.amount?.value)||row.amount.currency?.toLowerCase()!=='usd')throw failure();amount+=row.amount.value;}
  }
  page=result.has_more?result.next_page:null;
  if(result.has_more&&(!page||seen.has(page)||seen.size>=100))throw failure();
  if(page)seen.add(page);
 }while(page);
 return {amount,forecast:forecast(amount,start,end,now),start:start.toISOString(),end:end.toISOString(),scope:'Examio OpenAI project',scopeId:env.OPENAI_BILLING_PROJECT_ID,kind:'Provider-reported usage costs',alerts:[],note:'USD calendar month. Provider reporting may lag; excludes unrelated projects and organization-level charges. Forecast uses the elapsed-month average, not an invoice.'};
}
async function railwayCosts(env,request=fetch,now=new Date()){
 const result=await json(request,'https://backboard.railway.com/graphql/v2',{method:'POST',headers:{Authorization:'Bearer '+env.RAILWAY_BILLING_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:'query($workspaceId:String!){workspace(workspaceId:$workspaceId){name customer{currentUsage billingPeriod{start end} usageLimit{softLimit hardLimit isOverLimit}}}}',variables:{workspaceId:env.RAILWAY_BILLING_WORKSPACE_ID}})});
 const customer=result.data?.workspace?.customer,period=customer?.billingPeriod;
 if(result.errors?.length||!numeric(customer?.currentUsage)||!Number.isFinite(Date.parse(period?.start))||!Number.isFinite(Date.parse(period?.end))||Date.parse(period.end)<=Date.parse(period.start))throw failure();
 const amount=customer.currentUsage,projected=forecast(amount,period.start,period.end,now),alerts=[];
 for(const [key,label]of [['softLimit','alert threshold'],['hardLimit','hard limit']]){const limit=customer.usageLimit?.[key];if(numeric(limit)&&limit>0){if(amount>=limit)alerts.push(`Railway ${label} reached ($${limit}).`);else if(projected>=limit)alerts.push(`Projected Railway usage exceeds its $${limit} ${label}.`);}}
 if(customer.usageLimit?.isOverLimit)alerts.push('Railway reports usage over its configured limit.');
 return {amount,forecast:projected,start:period.start,end:period.end,scope:'Railway workspace (all projects)',scopeId:env.RAILWAY_BILLING_WORKSPACE_ID,kind:'Provider-reported current usage',alerts,note:'Includes all projects in this Railway workspace. Uses the provider billing period, which may differ from a calendar month. Subscription fees, credits and taxes may differ on the final invoice. Forecast uses elapsed-period average.'};
}
module.exports={openaiCosts,railwayCosts};
