const {randomUUID}=require('node:crypto');
const bad=()=>Object.assign(new Error('Check the month, provider and non-negative USD amounts.'),{status:400});
function validMonth(month){if(typeof month!=='string'||!/^20\d\d-(0[1-9]|1[0-2])$/.test(month))throw bad();return month;}
function createCostStore(pool){
 const billing=require("./billing-store").createBillingStore(pool);
 async function log(actor,action,details){await pool.query('INSERT INTO onscreen_v2_cost_audit(id,actor,action,details) VALUES($1,$2,$3,$4)',[randomUUID(),actor,action,JSON.stringify(details)]);}
 const methods={
  async syncBilling(){const now=new Date();for(let i=0;i<3;i++){const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1));await billing.sync(d.toISOString().slice(0,7));}},
  async recordAIUsage(event){
   const count=n=>Number.isSafeInteger(n)&&n>=0?n:null;
   const input=count(event.input),output=count(event.output),cached=Math.min(count(event.cached)||0,input||0);
   await pool.query(`INSERT INTO onscreen_v2_ai_usage(id,model,feature,input_tokens,cached_tokens,output_tokens,status,estimated_usd)
    VALUES($1,$2,$3,$4,$5,$6,$7,(SELECT (($4::bigint-$5::bigint)*input_rate+$5::bigint*cached_rate+$6::bigint*output_rate)/1000000 FROM onscreen_v2_ai_rates WHERE model=$2))`,[randomUUID(),event.model,event.feature,input,cached,output,event.status]);
  },
  async adminSaveRate(actor,v){
   if(!v||typeof v.model!=='string'||!v.model.trim()||v.model.length>120||![v.input,v.cached,v.output].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100000)||v.cached>v.input)throw bad();
   await pool.query(`WITH changed AS (INSERT INTO onscreen_v2_ai_rates(model,input_rate,cached_rate,output_rate) VALUES($1,$2,$3,$4) ON CONFLICT(model) DO UPDATE SET input_rate=$2,cached_rate=$3,output_rate=$4,updated_at=NOW() RETURNING model) INSERT INTO onscreen_v2_cost_audit(id,actor,action,details) SELECT $5,$6,'rate.saved',$7 FROM changed`,[v.model.trim(),v.input,v.cached,v.output,randomUUID(),actor,JSON.stringify(v)]);return {ok:true};
  },
  async adminSaveCost(actor,v){
   validMonth(v?.month);if(!['Railway','OpenAI','Supabase','Email','Domain','Other'].includes(v.provider)||!['actual','estimate'].includes(v.kind)||typeof v.amount!=='number'||!Number.isFinite(v.amount)||v.amount<0||v.amount>1000000||Math.abs(v.amount*100-Math.round(v.amount*100))>0.00001||typeof v.note!=='string'||v.note.length>500)throw bad();
   await pool.query(`WITH changed AS (INSERT INTO onscreen_v2_cost_entries(month,provider,amount,kind,note) VALUES($1,$2,$3,$4,$5) ON CONFLICT(month,provider) DO UPDATE SET amount=$3,kind=$4,note=$5,updated_at=NOW() RETURNING provider) INSERT INTO onscreen_v2_cost_audit(id,actor,action,details) SELECT $6,$7,'cost.saved',$8 FROM changed`,[v.month,v.provider,v.amount,v.kind,v.note,randomUUID(),actor,JSON.stringify(v)]);return {ok:true};
  },
  async adminCosts(month){
   validMonth(month);await billing.sync(month);const automatic=await billing.report(month);const params=[month+'-01'];
   const where="WHERE created_at >= $1::date AND created_at < $1::date + INTERVAL '1 month'";
   const summary=`COUNT(*)::int AS requests,COUNT(*) FILTER(WHERE status<>'completed')::int AS failures,COUNT(*) FILTER(WHERE estimated_usd IS NULL)::int AS unpriced,COALESCE(SUM(input_tokens),0)::float8 AS input_tokens,COALESCE(SUM(output_tokens),0)::float8 AS output_tokens,COALESCE(SUM(estimated_usd),0)::float8 AS estimated_usd`;
   return {automatic,month,currency:'USD',updatedAt:new Date().toISOString(),ai:(await pool.query('SELECT '+summary+' FROM onscreen_v2_ai_usage '+where,params)).rows[0],features:(await pool.query('SELECT feature,model,'+summary+' FROM onscreen_v2_ai_usage '+where+' GROUP BY feature,model ORDER BY requests DESC',params)).rows,rates:(await pool.query('SELECT model,input_rate::float8 AS input,cached_rate::float8 AS cached,output_rate::float8 AS output,updated_at FROM onscreen_v2_ai_rates ORDER BY model')).rows,entries:(await pool.query('SELECT month,provider,amount::float8 AS amount,kind,note,updated_at FROM onscreen_v2_cost_entries WHERE month=$1 ORDER BY provider',[month])).rows,history:(await pool.query('SELECT action,details,created_at FROM onscreen_v2_cost_audit ORDER BY created_at DESC LIMIT 15')).rows};
  }
 };
 return {methods,async init(){
  await billing.init();
  await pool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_ai_rates(model TEXT PRIMARY KEY,input_rate NUMERIC NOT NULL,cached_rate NUMERIC NOT NULL,output_rate NUMERIC NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_ai_usage(id TEXT PRIMARY KEY,model TEXT NOT NULL,feature TEXT NOT NULL,input_tokens BIGINT,cached_tokens BIGINT,output_tokens BIGINT,status TEXT NOT NULL,estimated_usd NUMERIC,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("CREATE INDEX IF NOT EXISTS onscreen_v2_ai_usage_date ON onscreen_v2_ai_usage(created_at)");
  await pool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_cost_entries(month TEXT NOT NULL,provider TEXT NOT NULL,amount NUMERIC NOT NULL,kind TEXT NOT NULL,note TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(month,provider))");
  await pool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_cost_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,details JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  for(const table of ['ai_rates','ai_usage','cost_entries','cost_audit'])await pool.query('ALTER TABLE onscreen_v2_'+table+' ENABLE ROW LEVEL SECURITY');
 }};
}
module.exports={createCostStore,validMonth};
