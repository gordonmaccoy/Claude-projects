// Student page: join form + basic calculator + visibility/heartbeat reporting.
// We detect whether THIS tab is currently visible. We do not, and cannot,
// detect what the student switched to.

const params = new URLSearchParams(location.search);
const sessionId = (params.get('session') || '').toUpperCase();

const els = {
  joinSection:    document.getElementById('join-section'),
  calcSection:    document.getElementById('calculator-section'),
  testSection:    document.getElementById('test-section'),
  sessionCode:    document.getElementById('session-code'),
  form:           document.getElementById('join-form'),
  nameInput:      document.getElementById('name-input'),
  joinError:      document.getElementById('join-error'),
  meName:         document.getElementById('me-name'),
  connDot:        document.getElementById('conn-dot'),
  testConnDot:    document.getElementById('test-conn-dot'),
  expression:     document.getElementById('expression'),
  result:         document.getElementById('result'),
  keys:           document.querySelector('.keys'),
  themeToggle:    document.getElementById('theme-toggle'),
  testThemeToggle:document.getElementById('test-theme-toggle'),
  themeColor:     document.getElementById('theme-color'),
  testTitle:      document.getElementById('test-title'),
  testQuestions:  document.getElementById('test-questions'),
  testActions:    document.getElementById('test-actions'),
  testSubmitBtn:  document.getElementById('test-submit-btn'),
  testDone:       document.getElementById('test-done'),
  doneScore:      document.getElementById('done-score'),
};

// --- Theme ---

const THEME_BG = { dark: '#0b0d12', light: '#e9edf2' };
function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  if (els.themeColor) els.themeColor.setAttribute('content', THEME_BG[t]);
  try { localStorage.setItem('exam-monitor-theme', t); } catch {}
}
const savedTheme = (() => {
  try { return localStorage.getItem('exam-monitor-theme'); } catch { return null; }
})();
applyTheme(savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
els.themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
});
els.testThemeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
});

els.sessionCode.textContent = sessionId || 'missing';
if (!sessionId) {
  showJoinError('No session in the URL. Scan the QR code from your professor again.');
  els.form.querySelector('button').disabled = true;
}

const socket = io();

socket.on('connect', () => setConnected(true));
socket.on('disconnect', () => setConnected(false));
socket.on('session:ended', () => {
  stopHeartbeat();
  els.calcSection.hidden = true;
  els.testSection.hidden = true;
  els.joinSection.hidden = false;
  showJoinError('The session was ended by the professor.');
});

function setConnected(ok) {
  els.connDot.classList.toggle('offline', !ok);
  els.connDot.title = ok ? 'Connected' : 'Disconnected';
  if (els.testConnDot) {
    els.testConnDot.classList.toggle('offline', !ok);
    els.testConnDot.title = ok ? 'Connected' : 'Disconnected';
  }
}

function showJoinError(msg) {
  els.joinError.textContent = msg;
  els.joinError.hidden = false;
}

// --- Join flow ---

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = els.nameInput.value.trim();
  if (!name) return;
  els.joinError.hidden = true;
  socket.emit('student:join', { sessionId, name });
});

socket.on('student:joined', (res) => {
  if (!res.ok) {
    const msg = res.error === 'session-not-found'
      ? 'That session no longer exists. Ask your professor to start a new session.'
      : res.error === 'name-required'
        ? 'Please enter your name.'
        : 'Could not join. Please try again.';
    showJoinError(msg);
    return;
  }
  els.meName.textContent = els.nameInput.value.trim();
  els.joinSection.hidden = true;
  // If this is a test session, the server will immediately follow with test:data.
  // We show the calculator temporarily; test:data handler will swap sections.
  // Calculator mode: show calculator now and start tracking.
  els.calcSection.hidden = false;
  startVisibilityTracking();
});

// --- Test mode ---

let testQuestions = [];   // question objects from test:data
let testAnswers = {};     // { questionId: optionId }
let testSubmitted = false;

socket.on('test:data', ({ title, questions }) => {
  testQuestions = questions;
  testAnswers = {};
  testSubmitted = false;
  // Switch from calculator section to test section.
  els.calcSection.hidden = true;
  els.testSection.hidden = false;
  els.testTitle.textContent = title;
  els.testActions.hidden = false;
  els.testDone.hidden = true;
  renderTestQuestions(questions);
  // Visibility tracking was already started by student:joined.
});

