const {AsyncLocalStorage}=require('node:async_hooks');
const {randomUUID}=require('node:crypto');
function problem(message,status=409){return Object.assign(new Error(message),{status});}
function createAccountStore(rawPool){
 const context=new AsyncLocalStorage();let savepoint=0;
 // Existing repository transactions become savepoints inside an owner transaction.
 // This keeps a single connection and prevents pool exhaustion from nested leases.
 const pool={query(...args){return (context.getStore()?.client||rawPool).query(...args);},async connect(){
  const current=context.getStore();if(!current)return rawPool.connect();const name='owner_nested_'+(++savepoint);let begun=false;
  return {async query(sql,...args){const command=typeof sql==='string'?sql.trim().toUpperCase():'';
   if(command==='BEGIN'){begun=true;return current.client.query('SAVEPOINT '+name);}
   if(command==='COMMIT'&&begun){begun=false;return current.client.query('RELEASE SAVEPOINT '+name);}
   if(command==='ROLLBACK'&&begun){begun=false;await current.client.query('ROLLBACK TO SAVEPOINT '+name);return current.client.query('RELEASE SAVEPOINT '+name);}
   return current.client.query(sql,...args);
  },release(){}};
 }};
 async function withOwner(ownerId,fn,{allowInactive=false}={}){
  const current=context.getStore();if(current){if(current.ownerId!==ownerId)throw new Error('Owner transaction mismatch');return fn(current.account);}
  const client=await rawPool.connect();try{await client.query('BEGIN');await client.query("INSERT INTO onscreen_v2_accounts(owner_id) VALUES($1) ON CONFLICT DO NOTHING",[ownerId]);
   const account=(await client.query('SELECT state,profile FROM onscreen_v2_accounts WHERE owner_id=$1 FOR UPDATE',[ownerId])).rows[0];
   if(!allowInactive&&account.state!=='active')throw problem('Account deletion is in progress or complete.',423);
   const result=await context.run({client,ownerId,account},()=>fn(account));await client.query('COMMIT');return result;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 function contact(row){return row?{...row.data,id:row.id,status:row.status,createdAt:row.created_at}:null;}
 const methods={
  async getAccount(ownerId){return withOwner(ownerId,account=>({...account}),{allowInactive:true});},
  async accountState(ownerId){return (await pool.query('SELECT state FROM onscreen_v2_accounts WHERE owner_id=$1',[ownerId])).rows[0]?.state||'active';},
  async saveProfile(ownerId,profile){return withOwner(ownerId,async()=>{await pool.query('UPDATE onscreen_v2_accounts SET profile=$2 WHERE owner_id=$1',[ownerId,JSON.stringify(profile)]);return profile;});},
  async saveContact(ownerId,email,input){return withOwner(ownerId,async()=>{
   const data={email,category:input.category,subject:input.subject,message:input.message};
   const previous=(await pool.query('SELECT * FROM onscreen_v2_contacts WHERE owner_id=$1 AND request_key=$2',[ownerId,input.requestId])).rows[0];
   if(previous){if(JSON.stringify(previous.data)!==JSON.stringify(data)){
     // JSONB key order differs from JS insertion order; compare fields explicitly.
     if(Object.keys(data).some(k=>previous.data[k]!==data[k]))throw problem('This request reference was already used. Start a new message.');
    }return contact(previous);}
   const id=randomUUID();return contact((await pool.query('INSERT INTO onscreen_v2_contacts(id,owner_id,request_key,data) VALUES($1,$2,$3,$4) RETURNING *',[id,ownerId,input.requestId,JSON.stringify(data)])).rows[0]);
  });},
  async listContacts(ownerId){return (await pool.query('SELECT * FROM onscreen_v2_contacts WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 20',[ownerId])).rows.map(contact);},
  async supportInbox(){return (await pool.query('SELECT * FROM onscreen_v2_contacts ORDER BY created_at DESC LIMIT 100')).rows.map(contact);},
  async queuedContacts(){return (await pool.query("SELECT c.id FROM onscreen_v2_contacts c JOIN onscreen_v2_accounts a ON a.owner_id=c.owner_id WHERE c.status='queued' AND c.next_at<=NOW() AND a.state='active' ORDER BY c.created_at LIMIT 10")).rows.map(r=>r.id);},
  async deliverContact(id,send){const owner=(await pool.query('SELECT owner_id FROM onscreen_v2_contacts WHERE id=$1',[id])).rows[0]?.owner_id;if(!owner)return;
   return withOwner(owner,async()=>{const row=(await pool.query('SELECT * FROM onscreen_v2_contacts WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)return;if(row.status==='sent')return contact(row);
    await send(contact(row));await pool.query("UPDATE onscreen_v2_contacts SET status='sent' WHERE id=$1",[id]);return contact({...row,status:'sent'});
   });
  },
  async delayContact(id){await pool.query("UPDATE onscreen_v2_contacts SET next_at=NOW()+INTERVAL '5 minutes' WHERE id=$1 AND status='queued'",[id]);},
  async beginDeletion(ownerId){return withOwner(ownerId,async account=>{
   if(account.state!=='active')return {state:account.state};
   const active=(await pool.query("SELECT EXISTS(SELECT 1 FROM onscreen_v2_sessions WHERE owner_id=$1 AND data->>'phase'<>'ended') AS active",[ownerId])).rows[0].active;
   if(active)throw problem('End all sessions before deleting your account.');
   await pool.query("UPDATE onscreen_v2_accounts SET state='deleting',retry_at=NOW() WHERE owner_id=$1",[ownerId]);return {state:'deleting'};
  },{allowInactive:true});},
  async pendingDeletions(){return (await pool.query("SELECT owner_id FROM onscreen_v2_accounts WHERE state='deleting' AND retry_at<=NOW() LIMIT 5")).rows.map(r=>r.owner_id);},
  async completeDeletion(ownerId,removeIdentity){return withOwner(ownerId,async account=>{
   if(account.state==='deleted')return {state:'deleted'};if(account.state!=='deleting')throw problem('Account deletion has not been requested.');
   await removeIdentity(ownerId);
   for(const table of ['contacts','folders','tests','sessions','onboarding'])await pool.query('DELETE FROM onscreen_v2_'+table+' WHERE owner_id=$1',[ownerId]);
   await pool.query("UPDATE onscreen_v2_accounts SET state='deleted',profile='{}'::jsonb WHERE owner_id=$1",[ownerId]);return {state:'deleted'};
  },{allowInactive:true});},
  async delayDeletion(ownerId){await pool.query("UPDATE onscreen_v2_accounts SET retry_at=NOW()+INTERVAL '1 minute' WHERE owner_id=$1 AND state='deleting'",[ownerId]);}
 };
 return {pool,withOwner,methods,async init(){
  await rawPool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_accounts(owner_id TEXT PRIMARY KEY,state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','deleting','deleted')),profile JSONB NOT NULL DEFAULT '{}'::jsonb,retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await rawPool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_contacts(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,request_key TEXT NOT NULL,data JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),next_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(owner_id,request_key))");
  await rawPool.query('CREATE INDEX IF NOT EXISTS onscreen_v2_contacts_owner ON onscreen_v2_contacts(owner_id,created_at DESC)');
  await rawPool.query("CREATE INDEX IF NOT EXISTS onscreen_v2_contacts_queue ON onscreen_v2_contacts(next_at) WHERE status='queued'");
 }};
}
module.exports={createAccountStore,problem};
