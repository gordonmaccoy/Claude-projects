const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { Pool } = require('pg');
const { createStore } = require('./store');
const { authConfig, createVerifier } = require('./auth');
const exam = require('./exam');
const { workbook } = require('./export');

function createApp({ store, verifyUser, config = {}, sweepInterval = 1000 }) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 128 * 1024, cors: { origin: config.origin || false } });
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '128kb' }));
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  app.get('/health', wrap(async (req, res) => { await store.activeSessions(); res.json({ ok: true }); }));
  app.get('/api/config', (req, res) => res.json({ supabaseUrl: config.url || '', supabaseKey: config.key || '' }));
  app.use('/api', (req, res, next) => Promise.resolve().then(async () => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    req.user = await verifyUser(token);
    if (!req.user) return res.status(401).json({ error: 'Please sign in with a verified professor account.' });
    // Continue only after remote identity validation, never from client claims.
    req.authenticated = true;
    next();
  }).catch(next));
  const api = express.Router();
  api.use((req, res, next) => req.authenticated ? next() : res.status(401).json({ error: 'Sign in required' }));
  const owned = async (id, user) => {
    const s = await store.getSession(id);
    if (!s || s.ownerId !== user.id) { const e = new Error('Session not found'); e.status = 404; throw e; }
    return s;
  };
  const origin = req => config.origin || `http://${req.headers.host}`;
  async function decorate(s, req) {
    const view = exam.privateView(s);
    view.joinUrl = `${origin(req)}/student.html?session=${s.id}`;
    view.displayUrl = `${origin(req)}/classroom.html#${s.id}/${s.displayToken}`;
    return view;
  }
  const sent = new Map();
  function changed(room, event, view) {
    const value = JSON.stringify(view);
    if (sent.get(room) !== value) { sent.set(room, value); io.to(room).emit(event, view); }
  }
  async function broadcast(s) {
    changed(`professor:${s.id}`, 'professor:update', exam.privateView(s));
    changed(`display:${s.id}`, 'display:update', exam.publicView(s));
    for (const st of s.students) changed(`student:${s.id}:${st.id}`, 'student:update', exam.studentView(s, st));
  }
  api.get('/me', (req, res) => res.json(req.user));
  api.get('/tests', wrap(async (req, res) => res.json(await store.listTests(req.user.id))));
  api.post('/tests', wrap(async (req, res) => {
    const test = exam.validateTest(req.body);
    if (!test) return res.status(400).json({ error: 'Invalid test. Add a title, 1–100 questions, 2–5 choices and a correct answer for each.' });
    let id = req.body.id;
    if (id && !await store.getTest(req.user.id, id)) return res.status(404).json({ error: 'Test not found' });
    if (!id) id = require('node:crypto').randomUUID();
    res.json(await store.saveTest(req.user.id, { ...test, id }));
  }));
  api.delete('/tests/:id', wrap(async (req, res) => {
    if (!await store.getTest(req.user.id, req.params.id)) return res.status(404).json({ error: 'Test not found' });
    await store.deleteTest(req.user.id, req.params.id); res.json({ ok: true });
  }));
  api.get('/sessions', wrap(async (req, res) => res.json((await store.listSessions(req.user.id)).map(s => exam.privateView(s)))));
  api.post('/sessions', wrap(async (req, res) => {
    const test = req.body.mode === 'calculator' ? null : await store.getTest(req.user.id, req.body.testId);
    if (!test && req.body.mode !== 'calculator') return res.status(404).json({ error: 'Saved test not found' });
    const s = exam.newSession(req.user.id, test);
    await store.createSession(s); res.json(await decorate(s, req));
  }));
  api.get('/sessions/:id', wrap(async (req, res) => res.json(await decorate(await owned(req.params.id, req.user), req))));
  for (const action of ['start', 'end', 'override']) api.post(`/sessions/:id/${action}`, wrap(async (req, res) => {
    await owned(req.params.id, req.user);
    const { session } = await store.mutate(req.params.id, s => {
      if (s.ownerId !== req.user.id) throw new Error('Session not found');
      if (action === 'start') exam.start(s);
      if (action === 'end') { exam.sweep(s); s.phase = 'ended'; s.endedAt = Date.now(); }
      if (action === 'override') exam.override(s, req.body.studentId, req.user.id, req.body.reason);
    });
    await broadcast(session); res.json(await decorate(session, req));
  }));
  api.get('/sessions/:id/export', wrap(async (req, res) => {
    await owned(req.params.id, req.user);
    const { session } = await store.mutate(req.params.id, s => exam.sweep(s));
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="onscreen-${session.id}.xlsx"`);
    res.send(workbook(session));
  }));
  app.use('/api', api);
  app.use(express.static(path.join(__dirname, 'public'), { etag: false }));
  app.get('/', (req, res) => res.redirect('/professor.html'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Request failed:', error.message);
    res.status(error.status || 400).json({ error: error.status === 404 ? 'Session not found' : 'Unable to complete request. Check connection and retry.' });
  });

  io.on('connection', socket => {
    let inFlight = 0;
    function on(name, handler) {
      socket.on(name, async (data, ack) => {
        if (typeof ack !== 'function') return;
        if (inFlight >= 8) return ack({ ok: false, error: 'Too many pending requests' });
        inFlight++;
        try { ack({ ok: true, ...await handler(data || {}) }); }
        catch (error) { ack({ ok: false, error: /not found|Invalid|already|ended|required|not running|full|waiting|many/.test(error.message) ? error.message : 'Storage unavailable. Retry shortly.' }); }
        finally { inFlight--; }
      });
    }
    on('professor:watch', async ({ sessionId, token }) => {
      const user = await verifyUser(token);
      if (!user) throw new Error('Invalid authentication');
      const s = await owned(sessionId, user);
      for (const room of socket.rooms) if (room.startsWith('professor:')) socket.leave(room);
      socket.data.professor = { token, sessionId, verifiedAt: Date.now() };
      socket.join(`professor:${sessionId}`);
      return { view: exam.privateView(s) };
    });
    on('display:watch', async ({ sessionId, token }) => {
      const s = await store.getSession(sessionId);
      if (!s || typeof token !== 'string' || s.displayToken !== token) throw new Error('Invalid display link');
      socket.join(`display:${sessionId}`);
      const joinUrl = `${config.origin || `http://${socket.handshake.headers.host}`}/student.html?session=${s.id}`;
      return { view: exam.publicView(s), joinUrl, qrDataUrl: await QRCode.toDataURL(joinUrl, { width: 600, margin: 2 }) };
    });
    on('student:join', async input => {
      const { session, result } = await store.mutate(input.sessionId, s => {
        const result = exam.join(s, input);
        exam.student(s, result.studentId).connectionId = socket.id;
        return result;
      });
      // A socket can only speak for its most recently authenticated enrollment.
      for (const room of socket.rooms) if (room.startsWith('student:')) socket.leave(room);
      socket.data.student = { sessionId: session.id, studentId: result.studentId };
      socket.join(`student:${session.id}:${result.studentId}`);
      await broadcast(session);
      return { ...result, view: exam.studentView(session, exam.student(session, result.studentId)) };
    });
    async function studentMutation(fn) {
      const identity = socket.data.student;
      if (!identity) throw new Error('Invalid student session');
      const { session } = await store.mutate(identity.sessionId, s => {
        if (exam.student(s, identity.studentId).connectionId !== socket.id) throw new Error('Invalid student connection; resume this page');
        return fn(s, identity.studentId);
      });
      await broadcast(session);
      return { view: exam.studentView(session, exam.student(session, identity.studentId)) };
    }
    on('student:visibility', ({ visible }) => studentMutation((s, id) => exam.visibility(s, id, visible)));
    on('student:draft', ({ answers }) => studentMutation((s, id) => {
      if (s.phase !== 'running') throw new Error('Test is not running');
      const st = exam.student(s, id);
      if (st.submission) throw new Error('Student already submitted');
      st.draft = exam.validateAnswers(s, answers);
    }));
    on('student:submit', ({ answers }) => studentMutation((s, id) => exam.submit(s, id, answers)));
    // Disconnection never ends an exam or constitutes confirmed hidden time.
    // Last heartbeat expires to red. Resume tokens reconnect the original enrollment.
    socket.on('disconnect', async () => {
      const identity = socket.data.student;
      if (!identity) return;
      try {
        const { session } = await store.mutate(identity.sessionId, s => {
          const st = exam.student(s, identity.studentId);
          if (st.connectionId === socket.id) st.lastSeen = 0;
        });
        await broadcast(session);
      } catch (error) { console.error('Unable to record disconnection:', error.message); }
    });
  });
  let sweeping = false;
  async function tick() {
    if (sweeping) return;
    sweeping = true;
    try {
      for (const socket of io.sockets.sockets.values()) {
        const p = socket.data.professor;
        if (p && Date.now() - p.verifiedAt > 60000) {
          const user = await verifyUser(p.token);
          if (!user) { socket.leave(`professor:${p.sessionId}`); delete socket.data.professor; socket.emit('auth:expired'); }
          else p.verifiedAt = Date.now();
        }
      }
      for (const s of await store.activeSessions()) {
        const { session } = await store.mutate(s.id, draft => exam.sweep(draft));
        await broadcast(session);
      }
    } catch (error) { console.error('Monitoring storage unavailable:', error.message); }
    finally { sweeping = false; }
  }
  const timer = sweepInterval ? setInterval(tick, sweepInterval) : null;
  return { app, server, io, tick, close: async () => { if (timer) clearInterval(timer); await new Promise(resolve => io.close(resolve)); } };
}
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Configure Railway Development PostgreSQL.');
  const config = authConfig();
  if (!config.origin) throw new Error('APP_ORIGIN is required (the Development app HTTPS URL)');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 10000 });
  const store = createStore(pool); await store.init();
  const runtime = createApp({ store, config, verifyUser: createVerifier(config) });
  runtime.server.listen(process.env.PORT || 3100, () => console.log('OnScreen V2 development server started'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await runtime.close(); await pool.end(); });
}
if (require.main === module) main().catch(error => { console.error('Startup failed:', error.message); process.exitCode = 1; });
module.exports = { createApp };
