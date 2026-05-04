const socket = io();

const els = {
  sessionCard:       document.getElementById('session-card'),
  noSession:         document.getElementById('no-session'),
  startBtn:          document.getElementById('start-btn'),
  testBuilderOpenBtn:document.getElementById('test-builder-open-btn'),
  testBuilder:       document.getElementById('test-builder'),
  tbTitle:           document.getElementById('tb-title'),
  tbQuestions:       document.getElementById('tb-questions'),
  tbAddQBtn:         document.getElementById('tb-add-q-btn'),
  tbCancelBtn:       document.getElementById('tb-cancel-btn'),
  tbStartBtn:        document.getElementById('tb-start-btn'),
  tbError:           document.getElementById('tb-error'),
  restartBtn:        document.getElementById('restart-btn'),
  sidebarQr:         document.getElementById('sidebar-qr'),
  qr:                document.getElementById('qr'),
  students:          document.getElementById('students'),
  empty:             document.getElementById('students-empty'),
  subtitle:          document.getElementById('page-subtitle'),
  countTotal:        document.getElementById('count-total'),
  countGreen:        document.getElementById('count-green'),
  countRed:          document.getElementById('count-red'),
  countFail:         document.getElementById('count-fail'),
};

const WARNING_MS = 5_000;   // 5s inactive → warning flash
const FAIL_MS    = 15_000;  // 15s inactive → permanent fail

// ─── Session state ────────────────────────────────────────────────────────────

let sessionMode = 'calculator'; // 'calculator' | 'test'

// studentId -> { name, status, lastSeen, inactiveSince, joinedAt,
//                permanentlyFailed, failSeconds,
//                submitted, score, total }
const students = new Map();
// studentId -> tile DOM element (stable, preserves join order)
const tiles    = new Map();

// ─── Session control ──────────────────────────────────────────────────────────

function startSession() {
  socket.emit('professor:startSession');
}

function resetToNoSession() {
  students.clear();
  tiles.clear();
  els.students.innerHTML = '';
  els.sidebarQr.hidden = true;
  els.sessionCard.hidden = false;
  showNoSession();
  els.restartBtn.hidden = true;
  els.subtitle.textContent = 'Start a session to begin monitoring student activity.';
  sessionMode = 'calculator';
  render();
}

function showNoSession() {
  els.noSession.hidden = false;
  els.testBuilder.hidden = true;
}

els.startBtn.addEventListener('click', startSession);

els.restartBtn.addEventListener('click', () => {
  if (confirm('Start a new session? Current students will be disconnected.')) {
    resetToNoSession();
    // Re-show session card so professor can pick mode again.
  }
});

socket.on('session:started', ({ sessionId, joinUrl, qrDataUrl, mode }) => {
  sessionMode = mode || 'calculator';
  if (qrDataUrl) els.qr.src = qrDataUrl;
  els.sidebarQr.hidden = false;
  els.sessionCard.hidden = true;
  els.restartBtn.hidden = false;
  els.subtitle.textContent =
    sessionMode === 'test'
      ? 'Test session live — students scan the QR code to join and take the test.'
      : 'Session live — students scan the QR code to join.';
  students.clear();
  tiles.clear();
  els.students.innerHTML = '';
  render();
});

socket.on('disconnect', () => {
  resetToNoSession();
});

// ─── Student events ───────────────────────────────────────────────────────────

socket.on('session:studentJoined', ({ studentId, name, status, lastSeen, inactiveSince, submitted }) => {
  students.set(studentId, {
    name,
    status,
    lastSeen,
    inactiveSince: inactiveSince || null,
    joinedAt: Date.now(),
    permanentlyFailed: false,
    failSeconds: 0,
    submitted: submitted ?? false,
    score: null,
    total: null,
  });
  render();
});

socket.on('session:studentUpdate', ({ studentId, status, lastSeen, inactiveSince }) => {
  const s = students.get(studentId);
  if (!s) return;
  if (!s.permanentlyFailed) {
    s.status = status;
    s.lastSeen = lastSeen;
    s.inactiveSince = inactiveSince || null;
  }
  render();
});

socket.on('session:studentLeft', ({ studentId }) => {
  students.delete(studentId);
  const tile = tiles.get(studentId);
  if (tile) { tile.remove(); tiles.delete(studentId); }
  render();
});

socket.on('session:studentSubmitted', ({ studentId, score, total }) => {
  const s = students.get(studentId);
  if (!s) return;
  s.submitted = true;
  s.score = score;
  s.total = total;
  render();
});

// ─── Tile state computation ───────────────────────────────────────────────────

