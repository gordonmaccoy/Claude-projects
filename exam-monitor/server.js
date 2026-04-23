// Exam Monitor MVP server.
// Page-visibility monitoring only. Not a lockdown browser.
// Detects whether each student's calculator tab is currently visible via
// visibilitychange, pagehide, and a 3s heartbeat. It cannot see which app
// or website a student switched to.

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3100;
const STALE_MS = 10_000;           // green requires a heartbeat within this window
const STALE_CHECK_INTERVAL_MS = 2_000;
const DISCONNECT_GRACE_MS = 60_000; // keep student on the dashboard this long after socket disconnect

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// sessionId -> { id, professorSocketId, students: Map<studentId, Student> }
// Student = { id, name, socketId, visible, lastSeen, status, disconnectedAt }
const sessions = new Map();
// professorSocketId -> sessionId (one active session per professor socket)
const professorSession = new Map();

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
      // Start the inactivity clock. If we already have a lastSeen from before the
      // student went quiet (heartbeat stopped while visible), anchor there; otherwise
      // use "now" (the moment we saw the hide / disconnect).
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
  // Prefer the Origin header the browser sent; fall back to Host.
  const origin = socket.handshake.headers.origin;
  if (origin) return origin;
  const host = socket.handshake.headers.host || `localhost:${PORT}`;
  return `http://${host}`;
}

io.on('connection', (socket) => {
  socket.on('professor:startSession', async () => {
    // Drop any prior session belonging to this professor socket.
    const priorId = professorSession.get(socket.id);
    if (priorId && sessions.has(priorId)) {
      const prior = sessions.get(priorId);
      for (const s of prior.students.values()) {
        io.to(s.socketId).emit('session:ended', {});
      }
      sessions.delete(priorId);
    }

    const sessionId = newSessionId();
    const joinUrl = `${originOf(socket)}/student.html?session=${sessionId}`;
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 1, width: 256 });
    } catch (err) {
      console.error('QR generation failed:', err);
    }

    sessions.set(sessionId, {
      id: sessionId,
      professorSocketId: socket.id,
      students: new Map(),
    });
    professorSession.set(socket.id, sessionId);

    socket.emit('session:started', { sessionId, joinUrl, qrDataUrl });
  });

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
    // Remember session+studentId on the socket for quick lookup on events/disconnect.
    socket.data.sessionId = sessionId;
    socket.data.studentId = studentId;
    socket.emit('student:joined', { ok: true, studentId });
    io.to(session.professorSocketId).emit('session:studentJoined', {
      studentId,
      name: student.name,
      status: student.status,
      lastSeen: student.lastSeen,
      inactiveSince: student.inactiveSince,
    });
  });

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
  socket.on('student:heartbeat', ({ visible } = {}) => touchFromClient(visible));

  socket.on('disconnect', () => {
    // Professor disconnect: drop the session and notify any students.
    const sessId = professorSession.get(socket.id);
    if (sessId && sessions.has(sessId)) {
      const session = sessions.get(sessId);
      for (const s of session.students.values()) {
        io.to(s.socketId).emit('session:ended', {});
      }
      sessions.delete(sessId);
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

// Periodic stale check: flip to RED when heartbeats stop, and evict students
// who have been disconnected past the grace window.
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
