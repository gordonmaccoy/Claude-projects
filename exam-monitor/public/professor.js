const $ = id => document.getElementById(id);
const els = { tbTitle: $('tb-title'), tbQuestions: $('tb-questions'), tbError: $('tb-error') };
const socket = io();
let auth, account, current, historySession, library = [], sessionList = [], editingId = null, tbQuestions = [], popup, recoveringPassword = false;
let accountGeneration = 0;
let popupSessionId = null, openingDisplay = false, launching = false;
function clearPrivateWorkspace() {
  accountGeneration++;
  current=null; historySession=null; library=[]; sessionList=[]; editingId=null; tbQuestions=[];
  for(const id of ['launch-tests','library-tests','active-sessions','result-sessions','live-students','result-students','tb-questions']) $(id).replaceChildren();
  for(const id of ['dashboard','result-detail','test-builder']) $(id).hidden=true;
  $('calculator-card').hidden=false;
  for(const id of ['session-title','session-phase','live-summary','result-title','account-name','notice','tb-error']) $(id).textContent='';
  $('tb-title').value=''; $('password').value='';
  socket.disconnect();
}
const notice = message => { $('notice').textContent = message || ''; };
async function token() { return (await auth.auth.getSession()).data.session?.access_token || ''; }
async function api(route, method = 'GET', body) {
  const generation=accountGeneration;
  const response = await fetch(`/api${route}`, { method, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if(generation!==accountGeneration) throw new Error('Account changed. Please retry.');
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function action(fn) { return async event => { try { notice(''); await fn(event); } catch (e) { notice(e.message); } }; }
function tab(name) {
  document.querySelectorAll('.tab').forEach(el => el.hidden = el.id !== name);
  document.querySelectorAll('[data-tab]').forEach(el => el.classList.toggle('selected', el.dataset.tab === name));
}
document.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => { tab(el.dataset.tab); if (el.dataset.tab === 'results') refresh().catch(e => notice(e.message)); });
function button(text, fn, className = '') { const b = document.createElement('button'); b.textContent = text; b.className = className; b.onclick = action(fn); return b; }
function card(title, subtitle) { const c = document.createElement('article'); c.className = 'card'; const h = document.createElement('h3'); h.textContent = title; const p = document.createElement('p'); p.textContent = subtitle; c.append(h,p); return c; }
async function refresh() {
  [library, sessionList] = await Promise.all([api('/tests'), api('/sessions')]);
  for (const id of ['launch-tests', 'library-tests', 'active-sessions', 'result-sessions']) $(id).replaceChildren();
  if (!library.length) {
    $('launch-tests').append(card('A fresh start', 'Create your first test in Library, or launch the calculator.'));
    $('library-tests').append(card('Your library starts here', 'Save a test and use it again with any class.'));
  }
  for (const test of library) {
    const launch = card(test.title, `${test.questions.length} questions · Saved test`);
    launch.append(button('Launch test ↗', () => launchSession({ testId: test.id }), 'primary')); $('launch-tests').append(launch);
    const saved = card(test.title, `${test.questions.length} questions`); const actions = document.createElement('div'); actions.className = 'actions';
    actions.append(button('Edit', () => openBuilder(test)), button('Delete', async () => {
      if (!confirm(`Delete “${test.title}” from your library? Existing sessions keep their copy.`)) return;
      await api(`/tests/${test.id}`, 'DELETE'); await refresh();
    })); saved.append(actions); $('library-tests').append(saved);
  }
  for (const s of sessionList) {
    if (s.mode === 'test') {
      const c = card(s.title, `${new Date(s.createdAt).toLocaleString()} · ${s.phase} · ${s.students.length} joined`);
      c.append(button('View results', async () => { historySession = await api(`/sessions/${s.id}`); renderResults(); }));
      if(s.phase === 'ended') c.append(button('Delete results', () => deleteResults(s), 'danger'));
      $('result-sessions').append(c);
    }
    if (s.phase !== 'ended') $('active-sessions').append(button(`${s.title} · ${s.phase}`, () => openSession(s.id)));
  }
  if (!sessionList.some(s => s.mode === 'test')) $('result-sessions').append(card('No test results yet', 'Results from tests will be saved here. Calculator sessions do not create results.'));
  if (!sessionList.some(s => s.phase !== 'ended')) $('active-sessions').textContent = 'No open sessions.';
}
function openBuilder(test) {
  tab('library'); editingId = test?.id || null;
  $('test-builder').hidden = false; $('builder-heading').textContent = test ? 'Edit test' : 'Create a test';
  els.tbTitle.value = test?.title || ''; tbQuestions = structuredClone(test?.questions || []); hideTbError();
  if (!tbQuestions.length) addQuestion(); else renderTestBuilder();
  $('test-builder').scrollIntoView({ behavior: 'smooth' });
}
$('new-test').onclick = () => openBuilder();
$('tb-add-q-btn').onclick = () => { if (tbQuestions.length < 100) addQuestion(); };
$('tb-cancel-btn').onclick = () => $('test-builder').hidden = true;
$('tb-start-btn').onclick = action(async () => {
  const collected = collectTest(); if (collected.error) return showTbError(collected.error);
  await api('/tests', 'POST', { ...collected.test, ...(editingId ? { id: editingId } : {}) });
  $('test-builder').hidden = true; await refresh(); notice('Test saved.');
});
async function launchSession(payload) {
  if (launching) return;
  launching = true;
  try {
    current = await api('/sessions', 'POST', payload);
    await openClassroomDisplay(current);
    await watch(); renderDashboard(); tab('launch'); await refresh();
  } finally { launching = false; }
}
async function openClassroomDisplay(session) {
  if (openingDisplay) return;
  openingDisplay = true;
  $('display-open').disabled = true;
  $('calculator-launch').disabled = true;
  try {
    const groupStorageKey=`onscreen-display-group-${account.id}`;
    let group=account.id;
    try { group=localStorage.getItem(groupStorageKey) || crypto.randomUUID(); localStorage.setItem(groupStorageKey,group); } catch {}
    const displayUrl=`${session.displayUrl}/${group}`;
    if (popup && !popup.closed) {
      if(popupSessionId !== session.id) popup.location.replace(displayUrl);
      popupSessionId=session.id; popup.focus(); return;
    }
    // Embedded browsers can ignore window names or discard opener handles. Ask an
    // existing display directly before opening another, including after reload.
    const found = await new Promise(resolve => {
      let channel;
      try { channel = new BroadcastChannel(`onscreen-display-${group}`); } catch { resolve(false); return; }
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => { channel.close(); resolve(false); }, 400);
      channel.onmessage = event => {
        if (event.data?.type === 'display-present' && event.data.requestId === requestId) {
          clearTimeout(timer); channel.close(); resolve(true);
        }
      };
      channel.postMessage({ type: 'focus-display', requestId, sessionId:session.id, displayUrl });
    });
    if (found) return;
    popup = window.open(displayUrl, 'onscreen-classroom-display', 'popup,width=1100,height=780');
    popupSessionId = session.id;
    if (popup) popup.focus();
    else notice('If the classroom window did not open, allow popups for OnScreen and use “Open classroom display”.');
  } finally {
    openingDisplay = false; $('display-open').disabled = false; $('calculator-launch').disabled = false;
  }
}
async function openSession(id) { current = await api(`/sessions/${id}`); await watch(); renderDashboard(); tab('launch'); }
// Access tokens are refreshed by Supabase; every new watch is verified by the server.
async function watch() {
  if (!current || !socket.connected) return;
  const accessToken = await token();
  const res = await new Promise(resolve => socket.timeout(10000).emit('professor:watch', { sessionId: current.id, token: accessToken }, (err,r) => resolve(err ? { ok:false,error:'Connection timed out' } : r)));
  if (!res.ok) throw new Error(res.error);
};
$('calculator-launch').onclick = action(async () => {
  const existing = sessionList.find(s => s.mode === 'calculator' && s.phase !== 'ended');
  if (existing) { await openSession(existing.id); await openClassroomDisplay(current); }
  else await launchSession({ mode: 'calculator' });
});
$('display-open').onclick = action(() => current && openClassroomDisplay(current));
$('test-start').onclick = action(async () => { if (!confirm('Start this test now? Hidden pages for more than 5 seconds will receive FAIL.')) return; current = await api(`/sessions/${current.id}/start`, 'POST', {}); renderDashboard(); });
$('session-end').onclick = action(async () => {
  if (!confirm('End this session?')) return;
  current = await api(`/sessions/${current.id}/end`, 'POST', {});
  if(current.mode === 'calculator') { current=null; $('dashboard').hidden=true; $('calculator-card').hidden=false; }
  else renderDashboard();
  await refresh();
});
function renderDashboard() {
  if (!current) return;
  $('dashboard').hidden = false; $('session-title').textContent = current.title;
  $('calculator-card').hidden = current.mode === 'calculator' && current.phase !== 'ended';
  $('session-phase').textContent = current.phase === 'waiting' ? 'Waiting room open · Questions appear when you start the test.' : current.phase === 'running' ? 'Session in progress' : 'Session ended · Results saved';
  $('test-start').hidden = current.phase !== 'waiting'; $('session-end').hidden = current.phase === 'ended';
  $('live-export').hidden = current.mode !== 'test';
  const scores = current.students.filter(s => s.result).map(s => s.result.percentage);
  $('live-summary').textContent = `${current.students.length} joined · ${current.students.filter(s => s.status === 'green').length} active` +
    (current.mode === 'test' ? ` · ${scores.length} submitted · ${current.students.filter(s => s.failed).length} FAIL${scores.length ? ` · Average ${Math.round(scores.reduce((a,b) => a+b,0)/scores.length)}%` : ''}` : '');
  renderTable($('live-students'), current);
}
function renderTable(container, session) {
  const table = document.createElement('table');
  if(session.mode === 'calculator') {
    table.innerHTML='<thead><tr><th>Student number</th><th>Name</th><th>Status</th></tr></thead>';
    const body=document.createElement('tbody');
    for(const s of session.students) {
      const row=document.createElement('tr');
      for(const value of [s.number,s.name,s.status === 'green' ? 'Active' : 'Inactive']) { const cell=document.createElement('td'); cell.textContent=value; row.append(cell); }
      body.append(row);
    }
    table.append(body); container.replaceChildren(table); return;
  }
  table.innerHTML = '<thead><tr><th>Student number</th><th>Name</th><th>Status</th><th>Score</th><th>Original score</th><th>Review</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const s of [...session.students].sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric:true }))) {
    const tr = document.createElement('tr');
    for (const text of [s.number,s.name]) { const td=document.createElement('td'); td.textContent=text; tr.append(td); }
    const state=document.createElement('td'); const pill=document.createElement('span'); pill.className=`pill ${s.status === 'red' ? 'red' : ''}`; pill.textContent=s.failed ? 'FAIL' : s.status === 'green' ? 'Active' : 'Inactive'; state.append(pill); tr.append(state);
    for (const text of [s.score === null ? 'Pending' : `${s.score} / ${s.total}${s.result ? ` · ${s.result.percentage}%` : ''}`, s.result ? `${s.result.originalScore} / ${s.total}` : '—']) { const td=document.createElement('td'); td.textContent=text; tr.append(td); }
    const review=document.createElement('td');
    if (s.failed) review.append(button('Override FAIL', async () => {
      const reason = prompt(`Reason for overriding ${s.name}’s FAIL:`); if (!reason?.trim()) return;
      const updated=await api(`/sessions/${session.id}/override`, 'POST', { studentId:s.id, reason });
      if (current?.id === updated.id) { current=updated; renderDashboard(); }
      if (historySession?.id === updated.id) { historySession=updated; renderResults(); }
    }));
    const details=document.createElement('details'); const summary=document.createElement('summary'); summary.textContent=`${s.events.length} monitoring events`; details.append(summary);
    const list=document.createElement('ul'); for (const e of s.events) { const li=document.createElement('li'); li.textContent=`${new Date(e.at).toLocaleTimeString()} · ${e.type}${e.reason ? ` · ${e.reason}` : ''}`; list.append(li); } details.append(list); review.append(details); tr.append(review); tbody.append(tr);
  }
  table.append(tbody); container.replaceChildren(table);
}
function renderResults() { $('result-detail').hidden=false; $('result-title').textContent=historySession.title; $('result-delete').hidden=historySession.phase !== 'ended'; renderTable($('result-students'),historySession); }
async function deleteResults(session) {
  if(!confirm(`Delete saved results for “${session.title}”? The library test will be kept.`)) return;
  await api(`/sessions/${session.id}`, 'DELETE');
  if(historySession?.id === session.id) { historySession=null; $('result-detail').hidden=true; $('result-students').replaceChildren(); }
  if(current?.id === session.id) { current=null; $('dashboard').hidden=true; $('calculator-card').hidden=false; }
  await refresh(); notice('Results deleted.');
}
$('result-delete').onclick=action(()=>deleteResults(historySession));
async function download(s) {
  const response=await fetch(`/api/sessions/${s.id}/export`,{headers:{Authorization:`Bearer ${await token()}`}});
  if (!response.ok) throw new Error('Could not download results. Please sign in and retry.');
  const url=URL.createObjectURL(await response.blob()); const a=document.createElement('a'); a.href=url; a.download=`onscreen-${s.id}.xlsx`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
}
$('live-export').onclick=action(()=>download(current)); $('result-export').onclick=action(()=>download(historySession)); $('results-refresh').onclick=action(refresh);
socket.on('connect',()=> { if (account) watch().catch(e=>notice(e.message)); });
socket.on('disconnect',()=> { if (account) notice('Live connection lost. Sessions remain saved; reconnecting…'); });
socket.on('professor:update',view=> { if (current?.id === view.id) { current={...current,...view}; renderDashboard(); } if (historySession?.id===view.id) { historySession={...historySession,...view}; renderResults(); } });
socket.on('auth:expired',()=> { notice('Please sign in again to reconnect the private dashboard.'); });
async function signedIn() {
  try { const verified=await api('/me'); if(account && account.id!==verified.id) clearPrivateWorkspace(); account=verified; socket.connect(); $('account-name').textContent=account.email; $('login').hidden=recoveringPassword ? false : true; $('workspace').hidden=recoveringPassword; $('signout').hidden=false; await refresh(); await watch(); }
  catch(e) { account=null; $('login').hidden=false; $('workspace').hidden=true; $('signout').hidden=true; $('auth-message').textContent=e.message; }
}
async function initAuth() {
  const config=await (await fetch('/api/config')).json();
  if (!config.supabaseUrl || !config.supabaseKey) { $('auth-message').textContent='Professor sign-in needs Development authentication configuration. See V2_SETUP.md.'; $('login').querySelectorAll('input,button').forEach(el=>el.disabled=true); return; }
  auth=window.createOnScreenAuth(config.supabaseUrl, config.supabaseKey, {auth:{flowType:'pkce',detectSessionInUrl:true}});
  auth.auth.onAuthStateChange((event) => {
    if (event==='PASSWORD_RECOVERY') { recoveringPassword=true; $('login').hidden=false; $('workspace').hidden=true; $('login-form').hidden=true; $('google').hidden=true; $('new-password-form').hidden=false; }
    if (event==='SIGNED_IN' || event==='TOKEN_REFRESHED') setTimeout(()=>signedIn(),0);
    if (event==='SIGNED_OUT') { clearPrivateWorkspace(); account=null; $('workspace').hidden=true; $('login').hidden=false; $('signout').hidden=true; }
  });
  $('login-form').onsubmit=async e=> { e.preventDefault(); const {error}=await auth.auth.signInWithPassword({email:$('email').value,password:$('password').value}); $('auth-message').textContent=error?.message || ''; if (!error) { socket.connect(); await signedIn(); } };
  $('signup').onclick=async()=> { const {error}=await auth.auth.signUp({email:$('email').value,password:$('password').value,options:{emailRedirectTo:location.origin+'/professor.html'}}); $('auth-message').textContent=error?.message || 'Check your email to confirm your account, then sign in.'; };
  $('google').onclick=async()=> { const {error}=await auth.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/professor.html'}}); if(error) $('auth-message').textContent=error.message; };
  $('signout').onclick=async()=> { await auth.auth.signOut(); };
  $('reset-password').onclick=async()=> { const {error}=await auth.auth.resetPasswordForEmail($('email').value,{redirectTo:location.origin+'/professor.html'}); $('auth-message').textContent=error?.message || 'Check your email for a password reset link.'; };
  $('new-password-form').onsubmit=async e=> { e.preventDefault(); const {error}=await auth.auth.updateUser({password:$('new-password').value}); $('auth-message').textContent=error?.message || 'Password updated.'; if(!error) { recoveringPassword=false; $('new-password-form').hidden=true; $('login-form').hidden=false; $('google').hidden=false; await signedIn(); } };
  if ((await auth.auth.getSession()).data.session) await signedIn();
}
initAuth().catch(e=>$('auth-message').textContent=e.message);
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
            <input type="radio" name="${escHtml(q.id)}" value="${escHtml(o.id)}" id="${escHtml(o.id)}_radio"
              ${q.correctOptionId === o.id ? 'checked' : ''}
              data-qidx="${qIdx}" data-oidx="${oIdx}" />
            <label for="${escHtml(o.id)}_radio" class="tb-correct-label" title="Mark as correct"></label>
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
