const {t}=window.examioLanguage;
const $ = id => document.getElementById(id);
$('add-practice-test').onclick=action(async()=>{
  const control=$('add-practice-test');
  control.disabled=true;
  try {
    await api('/practice-test','POST',{language:window.examioLanguage.current});
    await refresh();
    notice('Practice test added.');
  } finally { control.disabled=false; }
});
const els = { tbTitle: $('tb-title'), tbQuestions: $('tb-questions'), tbError: $('tb-error') };
const socket = io();
let resultViewVersion=0;
let trashVersion=0, pendingTrashDelete=null;
let auth, account, current, historySession, library = [], folders = [], aiConfigured=false, uploadMaxBytes=5*1024*1024, importMode="import", sessionList = [], editingId = null, tbQuestions = [], popup, recoveringPassword = false;
let accountGeneration = 0,creationVersion=0,professorTimerSnapshot=null;
$('calculator-language').value=window.examioLanguage.current;
let lastWorkspaceTab = 'launch';
let popupSessionId = null, openingDisplay = false, launching = false;
function clearPrivateWorkspace() {
  settings.reset();tour.reset();$('launch-show-names').checked=false;$('launch-show-scores-live').checked=false;$('result-detail-rows').replaceChildren();lastWorkspaceTab='launch';accountGeneration++;creationVersion++;professorTimerSnapshot=null;if($('answer-ai-dialog').open)$('answer-ai-dialog').close();$('answer-ai-status').textContent='';closeEntry();launchTest=null;$('new-title').value='';for(const id of ['tb-folder','new-folder-choice'])$(id).replaceChildren();$('launch-test-title').textContent='';if($('launch-dialog').open)$('launch-dialog').close();$('creation-choice').hidden=true;
  trashVersion++;pendingTrashDelete=null;if($('trash-confirm').open)$('trash-confirm').close();$('trash-confirm-message').textContent='';$('trash-items').replaceChildren();
  current=null; historySession=null; library=[]; folders=[]; sessionList=[]; $('import-source').value='';$('import-file').value='';$('import-panel').hidden=true;$('draft-review').textContent=''; editingId=null; tbQuestions=[];
  for(const id of ['launch-tests','library-tests','active-sessions','result-sessions','live-students','result-students','tb-questions']) $(id).replaceChildren();
  for(const id of ['dashboard','result-detail','test-builder']) $(id).hidden=true;
  $('calculator-card').hidden=false;
  for(const id of ['session-title','session-phase','live-summary','result-title','account-name','notice','tb-error']) $(id).textContent='';
  $('tb-title').value=''; $('password').value='';
  socket.disconnect();
}
let noticeTimer, workspaceTab='launch', tabVersion=0;
document.addEventListener('visibilitychange',()=>{if(document.hidden){tabVersion++;notice('');}});
const notice = message => {
  clearTimeout(noticeTimer);
  $('notice').textContent = t(message || '');
  if(message) noticeTimer=setTimeout(()=>notice(''),8000);
};
async function token() { return (await auth.auth.getSession()).data.session?.access_token || ''; }
async function api(route, method = 'GET', body) {
  const generation=accountGeneration;
  const response = await fetch(`/api${route}`, { method, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if(generation!==accountGeneration) throw new Error('Account changed. Please retry.');
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
const tour=window.createOnScreenTour(api);
const settings=window.createOnScreenSettings({api,notify:notice,onClose:()=>tab(lastWorkspaceTab),onTakeTour:()=>$('take-tour').click(),onDeleted:async result=>{
  await auth.auth.signOut({scope:'local'});clearPrivateWorkspace();account=null;$('workspace').hidden=true;$('login').hidden=false;$('signout').hidden=true;
  $('auth-message').textContent=result.state==='deleted'?'Your account and Examio data have been deleted.':'Account deletion has started. You are signed out while it completes.';
}});
function action(fn) { return async event => { const version=tabVersion; try { notice(''); await fn(event); } catch (e) { if(version===tabVersion)notice(e.message); } }; }
function tab(name) {
  if(name!==workspaceTab){workspaceTab=name;tabVersion++;notice('');}
  if(name!=='settings')lastWorkspaceTab=name;
  document.querySelectorAll('.tab').forEach(el => el.hidden = el.id !== name);
  document.querySelectorAll('[data-tab]').forEach(el => el.classList.toggle('selected', el.dataset.tab === name));
}
document.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => { tab(el.dataset.tab); if (el.dataset.tab === 'results') refresh().catch(e => notice(e.message)); if(el.dataset.tab==='trash') refreshTrash().catch(e=>notice(e.message)); });
function button(text, fn, className = '') { const b = document.createElement('button'); b.textContent = t(text); b.className = className; b.onclick = action(fn); return b; }
function card(title, subtitle) { const c = document.createElement('article'); c.className = 'card'; const h = document.createElement('h3'); h.textContent = title; const p = document.createElement('p'); p.textContent = subtitle; c.append(h,p); return c; }
async function refreshTrash() {
  const version=++trashVersion;
  const items=await api('/trash');
  if(version!==trashVersion)return;
  const container=$('trash-items');
  $('trash-select-all').checked=false;
  container.replaceChildren();
  if(!items.length) container.append(card('Trash is empty','Deleted quizzes and results will appear here.'));
  for(const item of items) {
    const route='/trash/'+item.kind+'/'+encodeURIComponent(item.id);
    const kind=item.kind==='quizzes'?'Quiz':'Results';
    const entry=card(item.title||kind,kind+' · Expires '+new Date(item.expiresAt).toLocaleString());
    const actions=document.createElement('div');
    actions.className='actions';
    actions.append(button(t('Restore'),async()=>{
      await api(route+'/restore','POST');
      await refreshTrash();
      await refresh();
      if(lastWorkspaceTab==='trash'&&!$('trash').hidden)notice(t('Restored.'));
    }),button('Delete permanently',()=>{
      pendingTrashDelete=route;
      const dialog=$('trash-confirm');
      dialog.returnValue='';
      $('trash-confirm-message').textContent='“'+(item.title||kind)+'” cannot be recovered after this.';
      dialog.showModal();
    },'danger'));
    if(item.kind==='results'){entry.classList.add('trash-selectable');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.className='trash-result-select';checkbox.setAttribute('aria-label','Select '+(item.title||kind));checkbox.value=item.id;checkbox.onchange=updateTrashSelection;entry.append(checkbox);}
    entry.append(actions);
    container.append(entry);
  }
  updateTrashSelection();
}
const selectedTrash=()=>[...document.querySelectorAll('.trash-result-select:checked')].map(input=>input.value);
function updateTrashSelection(){
  const total=document.querySelectorAll('.trash-result-select').length;
  const selected=selectedTrash().length;
  $('trash-select-all').disabled=!total;
  $('trash-select-all').checked=total>0&&selected===total;
  $('trash-select-all').indeterminate=selected>0&&selected<total;
  $('trash-delete-selected').disabled=!selected;
}
$('trash-select-all').onchange=event=>{
  document.querySelectorAll('.trash-result-select').forEach(input=>input.checked=event.target.checked);
  updateTrashSelection();
};
$('trash-delete-selected').onclick=()=>{
  const ids=selectedTrash();
  if(!ids.length)return;
  pendingTrashDelete=ids;
  $('trash-confirm').returnValue='';
  $('trash-confirm-message').textContent='Permanently delete '+ids.length+' selected results? This cannot be undone.';
  $('trash-confirm').showModal();
};
$('trash-refresh').onclick=action(refreshTrash);
$('trash-confirm').onclose=action(async()=>{
  const route=pendingTrashDelete;
  pendingTrashDelete=null;
  if(!route||$('trash-confirm').returnValue!=='delete')return;
  const version=tabVersion;
  const deleted=Array.isArray(route)?(await api('/trash/results/delete','POST',{ids:route})).deleted:(await api(route,'DELETE'),1);
  await refreshTrash();
  if(version===tabVersion&&!$('trash').hidden)notice(deleted?t('Permanently deleted.'):'The selected results were already removed.');
});
let draggedTest=null;
function previewQuizMove(list,before) {
  const row=draggedTest.placeholder;
  if(before===row||(row.parentElement===list&&row.nextElementSibling===before))return;
  const siblings=[...new Set([...row.parentElement.children,...list.children])].filter(el=>el!==row&&el!==draggedTest.row);
  const positions=siblings.map(el=>el.getBoundingClientRect().top);
  list.insertBefore(row,before);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches) siblings.forEach((el,index)=>{
    const delta=positions[index]-el.getBoundingClientRect().top;
    if(delta)el.animate([{transform:'translateY('+delta+'px)'},{transform:'translateY(0)'}],{duration:150,easing:'ease-out'});
  });
}
function finishQuizDrag() {
  const drag=draggedTest;
  if(!drag)return null;
  draggedTest=null;
  drag.row.classList.remove('quiz-dragging');
  drag.placeholder.remove();
  return drag;
}
function setupQuizDrop(folder,list) {
  folder.ondragover=event=>{
    if(!draggedTest)return;
    event.preventDefault();event.dataTransfer.dropEffect='move';
    if(!draggedTest.placeholder.parentElement)return;
    folder.open=true;
    const rows=[...list.children].filter(row=>row!==draggedTest.row&&row!==draggedTest.placeholder);
    const before=rows.find(row=>{const rect=row.getBoundingClientRect();return event.clientY<rect.top+rect.height/2;})||null;
    previewQuizMove(list,before);
  };
  folder.ondrop=action(async event=>{
    if(!draggedTest?.placeholder.parentElement)return;
    event.preventDefault();
    const {row,placeholder}=draggedTest;
    const destination=placeholder.parentElement;
    const ids=[...destination.children].filter(item=>item!==row).map(item=>item.dataset.testId);
    finishQuizDrag();
    await api('/test-order','PUT',{folderId:destination.dataset.folderId,ids,movedId:row.dataset.testId});
    await refresh();
  });
}
async function refresh() {
  [library, sessionList, folders] = await Promise.all([api('/tests'), api('/sessions'),api('/folders')]);
  const expanded=new Set([...document.querySelectorAll('#launch-tests details[open],#library-tests details[open]')].map(folder=>folder.dataset.folderKey));
  if(draggedTest)return;
  renderFolderOptions();
  for (const id of ['launch-tests', 'library-tests', 'active-sessions', 'result-sessions']) $(id).replaceChildren();
  if (!library.length) {
    $('launch-tests').append(card(t('A fresh start'), t('Create your first test in Library, or launch the calculator.')));
    $('library-tests').append(card('Your library starts here', 'Save a test and use it again with any class.'));
  }
  const groups={};
  for(const root of ['launch-tests','library-tests']) for(const folder of [...folders,{id:'',name:t('Uncategorized Test')}]) {
    const count=library.filter(t=>(t.folderId||'')===folder.id).length;
    if(!count && !folders.some(f=>f.id===folder.id) && root!=='library-tests')continue;
    const detail=document.createElement('details');detail.className='folder';detail.dataset.folderKey=root+':'+folder.id;detail.open=expanded.has(detail.dataset.folderKey);
    const summary=document.createElement('summary');summary.textContent=`${folder.name} (${count})`;if(root==='library-tests'&&folder.id)summary.append(folderActions(folder));detail.append(summary);
    const list=document.createElement('div');list.className=root==='library-tests'?'library-rows':'cards';list.dataset.folderId=folder.id;if(root==='library-tests')setupQuizDrop(detail,list);detail.append(list);$(root).append(detail);groups[root+folder.id]=list;
  }
  for (const test of library) {
    const launch = card(test.title, t('{count} questions · Saved test',{count:test.questions.length}));
    launch.append(button(t('Launch test ↗'), () => openLaunch(test), 'primary')); (groups['launch-tests'+(test.folderId||'')]||$('launch-tests')).append(launch);
    const saved=document.createElement('article');saved.className='library-test-row';
    const title=document.createElement('strong');title.textContent=test.title;saved.append(title);
    saved.dataset.testId=test.id;
    const handle=document.createElement('button');
    handle.type='button';handle.textContent='↕';handle.title='Drag to move, or press Up or Down';
    handle.className='drag-handle';handle.draggable=true;handle.setAttribute('aria-label','Move '+test.title);
    handle.ondragstart=event=>{
      const placeholder=document.createElement('div');
      placeholder.className='library-test-row quiz-drop-preview';placeholder.dataset.testId=test.id;
      placeholder.textContent=test.title;placeholder.setAttribute('aria-hidden','true');
      draggedTest={row:saved,placeholder};
      event.dataTransfer.setData('text/plain',test.id);event.dataTransfer.effectAllowed='move';
      const rect=saved.getBoundingClientRect();
      event.dataTransfer.setDragImage(saved,Math.max(0,Math.min(rect.width,event.clientX-rect.left)),rect.height/2);
      placeholder.style.height=rect.height+'px';
      requestAnimationFrame(()=>{if(draggedTest?.row===saved){saved.after(placeholder);saved.classList.add('quiz-dragging');}});
    };
    handle.ondragend=finishQuizDrag;
    handle.onkeydown=action(async event=>{
      if(!['ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();
      const folderId=test.folderId||'';
      const ids=library.filter(item=>(item.folderId||'')===folderId).map(item=>item.id);
      const index=ids.indexOf(test.id),next=index+(event.key==='ArrowUp'?-1:1);
      if(next<0||next>=ids.length)return;
      [ids[index],ids[next]]=[ids[next],ids[index]];
      await api('/test-order','PUT',{folderId,ids});await refresh();
      [...document.querySelectorAll('.library-test-row')].find(row=>row.dataset.testId===test.id)?.querySelector('.drag-handle')?.focus();
    });
    const actions = document.createElement('div'); actions.className = 'actions';
    actions.append(button(t('Edit'), () => openBuilder(test)),button(t('Copy'),()=>openEntry({title:t('Create copy of a test'),value:(test.title.slice(0,73)+' (copy)'),max:80},async title=>{const copy=await api('/tests/'+test.id+'/copy','POST',{title});await refresh();openBuilder(copy);})), button(t('Delete'), async () => {
      if (!confirm(`Move “${test.title}” to Trash for 30 days? Existing sessions keep their copy.`)) return;
      await api(`/tests/${test.id}`, 'DELETE'); await refresh();
    }));
    actions.append(button(t('Download PDF'),()=>downloadFile('/api/tests/'+encodeURIComponent(test.id)+'/pdf',test.title+'.pdf')),handle);saved.append(actions); (groups['library-tests'+(test.folderId||'')]||$('library-tests')).append(saved);
  }
  for (const s of sessionList) {
    if (s.mode === 'test') {
      const c = card(s.title, `${new Date(s.createdAt).toLocaleString()} · ${s.phase} · ${s.students.length} joined`);
      c.append(button(t('View results'), async () => { const version=++resultViewVersion; const session=await api(`/sessions/${s.id}`); if(version!==resultViewVersion)return; historySession=session; showResultSummary();renderResults(); }));
      if(s.phase === 'ended') c.append(button('Rename results',()=>renameResults(s)),button('Delete results', () => deleteResults(s), 'danger'));
      $('result-sessions').append(c);
    }
    if (s.phase !== 'ended') $('active-sessions').append(button(`${s.title} · ${t(s.phase)}`, () => openSession(s.id)));
  }
  if (!sessionList.some(s => s.mode === 'test')) $('result-sessions').append(card('No test results yet', 'Results from tests will be saved here. Calculator sessions do not create results.'));
  if(current && !sessionList.some(s=>s.id===current.id && s.phase!=='ended')){current=null;renderDashboard();}
}
function openBuilder(test) {
  creationVersion++;els.tbQuestions.inert=false;$('tb-start-btn').disabled=false;$('tb-add-q-btn').disabled=false;$('tb-answer-ai').disabled=!aiConfigured;$('answer-ai-status').textContent='';tab('library');$('creation-choice').hidden=true;$('import-panel').hidden=true; editingId = test?.id || null;
  $('test-builder').hidden = false; $('builder-heading').textContent = test?.id ? t('Edit test') : 'Create a test';
  els.tbTitle.value = test?.title || ''; renderFolderOptions(test?.folderId||''); $('draft-review').textContent=''; tbQuestions = structuredClone(test?.questions || []); hideTbError();
  if (!tbQuestions.length) addQuestion(); else renderTestBuilder();
  $('test-builder').scrollIntoView({ behavior: 'smooth' });
}
$('new-test').onclick = () => {creationVersion++;tab('library');$('test-builder').hidden=true;$('import-panel').hidden=true;$('creation-choice').hidden=false;$('new-title').value='';$('new-folder-choice').value='';$('import-source').value='';$('import-file').value='';$('ai-consent').checked=false;};
$('create-manual').onclick=()=>openBuilder({title:$('new-title').value.trim(),folderId:$('new-folder-choice').value});
$('creation-cancel').onclick=()=>{creationVersion++;$('creation-choice').hidden=true;};
$('tb-add-q-btn').onclick = () => { if (tbQuestions.length < 100) addQuestion(); };
$('tb-cancel-btn').onclick = () =>{creationVersion++;$('test-builder').hidden=true;};
$('tb-start-btn').onclick = action(async () => {
  const collected = collectTest(); if (collected.error) return showTbError(collected.error);
  await api('/tests', 'POST', { ...collected.test, ...(editingId ? { id: editingId } : {}) });
  $('test-builder').hidden = true; await refresh(); notice(t('Test saved.'));
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
    else notice('If the classroom window did not open, allow popups for Examio and use “Open classroom display”.');
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
  if(current?.id===res.view?.id){current={...current,...res.view};renderDashboard();}
};
$('calculator-launch').onclick = action(async () => {
  const existing = sessionList.find(s => s.mode === 'calculator' && s.phase !== 'ended');
  if (existing) { await openSession(existing.id); await openClassroomDisplay(current); }
  else await launchSession({ mode: 'calculator',language:$('calculator-language').value });
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
  if (!current || current.phase==='ended') {professorTimerSnapshot=null;current=null;$('dashboard').hidden=true;$('live-students').replaceChildren();$('calculator-card').hidden=false;return;}
  $('dashboard').hidden = false; $('session-title').textContent = current.title;
  $('calculator-card').hidden = current.mode === 'calculator' && current.phase !== 'ended';
  $('session-phase').textContent = current.phase === 'waiting' ? t('Waiting room open · Questions appear when you start the test.') : current.phase === 'running' ? 'Session in progress' : t('Session ended · Results saved');
  $('test-start').hidden = current.phase !== 'waiting'; $('session-end').hidden = current.phase === 'ended';
  $('extend-time').hidden=current.phase!=='running'||!current.deadlineAt;
  if(current.deadlineAt && (!professorTimerSnapshot||professorTimerSnapshot.id!==current.id||professorTimerSnapshot.serverNow!==current.serverNow||professorTimerSnapshot.deadlineAt!==current.deadlineAt))professorTimerSnapshot={id:current.id,serverNow:current.serverNow||Date.now(),deadlineAt:current.deadlineAt,receivedAt:performance.now()};renderProfessorTimer();
  $('session-rename').hidden=current.mode!=='test';
  $('launch-score-switch').hidden=current.mode!=='test';
  const scores = current.students.filter(s => s.result).map(s => s.result.percentage);
  $('live-summary').textContent = `${current.students.length} joined · ${current.students.filter(s => s.status === 'green' && !s.result && !s.completed).length} active` +
    (current.mode === 'test' ? ` · ${scores.length} submitted · ${current.students.filter(s => s.failed).length} FAIL${scores.length && $('launch-show-scores-live').checked ? ` · Average ${Math.round(scores.reduce((a,b) => a+b,0)/scores.length)}%` : ''}` : ' · '+current.students.filter(s=>s.completed).length+' completed');
  renderTable($('live-students'), current);
}
function renderProfessorTimer(){
 if(!current?.deadlineAt||current.phase!=='running'||!professorTimerSnapshot){$('session-timer').textContent='';return;}
 const seconds=Math.max(0,Math.ceil((professorTimerSnapshot.deadlineAt-(professorTimerSnapshot.serverNow+performance.now()-professorTimerSnapshot.receivedAt))/1000));
 $('session-timer').textContent='Time remaining: '+Math.floor(seconds/60)+' min '+String(seconds%60).padStart(2,'0')+' sec · Ends '+new Date(professorTimerSnapshot.deadlineAt).toLocaleTimeString();
}
setInterval(renderProfessorTimer,500);
for(const id of ['launch-show-names','launch-show-scores-live'])$(id).onchange=()=>{if(current)renderDashboard();};
function renderTable(container, session) {
  const isLaunch=container.id==='live-students';
  const masked=isLaunch&&!$('launch-show-names').checked;
  const showScores=!isLaunch||$('launch-show-scores-live').checked;
  const table = document.createElement('table');
  if(session.mode === 'calculator') {
    table.innerHTML='<thead><tr><th>'+t('Student number')+'</th><th>'+t('Name')+'</th><th>'+t('Status')+'</th><th>'+t('Review')+'</th></tr></thead>';
    const body=document.createElement('tbody');
    for(const s of session.students) {
      const row=document.createElement('tr');
      for(const value of [s.number,masked?'••••••':s.name,s.failed ? t('FAILED') : s.completed?'Completed and closed':s.status === 'green' ? t('Active') : t('Inactive')]) { const cell=document.createElement('td'); cell.textContent=value; row.append(cell); }
      const review=document.createElement('td');if(s.failed && session.phase==='running')review.append(button(t('Unlock & continue'),()=>unlockStudent(session,s)));row.append(review);body.append(row);
    }
    table.append(body); container.replaceChildren(table); return;
  }
  table.innerHTML = '<thead><tr><th>'+t('Student number')+'</th><th>'+t('Name')+'</th><th>'+t('Status')+'</th><th>'+t('Student progress')+'</th>'+(showScores?'<th>'+t('Score')+'</th><th>'+t('Original score')+'</th>':'')+'<th>'+t('Review')+'</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const s of [...session.students].sort((a,b) => a.number.localeCompare(b.number, undefined, { numeric:true }))) {
    const tr = document.createElement('tr');
    for (const text of [s.number,masked?'••••••':s.name]) { const td=document.createElement('td'); td.textContent=text; tr.append(td); }
    const state=document.createElement('td'); const pill=document.createElement('span'); pill.className=`pill ${s.status === 'red' ? 'red' : ''}`; pill.textContent=s.failed ? t('FAILED') : s.completed ? 'Completed and closed' : s.result ? 'Test Submitted' : s.status === 'green' ? t('Active') : t('Inactive'); state.append(pill); tr.append(state);
    const progress=document.createElement('td');progress.textContent=s.progress?`${s.result?t('Finished'):s.progress.question?t('Question {number} of {total}',{number:s.progress.question,total:s.progress.total}):t('Not started')} · ${t('{answered}/{total} answered',s.progress)}`:'—';tr.append(progress);
    if(showScores) for (const text of [s.score === null ? t('Pending') : `${s.score} / ${s.total}${s.result ? ` · ${s.result.percentage}%` : ''}`, s.result ? `${s.result.originalScore} / ${s.total}` : '—']) { const td=document.createElement('td'); td.textContent=text; tr.append(td); }
    const review=document.createElement('td');
    if(s.failed && !s.finalized && (s.result || session.phase==='running')) review.append(button(s.result?t('Override FAIL'):t('Unlock & continue'),()=>unlockStudent(session,s)));
    if(s.failed && !s.result)review.append(button(t('Submit Fail score'),()=>submitFail(session,s),'danger'));
    const details=document.createElement('details'); const summary=document.createElement('summary'); summary.textContent=t('{count} monitoring events',{count:s.events.length}); details.append(summary);
    const list=document.createElement('ul'); for (const e of s.events) { const li=document.createElement('li'); li.textContent=`${new Date(e.at).toLocaleTimeString()} · ${e.type}${e.reason ? ` · ${e.reason}` : ''}`; list.append(li); } details.append(list); review.append(details); tr.append(review); tbody.append(tr);
  }
  table.append(tbody); container.replaceChildren(table);
}
function closeResults() {
  $('result-details').hidden=true;$('result-detail-rows').replaceChildren();
  resultViewVersion++;
  historySession=null;
  $('result-detail').hidden=true;
  $('result-students').replaceChildren();
}
$('result-close').onclick=()=>{closeResults();$('results-refresh').focus();};
function renderResults() { $('result-detail').hidden=false; $('result-title').textContent=historySession.title; $('result-delete').hidden=historySession.phase !== 'ended'; $('result-rename').hidden=historySession.phase !== 'ended'; renderTable($('result-students'),historySession); }
async function deleteResults(session) {
  if(!confirm(`Move the saved results for “${session.title}” to Trash for 30 days?`)) return;
  await api(`/sessions/${session.id}`, 'DELETE');
  if(historySession?.id === session.id) closeResults();
  if(current?.id === session.id) { current=null; $('dashboard').hidden=true; $('calculator-card').hidden=false; }
  await refresh(); if(!$('results').hidden)notice(t('Results moved to Trash.'));
}
$('result-delete').onclick=action(()=>deleteResults(historySession));
async function downloadFile(path,fallback) {
  const response=await fetch(path,{headers:{Authorization:'Bearer '+await token()}});
  if(!response.ok)throw Error('Download failed. Please sign in and retry.');
  const url=URL.createObjectURL(await response.blob());
  const link=document.createElement('a');
  link.href=url;
  link.download=decodeURIComponent(response.headers.get('content-disposition')?.split("filename*=UTF-8''")[1]||encodeURIComponent(fallback));
  link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function download(s,detail=false) {
  return downloadFile('/api/sessions/'+encodeURIComponent(s.id)+'/export'+(detail?'?detail=1':''),'Examio results.xlsx');
}
function showResultSummary(){
  notice('');
  $('result-details').hidden=true;$('result-students').hidden=false;
  $('result-summary-tab').setAttribute('aria-pressed','true');$('result-details-tab').setAttribute('aria-pressed','false');
}
$('result-summary-tab').onclick=showResultSummary;
let detailsRequest=null,detailsSnapshot='',detailsPhase;
function detailsVisible(){return historySession&&!$('results').hidden&&!$('result-details').hidden&&!document.hidden;}
function renderAnswerGrid(data){
  const root=$('result-detail-rows');
  const table=document.createElement('table');table.className='answer-grid';
  const header=table.createTHead().insertRow();
  for(const [index,label] of ['Student number','Name','State',...data.questions].entries()){
    const th=document.createElement('th');th.scope='col';
    th.textContent=index<3?label:'Q'+(index-2);
    if(index>=3){th.title=label;th.setAttribute('aria-label','Question '+(index-2)+': '+label);}
    header.append(th);
  }
  const body=table.createTBody();
  for(const student of data.students){
    const row=body.insertRow();
    for(const value of [student.number,student.name,student.submitted?t('Submitted'):data.phase==='ended'?t('No submission'):t('Draft')])row.insertCell().textContent=value;
    for(const answer of student.answers){
      const cell=row.insertCell();cell.className='answer-'+answer.status;
      const state=answer.status==='correct'?'Correct':answer.status==='incorrect'?'Incorrect':'Unanswered';
      cell.textContent=(answer.status==='correct'?'✓ ':answer.status==='incorrect'?'✗ ':'')+(answer.letter||answer.answer||'—');
      cell.title=state+' · '+answer.question+' · Answer: '+(answer.answer||'Unanswered');
      cell.setAttribute('aria-label',cell.title);
    }
  }
  root.replaceChildren();
  if(data.students.length)root.append(table);else root.textContent=t('No students joined.');
}
async function refreshAnswerGrid(){
  if(!detailsVisible())return;
  const id=historySession.id,version=resultViewVersion;
  if(detailsRequest?.version===version)return;
  const request={version};detailsRequest=request;
  try{
    const data=await api('/sessions/'+encodeURIComponent(id)+'/details?live=1');
    if(version!==resultViewVersion||!detailsVisible())return;
    detailsPhase=data.phase;
    const snapshot=JSON.stringify(data);
    if(snapshot!==detailsSnapshot){detailsSnapshot=snapshot;renderAnswerGrid(data);}
  } catch(error){
    if(version===resultViewVersion&&detailsVisible())$('result-detail-rows').textContent=error.message;
    if(version===resultViewVersion)detailsSnapshot='';
  } finally {if(detailsRequest===request)detailsRequest=null;}
}
$('result-details-tab').onclick=action(async()=>{
  if(!historySession)return;
  $('result-details').hidden=false;$('result-students').hidden=true;
  $('result-summary-tab').setAttribute('aria-pressed','false');$('result-details-tab').setAttribute('aria-pressed','true');
  detailsSnapshot='';detailsPhase=null;
  $('result-detail-rows').textContent=t('Loading detailed results…');
  await refreshAnswerGrid();
});
setInterval(()=>{if(detailsPhase!=='ended')void refreshAnswerGrid();},2000);
$('result-detail-export').onclick=action(()=>download(historySession,true));
$('result-export').onclick=action(()=>download(historySession)); $('results-refresh').onclick=action(refresh);
socket.on('connect',()=> { if (account) { if($('notice').textContent.startsWith('Live connection lost'))notice(''); watch().catch(e=>notice(e.message)); } });
socket.on('disconnect',()=> { if (account) notice('Live connection lost. Sessions remain saved; reconnecting…'); });
socket.on('professor:update',view=> { const listed=sessionList.find(s=>s.id===view.id);if(view.phase==='ended'||(listed&&(listed.title!==view.title||listed.phase!==view.phase)))refresh().catch(e=>notice(e.message));if (current?.id === view.id) { current={...current,...view}; renderDashboard(); } if (historySession?.id===view.id) { historySession={...historySession,...view}; renderResults(); } });
socket.on('auth:expired',()=> { notice('Please sign in again to reconnect the private dashboard.'); });
let workspaceSignIn;
function signedIn() {
  if(!workspaceSignIn)workspaceSignIn=loadSignedInWorkspace().finally(()=>{workspaceSignIn=null;});
  return workspaceSignIn;
}
async function loadSignedInWorkspace() {
  let generation=accountGeneration;
  try {
    const verified=await api('/me');
    if(account && account.id!==verified.id) clearPrivateWorkspace();
    generation=accountGeneration;account=verified;
    if(recoveringPassword)return;
    settings.setAccount(verified);$('account-name').textContent=account.email;$('login').hidden=true;$('workspace').hidden=false;$('signout').hidden=false;
    socket.connect();
    try {
      const onboarding=await api('/onboarding','POST',{language:window.examioLanguage.current});
      await refresh(); await watch();
      if(generation===accountGeneration)tour.offer(onboarding);
    } catch(e) { if(generation===accountGeneration)notice(e.message); }
  }catch(e){if(generation!==accountGeneration)return;settings.reset();account=null;$('login').hidden=false;$('workspace').hidden=true;$('signout').hidden=true;$('auth-message').textContent=e.message;}
}
async function initAuth() {
  const config=await (await fetch('/api/config')).json();
  if (!config.supabaseUrl || !config.supabaseKey) { $('auth-message').textContent='Professor sign-in needs Development authentication configuration. See V2_SETUP.md.'; $('login').querySelectorAll('input,button').forEach(el=>el.disabled=true); return; }
  aiConfigured=Boolean(config.aiConfigured);if(Number.isSafeInteger(config.uploadMaxBytes)&&config.uploadMaxBytes>0)uploadMaxBytes=config.uploadMaxBytes;
  auth=window.createOnScreenAuth(config.supabaseUrl, config.supabaseKey, {auth:{flowType:'pkce',detectSessionInUrl:true}});
  auth.auth.onAuthStateChange((event) => {
    if (event==='PASSWORD_RECOVERY') { recoveringPassword=true; $('login').hidden=false; $('workspace').hidden=true; $('login-form').hidden=true; $('google').hidden=true; $('new-password-form').hidden=false; }
    if (event==='SIGNED_IN' && !account) setTimeout(()=>{if(!account)void signedIn();},0);
    if (event==='TOKEN_REFRESHED') setTimeout(()=>{if(account)watch().catch(e=>notice(e.message));},0);
    if (event==='SIGNED_OUT') { clearPrivateWorkspace(); account=null; $('workspace').hidden=true; $('login').hidden=false; $('signout').hidden=true; }
  });
  $('login-form').onsubmit=async e=> { e.preventDefault(); const {error}=await auth.auth.signInWithPassword({email:$('email').value,password:$('password').value}); $('auth-message').textContent=error?.t(message || ''); };
  $('signup').onclick=async()=> { const {error}=await auth.auth.signUp({email:$('email').value,password:$('password').value,options:{emailRedirectTo:location.origin+'/professor.html'}}); $('auth-message').textContent=error?.message || t('Check your email to confirm your account, then sign in.'); };
  $('google').onclick=async()=> { const {error}=await auth.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/professor.html'}}); if(error) $('auth-message').textContent=error.message; };
  $('signout').onclick=async()=> { await auth.auth.signOut(); };
  $('reset-password').onclick=async()=> { const {error}=await auth.auth.resetPasswordForEmail($('email').value,{redirectTo:location.origin+'/professor.html'}); $('auth-message').textContent=error?.message || t('Check your email for a password reset link.'); };
  $('new-password-form').onsubmit=async e=> { e.preventDefault(); const {error}=await auth.auth.updateUser({password:$('new-password').value}); $('auth-message').textContent=error?.message || t('Password updated.'); if(!error) { recoveringPassword=false; $('new-password-form').hidden=true; $('login-form').hidden=false; $('google').hidden=false; await signedIn(); } };
  if ((await auth.auth.getSession()).data.session) await signedIn();
}
initAuth().catch(e=>$('auth-message').textContent=e.message);

function renderFolderOptions(selected=$('tb-folder').value) {
 for(const id of ['tb-folder','new-folder-choice']){const value=id==='tb-folder'?selected:$(id).value;$(id).replaceChildren(...[{id:'',name:t('Uncategorized Test')},...folders].map(f=>{const o=document.createElement('option');o.value=f.id;o.textContent=f.name;return o;}));$(id).value=value;}
}
function folderActions(folder) {
  const actions=document.createElement('span');actions.className='folder-inline-actions';
  actions.append(button(t('Rename'),()=>openEntry({title:t('Rename folder'),value:folder.name,max:80},async name=>{await api('/folders/'+folder.id,'PATCH',{name});await refresh();})),button(t('Delete folder'),async()=>{
    if(!confirm('Delete “'+folder.name+'”? Its tests will move to Uncategorized Test.'))return;
    await api('/folders/'+folder.id,'DELETE');await refresh();
  },'danger'));
  actions.onclick=event=>event.preventDefault();
  return actions;
}
let launchTest=null;
function openLaunch(test){$('launch-language').value=window.examioLanguage.current;launchTest=test;$('launch-test-title').textContent=test.title;$('launch-duration').value='0';$('launch-show-scores').checked=true;$('launch-shuffle').checked=false;$('launch-corrections').checked=false;$('launch-error').textContent='';$('launch-dialog').showModal();}
$('launch-cancel').onclick=()=> $('launch-dialog').close();
$('launch-form').onsubmit=async e=>{e.preventDefault();$('launch-confirm').disabled=true;try{await launchSession({testId:launchTest.id,language:$('launch-language').value,durationMinutes:Number($('launch-duration').value),showScores:$('launch-show-scores').checked,shuffleAnswers:$('launch-shuffle').checked,showCorrections:$('launch-corrections').checked});$('launch-dialog').close();}catch(e){$('launch-error').textContent=e.message;}finally{$('launch-confirm').disabled=false;}};
$('extend-time').onclick=action(async()=>{const updated=await api('/sessions/'+current.id+'/extend','POST',{});updateSession(updated);notice('Added 1 minute (60 seconds). New end time: '+new Date(updated.deadlineAt).toLocaleTimeString());});
let entryAction=null;
function closeEntry(){entryAction=null;if($('entry-dialog').open)$('entry-dialog').close();}
function openEntry({title,label='Name',value='',max=120,help='',save='Save'},fn){
 $('entry-title').textContent=t(title);$('entry-label').firstChild.textContent=t(label);$('entry-value').value=value;$('entry-value').maxLength=max;$('entry-help').textContent=t(help);$('entry-error').textContent='';$('entry-save').textContent=t(save);$('entry-save').disabled=false;$('entry-cancel').disabled=false;entryAction=fn;$('entry-dialog').showModal();$('entry-value').focus();
}
$('entry-cancel').onclick=closeEntry;$('entry-dialog').addEventListener('cancel',()=>{entryAction=null;});
$('entry-form').onsubmit=async e=>{e.preventDefault();const value=$('entry-value').value.trim();if(!value)return;const fn=entryAction,generation=accountGeneration;if(!fn)return;$('entry-save').disabled=true;$('entry-cancel').disabled=true;
 try{await fn(value);if(generation===accountGeneration)closeEntry();}catch(e){if(generation===accountGeneration)$('entry-error').textContent=e.message;}finally{if(generation===accountGeneration){$('entry-save').disabled=false;$('entry-cancel').disabled=false;}}
};
$('new-folder').onclick=()=>openEntry({title:'New class folder',max:80},async name=>{await api('/folders','POST',{name});await refresh();});
function updateSession(updated){if(current?.id===updated.id){current=updated;renderDashboard();}if(historySession?.id===updated.id){historySession=updated;renderResults();}}
function unlockStudent(session,student){openEntry({title:student.result?t('Override FAIL'):t('Unlock & continue'),label:'Reason',max:500,help:'Review '+student.name+'’s incident, then record why you are allowing continuation.',save:student.result?t('Override FAIL'):t('Unlock & continue')},async reason=>updateSession(await api('/sessions/'+session.id+'/override','POST',{studentId:student.id,reason})));}
function submitFail(session,student){openEntry({title:t('Submit Fail score'),label:'Reason',value:'Confirmed by professor',max:500,help:'Finalize '+student.name+' at 0%. This closes their attempt and stops their connection. Their saved answers and original score remain in the private record.',save:t('Submit Fail score')},async reason=>updateSession(await api('/sessions/'+session.id+'/finalize-fail','POST',{studentId:student.id,reason})));}
function renameResults(session){openEntry({title:session.phase==='ended'?'Rename results':'Rename session',value:session.title,help:'This name will be used for this session, its results and Excel filename. The Library test stays unchanged.'},async title=>{updateSession(await api('/sessions/'+session.id,'PATCH',{title}));await refresh();});}
$('result-rename').onclick=()=>renameResults(historySession);$('session-rename').onclick=()=>renameResults(current);
function openImport(mode){
 creationVersion++;importMode=mode;$('import-panel').hidden=false;$('ai-options').hidden=false;$('generation-settings').hidden=mode!=='generate';$('import-local').hidden=mode!=='import';$('import-heading').textContent=mode==='generate'?'Create with AI':t('Upload a test · AI assisted');
 $('import-help').textContent=mode==='generate'?t('Create new questions from source material. AI proposes answer keys for your review.'):t('Upload or paste an existing test. AI organizes the questions and determines missing correct answers, preserving recognized wording, choices, points and supplied keys. Only uncertain answers need extra attention.');
 $('ai-consent-text').textContent=mode==='generate'?'Send this source to OpenAI to generate questions and answers. API usage charges apply.':'Send this test material to OpenAI to organize questions and determine answers. API usage charges apply.';
 $('ai-config-note').textContent=aiConfigured?'':t('AI setup is required in Development. You can still import an existing test without AI.');$('import-status').textContent='';$('import-submit').textContent=mode==='import'?t('Prepare with AI'):'Prepare draft';$('import-submit').disabled=!aiConfigured;$('import-panel').scrollIntoView({behavior:'smooth'});
}
$('import-source').oninput=()=>{if($('import-source').value.trim())$('import-file').value='';};$('import-file').onchange=()=>{if($('import-file').files.length)$('import-source').value='';};
$('upload-test').onclick=()=>openImport('import');$('create-ai').onclick=()=>openImport('generate');$('import-cancel').onclick=()=>{creationVersion++;$('import-panel').hidden=true;};
async function prepareImport(useAI){
 const mode=importMode,version=creationVersion,generation=accountGeneration;
 if(useAI&&!$('ai-consent').checked){$('import-status').textContent=t('Confirm that this material may be sent to OpenAI.');return;}
 const data=new FormData(),file=$('import-file').files[0],source=$('import-source').value;
 if(file&&file.size>uploadMaxBytes){const mb=Math.ceil(file.size/1024/1024*100)/100;$('import-status').textContent='File “'+file.name+'” is too large for the '+(uploadMaxBytes/1024/1024)+' MB limit ('+mb+' MB). Choose a smaller file or paste its text.';return;}
 if(!file&&!source.trim()){$('import-status').textContent=t('Choose a PDF or DOCX file, or paste source text.');return;}
 if(file)data.append('file',file);else data.append('source',source);
 if(mode==='generate')for(const key of ['count','types','difficulty'])data.append(key,$('ai-'+key).value);
 const route=mode==='generate'?'generate':useAI?'import-ai':'import';$('import-submit').disabled=true;$('import-local').disabled=true;$('import-status').textContent=mode==='generate'?t('AI is preparing questions and answers from your material…'):useAI?t('AI is organizing questions and determining answers…'):t('Reading your test…');
 try{const response=await fetch('/api/'+route,{method:'POST',headers:{Authorization:'Bearer '+await token()},body:data});const result=await response.json();if(generation!==accountGeneration||version!==creationVersion)return;if(!response.ok)throw new Error(result.error||'Could not prepare draft.');if(!result.test?.questions?.length)throw new Error('No questions were recognized. Check the format and try again.');
  const title=$('new-title').value.trim(),folderId=$('new-folder-choice').value;openBuilder({...result.test,title:title||result.test.title,folderId});editingId=null;$('draft-review').textContent=[result.test.questions.length+' questions prepared. Review the proposed answers before saving.',...(result.warnings||[])].join(' ');$('import-panel').hidden=true;$('import-source').value='';$('import-file').value='';
 }catch(e){if(generation===accountGeneration&&version===creationVersion)$('import-status').textContent=e.message;}
 finally{if(generation===accountGeneration){$('import-local').disabled=false;if(version===creationVersion)$('import-submit').disabled=!aiConfigured;}}
}
$('import-form').onsubmit=action(async e=>{e.preventDefault();await prepareImport(true);});$('import-local').onclick=action(()=>prepareImport(false));
$('tb-answer-ai').onclick=()=>{if(aiConfigured)$('answer-ai-dialog').showModal();else $('answer-ai-status').textContent=t('AI setup is required in Development.');};$('answer-ai-cancel').onclick=()=> $('answer-ai-dialog').close();
$('answer-ai-confirm').onclick=async()=>{
 $('answer-ai-dialog').close();const version=creationVersion,generation=accountGeneration;$('answer-ai-status').textContent=t('AI is determining missing answers…');els.tbQuestions.inert=true;for(const id of ['tb-start-btn','tb-add-q-btn','tb-answer-ai'])$(id).disabled=true;
 try{const result=await api('/answer-key','POST',{test:{title:els.tbTitle.value.trim(),questions:tbQuestions}});if(version!==creationVersion||generation!==accountGeneration||$('test-builder').hidden)return;tbQuestions=result.test.questions;renderTestBuilder();$('draft-review').textContent=(result.warnings||[]).join(' ');$('answer-ai-status').textContent=t('Proposed answer keys are ready. Review, then save.');}
 catch(e){if(version===creationVersion&&generation===accountGeneration)$('answer-ai-status').textContent=e.message;}
 finally{if(version===creationVersion&&generation===accountGeneration){els.tbQuestions.inert=false;for(const id of ['tb-start-btn','tb-add-q-btn'])$(id).disabled=false;$('tb-answer-ai').disabled=!aiConfigured;}}
};
function addQuestion() {
 const id='q_'+crypto.randomUUID();tbQuestions.push({id,type:'mc',text:'',options:[{id:id+'_a',text:''},{id:id+'_b',text:''}],correctOptionId:'',points:1});renderTestBuilder();els.tbQuestions.lastElementChild?.querySelector('.tb-q-text').focus();
}
function moveQuestion(from,to) {if(to<0||to>=tbQuestions.length||from===to)return;tbQuestions.splice(to,0,tbQuestions.splice(from,1)[0]);renderTestBuilder();}
let draggingQuestion=null;
let pendingImages=0;
function imageControl(target,labelText) {
  const panel=document.createElement('div');
  const label=document.createElement('label');label.textContent=labelText;
  const picker=document.createElement('input');picker.type='file';picker.accept='image/png,image/jpeg,image/webp';
  label.append(picker);panel.append(label);
  const status=document.createElement('p');status.setAttribute('role','status');panel.append(status);
  if(target.image){
    const preview=document.createElement('img');preview.className='tb-image';preview.alt=labelText;preview.src=target.image;
    panel.append(preview,button(t('Remove image'),()=>{delete target.image;renderTestBuilder();}));
  }
  picker.onchange=async()=>{
    const file=picker.files[0];
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){
      status.textContent='Choose a PNG, JPEG, or WebP image up to 5 MB.';return;
    }
    const version=creationVersion;
    picker.disabled=true;pendingImages++;
    let bitmap;
    try {
      bitmap=await createImageBitmap(file);
      const scale=Math.min(1,960/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const context=canvas.getContext('2d');
      context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const encoded=canvas.toDataURL('image/jpeg',0.75);
      if(encoded.length>180000)throw Error('This image is too detailed. Choose a smaller image.');
      if(version===creationVersion&&panel.isConnected){target.image=encoded;renderTestBuilder();}
    } catch(error) {status.textContent=error.message||'Could not read this image.';}
    finally {bitmap?.close();pendingImages--;picker.disabled=false;}
  };
  return panel;
}
function renderTestBuilder() {
 els.tbQuestions.replaceChildren();
 tbQuestions.forEach((q,i)=> {
  const card=document.createElement('div');card.className='tb-q-card';card.dataset.index=i;
  const header=document.createElement('div');header.className='tb-q-header';const handle=document.createElement('span');handle.textContent='⠿ Q'+(i+1);handle.draggable=true;handle.className='drag-handle';handle.title='Drag to reorder';handle.ondragstart=e=>{draggingQuestion=i;e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move';};handle.ondragend=()=>draggingQuestion=null;
  card.ondragover=e=> {if(draggingQuestion!==null)e.preventDefault();};card.ondrop=e=> {e.preventDefault();if(draggingQuestion!==null)moveQuestion(draggingQuestion,i);draggingQuestion=null;};header.append(handle);
  const up=button('↑',()=>moveQuestion(i,i-1));up.disabled=i===0;up.setAttribute('aria-label','Move question '+(i+1)+' up');const down=button('↓',()=>moveQuestion(i,i+1));down.disabled=i===tbQuestions.length-1;down.setAttribute('aria-label','Move question '+(i+1)+' down');header.append(up,down);
  const pointsLabel=document.createElement('label');pointsLabel.textContent=t('Points');const points=document.createElement('input');points.type='number';points.className='tb-points';points.min='0.01';points.max='1000';points.step='0.01';points.value=q.points??1;points.setAttribute('aria-label','Question '+(i+1)+' points');points.oninput=()=>q.points=Number(points.value);pointsLabel.append(points);header.append(pointsLabel);
  if(tbQuestions.length>1)header.append(button(t('Remove question'),()=>{tbQuestions.splice(i,1);renderTestBuilder();}));card.append(header);
  const type=document.createElement('select');type.className='tb-q-type';type.setAttribute('aria-label','Question '+(i+1)+' type');for(const [value,label] of [['mc','Multiple choice'],['blank','Fill in the blank']]){const o=document.createElement('option');o.value=value;o.textContent=label;type.append(o);}type.value=q.type||'mc';type.onchange=()=>{q.type=type.value;if(q.type==='blank'){q.acceptedAnswers=q.acceptedAnswers||[];q.caseSensitive=q.caseSensitive||false;}else if(!q.options){q.options=[{id:q.id+'_a',text:''},{id:q.id+'_b',text:''}];q.correctOptionId='';}renderTestBuilder();};card.append(type);
  const text=document.createElement('input');text.className='tb-q-text';text.placeholder='Question text…';text.setAttribute('aria-label','Question '+(i+1)+' text');text.maxLength=1000;text.value=q.text;text.oninput=()=>q.text=text.value;card.append(text,imageControl(q,'Question image (optional)'));
  if(q.type==='blank') {
   const label=document.createElement('label');label.textContent=t('Accepted answers (one per line)');const answers=document.createElement('textarea');answers.className='tb-accepted';answers.rows=3;answers.value=(q.acceptedAnswers||[]).join('\n');answers.oninput=()=>q.acceptedAnswers=answers.value.split('\n').map(s=>s.trim()).filter(Boolean);label.append(answers);card.append(label);
   const sensitive=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.checked=q.caseSensitive;check.onchange=()=>q.caseSensitive=check.checked;sensitive.append(check,' Case sensitive');card.append(sensitive);
  } else {
   (q.options||[]).forEach((o,j)=>{const row=document.createElement('div');row.className='tb-option-row';const radio=document.createElement('input');radio.type='radio';radio.name=q.id;radio.checked=q.correctOptionId===o.id;radio.setAttribute('aria-label','Correct answer '+String.fromCharCode(65+j));radio.onchange=()=>q.correctOptionId=o.id;const input=document.createElement('input');input.className='tb-opt-text';input.maxLength=500;input.placeholder='Option '+String.fromCharCode(65+j);input.value=o.text;input.oninput=()=>o.text=input.value;row.append(radio,input);if(q.options.length>2)row.append(button(t('Remove option'),()=>{q.options.splice(j,1);if(q.correctOptionId===o.id)q.correctOptionId='';renderTestBuilder();}));card.append(row,imageControl(o,'Image for option '+String.fromCharCode(65+j)+' (optional)'));});
   if(q.options.length<5)card.append(button(t('+ Add Option'),()=>{q.options.push({id:q.id+'_'+crypto.randomUUID(),text:''});renderTestBuilder();}));
  }
  if(q.answerExplanation){const reason=document.createElement('p');reason.className='answer-rationale';reason.textContent='AI answer rationale: '+q.answerExplanation;card.append(reason);}
  if(q.evidence){const evidence=document.createElement('p');evidence.className='source-evidence';evidence.textContent='Source excerpt: '+q.evidence;card.append(evidence);}els.tbQuestions.append(card);
 });
}
function collectTest() {
 if(pendingImages)return {error:'Wait for images to finish loading.'};
 const imageSize=tbQuestions.reduce((sum,q)=>sum+(q.image?.length||0)+(q.type==='blank'?0:(q.options||[]).reduce((total,o)=>total+(o.image?.length||0),0)),0);
 if(imageSize>600000)return {error:'These images are too large together. Remove or resize some images before saving.'};
 const title=els.tbTitle.value.trim();if(!title)return {error:'Please enter a test title.'};
 for(const [i,q] of tbQuestions.entries()) {
  if(!Number.isFinite(q.points??1)||(q.points??1)<=0||(q.points??1)>1000||Math.abs((q.points??1)*100-Math.round((q.points??1)*100))>0.000001)return {error:'Q'+(i+1)+': Enter positive points, up to1000, with at most2 decimals.'};
  if(!q.text.trim())return {error:'Q'+(i+1)+': Question text is required.'};
  if(q.type==='blank'){if(!q.acceptedAnswers?.length||q.acceptedAnswers.length>20||q.acceptedAnswers.some(a=>a.length>300))return {error:'Q'+(i+1)+': Enter 1–20 accepted answers, each up to 300 characters.'};}
  else {if(q.options.some(o=>!o.text.trim()))return {error:'Q'+(i+1)+': Each option needs text.'};if(!q.correctOptionId)return {error:'Q'+(i+1)+': Please mark the correct answer.'};}
 }
 const questions=tbQuestions.map(q=>q.type==='blank'?{id:q.id,type:'blank',points:q.points??1,text:q.text,...(q.image?{image:q.image}:{}),acceptedAnswers:q.acceptedAnswers,caseSensitive:q.caseSensitive,...(q.evidence?{evidence:q.evidence}:{}),...(q.answerExplanation?{answerExplanation:q.answerExplanation}:{})}:{id:q.id,type:'mc',points:q.points??1,text:q.text,...(q.image?{image:q.image}:{}),options:q.options,correctOptionId:q.correctOptionId,...(q.evidence?{evidence:q.evidence}:{}),...(q.answerExplanation?{answerExplanation:q.answerExplanation}:{})});
 return {test:{title,folderId:$('tb-folder').value||null,questions}};
}
function showTbError(msg){els.tbError.textContent=msg;els.tbError.hidden=false;}
function hideTbError(){els.tbError.hidden=true;}
