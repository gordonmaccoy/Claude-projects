const {randomUUID}=require('node:crypto');
const {problem}=require('./account-store');
const PLANS=['beta','free','pro','institution'];
function createAdminStore(pool,accounts){
 async function audit(client,actor,action,target,details={}){await client.query('INSERT INTO onscreen_v2_admin_audit(id,actor_id,action,target_id,details) VALUES($1,$2,$3,$4,$5)',[randomUUID(),actor,action,target,JSON.stringify(details)]);}
 const accountSource=`FROM onscreen_v2_accounts a LEFT JOIN onscreen_v2_share_identities i ON i.owner_id=a.owner_id LEFT JOIN onscreen_v2_admin_accounts m ON m.owner_id=a.owner_id`;
 const methods={
  async adminEmailIdentity(email){return (await pool.query('SELECT owner_id AS id,email FROM onscreen_v2_share_identities WHERE email=$1',[email])).rows[0]||null;},
  async accountPlan(id){return (await pool.query('SELECT plan FROM onscreen_v2_admin_accounts WHERE owner_id=$1',[id])).rows[0]?.plan||'beta';},
  async isAccountBanned(user){return !!(await pool.query('SELECT email FROM onscreen_v2_admin_bans WHERE email=$1 OR owner_id=$2',[(user.email||'').trim().toLowerCase(),user.id])).rows.length;},
  async adminBans(){return {items:(await pool.query('SELECT email,reason,created_at FROM onscreen_v2_admin_bans ORDER BY created_at DESC')).rows};},
  async adminBan(actor,email,reason){await pool.query(`WITH changed AS (INSERT INTO onscreen_v2_admin_bans(email,owner_id,reason) VALUES($1,(SELECT owner_id FROM onscreen_v2_share_identities WHERE email=$1 LIMIT 1),$2) ON CONFLICT(email) DO UPDATE SET reason=$2 RETURNING email) INSERT INTO onscreen_v2_admin_audit(id,actor_id,action,target_id) SELECT $3,$4,'email.banned',email FROM changed`,[email,reason,randomUUID(),actor]);return {ok:true};},
  async adminUnban(actor,email){await pool.query(`WITH changed AS (DELETE FROM onscreen_v2_admin_bans WHERE email=$1 RETURNING email) INSERT INTO onscreen_v2_admin_audit(id,actor_id,action,target_id) SELECT $2,$3,'email.unbanned',email FROM changed`,[email,randomUUID(),actor]);return {ok:true};},
  async getAccountForAdmin(id){return (await pool.query("SELECT a.owner_id,i.email FROM onscreen_v2_accounts a LEFT JOIN onscreen_v2_share_identities i USING(owner_id) WHERE a.owner_id=$1 AND a.state='active'",[id])).rows[0]||null;},
  async isAdmin(user,config={}){
   if(!user?.id||!user.email||(!config.ownerEmail&&!config.ownerId))return false;
   if(config.ownerId)return user.id===config.ownerId;
   let owner=(await pool.query('SELECT owner_id FROM onscreen_v2_admin_owner WHERE singleton=TRUE')).rows[0];
   if(!owner&&user.email.toLowerCase()===config.ownerEmail.toLowerCase()){
    // A unique singleton makes the first verified identity binding atomic.
    await pool.query('INSERT INTO onscreen_v2_admin_owner(singleton,owner_id) VALUES(TRUE,$1) ON CONFLICT DO NOTHING',[user.id]);
    owner=(await pool.query('SELECT owner_id FROM onscreen_v2_admin_owner WHERE singleton=TRUE')).rows[0];
   }
   return owner?.owner_id===user.id;
  },
  async recordAccountActivity(user){return accounts.withOwner(user.id,()=>pool.query(`INSERT INTO onscreen_v2_admin_accounts(owner_id,last_seen_at) VALUES($1,NOW()) ON CONFLICT(owner_id) DO UPDATE SET last_seen_at=NOW() WHERE onscreen_v2_admin_accounts.last_seen_at IS NULL OR onscreen_v2_admin_accounts.last_seen_at<NOW()-INTERVAL '5 minutes'`,[user.id]));},
  async adminOverview(){const row=(await pool.query(`SELECT
   (SELECT COUNT(*)::int FROM onscreen_v2_accounts WHERE state='active') AS accounts,
   (SELECT COUNT(*)::int FROM onscreen_v2_admin_accounts m JOIN onscreen_v2_accounts a USING(owner_id) WHERE a.state='active' AND m.last_seen_at>NOW()-INTERVAL '7 days') AS active_week,
   (SELECT COUNT(*)::int FROM onscreen_v2_tests WHERE data->>'deletedAt' IS NULL) AS quizzes,
   (SELECT COUNT(*)::int FROM onscreen_v2_games) AS games,
   (SELECT COUNT(*)::int FROM onscreen_v2_sessions WHERE data->>'phase'<>'ended' AND data->>'deletedAt' IS NULL) AS live_quizzes,
   (SELECT COUNT(*)::int FROM onscreen_v2_game_sessions WHERE expires_at>$1 AND data->>'phase' NOT IN ('podium','closed')) AS live_games,
   (SELECT COUNT(*)::int FROM onscreen_v2_contacts c LEFT JOIN onscreen_v2_admin_support s ON s.contact_id=c.id WHERE COALESCE(s.state,'open')<>'resolved') AS open_requests`,[Date.now()])).rows[0];return row;},
  async adminAccounts({q='',page=0}){
   const where=`WHERE a.state<>'deleted' AND ($1='' OR POSITION(LOWER($1) IN LOWER(COALESCE(i.email,'')||' '||COALESCE(a.profile->>'firstName','')||' '||COALESCE(a.profile->>'lastName','')||' '||COALESCE(a.profile->>'institution','')))>0)`;
   const total=(await pool.query('SELECT COUNT(*)::int AS count '+accountSource+' '+where,[q])).rows[0].count;
   const items=(await pool.query(`SELECT a.owner_id AS id,a.state,i.email,a.profile->>'firstName' AS first_name,a.profile->>'lastName' AS last_name,a.profile->>'institution' AS institution,a.profile->>'country' AS country,EXISTS(SELECT 1 FROM onscreen_v2_admin_bans b WHERE b.email=i.email OR b.owner_id=a.owner_id) AS banned,COALESCE(m.plan,'beta') AS plan,COALESCE(m.note,'') AS note,COALESCE(m.version,0) AS version,m.last_seen_at,
    (SELECT COUNT(*)::int FROM onscreen_v2_tests t WHERE t.owner_id=a.owner_id AND t.data->>'deletedAt' IS NULL) AS quizzes,
    (SELECT COUNT(*)::int FROM onscreen_v2_sessions s WHERE s.owner_id=a.owner_id AND s.data->>'deletedAt' IS NULL) AS sessions
    ${accountSource} ${where} ORDER BY m.last_seen_at DESC NULLS LAST,a.owner_id LIMIT 25 OFFSET $2`,[q,page*25])).rows;
   return {items,total,page,pageSize:25};
  },
  async adminUpdateAccount(actor,id,input){
   validateEdit(input,'plan',PLANS);
   return accounts.withOwner(id,async()=>{
    const existing=(await pool.query('SELECT * FROM onscreen_v2_admin_accounts WHERE owner_id=$1 FOR UPDATE',[id])).rows[0];
    if((existing?.version||0)!==input.version)throw problem('This account was updated elsewhere. Refresh and try again.');
    await pool.query(`INSERT INTO onscreen_v2_admin_accounts(owner_id,plan,note,version) VALUES($1,$2,$3,1) ON CONFLICT(owner_id) DO UPDATE SET plan=$2,note=$3,version=onscreen_v2_admin_accounts.version+1`,[id,input.plan,input.note.trim()]);
    await audit(pool,actor,'account.updated',id,{fromPlan:existing?.plan||'beta',toPlan:input.plan,noteChanged:(existing?.note||'')!==input.note.trim()});
    return {ok:true};
   });
  },
  async adminSupport({state='',page=0,q=''}){
   const source=`FROM onscreen_v2_contacts c LEFT JOIN onscreen_v2_admin_support s ON s.contact_id=c.id WHERE ($1='' OR COALESCE(s.state,'open')=$1) AND ($2='' OR POSITION(LOWER($2) IN LOWER(COALESCE(c.data->>'email','')||' '||COALESCE(c.data->>'subject','')||' '||COALESCE(c.data->>'message','')))>0)`;
   const total=(await pool.query('SELECT COUNT(*)::int AS count '+source,[state,q])).rows[0].count;
   const items=(await pool.query(`SELECT c.id,c.data,c.status,c.created_at,COALESCE(s.state,'open') AS state,COALESCE(s.note,'') AS note,COALESCE(s.version,0) AS version ${source} ORDER BY c.created_at DESC,c.id LIMIT 25 OFFSET $3`,[state,q,page*25])).rows.map(({data,...row})=>({...data,...row}));
   return {items,total,page,pageSize:25};
  },
  async adminUpdateSupport(actor,id,input){
   validateEdit(input,'state',['open','in_progress','resolved']);
   const owner=(await pool.query('SELECT owner_id FROM onscreen_v2_contacts WHERE id=$1',[id])).rows[0]?.owner_id;
   if(!owner)throw problem('Request not found.',404);
   return accounts.withOwner(owner,async()=>{
    if(!(await pool.query('SELECT id FROM onscreen_v2_contacts WHERE id=$1',[id])).rows.length)throw problem('Request not found.',404);
    const old=(await pool.query('SELECT * FROM onscreen_v2_admin_support WHERE contact_id=$1 FOR UPDATE',[id])).rows[0];
    if((old?.version||0)!==input.version)throw problem('This request was updated elsewhere. Refresh and try again.');
    await pool.query(`INSERT INTO onscreen_v2_admin_support(contact_id,owner_id,state,note,version) VALUES($1,$2,$3,$4,1) ON CONFLICT(contact_id) DO UPDATE SET state=$3,note=$4,version=onscreen_v2_admin_support.version+1`,[id,owner,input.state,input.note.trim()]);
    await audit(pool,actor,'support.updated',id,{fromState:old?.state||'open',toState:input.state,noteChanged:(old?.note||'')!==input.note.trim()});return {ok:true};
   });
  },
  async adminAudit({page=0,q=''}){const source="FROM onscreen_v2_admin_audit WHERE ($1='' OR POSITION(LOWER($1) IN LOWER(action||' '||target_id))>0)";const total=(await pool.query('SELECT COUNT(*)::int AS count '+source,[q])).rows[0].count;return {items:(await pool.query('SELECT * '+source+' ORDER BY created_at DESC,id LIMIT 25 OFFSET $2',[q,page*25])).rows,total,page,pageSize:25};}
 };
 return {methods,async init(){
  await pool.query('CREATE TABLE IF NOT EXISTS onscreen_v2_admin_owner(singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton=TRUE),owner_id TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await pool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_admin_accounts(owner_id TEXT PRIMARY KEY REFERENCES onscreen_v2_accounts(owner_id),plan TEXT NOT NULL DEFAULT 'beta' CHECK(plan IN ('beta','free','pro','institution')),note TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 0,last_seen_at TIMESTAMPTZ)");
  await pool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_admin_support(contact_id TEXT PRIMARY KEY REFERENCES onscreen_v2_contacts(id) ON DELETE CASCADE,owner_id TEXT NOT NULL REFERENCES onscreen_v2_accounts(owner_id),state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','in_progress','resolved')),note TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 0)");
  await pool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_admin_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT NOT NULL,details JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_admin_bans(email TEXT PRIMARY KEY,owner_id TEXT,reason TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  for(const suffix of ['owner','accounts','support','audit','bans'])await pool.query('ALTER TABLE onscreen_v2_admin_'+suffix+' ENABLE ROW LEVEL SECURITY');
  await pool.query('CREATE INDEX IF NOT EXISTS onscreen_v2_admin_audit_date ON onscreen_v2_admin_audit(created_at DESC)');
 }};
}
function validateEdit(input,key,values){if(!input||Object.keys(input).some(k=>![key,'note','version'].includes(k))||!values.includes(input[key])||typeof input.note!=='string'||input.note.length>2000||!Number.isSafeInteger(input.version)||input.version<0)throw problem('Check the selected option and note (maximum 2,000 characters), then retry.',400);}
module.exports={createAdminStore};
