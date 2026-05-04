// Exam Monitor MVP server.
// Page-visibility monitoring only. Not a lockdown browser.
// Detects whether each student's tab is currently visible via
// visibilitychange, pagehide, and a 3s heartbeat. It cannot see which app
// or website a student switched to.
//
// Modes:
//   calculator — students get a basic calculator (original behaviour)
//   test       — students get a multiple-choice test built by the professor

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3100;
const STALE_MS = 10_000;            // green requires a heartbeat within this window
const STALE_CHECK_INTERVAL_MS = 2_000;
const DISCONNECT_GRACE_MS = 60_000; // keep student on dashboard this long after disconnect

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.redirect('/professor.html'));

// sessionId -> { id, professorSocketId, students: Map<studentId, Student>,
//                mode: 'calculator'|'test', testId: string|null }
// Student = { id, name, socketId, visible, lastSeen, status, disconnectedAt, inactiveSince }
const sessions = new Map();

// professorSocketId -> sessionId (one active session per professor socket)
const professorSession = new Map();

// testId -> full Test object (including correctOptionId — never sent to students)
// Test = { id, title, questions: [{ id, text, options:[{id,text}], correctOptionId }] }
const tests = new Map();

// sessionId -> Map<studentId, Submission>
// Submission = { answers:{questionId:optionId}, score, total, submittedAt }
const submissions = new Map();

// ─── Helpers ────────────────────────────────────────────────────────────────

