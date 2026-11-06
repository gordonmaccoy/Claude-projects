const $ = id => document.getElementById(id);
const els = { tbTitle: $('tb-title'), tbQuestions: $('tb-questions'), tbError: $('tb-error') };
const socket = io();
let auth, account, current, historySession, library = [], folders = [], aiConfigured=false, importMode="import", sessionList = [], editingId = null, tbQuestions = [], popup, recoveringPassword = false;
let accountGeneration = 0;
let popupSessionId = null, openingDisplay = false, launching = false;
function clearPrivateWorkspace() {
  accountGeneration++;closeEntry();launchTest=null;$('new-title').value='';$('folder-list').replaceChildren();$('folder-menu').open=false;for(const id of ['tb-folder','new-folder-choice'])$(id).replaceChildren();$('launch-test-title').textContent='';if($('launch-dialog').open)$('launch-dialog').close();$('creation-choice').hidden=true;
  current=null; historySession=null; library=[]; folders=[]; sessionList=[]; $('import-source').value='';$('import-file').value='';$('import-panel').hidden=true;$('draft-review').textContent=''; editingId=null; tbQuestions=[];
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
  [library, sessionList, folders] = await Promise.all([api('/tests'), api('/sessions'),api('/folders')]);
  renderFolderOptions();renderFolderMenu();
  for (const id of ['launch-tests', 'library-tests', 'active-sessions', 'result-sessions']) $(id).replaceChildren();
  if (!library.length) {
    $('launch-tests').append(card('A fresh start', 'Create your first test in Library, or launch the calculator.'));
    $('library-tests').append(card('Your library starts here', 'Save a test and use it again with any class.'));
  }
  const groups={};
  for(const root of ['launch-tests','library-tests']) for(const folder of [...folders,{id:'',name:'Uncategorized Test'}]) {
    const count=library.filter(t=>(t.folderId||'')===folder.id).length;
    if(!count && !folders.some(f=>f.id===folder.id))continue;
    const detail=document.createElement('details');detail.className='folder';detail.open=true;
    const summary=document.createElement('summary');summary.textContent=`${folder.name} (${count})`;detail.append(summary);
    const list=document.createElement('div');list.className='cards';detail.append(list);$(root).append(detail);groups[root+folder.id]=list;
  }
  for (const test of library) {
    const launch = card(test.title, `${test.questions.length} questions · Saved test`);
    launch.append(button('Launch test ↗', () => openLaunch(test), 'primary')); (groups['launch-tests'+(test.folderId||'')]||$('launch-tests')).append(launch);
    const saved = card(test.title, `${test.questions.length} questions`); const actions = document.createElement('div'); actions.className = 'actions';
    actions.append(button('Edit', () => openBuilder(test)),button('Create copy',()=>openEntry({title:'Create copy of a test',value:(test.title.slice(0,73)+' (copy)'),max:80},async title=>{const copy=await api('/tests/'+test.id+'/copy','POST',{title});await refresh();openBuilder(copy);})), button('Delete', async () => {
      if (!confirm(`Delete “${test.title}” from your library? Existing sessions keep their copy.`)) return;
      await api(`/tests/${test.id}`, 'DELETE'); await refresh();
    })); saved.append(actions); (groups['library-tests'+(test.folderId||'')]||$('library-tests')).append(saved);
  }
  for (const s of sessionList) {
    if (s.mode === 'test') {
      const c = card(s.title, `${new Date(s.createdAt).toLocaleString()} · ${s.phase} · ${s.students.length} joined`);
      c.append(button('View results', async () => { historySession = await api(`/sessions/${s.id}`); renderResults(); }));
      if(s.phase === 'ended') c.append(button('Rename results',()=>renameResults(s)),button('Delete results', () => deleteResults(s), 'danger'));
      $('result-sessions').append(c);
    }
    if (s.phase !== 'ended') $('active-sessions').append(button(`${s.title} · ${s.phase}`, () => openSession(s.id)));
  }
  if (!sessionList.some(s => s.mode === 'test')) $('result-sessions').append(card('No test results yet', 'Results from tests will be saved here. Calculator sessions do not create results.'));
  if(current && !sessionList.some(s=>s.id===current.id && s.phase!=='ended')){current=null;renderDashboard();}
}
function openBuilder(test) {
  tab('library');$('creation-choice').hidden=true;$('import-panel').hidden=true; editingId = test?.id || null;
  $('test-builder').hidden = false; $('builder-heading').textContent = test?.id ? 'Edit test' : 'Create a test';
  els.tbTitle.value = test?.title || ''; renderFolderOptions(test?.folderId||''); $('draft-review').textContent=''; tbQuestions = structuredClone(test?.questions || []); hideTbError();
  if (!tbQuestions.length) addQuestion(); else renderTestBuilder();
  $('test-builder').scrollIntoView({ behavior: 'smooth' });
}
$('new-test').onclick = () => {tab('library');$('test-builder').hidden=true;$('import-panel').hidden=true;$('creation-choice').hidden=false;$('new-title').value='';$('new-folder-choice').value='';$('import-source').value='';$('import-file').value='';$('ai-consent').checked=false;};
$('create-manual').onclick=()=>openBuilder({title:$('new-title').value.trim(),folderId:$('new-folder-choice').value});
$('creation-cancel').onclick=()=> $('creation-choice').hidden=true;
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
  current=null;renderDashboard();
  await refresh();
});
function renderDashboard() {
  if (!current || current.phase==='ended') {current=null;$('dashboard').hidden=true;$('live-students').replaceChildren();$('calculator-card').hidden=false;return;}
  $('dashboard').hidden = false; $('session-title').textContent = current.title;
  $('calculator-card').hidden = current.mode === 'calculator' && current.phase !== 'ended';
  $('session-phase').textContent = current.phase === 'waiting' ? 'Waiting room open · Questions appear when you start the test.' : current.phase === 'running' ? 'Session in progress' : 'Session ended · Results saved';
  $('test-start').hidden = current.phase !== 'waiting'; $('session-end').hidden = current.phase === 'ended';
  $('extend-time').hidden=current.phase!=='running'||!current.deadlineAt;$('session-timer').textContent=current.deadlineAt&&current.phase==='running'?'Timer ends '+new Date(current.deadlineAt).toLocaleTimeString():'';
  $('live-export').hidden = current.mode !== 'test';$('session-rename').hidden=current.mode!=='test';
  const scores = current.students.filter(s => s.result).map(s => s.result.percentage);
  $('live-summary').textContent = `${current.students.length} joined · ${current.students.filter(s => s.status === 'green' && !s.result).length} active` +
    (current.mode === 'test' ? ` · ${scores.length} submitted · ${current.students.filter(s => s.failed).length} FAIL${scores.length ? ` · Average ${Math.round(scores.reduce((a,b) => a+b,0)/scores.length)}%` : ''}` : '');
  renderTable($('live-students'), current);
}
function renderTable(container, session) {
  const table = document.createElement('table');
  if(session.mode === 'calculator') {
    table.innerHTML='<thead><tr><th>Student number</th><th>Name</th><th>Status</th><th>Review</th></tr></thead>';
    const body=document.createElement('tbody');
    for(const s of session.students) {
      const row=document.createElement('tr');
      for(const value of [s.number,s.name,s.failed ? 'FAILED' : s.status === 'green' ? 'Active' : 'Inactive']) { const cell=document.createElement('td'); cell.textContent=value; row.append(cell); }
      const review=document.createElement('td');if(s.failed && session.phase==='running')review.append(button('Unlock & continue',()=>unlockStudent(session,s)));row.append(review);body.append(row);
    }
    table.append(body); container.replaceChildren(table); return;
  }
  table.innerHTML = '<thead><tr><th>Student number</th><th>Name</th><th>Status</th><th>Student progress</th><th>Score</th><th>Original score</th><th>Review</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const s of [...session.students].sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric:true }))) {
    const tr = document.createElement('tr');
    for (const text of [s.number,s.name]) { const td=document.createElement('td'); td.textContent=text; tr.append(td); }
    const state=document.createElement('td'); const pill=document.createElement('span'); pill.className=`pill ${s.status === 'red' ? 'red' : ''}`; pill.textContent=s.failed ? 'FAILED' : s.result ? 'Test Submitted' : s.status === 'green' ? 'Active' : 'Inactive'; state.append(pill); tr.append(state);
    const progress=document.createElement('td');progress.textContent=s.progress?`${s.result?'Finished':s.progress.question?'Question '+s.progress.question+' of '+s.progress.total:'Not started'} · ${s.progress.answered}/${s.progress.total} answered`:'—';tr.append(progress);
    for (const text of [s.score === null ? 'Pending' : `${s.score} / ${s.total}${s.result ? ` · ${s.result.percentage}%` : ''}`, s.result ? `${s.result.originalScore} / ${s.total}` : '—']) { const td=document.createElement('td'); td.textContent=text; tr.append(td); }
    const review=document.createElement('td');
    if(s.failed && !s.finalized && (s.result || session.phase==='running')) review.append(button(s.result?'Override FAIL':'Unlock & continue',()=>unlockStudent(session,s)));
    if(s.failed && !s.result)review.append(button('Submit Fail score',()=>submitFail(session,s),'danger'));
    const details=document.createElement('details'); const summary=document.createElement('summary'); summary.textContent=`${s.events.length} monitoring events`; details.append(summary);
    const list=document.createElement('ul'); for (const e of s.events) { const li=document.createElement('li'); li.textContent=`${new Date(e.at).toLocaleTimeString()} · ${e.type}${e.reason ? ` · ${e.reason}` : ''}`; list.append(li); } details.append(list); review.append(details); tr.append(review); tbody.append(tr);
  }
  table.append(tbody); container.replaceChildren(table);
}
function renderResults() { $('result-detail').hidden=false; $('result-title').textContent=historySession.title; $('result-delete').hidden=historySession.phase !== 'ended'; $('result-rename').hidden=historySession.phase !== 'ended'; renderTable($('result-students'),historySession); }
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
  const url=URL.createObjectURL(await response.blob()); const a=document.createElement('a'); a.href=url; a.download=decodeURIComponent(response.headers.get('content-disposition')?.split("filename*=UTF-8''")[1]||'OnScreen results.xlsx'); a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
}
$('live-export').onclick=action(()=>download(current)); $('result-export').onclick=action(()=>download(historySession)); $('results-refresh').onclick=action(refresh);
socket.on('connect',()=> { if (account) watch().catch(e=>notice(e.message)); });
socket.on('disconnect',()=> { if (account) notice('Live connection lost. Sessions remain saved; reconnecting…'); });
socket.on('professor:update',view=> { const listed=sessionList.find(s=>s.id===view.id);if(view.phase==='ended'||(listed&&(listed.title!==view.title||listed.phase!==view.phase)))refresh().catch(e=>notice(e.message));if (current?.id === view.id) { current={...current,...view}; renderDashboard(); } if (historySession?.id===view.id) { historySession={...historySession,...view}; renderResults(); } });
socket.on('auth:expired',()=> { notice('Please sign in again to reconnect the private dashboard.'); });
async function signedIn() {
  try { const verified=await api('/me'); if(account && account.id!==verified.id) clearPrivateWorkspace(); account=verified; socket.connect(); $('account-name').textContent=account.email; $('login').hidden=recoveringPassword ? false : true; $('workspace').hidden=recoveringPassword; $('signout').hidden=false; await refresh(); await watch(); }
  catch(e) { account=null; $('login').hidden=false; $('workspace').hidden=true; $('signout').hidden=true; $('auth-message').textContent=e.message; }
}
async function initAuth() {
  const config=await (await fetch('/api/config')).json();
  if (!config.supabaseUrl || !config.supabaseKey) { $('auth-message').textContent='Professor sign-in needs Development authentication configuration. See V2_SETUP.md.'; $('login').querySelectorAll('input,button').forEach(el=>el.disabled=true); return; }
  aiConfigured=Boolean(config.aiConfigured);
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

function renderFolderOptions(selected=$('tb-folder').value) {
 for(const id of ['tb-folder','new-folder-choice']){const value=id==='tb-folder'?selected:$(id).value;$(id).replaceChildren(...[{id:'',name:'Uncategorized Test'},...folders].map(f=>{const o=document.createElement('option');o.value=f.id;o.textContent=f.name;return o;}));$(id).value=value;}
}
function renderFolderMenu(){
 $('folder-list').replaceChildren();if(!folders.length)$('folder-list').textContent='No class folders yet.';
 for(const f of folders){const row=document.createElement('div');row.className='actions folder-edit-row';const name=document.createElement('strong');name.textContent=f.name;row.append(name,button('Rename',()=>openEntry({title:'Rename folder',value:f.name,max:80},async name=>{await api('/folders/'+f.id,'PATCH',{name});await refresh();})),button('Delete folder',async()=>{if(!confirm('Delete “'+f.name+'”? Its tests will move to Uncategorized Test.'))return;await api('/folders/'+f.id,'DELETE');await refresh();},'danger'));$('folder-list').append(row);}
}
let launchTest=null;
function openLaunch(test){launchTest=test;$('launch-test-title').textContent=test.title;$('launch-duration').value='0';$('launch-show-scores').checked=true;$('launch-shuffle').checked=false;$('launch-error').textContent='';$('launch-dialog').showModal();}
$('launch-cancel').onclick=()=> $('launch-dialog').close();
$('launch-form').onsubmit=async e=>{e.preventDefault();$('launch-confirm').disabled=true;try{await launchSession({testId:launchTest.id,durationMinutes:Number($('launch-duration').value),showScores:$('launch-show-scores').checked,shuffleAnswers:$('launch-shuffle').checked});$('launch-dialog').close();}catch(e){$('launch-error').textContent=e.message;}finally{$('launch-confirm').disabled=false;}};
$('extend-time').onclick=action(async()=>updateSession(await api('/sessions/'+current.id+'/extend','POST',{})));
let entryAction=null;
function closeEntry(){entryAction=null;if($('entry-dialog').open)$('entry-dialog').close();}
function openEntry({title,label='Name',value='',max=120,help='',save='Save'},fn){
 $('entry-title').textContent=title;$('entry-label').firstChild.textContent=label;$('entry-value').value=value;$('entry-value').maxLength=max;$('entry-help').textContent=help;$('entry-error').textContent='';$('entry-save').textContent=save;$('entry-save').disabled=false;$('entry-cancel').disabled=false;entryAction=fn;$('entry-dialog').showModal();$('entry-value').focus();
}
$('entry-cancel').onclick=closeEntry;$('entry-dialog').addEventListener('cancel',()=>{entryAction=null;});
$('entry-form').onsubmit=async e=>{e.preventDefault();const value=$('entry-value').value.trim();if(!value)return;const fn=entryAction,generation=accountGeneration;if(!fn)return;$('entry-save').disabled=true;$('entry-cancel').disabled=true;
 try{await fn(value);if(generation===accountGeneration)closeEntry();}catch(e){if(generation===accountGeneration)$('entry-error').textContent=e.message;}finally{if(generation===accountGeneration){$('entry-save').disabled=false;$('entry-cancel').disabled=false;}}
};
$('new-folder').onclick=()=>openEntry({title:'New class folder',max:80},async name=>{await api('/folders','POST',{name});await refresh();});
function updateSession(updated){if(current?.id===updated.id){current=updated;renderDashboard();}if(historySession?.id===updated.id){historySession=updated;renderResults();}}
function unlockStudent(session,student){openEntry({title:student.result?'Override FAIL':'Unlock & continue',label:'Reason',max:500,help:'Review '+student.name+'’s incident, then record why you are allowing continuation.',save:student.result?'Override FAIL':'Unlock & continue'},async reason=>updateSession(await api('/sessions/'+session.id+'/override','POST',{studentId:student.id,reason})));}
function submitFail(session,student){openEntry({title:'Submit Fail score',label:'Reason',value:'Confirmed by professor',max:500,help:'Finalize '+student.name+' at 0%. This closes their attempt and stops their connection. Their saved answers and original score remain in the private record.',save:'Submit Fail score'},async reason=>updateSession(await api('/sessions/'+session.id+'/finalize-fail','POST',{studentId:student.id,reason})));}
function renameResults(session){openEntry({title:session.phase==='ended'?'Rename results':'Rename session',value:session.title,help:'This name will be used for this session, its results and Excel filename. The Library test stays unchanged.'},async title=>{updateSession(await api('/sessions/'+session.id,'PATCH',{title}));await refresh();});}
$('result-rename').onclick=()=>renameResults(historySession);$('session-rename').onclick=()=>renameResults(current);
function openImport(mode) {
  importMode=mode;$('import-panel').hidden=false;$('ai-options').hidden=mode!=='generate';$('import-heading').textContent=mode==='generate'?'Create with AI':'Upload a test';
  $('import-help').textContent=mode==='generate'?'Create new questions from lecture notes or other source material. Review the generated answers and source excerpts before saving.':'Upload a ready-made test with numbered questions, A. / B. options and Answer: A, marked correct options, or an Answer key: block. For blanks, use Answer: value (alternatives separated by |). Missing answers will be flagged for your review. Text-based PDF and Word DOCX supported; scanned files need OCR first.';
  $('ai-config-note').textContent=aiConfigured?'':'AI setup is required in Development before generation is available.';$('import-status').textContent='';$('import-submit').disabled=mode==='generate'&&!aiConfigured;$('import-panel').scrollIntoView({behavior:'smooth'});
}
$('import-source').oninput=()=>{if($('import-source').value.trim())$('import-file').value='';};$('import-file').onchange=()=>{if($('import-file').files.length)$('import-source').value='';};
$('upload-test').onclick=()=>openImport('import');$('create-ai').onclick=()=>openImport('generate');$('import-cancel').onclick=()=> $('import-panel').hidden=true;
$('import-form').onsubmit=action(async e=> {
  e.preventDefault();if(importMode==='generate'&&!$('ai-consent').checked) {$('import-status').textContent='Confirm that this source may be sent to OpenAI.';return;}
  const data=new FormData(),file=$('import-file').files[0];if(file)data.append('file',file);else data.append('source',$('import-source').value);
  if(importMode==='generate')for(const key of ['count','types','difficulty'])data.append(key,$('ai-'+key).value);
  const generation=accountGeneration;$('import-submit').disabled=true;$('import-status').textContent=importMode==='generate'?'Creating a draft…':'Reading your test…';
  try {
    const response=await fetch('/api/'+importMode,{method:'POST',headers:{Authorization:'Bearer '+await token()},body:data});const result=await response.json();
    if(generation!==accountGeneration)return;if(!response.ok)throw new Error(result.error||'Could not prepare draft.');
    if(!result.test?.questions?.length)throw new Error('No questions were recognized. Check the format and try again.');
    const title=$('new-title').value.trim(),folderId=$('new-folder-choice').value;openBuilder({...result.test,title:title||result.test.title,folderId});editingId=null;$('draft-review').textContent=['Review every question and answer before saving.',...(result.warnings||[])].join(' ');$('import-panel').hidden=true;$('import-source').value='';$('import-file').value='';
  } catch(e) {if(generation===accountGeneration)$('import-status').textContent=e.message;}
  finally {if(generation===accountGeneration)$('import-submit').disabled=importMode==='generate'&&!aiConfigured;}
});
function addQuestion() {
 const id='q_'+crypto.randomUUID();tbQuestions.push({id,type:'mc',text:'',options:[{id:id+'_a',text:''},{id:id+'_b',text:''}],correctOptionId:'',points:1});renderTestBuilder();els.tbQuestions.lastElementChild?.querySelector('.tb-q-text').focus();
}
function moveQuestion(from,to) {if(to<0||to>=tbQuestions.length||from===to)return;tbQuestions.splice(to,0,tbQuestions.splice(from,1)[0]);renderTestBuilder();}
let draggingQuestion=null;
function renderTestBuilder() {
 els.tbQuestions.replaceChildren();
 tbQuestions.forEach((q,i)=> {
  const card=document.createElement('div');card.className='tb-q-card';card.dataset.index=i;
  const header=document.createElement('div');header.className='tb-q-header';const handle=document.createElement('span');handle.textContent='⠿ Q'+(i+1);handle.draggable=true;handle.className='drag-handle';handle.title='Drag to reorder';handle.ondragstart=e=>{draggingQuestion=i;e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move';};handle.ondragend=()=>draggingQuestion=null;
  card.ondragover=e=> {if(draggingQuestion!==null)e.preventDefault();};card.ondrop=e=> {e.preventDefault();if(draggingQuestion!==null)moveQuestion(draggingQuestion,i);draggingQuestion=null;};header.append(handle);
  const up=button('↑',()=>moveQuestion(i,i-1));up.disabled=i===0;up.setAttribute('aria-label','Move question '+(i+1)+' up');const down=button('↓',()=>moveQuestion(i,i+1));down.disabled=i===tbQuestions.length-1;down.setAttribute('aria-label','Move question '+(i+1)+' down');header.append(up,down);
  const pointsLabel=document.createElement('label');pointsLabel.textContent='Points';const points=document.createElement('input');points.type='number';points.className='tb-points';points.min='0.01';points.max='1000';points.step='0.01';points.value=q.points??1;points.setAttribute('aria-label','Question '+(i+1)+' points');points.oninput=()=>q.points=Number(points.value);pointsLabel.append(points);header.append(pointsLabel);
  if(tbQuestions.length>1)header.append(button('Remove question',()=>{tbQuestions.splice(i,1);renderTestBuilder();}));card.append(header);
  const type=document.createElement('select');type.className='tb-q-type';type.setAttribute('aria-label','Question '+(i+1)+' type');for(const [value,label] of [['mc','Multiple choice'],['blank','Fill in the blank']]){const o=document.createElement('option');o.value=value;o.textContent=label;type.append(o);}type.value=q.type||'mc';type.onchange=()=>{q.type=type.value;if(q.type==='blank'){q.acceptedAnswers=q.acceptedAnswers||[];q.caseSensitive=q.caseSensitive||false;}else if(!q.options){q.options=[{id:q.id+'_a',text:''},{id:q.id+'_b',text:''}];q.correctOptionId='';}renderTestBuilder();};card.append(type);
  const text=document.createElement('input');text.className='tb-q-text';text.placeholder='Question text…';text.setAttribute('aria-label','Question '+(i+1)+' text');text.maxLength=1000;text.value=q.text;text.oninput=()=>q.text=text.value;card.append(text);
  if(q.type==='blank') {
   const label=document.createElement('label');label.textContent='Accepted answers (one per line)';const answers=document.createElement('textarea');answers.className='tb-accepted';answers.rows=3;answers.value=(q.acceptedAnswers||[]).join('\n');answers.oninput=()=>q.acceptedAnswers=answers.value.split('\n').map(s=>s.trim()).filter(Boolean);label.append(answers);card.append(label);
   const sensitive=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.checked=q.caseSensitive;check.onchange=()=>q.caseSensitive=check.checked;sensitive.append(check,' Case sensitive');card.append(sensitive);
  } else {
   (q.options||[]).forEach((o,j)=>{const row=document.createElement('div');row.className='tb-option-row';const radio=document.createElement('input');radio.type='radio';radio.name=q.id;radio.checked=q.correctOptionId===o.id;radio.setAttribute('aria-label','Correct answer '+String.fromCharCode(65+j));radio.onchange=()=>q.correctOptionId=o.id;const input=document.createElement('input');input.className='tb-opt-text';input.maxLength=500;input.placeholder='Option '+String.fromCharCode(65+j);input.value=o.text;input.oninput=()=>o.text=input.value;row.append(radio,input);if(q.options.length>2)row.append(button('Remove option',()=>{q.options.splice(j,1);if(q.correctOptionId===o.id)q.correctOptionId='';renderTestBuilder();}));card.append(row);});
   if(q.options.length<5)card.append(button('+ Add Option',()=>{q.options.push({id:q.id+'_'+crypto.randomUUID(),text:''});renderTestBuilder();}));
  }
  if(q.evidence){const evidence=document.createElement('p');evidence.className='source-evidence';evidence.textContent='Source excerpt: '+q.evidence;card.append(evidence);}els.tbQuestions.append(card);
 });
}
function collectTest() {
 const title=els.tbTitle.value.trim();if(!title)return {error:'Please enter a test title.'};
 for(const [i,q] of tbQuestions.entries()) {
  if(!Number.isFinite(q.points??1)||(q.points??1)<=0||(q.points??1)>1000||Math.abs((q.points??1)*100-Math.round((q.points??1)*100))>0.000001)return {error:'Q'+(i+1)+': Enter positive points, up to1000, with at most2 decimals.'};
  if(!q.text.trim())return {error:'Q'+(i+1)+': Question text is required.'};
  if(q.type==='blank'){if(!q.acceptedAnswers?.length||q.acceptedAnswers.length>20||q.acceptedAnswers.some(a=>a.length>300))return {error:'Q'+(i+1)+': Enter 1–20 accepted answers, each up to 300 characters.'};}
  else {if(q.options.some(o=>!o.text.trim()))return {error:'Q'+(i+1)+': Each option needs text.'};if(!q.correctOptionId)return {error:'Q'+(i+1)+': Please mark the correct answer.'};}
 }
 const questions=tbQuestions.map(q=>q.type==='blank'?{id:q.id,type:'blank',points:q.points??1,text:q.text,acceptedAnswers:q.acceptedAnswers,caseSensitive:q.caseSensitive,...(q.evidence?{evidence:q.evidence}:{})}:{id:q.id,type:'mc',points:q.points??1,text:q.text,options:q.options,correctOptionId:q.correctOptionId,...(q.evidence?{evidence:q.evidence}:{})});
 return {test:{title,folderId:$('tb-folder').value||null,questions}};
}
function showTbError(msg){els.tbError.textContent=msg;els.tbError.hidden=false;}
function hideTbError(){els.tbError.hidden=true;}
