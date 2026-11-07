// PostgreSQL persistence for tests, sessions, students, and submissions.
// Set DATABASE_URL on Railway. No tables or records are created without it.
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  : null;

async function init() {
  if (!pool) return false;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onscreen_tests (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, questions JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS onscreen_sessions (
      id TEXT PRIMARY KEY, mode TEXT NOT NULL, test_id TEXT REFERENCES onscreen_tests(id),
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ended_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS onscreen_students (
      session_id TEXT NOT NULL REFERENCES onscreen_sessions(id),
      student_id TEXT NOT NULL, name TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(session_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS onscreen_submissions (
      session_id TEXT NOT NULL, student_id TEXT NOT NULL,
      answers JSONB NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(session_id, student_id),
      FOREIGN KEY(session_id, student_id)
        REFERENCES onscreen_students(session_id, student_id)
    );
  `);
  return true;
}

async function saveTestAndSession(test, session) {
  if (!pool) throw new Error('Database is not configured');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO onscreen_tests (id,title,questions) VALUES ($1,$2,$3)', [
      test.id, test.title, JSON.stringify(test.questions),
    ]);
    await client.query('INSERT INTO onscreen_sessions (id,mode,test_id) VALUES ($1,$2,$3)', [
      session.id, session.mode, session.testId,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function saveStudent(sessionId, studentId, name) {
  if (!pool) return;
  await pool.query(
    'INSERT INTO onscreen_students (session_id,student_id,name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
    [sessionId, studentId, name],
  );
}

async function saveSubmission(sessionId, studentId, submission) {
  if (!pool) throw new Error('Database is not configured');
  const result = await pool.query(
    `INSERT INTO onscreen_submissions (session_id,student_id,answers,score,total)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING student_id`,
    [sessionId, studentId, JSON.stringify(submission.answers), submission.score, submission.total],
  );
  return result.rowCount === 1;
}

async function endSession(sessionId) {
  if (!pool) return;
  await pool.query('UPDATE onscreen_sessions SET ended_at=NOW() WHERE id=$1 AND ended_at IS NULL', [sessionId]);
}

module.exports = { init, configured: Boolean(pool), saveTestAndSession, saveStudent, saveSubmission, endSession };
