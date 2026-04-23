const socket = io();

const els = {
  sessionCard: document.getElementById('session-card'),
  startBtn: document.getElementById('start-btn'),
  restartBtn: document.getElementById('restart-btn'),
  sidebarQr: document.getElementById('sidebar-qr'),
  qr: document.getElementById('qr'),
  students: document.getElementById('students'),
  empty: document.getElementById('students-empty'),
  subtitle: document.getElementById('page-subtitle'),
  countTotal: document.getElementById('count-total'),
  countGreen: document.getElementById('count-green'),
  countRed: document.getElementById('count-red'),
  countFail: document.getElementById('count-fail'),
};

const WARNING_MS = 5_000;   // 5s inactive → warning flash
const FAIL_MS    = 15_000;  // 15s inactive → permanent fail

// studentId -> { name, status, lastSeen, inactiveSince, joinedAt, permanentlyFailed }
const students = new Map();
// studentId -> tile DOM element (stable, preserves join order)
const tiles = new Map();

function startSession() {
  socket.emit('professor:startSession');
}

els.startBtn.addEventListener('click', startSession);
els.restartBtn.addEventListener('click', () => {
  if (confirm('Start a new session? Current students will be disconnected.')) {
    students.clear();
    tiles.clear();
    els.students.innerHTML = '';
    els.sidebarQr.hidden = true;
    els.sessionCard.hidden = false;
    els.restartBtn.hidden = true;
    els.subtitle.textContent = 'Start a session to begin monitoring student activity.';
    render();
    startSession();
  }
});

socket.on('session:started', ({ sessionId, joinUrl, qrDataUrl }) => {
  if (qrDataUrl) els.qr.src = qrDataUrl;
  els.sidebarQr.hidden = false;
  els.sessionCard.hidden = true;
  els.restartBtn.hidden = false;
  els.subtitle.textContent = 'Session live — students scan the QR code to join.';
  students.clear();
  tiles.clear();
  els.students.innerHTML = '';
  render();
});

socket.on('session:studentJoined', ({ studentId, name, status, lastSeen, inactiveSince }) => {
  students.set(studentId, {
    name,
    status,
    lastSeen,
    inactiveSince: inactiveSince || null,
    joinedAt: Date.now(),
    permanentlyFailed: false,
  });
  render();
});

socket.on('session:studentUpdate', ({ studentId, status, lastSeen, inactiveSince }) => {
  const s = students.get(studentId);
  if (!s) return;
  // Once permanently failed, ignore status updates — student stays at fail.
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

socket.on('disconnect', () => {
  students.clear();
  tiles.clear();
  els.students.innerHTML = '';
  els.sidebarQr.hidden = true;
  els.sessionCard.hidden = false;
  els.restartBtn.hidden = true;
  els.subtitle.textContent = 'Start a session to begin monitoring student activity.';
  render();
});

function tileStateFor(s) {
  if (s.permanentlyFailed) return { state: 'fail', label: 'Fail', seconds: s.failSeconds || 0 };
  if (s.status === 'green') return { state: 'active', label: 'Active', seconds: 0 };
  const since = s.inactiveSince || s.lastSeen || Date.now();
  const ms = Math.max(0, Date.now() - since);
  const seconds = Math.floor(ms / 1000);
  if (ms >= FAIL_MS) return { state: 'fail', label: 'Fail', seconds };
  if (ms >= WARNING_MS) return { state: 'warning', label: 'Warning', seconds };
  return { state: 'inactive', label: 'Inactive', seconds };
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
    <div class="tile-fail-badge">FAIL</div>
  `;
  tile.querySelector('.tile-name').textContent = s.name;
  els.students.appendChild(tile);
  tiles.set(id, tile);
  return tile;
}

function render() {
  let activeCount = 0;
  let inactiveCount = 0;
  let failCount = 0;

  const ordered = [...students.entries()].sort(([, a], [, b]) => a.joinedAt - b.joinedAt);

  for (const [id, s] of ordered) {
    const tile = ensureTile(id, s);
    const { state, label, seconds } = tileStateFor(s);

    // Latch permanently failed the first time we compute fail state.
    if (state === 'fail' && !s.permanentlyFailed) {
      s.permanentlyFailed = true;
      s.failSeconds = seconds;
    }

    tile.classList.remove('state-active', 'state-inactive', 'state-warning', 'state-fail');
    tile.classList.add(`state-${state}`);
    tile.querySelector('.tile-status-label').textContent = label;
    const timer = tile.querySelector('.tile-timer');
    timer.textContent = state === 'active' ? '' : `${seconds}s`;

    if (state === 'active') activeCount += 1;
    else if (state === 'fail') { failCount += 1; inactiveCount += 1; }
    else inactiveCount += 1;
  }

  const total = students.size;
  els.countTotal.textContent = total;
  els.countGreen.textContent = activeCount;
  els.countRed.textContent = inactiveCount;
  els.countFail.textContent = failCount;
  els.empty.hidden = total > 0;
}

setInterval(render, 1000);
render();