function tileStateFor(s) {
  if (s.permanentlyFailed) return { state: 'fail', label: 'Fail', seconds: s.failSeconds || 0 };
  if (s.status === 'green') return { state: 'active', label: 'Active', seconds: 0 };
  const since = s.inactiveSince || s.lastSeen || Date.now();
  const ms = Math.max(0, Date.now() - since);
  const seconds = Math.floor(ms / 1000);
  if (ms >= FAIL_MS)    return { state: 'fail',     label: 'Fail',    seconds };
  if (ms >= WARNING_MS) return { state: 'warning',  label: 'Warning', seconds };
  return                       { state: 'inactive', label: 'Inactive', seconds };
}

function ensureTile(id, s) {
  let tile = tiles.get(id);
  if (tile) return tile;
  tile = document.createElement('div');
  tile.className = 'tile';
  tile.dataset.id = id;
  tile.innerHTML = `
    <div class="tile-meta">
      <span class="tile-status"><span class="dot"></span><span class="tile-status-label"></span></span>
      <span class="tile-timer"></span>
    </div>
    <div class="tile-name"></div>
    <div class="tile-submission" hidden></div>
    <div class="tile-fail-badge">FAIL</div>
  `;
  tile.querySelector('.tile-name').textContent = s.name;
  els.students.appendChild(tile);
  tiles.set(id, tile);
  return tile;
}

function render() {
  let activeCount = 0, inactiveCount = 0, failCount = 0;
  const ordered = [...students.entries()].sort(([, a], [, b]) => a.joinedAt - b.joinedAt);

  for (const [id, s] of ordered) {
    const tile = ensureTile(id, s);
    const { state, label, seconds } = tileStateFor(s);

    // Latch permanently failed on first fail transition.
    if (state === 'fail' && !s.permanentlyFailed) {
      s.permanentlyFailed = true;
      s.failSeconds = seconds;
    }

    tile.classList.remove('state-active', 'state-inactive', 'state-warning', 'state-fail');
    tile.classList.add(`state-${state}`);
    tile.querySelector('.tile-status-label').textContent = label;
    tile.querySelector('.tile-timer').textContent = state === 'active' ? '' : `${seconds}s`;

    // Submission badge (test mode only)
    const sub = tile.querySelector('.tile-submission');
    if (sessionMode === 'test') {
      sub.hidden = false;
      if (s.submitted) {
        sub.dataset.sub = 'submitted';
        sub.textContent = `✓ ${s.score}/${s.total}`;
      } else {
        sub.dataset.sub = 'pending';
        sub.textContent = 'PENDING';
      }
    } else {
      sub.hidden = true;
    }

    if (state === 'active') activeCount += 1;
    else if (state === 'fail') { failCount += 1; inactiveCount += 1; }
    else inactiveCount += 1;
  }

  const total = students.size;
  els.countTotal.textContent = total;
  els.countGreen.textContent = activeCount;
  els.countRed.textContent   = inactiveCount;
  els.countFail.textContent  = failCount;
  els.empty.hidden = total > 0;
}

// Re-render every second so timers and state escalation stay current.
setInterval(render, 1000);
render();

// ─── Test builder ─────────────────────────────────────────────────────────────

// In-memory questions while building a test.
// Each entry: { id, text, options:[{id,text}], correctOptionId }
let tbQuestions = [];

els.testBuilderOpenBtn.addEventListener('click', openTestBuilder);
els.tbCancelBtn.addEventListener('click',        closeTestBuilder);
els.tbAddQBtn.addEventListener('click',          addQuestion);
els.tbStartBtn.addEventListener('click',         startTestSession);

function openTestBuilder() {
  els.noSession.hidden = true;
  els.testBuilder.hidden = false;
  tbQuestions = [];
  els.tbTitle.value = '';
  hideTbError();
  addQuestion(); // Start with one blank question.
}

function closeTestBuilder() {
  els.testBuilder.hidden = true;
  els.noSession.hidden = false;
  tbQuestions = [];
}

function addQuestion() {
  const qId = 'q' + Date.now() + Math.random().toString(36).slice(2, 5);
  tbQuestions.push({
    id: qId,
    text: '',
    options: [
      { id: qId + '_a', text: '' },
      { id: qId + '_b', text: '' },
    ],
    correctOptionId: '',
  });
  renderTestBuilder();
  // Focus the new question's text input.
  const cards = els.tbQuestions.querySelectorAll('.tb-q-card');
  const lastCard = cards[cards.length - 1];
  if (lastCard) lastCard.querySelector('.tb-q-text')?.focus();
}

function removeQuestion(qIdx) {
  if (tbQuestions.length <= 1) return; // Must have at least one question.
  tbQuestions.splice(qIdx, 1);
  renderTestBuilder();
}

function addOption(qIdx) {
  const q = tbQuestions[qIdx];
  if (q.options.length >= 5) return;
  q.options.push({ id: q.id + '_' + Date.now(), text: '' });
  renderTestBuilder();
}

function removeOption(qIdx, oIdx) {
  const q = tbQuestions[qIdx];
  if (q.options.length <= 2) return;
  const removed = q.options.splice(oIdx, 1)[0];
  if (q.correctOptionId === removed.id) q.correctOptionId = '';
  renderTestBuilder();
}