function renderTestQuestions(questions) {
  els.testQuestions.innerHTML = '';
  questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'tq-card';
    card.dataset.qid = q.id;

    const text = document.createElement('p');
    text.className = 'tq-text';
    text.textContent = `${idx + 1}. ${q.text}`;
    card.appendChild(text);

    const opts = document.createElement('div');
    opts.className = 'tq-options';
    q.options.forEach((o, oIdx) => {
      const label = document.createElement('label');
      label.className = 'tq-option';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = q.id;
      radio.value = o.id;
      radio.addEventListener('change', () => {
        testAnswers[q.id] = o.id;
      });

      const letter = document.createElement('span');
      letter.className = 'tq-opt-letter';
      letter.textContent = String.fromCharCode(65 + oIdx);

      const optText = document.createElement('span');
      optText.className = 'tq-opt-text';
      optText.textContent = o.text;

      label.appendChild(radio);
      label.appendChild(letter);
      label.appendChild(optText);
      opts.appendChild(label);
    });
    card.appendChild(opts);
    els.testQuestions.appendChild(card);
  });
}

els.testSubmitBtn.addEventListener('click', () => {
  if (testSubmitted) return;
  const unanswered = testQuestions.filter(q => !testAnswers[q.id]);
  if (unanswered.length > 0) {
    alert(`${unanswered.length} question(s) not yet answered. Please answer all questions before submitting.`);
    return;
  }
  if (!confirm('Submit your answers? You cannot change them after submitting.')) return;
  testSubmitted = true;
  els.testSubmitBtn.disabled = true;
  socket.emit('student:submitAnswers', { answers: testAnswers });
});

socket.on('test:result', ({ score, total }) => {
  els.testActions.hidden = true;
  els.testDone.hidden = false;
  els.doneScore.textContent = `Your score: ${score} / ${total}`;
});

// --- Visibility + heartbeat ---

let heartbeatTimer = null;

function sendVisibility() {
  socket.emit('student:visibility', { visible: !document.hidden });
}

function startVisibilityTracking() {
  document.addEventListener('visibilitychange', sendVisibility);
  // pagehide fires for tab close, navigation away, and many mobile backgrounding cases
  // that visibilitychange can miss.
  window.addEventListener('pagehide', () => {
    socket.emit('student:visibility', { visible: false });
  });
  // Prime the server with the initial state.
  sendVisibility();
  // Heartbeat: liveness signal. If these stop, the server times us out to RED.
  heartbeatTimer = setInterval(() => {
    socket.emit('student:heartbeat', { visible: !document.hidden });
  }, 3000);
}

function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

// --- Calculator ---

// expression is the string we evaluate. UI shows it as the top line.
// result is shown as the bottom line after '='.
// After '=', the next digit starts a fresh expression; the next operator
// continues from the last result.
let expression = '';
let lastResult = null;
let justEvaluated = false;

const OP_DISPLAY = { '+': '+', '-': '\u2212', '*': '\u00d7', '/': '\u00f7' };
const SAFE_RE = /^[\d+\-*/.()\s]+$/;

function render() {
  const raw = expression || '0';
  // Pretty-print operators for the top display without changing the eval string.
  let shown = raw.replace(/[+\-*/]/g, (c) => OP_DISPLAY[c] || c);
  // After '=', append "=" to the expression line to echo the evaluated form.
  if (justEvaluated && expression) shown += ' =';
  els.expression.textContent = shown;
  els.result.classList.toggle('error', String(lastResult) === 'Error');
  if (lastResult !== null) {
    els.result.textContent = lastResult;
    els.result.classList.remove('placeholder');
  } else {
    // Placeholder: echo the in-progress expression numerically (or 0).
    els.result.textContent = '0';
    els.result.classList.add('placeholder');
    els.result.classList.remove('error');
  }
}

function appendNum(d) {
  if (justEvaluated) { expression = ''; lastResult = null; justEvaluated = false; }
  expression += d;
  render();
}

