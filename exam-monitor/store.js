// PostgreSQL is the authority: no successful write is acknowledged before COMMIT.
// V2 tables are additive. Legacy onscreen_* records are preserved for explicit migration.
function createStore(pool) {
  if (!pool) throw new Error('DATABASE_URL is required');
  return {
    async init() {
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
      await pool.query(`CREATE TABLE IF NOT EXISTS onscreen_v2_folders (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
        UNIQUE(owner_id,name)
      )`);
    },
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
    async listFolders(ownerId) { return (await pool.query('SELECT id,name FROM onscreen_v2_folders WHERE owner_id=$1 ORDER BY name',[ownerId])).rows; },
    async getFolder(ownerId,id) { return (await pool.query('SELECT id,name FROM onscreen_v2_folders WHERE id=$1 AND owner_id=$2',[id,ownerId])).rows[0] || null; },
    async createFolder(ownerId,name) {
      const id=require('node:crypto').randomUUID();
      return (await pool.query('INSERT INTO onscreen_v2_folders(id,owner_id,name) VALUES($1,$2,$3) RETURNING id,name',[id,ownerId,name])).rows[0];
    },
    async renameFolder(ownerId,id,name){return (await pool.query('UPDATE onscreen_v2_folders SET name=$3 WHERE id=$1 AND owner_id=$2 RETURNING id,name',[id,ownerId,name])).rows[0]||null;},
    async deleteFolder(ownerId,id){const client=await pool.connect();try{await client.query('BEGIN');const folder=(await client.query('SELECT id FROM onscreen_v2_folders WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,ownerId])).rows[0];if(!folder){await client.query('COMMIT');return false;}
      await client.query(`UPDATE onscreen_v2_tests SET data=jsonb_set(data,'{folderId}','null'::jsonb),updated_at=NOW() WHERE owner_id=$1 AND data->>'folderId'=$2`,[ownerId,id]);await client.query('DELETE FROM onscreen_v2_folders WHERE id=$1 AND owner_id=$2',[id,ownerId]);await client.query('COMMIT');return true;
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},
    async saveTest(ownerId,test){const client=await pool.connect();try{await client.query('BEGIN');if(test.folderId && !(await client.query('SELECT id FROM onscreen_v2_folders WHERE id=$1 AND owner_id=$2 FOR KEY SHARE',[test.folderId,ownerId])).rows.length)throw new Error('Class folder not found');
      const r=await client.query(`INSERT INTO onscreen_v2_tests(id,owner_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW() WHERE onscreen_v2_tests.owner_id=EXCLUDED.owner_id RETURNING id`,[test.id,ownerId,JSON.stringify(test)]);if(!r.rows.length)throw new Error('Test not found');await client.query('COMMIT');return test;
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},
    async listTests(ownerId) {
      return (await pool.query('SELECT data FROM onscreen_v2_tests WHERE owner_id=$1 ORDER BY updated_at DESC', [ownerId])).rows.map(r => r.data);
    },
    async getTest(ownerId, id) {
      return (await pool.query('SELECT data FROM onscreen_v2_tests WHERE id=$1 AND owner_id=$2', [id, ownerId])).rows[0]?.data || null;
    },
    async deleteTest(ownerId, id) {
      await pool.query('DELETE FROM onscreen_v2_tests WHERE id=$1 AND owner_id=$2', [id, ownerId]);
    },
    async createSession(s) {
      await pool.query('INSERT INTO onscreen_v2_sessions(id,owner_id,data) VALUES($1,$2,$3)', [s.id, s.ownerId, JSON.stringify(s)]);
      return s;
    },
    async getSession(id) {
      return (await pool.query("SELECT data FROM onscreen_v2_sessions WHERE id=$1 AND data->>'deletedAt' IS NULL", [id])).rows[0]?.data || null;
    },
    async listSessions(ownerId) {
      return (await pool.query("SELECT data FROM onscreen_v2_sessions WHERE owner_id=$1 AND data->>'deletedAt' IS NULL ORDER BY created_at DESC", [ownerId])).rows.map(r => r.data);
    },
    async activeSessions() {
      return (await pool.query("SELECT data FROM onscreen_v2_sessions WHERE data->>'phase' <> 'ended'")).rows.map(r => r.data);
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
}
module.exports = { createStore };