function renderTestBuilder() {
  els.tbQuestions.innerHTML = '';
  tbQuestions.forEach((q, qIdx) => {
    const card = document.createElement('div');
    card.className = 'tb-q-card';
    card.innerHTML = `
      <div class="tb-q-header">
        <span class="tb-q-num">Q${qIdx + 1}</span>
        ${tbQuestions.length > 1
          ? `<button class="tb-remove-q btn-icon" data-qidx="${qIdx}" title="Remove question">✕</button>`
          : ''}
      </div>
      <input class="tb-q-text" type="text" placeholder="Question text…" maxlength="300"
        value="${escHtml(q.text)}" data-qidx="${qIdx}" autocomplete="off" />
      <div class="tb-options">
        ${q.options.map((o, oIdx) => `
          <div class="tb-option-row">
            <input type="radio" name="${q.id}" value="${o.id}" id="${o.id}_radio"
              ${q.correctOptionId === o.id ? 'checked' : ''}
              data-qidx="${qIdx}" data-oidx="${oIdx}" />
            <label for="${o.id}_radio" class="tb-correct-label" title="Mark as correct"></label>
            <input class="tb-opt-text" type="text" placeholder="Option ${String.fromCharCode(65 + oIdx)}…"
              maxlength="200" value="${escHtml(o.text)}"
              data-qidx="${qIdx}" data-oidx="${oIdx}" autocomplete="off" />
            ${q.options.length > 2
              ? `<button class="btn-icon tb-remove-opt" data-qidx="${qIdx}" data-oidx="${oIdx}" title="Remove option">✕</button>`
              : ''}
          </div>
        `).join('')}
      </div>
      ${q.options.length < 5
        ? `<button class="tb-add-opt-btn btn-ghost btn-sm" data-qidx="${qIdx}">+ Add Option</button>`
        : ''}
    `;
    els.tbQuestions.appendChild(card);
  });

  // Wire events (delegated on the container would be cleaner but explicit is fine for MVP).
  els.tbQuestions.querySelectorAll('.tb-q-text').forEach(input => {
    input.addEventListener('input', e => {
      tbQuestions[+e.target.dataset.qidx].text = e.target.value;
    });
  });
  els.tbQuestions.querySelectorAll('.tb-opt-text').forEach(input => {
    input.addEventListener('input', e => {
      tbQuestions[+e.target.dataset.qidx].options[+e.target.dataset.oidx].text = e.target.value;
    });
  });
  els.tbQuestions.querySelectorAll('input[type=radio]').forEach(radio => {
    radio.addEventListener('change', e => {
      tbQuestions[+e.target.dataset.qidx].correctOptionId = e.target.value;
    });
  });
  els.tbQuestions.querySelectorAll('.tb-remove-q').forEach(btn => {
    btn.addEventListener('click', e => removeQuestion(+e.currentTarget.dataset.qidx));
  });
  els.tbQuestions.querySelectorAll('.tb-remove-opt').forEach(btn => {
    btn.addEventListener('click', e =>
      removeOption(+e.currentTarget.dataset.qidx, +e.currentTarget.dataset.oidx));
  });
  els.tbQuestions.querySelectorAll('.tb-add-opt-btn').forEach(btn => {
    btn.addEventListener('click', e => addOption(+e.currentTarget.dataset.qidx));
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function collectTest() {
  const title = els.tbTitle.value.trim();
  if (!title) return { error: 'Please enter a test title.' };

  // Read current values from DOM to catch any unsaved edits.
  els.tbQuestions.querySelectorAll('.tb-q-text').forEach(inp => {
    tbQuestions[+inp.dataset.qidx].text = inp.value.trim();
  });
  els.tbQuestions.querySelectorAll('.tb-opt-text').forEach(inp => {
    tbQuestions[+inp.dataset.qidx].options[+inp.dataset.oidx].text = inp.value.trim();
  });

  for (let i = 0; i < tbQuestions.length; i++) {
    const q = tbQuestions[i];
    if (!q.text) return { error: `Q${i + 1}: Question text is required.` };
    for (let j = 0; j < q.options.length; j++) {
      if (!q.options[j].text) return { error: `Q${i + 1}: Option ${String.fromCharCode(65 + j)} text is required.` };
    }
    if (!q.correctOptionId) return { error: `Q${i + 1}: Please mark the correct answer.` };
  }

  return { test: { title, questions: tbQuestions } };
}

function showTbError(msg) {
  els.tbError.textContent = msg;
  els.tbError.hidden = false;
}
function hideTbError() {
  els.tbError.hidden = true;
}

function startTestSession() {
  hideTbError();
  const { test, error } = collectTest();
  if (error) { showTbError(error); return; }
  socket.emit('professor:startTestSession', { test });
}

socket.on('session:error', ({ message }) => {
  showTbError(message || 'An error occurred.');
});
