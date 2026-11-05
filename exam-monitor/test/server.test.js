const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { PGlite } = require('@electric-sql/pglite');
const { io } = require('socket.io-client');
const { unzipSync, strFromU8 } = require('fflate');
const { createStore } = require('../store');
const { createApp } = require('../server');

test('HTTP/socket exam flow enforces ownership, recovers after restart, sanitizes display and exports text IDs', async () => {
  const db = new PGlite(); let queue = Promise.resolve();
  async function lease() { const previous = queue; let release; queue = new Promise(r => release = r); await previous; return { query: (...a) => db.query(...a), release }; }
  const pool = { connect: lease, query: async (...a) => { const c = await lease(); try { return await c.query(...a); } finally { c.release(); } } };
  const store = createStore(pool); await store.init();
  const verifyUser = async token => token === 'alice' || token === 'bob' ? { id: token, email: `${token}@example.com` } : null;
  let running; const sockets = [];
  async function boot() { running = createApp({ store, verifyUser, sweepInterval: 0 }); running.server.listen(0, '127.0.0.1'); await once(running.server, 'listening'); return `http://127.0.0.1:${running.server.address().port}`; }
  let base = await boot();
  const request = async (route, method = 'GET', body, who = 'alice') => {
    const r = await fetch(base + route, { method, headers: { Authorization: `Bearer ${who}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  async function socket() { const s = io(base, { transports: ['websocket'], forceNew: true }); sockets.push(s); await once(s, 'connect'); return s; }
  const emit = (s, name, data) => new Promise((resolve, reject) => s.timeout(3000).emit(name, data, (err, res) => err ? reject(err) : resolve(res)));
  try {
    assert.equal((await request('/api/tests', 'GET', undefined, 'invalid')).status, 401);
    const saved = await request('/api/tests', 'POST', { title: 'Quiz', questions: [{ id: 'q', text: '2+2?', options: [{ id: 'a', text: '4' }, { id: 'b', text: '5' }], correctOptionId: 'a' }] });
    assert.equal(saved.status, 200);
    const launched = await request('/api/sessions', 'POST', { testId: saved.body.id });
    const sid = launched.body.id;
    assert.equal((await request(`/api/sessions/${sid}`, 'GET', undefined, 'bob')).status, 404);
    assert.equal((await request('/api/tests', 'GET', undefined, 'bob')).body.length, 0);
    assert.equal((await request(`/api/tests/${saved.body.id}`, 'DELETE', undefined, 'bob')).status, 404);
    const publicSocket = await socket();
    const publicAck = await emit(publicSocket, 'display:watch', { sessionId: sid, token: launched.body.displayToken });
    assert.equal(publicAck.ok, true);
    assert.equal((await emit(publicSocket, 'professor:watch', { sessionId: sid, token: 'invalid' })).ok, false);
    const a = await socket();
    const joined = await emit(a, 'student:join', { sessionId: sid, name: '=Kim & Lee', number: '0010' });
    assert.equal(joined.ok, true); assert.equal(joined.view.test, null);
    assert.equal((await emit(a, 'student:join', { sessionId: sid, name: 'Kim', number: '0010' })).ok, false);
    const b = await socket();
    const joinedB = await emit(b, 'student:join', { sessionId: sid, name: 'Park', number: '0002' });
    assert.equal(joinedB.ok, true);
    const updated = once(publicSocket, 'display:update');
    await request(`/api/sessions/${sid}/start`, 'POST', {});
    const [pub] = await updated;
    assert.deepEqual(Object.keys(pub.students[0]).sort(), ['name', 'status']);
    assert.equal(JSON.stringify(pub).includes('0010'), false);
    const resumedView = (await emit(a, 'student:join', { sessionId: sid, resumeToken: joined.resumeToken })).view;
    assert.equal(resumedView.test.questions[0].correctOptionId, undefined);
    await emit(a, 'student:draft', { answers: { q: 'a' } });
    sockets.forEach(s => s.disconnect()); await running.close();
    base = await boot();
    const reconnect = await socket();
    const resume = await emit(reconnect, 'student:join', { sessionId: sid, resumeToken: joined.resumeToken });
    assert.equal(resume.ok, true); assert.equal(resume.view.draft.q, 'a');
    const responses = await Promise.all([emit(reconnect, 'student:submit', { answers: { q: 'a' } }), emit(reconnect, 'student:submit', { answers: { q: 'a' } })]);
    assert.equal(responses.filter(r => r.ok).length, 1);
    assert.equal(responses.find(r => r.ok).view.result.percentage, 100);
    const reconnectB = await socket();
    await emit(reconnectB, 'student:join', { sessionId: sid, resumeToken: joinedB.resumeToken });
    await emit(reconnectB, 'student:visibility', { visible: false });
    await store.mutate(sid, s => { s.students.find(st => st.id === joinedB.studentId).hiddenSince = Date.now() - 6000; });
    await running.tick();
    const failedResult = await emit(reconnectB, 'student:submit', { answers: { q: 'a' } });
    assert.equal(failedResult.view.result.score, 0);
    assert.equal(failedResult.view.result.failed, true);
    const overridden = await request(`/api/sessions/${sid}/override`, 'POST', { studentId: joinedB.studentId, reason: 'Verified OS interruption' });
    const restoredStudent = overridden.body.students.find(st => st.id === joinedB.studentId);
    assert.equal(restoredStudent.result.originalScore, 1); assert.equal(restoredStudent.score, 1);
    assert.equal(restoredStudent.events.at(-1).reason, 'Verified OS interruption');
    const failed = await request(`/api/sessions/${sid}/override`, 'POST', { studentId: joined.studentId, reason: 'invalid' }, 'bob');
    assert.equal(failed.status, 404);
    const download = await fetch(`${base}/api/sessions/${sid}/export`, { headers: { Authorization: 'Bearer alice' } });
    assert.equal(download.status, 200);
    const files = unzipSync(new Uint8Array(await download.arrayBuffer()));
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    assert.ok(sheet.indexOf('0002') < sheet.indexOf('0010'));
    assert.ok(sheet.includes('t="inlineStr"><is><t xml:space="preserve">0010'));
    assert.ok(sheet.includes('=Kim &amp; Lee')); assert.equal(sheet.includes('<f>'), false);
    assert.ok(sheet.includes('student number')); assert.ok(sheet.includes('percentage'));
    await request(`/api/sessions/${sid}/end`, 'POST', {});
    assert.equal((await request(`/api/sessions/${sid}`)).body.phase, 'ended');
    assert.equal((await emit(reconnect, 'student:join', { sessionId: sid, resumeToken: joined.resumeToken })).view.result.score, 1);
  } finally { sockets.forEach(s => s.disconnect()); await running.close(); await db.close(); }
});
