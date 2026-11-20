const {openaiCosts,railwayCosts}=require('./billing-providers');
function createBillingStore(pool,{env=process.env,request=fetch}={}){
 const active=new Map();
 const definitions=()=>[
  {provider:'OpenAI',ready:!!(env.OPENAI_BILLING_KEY&&env.OPENAI_BILLING_PROJECT_ID),setup:'Connect an OpenAI organization billing key and the Examio project ID once.',read:month=>openaiCosts(env,month,request)},
  {provider:'Railway',ready:!!(env.RAILWAY_BILLING_TOKEN&&env.RAILWAY_BILLING_WORKSPACE_ID),setup:'Connect a Railway workspace billing token once.',read:()=>railwayCosts(env,request)},
  {provider:'Supabase',ready:false,setup:'Not connected. Supabase does not document a public billing-total API. Usage metrics are not invoice totals.'},
  {provider:'Email / domain',ready:false,setup:'Not connected. No automatic billing source configured.'}
 ];
 async function sync(month){
  if(active.has(month))return active.get(month);
  const job=(async()=>{await Promise.all(definitions().filter(d=>d.ready).map(async d=>{
   const current=new Date().toISOString().slice(0,7);
   if(d.provider==='Railway'&&month!==current)return;
   const cached=(await pool.query('SELECT attempted_at FROM onscreen_v2_billing_sync WHERE provider=$1 AND month=$2',[d.provider,month])).rows[0];
   if(cached&&Date.now()-new Date(cached.attempted_at)<3600000)return;
   try{
    const data=await d.read(month);
    await pool.query(`WITH snapshot AS (INSERT INTO onscreen_v2_billing_snapshots(provider,period_start,period_end,data) VALUES($1,$2,$3,$4) ON CONFLICT(provider,period_start) DO UPDATE SET period_end=$3,data=$4,synced_at=NOW() RETURNING provider) INSERT INTO onscreen_v2_billing_sync(provider,month,status) SELECT provider,$5,'connected' FROM snapshot ON CONFLICT(provider,month) DO UPDATE SET status='connected',attempted_at=NOW()`,[d.provider,data.start,data.end,JSON.stringify(data),month]);
   }catch{
    await pool.query("INSERT INTO onscreen_v2_billing_sync(provider,month,status) VALUES($1,$2,'error') ON CONFLICT(provider,month) DO UPDATE SET status='error',attempted_at=NOW()",[d.provider,month]);
   }
  }));})();active.set(month,job);try{await job;}finally{active.delete(month);}
 }
 async function report(month){
  const snapshots=(await pool.query('SELECT provider,period_start,period_end,data,synced_at FROM onscreen_v2_billing_snapshots ORDER BY period_start DESC LIMIT 100')).rows;
  const states=(await pool.query('SELECT provider,status,attempted_at FROM onscreen_v2_billing_sync WHERE month=$1',[month])).rows;
  const start=new Date(month+'-01T00:00:00Z'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
  const providers=definitions().map(d=>{
   const row=snapshots.find(s=>s.provider===d.provider&&new Date(s.period_start)<end&&new Date(s.period_end)>start);
   const state=states.find(s=>s.provider===d.provider);
   return {provider:d.provider,status:!d.ready?'not_connected':state?.status||'no_history',setup:d.setup,attemptedAt:state?.attempted_at||null,lastSuccess:row?.synced_at||null,snapshot:row?row.data:null};
  });
  return {providers,history:snapshots.map(s=>({provider:s.provider,...s.data,lastSuccess:s.synced_at})),refreshMinutes:60};
 }
 return {sync,report,async init(){
  await pool.query('CREATE TABLE IF NOT EXISTS onscreen_v2_billing_snapshots(provider TEXT NOT NULL,period_start TIMESTAMPTZ NOT NULL,period_end TIMESTAMPTZ NOT NULL,data JSONB NOT NULL,synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(provider,period_start))');
  await pool.query('CREATE TABLE IF NOT EXISTS onscreen_v2_billing_sync(provider TEXT NOT NULL,month TEXT NOT NULL,status TEXT NOT NULL,attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(provider,month))');
  for(const name of ['billing_snapshots','billing_sync'])await pool.query('ALTER TABLE onscreen_v2_'+name+' ENABLE ROW LEVEL SECURITY');
 }};
}
module.exports={createBillingStore};
