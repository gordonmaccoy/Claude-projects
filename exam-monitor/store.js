// PostgreSQL is the authority: no successful write is acknowledged before COMMIT.
// V2 tables are additive. Legacy onscreen_* records are preserved for explicit migration.
function createStore(pool) {
  if (!pool) throw new Error('DATABASE_URL is required');
  return {
    async init() {
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
    },
    async saveTest(ownerId, test) {
      const r = await pool.query(`INSERT INTO onscreen_v2_tests(id,owner_id,data) VALUES($1,$2,$3)
        ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()
        WHERE onscreen_v2_tests.owner_id=EXCLUDED.owner_id RETURNING id`, [test.id, ownerId, JSON.stringify(test)]);
      if (!r.rows.length) throw new Error('Test not found');
      return test;
    },
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
