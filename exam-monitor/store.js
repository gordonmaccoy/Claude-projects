// PostgreSQL is the authority: no successful write is acknowledged before COMMIT.
// V2 tables are additive. Legacy onscreen_* records are preserved for explicit migration.
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const trashTables = { quizzes: 'onscreen_v2_tests', results: 'onscreen_v2_sessions' };

function createStore(pool) {
  if (!pool) throw new Error('DATABASE_URL is required');
  const accounts=require('./account-store').createAccountStore(pool);pool=accounts.pool;
  const store={
    async init() {
      await accounts.init();
      await pool.query(`CREATE TABLE IF NOT EXISTS onscreen_v2_onboarding (
        owner_id TEXT PRIMARY KEY, data JSONB NOT NULL
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS onscreen_v2_tests (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS onscreen_v2_tests_owner ON onscreen_v2_tests(owner_id)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS onscreen_v2_sessions (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS onscreen_v2_sessions_owner ON onscreen_v2_sessions(owner_id)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS onscreen_v2_folder_order (owner_id TEXT PRIMARY KEY, ids JSONB NOT NULL)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS onscreen_v2_folders (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
        UNIQUE(owner_id,name)
      )`);
    },
    async hasWorkspaceHistory(ownerId){return (await pool.query('SELECT EXISTS(SELECT 1 FROM onscreen_v2_onboarding WHERE owner_id=$1) OR EXISTS(SELECT 1 FROM onscreen_v2_tests WHERE owner_id=$1) OR EXISTS(SELECT 1 FROM onscreen_v2_sessions WHERE owner_id=$1) AS used',[ownerId])).rows[0].used;},
    async initializeOnboarding(ownerId,starter){
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        // Concurrent logins wait on the same owner key; seed and marker commit together.
        const inserted=await client.query(`INSERT INTO onscreen_v2_onboarding(owner_id,data) VALUES($1,'{}'::jsonb) ON CONFLICT(owner_id) DO NOTHING RETURNING owner_id`,[ownerId]);
        if(inserted.rows.length){
          const existing=(await client.query(`SELECT EXISTS(SELECT 1 FROM onscreen_v2_tests WHERE owner_id=$1) OR EXISTS(SELECT 1 FROM onscreen_v2_sessions WHERE owner_id=$1) AS used`,[ownerId])).rows[0].used;
          const state={version:1,tourDismissed:existing};
          if(!existing)await client.query('INSERT INTO onscreen_v2_tests(id,owner_id,data) VALUES($1,$2,$3)',[starter.id,ownerId,JSON.stringify(starter)]);
          await client.query('UPDATE onscreen_v2_onboarding SET data=$2 WHERE owner_id=$1',[ownerId,JSON.stringify(state)]);
        }
        const state=(await client.query('SELECT data FROM onscreen_v2_onboarding WHERE owner_id=$1 FOR UPDATE',[ownerId])).rows[0].data;
        await client.query('COMMIT');return state;
      }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
    },
    async dismissOnboarding(ownerId){
      return (await pool.query(`UPDATE onscreen_v2_onboarding SET data=jsonb_set(data,'{tourDismissed}','true'::jsonb) WHERE owner_id=$1 RETURNING data`,[ownerId])).rows[0]?.data||null;
    },
    async listFolders(ownerId) { return (await pool.query('SELECT f.id,f.name FROM onscreen_v2_folders f LEFT JOIN onscreen_v2_folder_order o ON o.owner_id=f.owner_id WHERE f.owner_id=$1 ORDER BY (SELECT position FROM jsonb_array_elements_text(o.ids) WITH ORDINALITY AS r(id,position) WHERE r.id=f.id) NULLS LAST, f.name',[ownerId])).rows; },
    async orderFolders(ownerId,ids) {
      if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)return false;
      const client=await pool.connect();try{await client.query('BEGIN');
        const {rows}=await client.query('SELECT id FROM onscreen_v2_folders WHERE owner_id=$1 FOR UPDATE',[ownerId]);
        const existing=new Set(rows.map(row=>row.id));
        if(existing.size!==ids.length||ids.some(id=>!existing.has(id))){await client.query('ROLLBACK');return false;}
        await client.query('INSERT INTO onscreen_v2_folder_order(owner_id,ids) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET ids=EXCLUDED.ids',[ownerId,JSON.stringify(ids)]);
        await client.query('COMMIT');return true;
      }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
    },
    async getFolder(ownerId,id) { return (await pool.query('SELECT id,name FROM onscreen_v2_folders WHERE id=$1 AND owner_id=$2',[id,ownerId])).rows[0] || null; },
    async createFolder(ownerId,name) {
      const id=require('node:crypto').randomUUID();
      return (await pool.query('INSERT INTO onscreen_v2_folders(id,owner_id,name) VALUES($1,$2,$3) RETURNING id,name',[id,ownerId,name])).rows[0];
    },
    async renameFolder(ownerId,id,name){return (await pool.query('UPDATE onscreen_v2_folders SET name=$3 WHERE id=$1 AND owner_id=$2 RETURNING id,name',[id,ownerId,name])).rows[0]||null;},
    async deleteFolder(ownerId,id){const client=await pool.connect();try{await client.query('BEGIN');const folder=(await client.query('SELECT id FROM onscreen_v2_folders WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,ownerId])).rows[0];if(!folder){await client.query('COMMIT');return false;}
      await client.query(`UPDATE onscreen_v2_tests SET data=jsonb_set(data,'{folderId}','null'::jsonb),updated_at=NOW() WHERE owner_id=$1 AND data->>'folderId'=$2`,[ownerId,id]);await client.query('DELETE FROM onscreen_v2_folders WHERE id=$1 AND owner_id=$2',[id,ownerId]);await client.query('COMMIT');return true;
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},
    async saveTest(ownerId,test,updateOnly=false){const client=await pool.connect();try{await client.query('BEGIN');if(test.folderId && !(await client.query('SELECT id FROM onscreen_v2_folders WHERE id=$1 AND owner_id=$2 FOR KEY SHARE',[test.folderId,ownerId])).rows.length)throw new Error('Class folder not found');
      const r=await client.query(updateOnly?"UPDATE onscreen_v2_tests SET data=$3::jsonb || jsonb_build_object('sortOrder', data->'sortOrder'),updated_at=NOW() WHERE id=$1 AND owner_id=$2 AND data->>'deletedAt' IS NULL RETURNING id":`INSERT INTO onscreen_v2_tests(id,owner_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW() WHERE onscreen_v2_tests.owner_id=EXCLUDED.owner_id AND onscreen_v2_tests.data->>'deletedAt' IS NULL RETURNING id`,[test.id,ownerId,JSON.stringify(test)]);if(!r.rows.length)throw new Error('Test not found');await client.query('COMMIT');return test;
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},
    async listTests(ownerId) {
      return (await pool.query("SELECT data FROM onscreen_v2_tests WHERE owner_id=$1 AND data->>'deletedAt' IS NULL ORDER BY (data->>'sortOrder')::integer NULLS LAST, updated_at DESC, id", [ownerId])).rows.map(r => r.data);
    },
    async getTest(ownerId, id) {
      return (await pool.query("SELECT data FROM onscreen_v2_tests WHERE id=$1 AND owner_id=$2 AND data->>'deletedAt' IS NULL", [id, ownerId])).rows[0]?.data || null;
    },
    async deleteTest(ownerId, id) {
      return (await pool.query(
        "UPDATE onscreen_v2_tests SET data=jsonb_set(data,'{deletedAt}',to_jsonb($3::bigint)) WHERE id=$1 AND owner_id=$2 AND data->>'deletedAt' IS NULL RETURNING id",
        [id,ownerId,Date.now()]
      )).rows.length>0;
    },
    async orderTests(ownerId,folderId,ids,movedId) {
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        const {rows}=await client.query("SELECT id FROM onscreen_v2_tests WHERE owner_id=$1 AND COALESCE(data->>'folderId','')=$2 AND data->>'deletedAt' IS NULL FOR UPDATE",[ownerId,folderId]);
        const existing=new Set(rows.map(row=>row.id));
        if(movedId&&!existing.has(movedId)) {
          if(folderId&&!await store.getFolder(ownerId,folderId)){await client.query('ROLLBACK');return false;}
          const moved=await client.query("UPDATE onscreen_v2_tests SET data=jsonb_set(data,'{folderId}',COALESCE(to_jsonb(NULLIF($3::text,'')),'null'::jsonb)) WHERE owner_id=$1 AND id=$2 AND data->>'deletedAt' IS NULL RETURNING id",[ownerId,movedId,folderId]);
          if(!moved.rows.length){await client.query('ROLLBACK');return false;}
          existing.add(movedId);
        }
        if(existing.size!==ids.length||ids.some(id=>!existing.has(id))) {
          await client.query('ROLLBACK');return false;
        }
        await client.query("UPDATE onscreen_v2_tests t SET data=jsonb_set(t.data,'{sortOrder}',to_jsonb(r.position::integer)) FROM unnest($2::text[]) WITH ORDINALITY AS r(id,position) WHERE t.owner_id=$1 AND t.id=r.id",[ownerId,ids]);
        await client.query('COMMIT');return true;
      } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
    },
    async deleteTrashResults(ownerId,ids,now=Date.now()) {
      const {rows}=await pool.query("DELETE FROM onscreen_v2_sessions WHERE owner_id=$1 AND id=ANY($2::text[]) AND (data->>'deletedAt')::bigint>$3 RETURNING id",[ownerId,ids,now-TRASH_RETENTION_MS]);
      return rows.length;
    },
    async listTrash(ownerId,now=Date.now()) {
      const groups=await Promise.all(Object.entries(trashTables).map(async ([kind,table])=>{
        const {rows}=await pool.query(
          `SELECT id,COALESCE(NULLIF(data->>'resultTitle',''),data->>'title',data->'test'->>'title') AS title,
                  (data->>'deletedAt')::bigint AS deleted_at
             FROM ${table}
            WHERE owner_id=$1 AND (data->>'deletedAt')::bigint>$2`,
          [ownerId,now-TRASH_RETENTION_MS]
        );
        return rows.map(row=>({id:row.id,title:row.title,kind,deletedAt:Number(row.deleted_at),expiresAt:Number(row.deleted_at)+TRASH_RETENTION_MS}));
      }));
      return groups.flat().sort((a,b)=>b.deletedAt-a.deletedAt);
    },
    async changeTrash(ownerId,kind,id,restore,now=Date.now()) {
      if(!Object.hasOwn(trashTables,kind)) return false;
      const table=trashTables[kind];
      const condition="WHERE owner_id=$1 AND id=$2 AND (data->>'deletedAt')::bigint>$3 RETURNING id";
      const query=restore?`UPDATE ${table} SET data=data-'deletedAt' ${condition}`:`DELETE FROM ${table} ${condition}`;
      return (await pool.query(query,[ownerId,id,now-TRASH_RETENTION_MS])).rows.length>0;
    },
    async purgeExpiredTrash(now=Date.now()) {
      for(const table of Object.values(trashTables)) {
        await pool.query(`DELETE FROM ${table} WHERE (data->>'deletedAt')::bigint<=$1`,[now-TRASH_RETENTION_MS]);
      }
    },
    async createSession(s) {
      await pool.query('INSERT INTO onscreen_v2_sessions(id,owner_id,data) VALUES($1,$2,$3)', [s.id, s.ownerId, JSON.stringify(s)]);
      return s;
    },
    async getSession(id) {
      return (await pool.query("SELECT data FROM onscreen_v2_sessions WHERE id=$1 AND data->>'deletedAt' IS NULL AND NOT EXISTS(SELECT 1 FROM onscreen_v2_accounts a WHERE a.owner_id=onscreen_v2_sessions.owner_id AND a.state<>'active')", [id])).rows[0]?.data || null;
    },
    async listSessions(ownerId) {
      return (await pool.query("SELECT data FROM onscreen_v2_sessions WHERE owner_id=$1 AND data->>'deletedAt' IS NULL ORDER BY created_at DESC", [ownerId])).rows.map(r => r.data);
    },
    async activeSessions() {
      return (await pool.query("SELECT data FROM onscreen_v2_sessions WHERE data->>'phase' <> 'ended' AND NOT EXISTS(SELECT 1 FROM onscreen_v2_accounts a WHERE a.owner_id=onscreen_v2_sessions.owner_id AND a.state<>'active')")).rows.map(r => r.data);
    },
    async mutate(id, fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const s = (await client.query("SELECT data FROM onscreen_v2_sessions WHERE id=$1 AND data->>'deletedAt' IS NULL FOR UPDATE", [id])).rows[0]?.data;
        if (!s) throw new Error('Session not found');
        const result = await fn(s);
        await client.query('UPDATE onscreen_v2_sessions SET data=$2 WHERE id=$1', [id, JSON.stringify(s)]);
        await client.query('COMMIT');
        return { session: s, result };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally { client.release(); }
    },
  };
  for(const name of ['initializeOnboarding','dismissOnboarding','createFolder','renameFolder','deleteFolder','saveTest','deleteTest','changeTrash','orderTests','orderFolders','deleteTrashResults']){
    const operation=store[name];store[name]=(...args)=>accounts.withOwner(args[0],()=>operation(...args));
  }
  const createSession=store.createSession;store.createSession=s=>accounts.withOwner(s.ownerId,()=>createSession(s));
  const mutate=store.mutate;store.mutate=async(id,fn)=>{const owner=(await pool.query('SELECT owner_id FROM onscreen_v2_sessions WHERE id=$1',[id])).rows[0]?.owner_id;if(!owner)throw new Error('Session not found');return accounts.withOwner(owner,()=>mutate(id,fn));};
  return Object.assign(store,accounts.methods);
}
module.exports = { createStore };
