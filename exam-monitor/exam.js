const { randomBytes, createHash } = require('node:crypto');
const token = () => randomBytes(24).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
function validateTest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 80) return null;
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 100) return null;

  const seenQuestions = new Set();
  const questions = [];
  for (const q of input.questions) {
    if (!q || typeof q !== 'object' || typeof q.id !== 'string' ||
        !q.id || q.id.length > 100 || seenQuestions.has(q.id) ||
        typeof q.text !== 'string' || !q.text.trim() || q.text.length > 300 ||
        !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5 ||
        typeof q.correctOptionId !== 'string') return null;
    seenQuestions.add(q.id);

    const seenOptions = new Set();
    const options = [];
    for (const o of q.options) {
      if (!o || typeof o.id !== 'string' || !o.id || o.id.length > 100 ||
          seenOptions.has(o.id) || typeof o.text !== 'string' ||
          !o.text.trim() || o.text.length > 200) return null;
      seenOptions.add(o.id);
      options.push({ id: o.id, text: o.text.trim() });
    }
    if (!seenOptions.has(q.correctOptionId)) return null;
    questions.push({ id: q.id, text: q.text.trim(), options, correctOptionId: q.correctOptionId });
  }
  return { title: input.title.trim(), questions };
}

function newSession(ownerId, test, now = Date.now()) {
  return { id: randomBytes(6).toString('hex').toUpperCase(), ownerId, displayToken: token(),
    mode: test ? 'test' : 'calculator', test: test ? structuredClone(test) : null,
    phase: test ? 'waiting' : 'running', createdAt: now, startedAt: test ? null : now,
    endedAt: null, students: [] };
}
function join(s, input, now = Date.now()) {
  if (typeof input.resumeToken === 'string') {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(input.resumeToken)) throw new Error('Invalid resume token');
    const st = s.students.find(x => x.tokenHash === hash(input.resumeToken));
    if (st) return { studentId: st.id, resumeToken: input.resumeToken };
    if (!input.name || !input.number) throw new Error('Invalid resume token');
  }
  if (s.phase === 'ended') throw new Error('Session ended');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const number = typeof input.number === 'string' ? input.number.trim() : '';
  if (!name || name.length > 80 || !number || number.length > 64 || /[\x00-\x1f]/.test(name + number)) throw new Error('Student number and name are required (maximum 64 / 80 characters)');
  if (s.students.some(x => x.number === number)) throw new Error('Student number already joined. Resume on the original browser or ask your professor.');
  if (s.students.length >= 1000) throw new Error('Classroom is full');
  const resumeToken = input.resumeToken || token();
  const st = { id: token(), tokenHash: hash(resumeToken), number, name, visible: true, lastSeen: now,
    hiddenSince: null, failedAt: null, overrideAt: null, draft: {}, submission: null, events: [] };
  s.students.push(st);
  return { studentId: st.id, resumeToken };
}
function student(s, id) {
  const st = s.students.find(x => x.id === id);
  if (!st) throw new Error('Student not found');
  return st;
}
function isFailed(st) { return st.failedAt !== null && st.overrideAt === null; }
function sweep(s, now = Date.now()) {
  let changed = false;
  if (s.mode !== 'test' || s.phase !== 'running') return false;
  for (const st of s.students) {
    if (!st.submission && !isFailed(st) && st.hiddenSince !== null && now - st.hiddenSince > 5000) {
      st.failedAt = now; st.overrideAt = null;
      st.events.push({ type: 'fail', at: now, hiddenSince: st.hiddenSince });
      changed = true;
    }
  }
  return changed;
}
function start(s, now = Date.now()) {
  if (s.phase !== 'waiting') throw new Error('Test is not waiting');
  s.phase = 'running'; s.startedAt = now;
  for (const st of s.students) st.hiddenSince = st.visible ? null : now;
}
function visibility(s, id, visible, now = Date.now()) {
  if (typeof visible !== 'boolean') throw new Error('Invalid visibility');
  sweep(s, now); // evaluate the elapsed interval BEFORE a return clears it
  const st = student(s, id);
  const wasVisible = st.visible;
  if (st.visible !== visible) st.events.push({ type: visible ? 'visible' : 'hidden', at: now });
  st.visible = visible; st.lastSeen = now;
  if (visible) st.hiddenSince = null;
  else if (s.phase === 'running' && st.hiddenSince === null && wasVisible) st.hiddenSince = now;
}
function validateAnswers(s, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('Invalid answers');
  const valid = Object.create(null);
  for (const [id, value] of Object.entries(answers)) {
    const q = s.test?.questions.find(q => q.id === id);
    if (!q || !q.options.some(o => o.id === value)) throw new Error('Invalid question or answer option');
    valid[id] = value;
  }
  return valid;
}
function result(s, st) {
  if (!st.submission) return null;
  const score = isFailed(st) ? 0 : st.submission.originalScore;
  return { score, originalScore: st.submission.originalScore, total: s.test.questions.length,
    percentage: Math.round(score / s.test.questions.length * 10000) / 100,
    failed: isFailed(st), submittedAt: st.submission.submittedAt };
}
function submit(s, id, answers, now = Date.now()) {
  if (s.mode !== 'test' || s.phase !== 'running') throw new Error('Test is not running');
  const st = student(s, id);
  if (st.submission) throw new Error('Student already submitted');
  const valid = validateAnswers(s, answers);
  sweep(s, now);
  st.submission = { answers: valid, originalScore: s.test.questions.filter(q => valid[q.id] === q.correctOptionId).length, submittedAt: now };
  st.draft = {};
  return result(s, st);
}
function override(s, id, professorId, reason, now = Date.now()) {
  if (s.ownerId !== professorId) throw new Error('Session not found');
  const st = student(s, id);
  if (!isFailed(st)) throw new Error('Student has no active failure');
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw new Error('Override reason required (maximum 500 characters)');
  st.overrideAt = now;
  // Forgive the existing interval; any later hidden transition can create a new incident.
  st.hiddenSince = null;
  st.events.push({ type: 'override', at: now, professorId, reason: reason.trim() });
}
function status(st, now) { return isFailed(st) || !st.visible || now - st.lastSeen > 10000 ? 'red' : 'green'; }
function publicView(s, now = Date.now()) {
  return { title: s.test?.title || 'Classroom calculator', phase: s.phase,
    students: s.students.map(st => ({ name: st.name, status: status(st, now) })) };
}
function privateView(s, now = Date.now()) {
  return { id: s.id, mode: s.mode, title: s.test?.title || 'Classroom calculator', phase: s.phase,
    createdAt: s.createdAt, startedAt: s.startedAt, endedAt: s.endedAt, displayToken: s.displayToken,
    students: s.students.map(st => ({ id: st.id, number: st.number, name: st.name, status: status(st, now),
      failed: isFailed(st), result: result(s, st), events: st.events,
      score: result(s, st)?.score ?? (isFailed(st) ? 0 : null), total: s.test?.questions.length || 0 })) };
}
function studentView(s, st) {
  return { phase: s.phase, mode: s.mode, name: st.name, failed: isFailed(st),
    test: s.test && s.phase === 'running' && !st.submission ? { title: s.test.title,
      questions: s.test.questions.map(q => ({ id: q.id, text: q.text, options: q.options })) } : null,
    draft: st.submission ? {} : st.draft, result: result(s, st) };
}
module.exports = { validateTest, newSession, join, student, start, sweep, visibility, submit, override,
  validateAnswers, publicView, privateView, studentView, hash, isFailed };