function appendDot() {
  if (justEvaluated) { expression = ''; lastResult = null; justEvaluated = false; }
  // Only one dot per current number token.
  const tail = expression.split(/[+\-*/()]/).pop() || '';
  if (tail.includes('.')) return;
  // If no digit yet in this number, prefix with 0 for readability.
  if (!/\d$/.test(expression)) expression += '0';
  expression += '.';
  render();
}

function appendOp(op) {
  if (justEvaluated && lastResult !== null && String(lastResult) !== 'Error') {
    expression = String(lastResult);
    lastResult = null;
    justEvaluated = false;
  }
  // Replace a trailing operator instead of stacking.
  if (/[+\-*/]$/.test(expression)) {
    expression = expression.slice(0, -1) + op;
  } else if (expression === '' && op !== '-') {
    // Don't let the expression start with +, *, /. A leading '-' is fine.
    return;
  } else {
    expression += op;
  }
  render();
}

function appendParen(which) {
  if (justEvaluated) { expression = ''; lastResult = null; justEvaluated = false; }
  if (which === '(') {
    // Insert implicit multiplication if a digit or ')' precedes.
    if (/[\d)]$/.test(expression)) expression += '*';
    expression += '(';
  } else {
    // Only close if there's an unmatched '(' and the previous char isn't an operator/'('.
    const opens = (expression.match(/\(/g) || []).length;
    const closes = (expression.match(/\)/g) || []).length;
    if (opens <= closes) return;
    if (/[+\-*/(]$/.test(expression) || expression === '') return;
    expression += ')';
  }
  render();
}

function backspace() {
  if (justEvaluated) { lastResult = null; justEvaluated = false; render(); return; }
  expression = expression.slice(0, -1);
  render();
}

function clearAll() {
  expression = '';
  lastResult = null;
  justEvaluated = false;
  render();
}

function evaluate() {
  if (!expression) return;
  if (!SAFE_RE.test(expression)) {
    lastResult = 'Error';
    justEvaluated = true;
    render();
    return;
  }
  // Auto-close any open parens for convenience.
  let toEval = expression;
  const opens = (toEval.match(/\(/g) || []).length;
  const closes = (toEval.match(/\)/g) || []).length;
  for (let i = 0; i < opens - closes; i++) toEval += ')';

  try {
    // Safe because SAFE_RE restricts characters to digits + operators + parens.
    // No identifiers, no property access, nothing else can pass.
    const value = Function('"use strict"; return (' + toEval + ')')();
    if (typeof value !== 'number' || !isFinite(value)) {
      lastResult = typeof value === 'number' ? String(value) : 'Error';
    } else {
      // Trim floating-point noise.
      lastResult = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)));
    }
  } catch {
    lastResult = 'Error';
  }
  justEvaluated = true;
  render();
}

els.keys.addEventListener('click', (e) => {
  const btn = e.target.closest('button.key');
  if (!btn) return;
  const action = btn.dataset.action;
  switch (action) {
    case 'num':         appendNum(btn.dataset.value); break;
    case 'dot':         appendDot(); break;
    case 'op':          appendOp(btn.dataset.value); break;
    case 'paren-open':  appendParen('('); break;
    case 'paren-close': appendParen(')'); break;
    case 'backspace':   backspace(); break;
    case 'clear':       clearAll(); break;
    case 'equals':      evaluate(); break;
  }
});

// Basic keyboard support for desktop testing.
document.addEventListener('keydown', (e) => {
  if (els.calcSection.hidden) return;
  const k = e.key;
  if (/^[0-9]$/.test(k))         { appendNum(k); e.preventDefault(); return; }
  if (k === '.')                 { appendDot(); e.preventDefault(); return; }
  if ('+-*/'.includes(k))        { appendOp(k); e.preventDefault(); return; }
  if (k === '(' || k === ')')    { appendParen(k); e.preventDefault(); return; }
  if (k === 'Enter' || k === '=') { evaluate(); e.preventDefault(); return; }
  if (k === 'Backspace')         { backspace(); e.preventDefault(); return; }
  if (k === 'Escape' || k === 'c' || k === 'C') { clearAll(); e.preventDefault(); return; }
});

render();