function genId(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I for readability
  let id = '';
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function newSessionId() {
  let id;
  do { id = genId(6); } while (sessions.has(id));
  return id;
}

function computeStatus(student) {
  if (!student.visible) return 'red';
  if (Date.now() - student.lastSeen >= STALE_MS) return 'red';
  if (student.disconnectedAt) return 'red';
  return 'green';
}

function emitUpdateIfChanged(session, student) {
  const next = computeStatus(student);
  if (next !== student.status) {
    if (next === 'red') {
      if (!student.inactiveSince) {
        student.inactiveSince = student.visible ? student.lastSeen : Date.now();
      }
    } else {
      student.inactiveSince = null;
    }
    student.status = next;
    io.to(session.professorSocketId).emit('session:studentUpdate', {
      studentId: student.id,
      status: student.status,
      lastSeen: student.lastSeen,
      inactiveSince: student.inactiveSince,
    });
  }
}

function originOf(socket) {
  const origin = socket.handshake.headers.origin;
  if (origin) return origin;
  const host = socket.handshake.headers.host || `localhost:${PORT}`;
  return `http://${host}`;
}

// Drop the professor's prior session (if any), notifying students.
// Returns the prior session's testId if one existed (for cleanup).
function dropPriorSession(professorSocketId) {
  const priorId = professorSession.get(professorSocketId);
  if (!priorId || !sessions.has(priorId)) return null;
  const prior = sessions.get(priorId);
  for (const s of prior.students.values()) {
    io.to(s.socketId).emit('session:ended', {});
  }
  const priorTestId = prior.testId || null;
  sessions.delete(priorId);
  submissions.delete(priorId);
  return priorTestId;
}

async function makeQr(joinUrl) {
  try {
    return await QRCode.toDataURL(joinUrl, { margin: 1, width: 256 });
  } catch (err) {
    console.error('QR generation failed:', err);
    return '';
  }
}

// ─── Socket handlers ─────────────────────────────────────────────────────────

io.on('connection', (socket) => {

  // ── Professor: start a calculator session ────────────────────────────────
  socket.on('professor:startSession', async () => {
    const priorTestId = dropPriorSession(socket.id);
    if (priorTestId) tests.delete(priorTestId);

    const sessionId = newSessionId();
    const joinUrl = `${originOf(socket)}/student.html?session=${sessionId}`;
    const qrDataUrl = await makeQr(joinUrl);

    sessions.set(sessionId, {
      id: sessionId,
      professorSocketId: socket.id,
      students: new Map(),
      mode: 'calculator',
      testId: null,
    });
    professorSession.set(socket.id, sessionId);

    socket.emit('session:started', { sessionId, joinUrl, qrDataUrl, mode: 'calculator' });
  });

  // ── Professor: start a test session ─────────────────────────────────────
  socket.on('professor:startTestSession', async ({ test } = {}) => {
    if (!test || !test.title || !Array.isArray(test.questions) || test.questions.length === 0) {
      socket.emit('session:error', { message: 'Invalid test data.' });
      return;
    }

    const priorTestId = dropPriorSession(socket.id);
    if (priorTestId) tests.delete(priorTestId);

    const testId = genId(8);
    tests.set(testId, { ...test, id: testId });

    const sessionId = newSessionId();
    const joinUrl = `${originOf(socket)}/student.html?session=${sessionId}`;
    const qrDataUrl = await makeQr(joinUrl);

    sessions.set(sessionId, {
      id: sessionId,
      professorSocketId: socket.id,
      students: new Map(),
      mode: 'test',
      testId,
    });
    professorSession.set(socket.id, sessionId);
    submissions.set(sessionId, new Map());

    socket.emit('session:started', { sessionId, joinUrl, qrDataUrl, mode: 'test' });
  });

  // ── Student: join session ────────────────────────────────────────────────
  socket.on('student:join', ({ sessionId, name } = {}) => {
    const session = sessions.get(sessionId);
    if (!session) {
      socket.emit('student:joined', { ok: false, error: 'session-not-found' });
      return;
    }
    const cleanName = String(name || '').trim().slice(0, 40);
    if (!cleanName) {
      socket.emit('student:joined', { ok: false, error: 'name-required' });
      return;
    }
    const studentId = genId(8);
    const student = {
      id: studentId,
      name: cleanName,
      socketId: socket.id,
      visible: true,
      lastSeen: Date.now(),
      status: 'green',
      disconnectedAt: null,
      inactiveSince: null,
    };
    session.students.set(studentId, student);
    socket.data.sessionId = sessionId;
    socket.data.studentId = studentId;

    socket.emit('student:joined', { ok: true, studentId });

    // In test mode: send sanitised questions (no correct answers) to the student.
    if (session.mode === 'test' && session.testId) {
      const test = tests.get(session.testId);
      if (test) {
        const sanitised = {
          title: test.title,
          questions: test.questions.map(q => ({
            id: q.id,
            text: q.text,
            options: q.options.map(o => ({ id: o.id, text: o.text })),
          })),
        };
        socket.emit('test:data', sanitised);
      }
    }

    io.to(session.professorSocketId).emit('session:studentJoined', {
      studentId,
      name: student.name,
      status: student.status,
      lastSeen: student.lastSeen,
      inactiveSince: student.inactiveSince,
      submitted: false,
    });
  });

  // ── Student: submit test answers ─────────────────────────────────────────
  socket.on('student:submitAnswers', ({ answers } = {}) => {
    const { sessionId, studentId } = socket.data;
    if (!sessionId || !studentId) return;
    const session = sessions.get(sessionId);
    if (!session || session.mode !== 'test') return;
    const subMap = submissions.get(sessionId);
    if (!subMap) return;
    // Prevent double submission.
    if (subMap.has(studentId)) return;

    const test = tests.get(session.testId);
    if (!test) return;

    let score = 0;
    const total = test.questions.length;
    for (const q of test.questions) {
      if (answers && answers[q.id] === q.correctOptionId) score++;
    }

    subMap.set(studentId, {
      answers: answers || {},
      score,
      total,
      submittedAt: new Date().toISOString(),
    });

    socket.emit('test:result', { score, total });
    io.to(session.professorSocketId).emit('session:studentSubmitted', { studentId, score, total });
  });

  // ── Visibility / heartbeat ───────────────────────────────────────────────
  function touchFromClient(visible) {
    const { sessionId, studentId } = socket.data;
    if (!sessionId || !studentId) return;
    const session = sessions.get(sessionId);
    if (!session) return;
    const student = session.students.get(studentId);
    if (!student) return;
    student.visible = !!visible;
    student.lastSeen = Date.now();
    student.disconnectedAt = null;
    emitUpdateIfChanged(session, student);
  }

  socket.on('student:visibility', ({ visible } = {}) => touchFromClient(visible));
  socket.on('student:heartbeat',  ({ visible } = {}) => touchFromClient(visible));

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    // Professor disconnect: drop the session and notify any students.
    const sessId = professorSession.get(socket.id);
    if (sessId && sessions.has(sessId)) {
      const session = sessions.get(sessId);
      for (const s of session.students.values()) {
        io.to(s.socketId).emit('session:ended', {});
      }
      const tid = session.testId;
      sessions.delete(sessId);
      submissions.delete(sessId);
      if (tid) tests.delete(tid);
      professorSession.delete(socket.id);
      return;
    }
    // Student disconnect: mark disconnected, keep in session during grace window.
    const { sessionId, studentId } = socket.data;
    if (sessionId && studentId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      const student = session.students.get(studentId);
      if (student) {
        student.disconnectedAt = Date.now();
        emitUpdateIfChanged(session, student);
      }
    }
  });
});

// ─── Periodic stale check ────────────────────────────────────────────────────
// Flip to RED when heartbeats stop; evict students past the grace window.
setInterval(() => {
  const now = Date.now();
  for (const session of sessions.values()) {
    for (const [id, student] of session.students) {
      if (student.disconnectedAt && now - student.disconnectedAt > DISCONNECT_GRACE_MS) {
        session.students.delete(id);
        io.to(session.professorSocketId).emit('session:studentLeft', { studentId: id });
        continue;
      }
      emitUpdateIfChanged(session, student);
    }
  }
}, STALE_CHECK_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`exam-monitor listening on http://localhost:${PORT}`);
  console.log(`  professor: http://localhost:${PORT}/professor.html`);
});
