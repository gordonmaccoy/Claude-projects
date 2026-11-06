const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { Pool } = require('pg');
const { createStore } = require('./store');
const { authConfig, createVerifier } = require('./auth');
const exam = require('./exam');
const { workbook,exportFilename } = require('./export');
const multer=require('multer');
const {extractDocument,parseTest,MAX_BYTES,MAX_TEXT}=require('./documents');
const {createGenerator}=require('./generation');
const {createAIImporter,createAnswerCompleter}=require('./answer-key');

function createApp({ store, verifyUser, config = {}, sweepInterval = 1000, generate=createGenerator(), completeAnswers=createAnswerCompleter(),importWithAI=createAIImporter(), aiConfigured=Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL) }) {
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
  app.use(express.json({ limit: '1mb' }));
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  app.get('/health', wrap(async (req, res) => { await store.activeSessions(); res.json({ ok: true }); }));
  app.get('/api/config', (req, res) => res.json({ supabaseUrl: config.url || '', supabaseKey: config.key || '',uploadMaxBytes:MAX_BYTES,aiConfigured }));
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
    const view = {...exam.privateView(s),serverNow:Date.now()};
    view.joinUrl = `${origin(req)}/student.html?session=${s.id}`;
    view.displayUrl = `${origin(req)}/classroom.html#${s.id}/${s.displayToken}`;
    return view;
  }
  const sent = new Map();
  const studentWireView=(s,st)=>({...exam.studentView(s,st),serverNow:Date.now()});
  function changed(room, event, view,stampClock=false) {
    const value = JSON.stringify(view);
    if (sent.get(room) !== value) { sent.set(room, value); io.to(room).emit(event,stampClock?{...view,serverNow:Date.now()}:view); }
  }
  async function broadcast(s) {
    changed(`professor:${s.id}`, 'professor:update', exam.privateView(s),true);
    changed(`display:${s.id}`, 'display:update', exam.publicView(s));
    for (const st of s.students) changed(`student:${s.id}:${st.id}`, 'student:update', exam.studentView(s, st),true);
  }
  api.get('/me', (req, res) => res.json(req.user));
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_BYTES,files:1,fields:8,fieldSize:MAX_TEXT*4}}).single('file');
  const work=new Map();
  function beginWork(req,res,isAI){const key=req.user.id+':'+(isAI?'ai':'import'),now=Date.now(),previous=work.get(key),interval=isAI?3600000:60000,limit=isAI?5:20;
    const state=previous&&now-previous.start<interval?previous:{start:now,count:0,busy:false};if(state.busy||state.count>=limit){res.status(429).json({error:isAI?'OnScreen AI request limit reached (5 per hour). Please wait before retrying.':'Please wait before processing another document.'});return null;}state.busy=true;state.count++;work.set(key,state);return state;
  }
  for(const mode of ['import','generate','import-ai'])api.post('/'+mode,upload,wrap(async(req,res)=>{
    const isAI=mode!=='import';if(isAI&&!aiConfigured){if(req.file)req.file.buffer.fill(0);return res.status(503).json({error:'AI needs Development OPENAI_API_KEY and OPENAI_MODEL configuration.'});}
    const state=beginWork(req,res,isAI);if(!state){if(req.file)req.file.buffer.fill(0);return;}
    try{const source=req.file?await extractDocument(req.file):(req.body.source||req.body.text);const result=mode==='import'?parseTest(source,req.file?.originalname):mode==='import-ai'?await importWithAI({source,filename:req.file?.originalname}):await generate({source,count:req.body.count,types:req.body.types,difficulty:req.body.difficulty});res.json(result);}
    catch(e){res.status(400).json({error:e.message||'Unable to process this material.'});}finally{state.busy=false;if(req.file)req.file.buffer.fill(0);}
  }));
  api.post('/answer-key',wrap(async(req,res)=>{if(!aiConfigured)return res.status(503).json({error:'AI needs Development OPENAI_API_KEY and OPENAI_MODEL configuration.'});const state=beginWork(req,res,true);if(!state)return;try{res.json(await completeAnswers(req.body.test));}catch(e){res.status(400).json({error:e.message||'Unable to determine answer keys.'});}finally{state.busy=false;}}));
  api.get('/folders',wrap(async(req,res)=>res.json(await store.listFolders(req.user.id))));
  api.post('/folders',wrap(async(req,res)=>{
    const name=typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if(!name || name.length>80) return res.status(400).json({error:'Folder name must be 1–80 characters.'});
    res.json(await store.createFolder(req.user.id,name));
  }));
  api.patch('/folders/:id',wrap(async(req,res)=>{const name=typeof req.body.name==='string'?req.body.name.trim():'';if(!name||name.length>80||/[\x00-\x1f]/.test(name))return res.status(400).json({error:'Use a folder name of 1–80 characters.'});const folder=await store.renameFolder(req.user.id,req.params.id,name);if(!folder)return res.status(404).json({error:'Folder not found'});res.json(folder);}));
  api.delete('/folders/:id',wrap(async(req,res)=>{if(!await store.deleteFolder(req.user.id,req.params.id))return res.status(404).json({error:'Folder not found'});res.json({ok:true});}));
  api.post('/tests/:id/copy',wrap(async(req,res)=>{const test=await store.getTest(req.user.id,req.params.id);if(!test)return res.status(404).json({error:'Test not found'});const title=req.body.title===undefined?(test.title.slice(0,73)+' (copy)'):req.body.title;const copy=exam.validateTest({...test,title});if(!copy)return res.status(400).json({error:'Use a test title of 1–80 characters.'});res.json(await store.saveTest(req.user.id,{...copy,id:require('node:crypto').randomUUID(),folderId:test.folderId||null}));}));
  api.get('/tests', wrap(async (req, res) => res.json(await store.listTests(req.user.id))));
  api.post('/tests', wrap(async (req, res) => {
    const test = exam.validateTest(req.body);
    if (!test) return res.status(400).json({ error: 'Invalid test. Add a title, 1–100 questions, 2–5 choices and a correct answer for each.' });
    let id = req.body.id;
    if (id && !await store.getTest(req.user.id, id)) return res.status(404).json({ error: 'Test not found' });
    if (!id) id = require('node:crypto').randomUUID();
    const folderId=req.body.folderId || null;
    if(folderId && !await store.getFolder(req.user.id,folderId)) return res.status(404).json({error:'Class folder not found'});
    res.json(await store.saveTest(req.user.id, { ...test, id, folderId }));
  }));
  api.delete('/tests/:id', wrap(async (req, res) => {
    if (!await store.getTest(req.user.id, req.params.id)) return res.status(404).json({ error: 'Test not found' });
    await store.deleteTest(req.user.id, req.params.id); res.json({ ok: true });
  }));
  api.get('/sessions', wrap(async (req, res) => res.json((await store.listSessions(req.user.id))
    .filter(s => s.mode === 'test' || s.phase !== 'ended').map(s => exam.privateView(s)))));
  api.post('/sessions', wrap(async (req, res) => {
    const test = req.body.mode === 'calculator' ? null : await store.getTest(req.user.id, req.body.testId);
    if (!test && req.body.mode !== 'calculator') return res.status(404).json({ error: 'Saved test not found' });
    const s = exam.newSession(req.user.id, test,Date.now(),req.body);
    await store.createSession(s); res.json(await decorate(s, req));
  }));
  api.get('/sessions/:id', wrap(async (req, res) => res.json(await decorate(await owned(req.params.id, req.user), req))));
  api.patch('/sessions/:id',wrap(async(req,res)=>{
    await owned(req.params.id,req.user);
    const title=typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if(!title || title.length>120 || /[\x00-\x1f]/.test(title)) return res.status(400).json({error:'Result name must be 1–120 characters.'});
    const {session}=await store.mutate(req.params.id,s=>{
      if(s.ownerId!==req.user.id) throw new Error('Session not found');
      if(s.mode!=='test') {const e=new Error('Only tests can be renamed');e.status=409;throw e;}
      s.resultTitle=title;
    });
    await broadcast(session);res.json(await decorate(session,req));
  }));
  api.delete('/sessions/:id', wrap(async (req, res) => {
    await owned(req.params.id, req.user);
    await store.mutate(req.params.id, s => {
      if (s.ownerId !== req.user.id) { const e = new Error('Session not found'); e.status = 404; throw e; }
      if (s.mode !== 'test' || s.phase !== 'ended') { const e = new Error('Only completed test results can be deleted'); e.status = 409; throw e; }
      // Hide results and invalidate their capabilities without irreversibly erasing grades.
      s.deletedAt = Date.now();
    });
    res.json({ ok: true });
  }));
  api.post('/sessions/:id/extend',wrap(async(req,res)=>{await owned(req.params.id,req.user);const {session,result}=await store.mutate(req.params.id,s=>{try{exam.extend(s,req.user.id,1);return null;}catch(e){return {error:e.message};}});await broadcast(session);if(result?.error)return res.status(409).json({error:result.error});res.json(await decorate(session,req));}));
  for (const action of ['start', 'end', 'override','finalize-fail']) api.post(`/sessions/:id/${action}`, wrap(async (req, res) => {
    await owned(req.params.id, req.user);
    const { session } = await store.mutate(req.params.id, s => {
      if (s.ownerId !== req.user.id) throw new Error('Session not found');
      if (action === 'start') exam.start(s);
      if (action === 'end') { exam.sweep(s); s.phase = 'ended'; s.endedAt = Date.now(); }
      if(action==='finalize-fail')exam.finalizeFail(s,req.body.studentId,req.user.id,req.body.reason);
      if (action === 'override') exam.override(s, req.body.studentId, req.user.id, req.body.reason);
    });
    await broadcast(session);
    if(action==='finalize-fail') {
      for(const client of io.sockets.sockets.values())if(client.data.student?.sessionId===session.id && client.data.student.studentId===req.body.studentId){client.emit('student:finished',studentWireView(session,exam.student(session,req.body.studentId)));client.disconnect(true);}
    }
    res.json(await decorate(session, req));
  }));
  api.get('/sessions/:id/export', wrap(async (req, res) => {
    const original = await owned(req.params.id, req.user);
    if (original.mode !== 'test') return res.status(400).json({ error: 'Calculator sessions have no test scores to export.' });
    const { session } = await store.mutate(req.params.id, s => exam.sweep(s));
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="onscreen-${session.id}.xlsx"; filename*=UTF-8''${encodeURIComponent(exportFilename(session)).replace(/['()*]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase())}`);
    res.send(workbook(session));
  }));
  app.use('/api', api);
  app.use(express.static(path.join(__dirname, 'public'), { etag: false }));
  app.get('/', (req, res) => res.redirect('/professor.html'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if(error.code==='23505')return res.status(409).json({error:'A folder with that name already exists.'});
    if(error instanceof multer.MulterError){
      if(error.code==='LIMIT_FILE_SIZE')return res.status(413).json({error:'The selected file is too large. Maximum upload size is '+(MAX_BYTES/1024/1024)+' MB. Choose a smaller file or paste its text.'});
      if(error.code==='LIMIT_FIELD_VALUE')return res.status(413).json({error:'The pasted source material is too large. Use at most 60,000 characters.'});
      if(['LIMIT_FILE_COUNT','LIMIT_UNEXPECTED_FILE'].includes(error.code))return res.status(400).json({error:'Choose one PDF or DOCX file using the upload field.'});
      return res.status(400).json({error:'The upload could not be read. Reselect the PDF or DOCX file and try again.'});
    }
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
      return { view: {...exam.privateView(s),serverNow:Date.now()} };
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
        exam.sweep(s);
        let result;try{result=exam.join(s,input);}catch(e){return {joinError:e.message};}
        exam.student(s, result.studentId).connectionId = socket.id;
        return result;
      });
      if(result.joinError){await broadcast(session);throw new Error(result.joinError);}
      // A socket can only speak for its most recently authenticated enrollment.
      for (const room of socket.rooms) if (room.startsWith('student:')) socket.leave(room);
      socket.data.student = { sessionId: session.id, studentId: result.studentId };
      socket.join(`student:${session.id}:${result.studentId}`);
      await broadcast(session);
      return { ...result, view: studentWireView(session, exam.student(session, result.studentId)) };
    });
    async function studentMutation(fn, allowLocked=false) {
      const identity = socket.data.student;
      if (!identity) throw new Error('Invalid student session');
      const { session, result } = await store.mutate(identity.sessionId, s => {
        if (exam.student(s, identity.studentId).connectionId !== socket.id) throw new Error('Invalid student connection; resume this page');
        // One row-locked operation has one decision time, including nested rules.
        const now=Date.now();
        exam.sweep(s,now);
        if(s.phase==='ended')return {closed:true};
        if(exam.student(s,identity.studentId).submission?.professorFinalized)return {blocked:true};
        if(!allowLocked && exam.isFailed(exam.student(s,identity.studentId))) return {blocked:true};
        return fn(s, identity.studentId,now);
      });
      await broadcast(session);
      return { ...(result?.blocked ? {ok:false,error:'Call professor: activity is locked'} : {}), view: studentWireView(session, exam.student(session, identity.studentId)) };
    }
    on('student:sync',()=>studentMutation(()=>null,true));
    on('student:visibility', ({ visible }) => studentMutation((s, id, now) => exam.visibility(s, id, visible,now),true));
    on('student:progress',({questionId})=>studentMutation((s,id)=>exam.progress(s,id,questionId)));
    on('student:draft', ({ answers,questionId }) => studentMutation((s, id) => {
      if (s.phase !== 'running') throw new Error('Test is not running');
      const st = exam.student(s, id);
      if (st.submission) throw new Error('Student already submitted');
      st.draft = exam.validateAnswers(s, answers);
      if(questionId && st.draft[questionId]?.trim())exam.progress(s,id,questionId);
      else if(st.progressQuestionId && !st.draft[st.progressQuestionId]?.trim())st.progressQuestionId=null;
    }));
    on('student:submit', ({ answers }) => studentMutation((s, id, now) => exam.submit(s, id, answers,now)));
    // Disconnection never ends an exam or constitutes confirmed hidden time.
    // Last heartbeat expires to red. Resume tokens reconnect the original enrollment.
    socket.on('disconnect', async () => {
      const identity = socket.data.student;
      if (!identity) return;
      try {
        const { session } = await store.mutate(identity.sessionId, s => {
          const st = exam.student(s, identity.studentId);
          if (!st.submission && st.connectionId === socket.id) st.lastSeen = 0;
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
  if (process.env.RAILWAY_ENVIRONMENT_NAME && process.env.RAILWAY_ENVIRONMENT_NAME.toLowerCase() !== 'development') {
    throw new Error('This V2 build is restricted to Railway Development');
  }
  if (!config.url || !config.key) console.warn('Professor sign-in disabled: configure Development Supabase Auth.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 10000 });
  const store = createStore(pool); await store.init();
  const runtime = createApp({ store, config, verifyUser: createVerifier(config) });
  runtime.server.listen(process.env.PORT || 3100, () => console.log('OnScreen V2 development server started'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await runtime.close(); await pool.end(); });
}
if (require.main === module) main().catch(error => { console.error('Startup failed:', error.message); process.exitCode = 1; });
module.exports = { createApp };
