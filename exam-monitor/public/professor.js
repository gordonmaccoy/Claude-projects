function applyProfessorTheme(value){const theme=value==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('exam-monitor-theme',theme);}catch{}document.getElementById('professor-theme-toggle').setAttribute('aria-pressed',String(theme==='dark'));}
try{applyProfessorTheme(localStorage.getItem('exam-monitor-theme'));}catch{applyProfessorTheme('light');}
document.getElementById('professor-theme-toggle').onclick=()=>applyProfessorTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
const {t}=window.examioLanguage;
const $ = id => document.getElementById(id);
const gameWorkspace=window.ExamioGameWorkspace.create($('game-workspace-frame'));
const openGameTab=new URLSearchParams(location.search).get('tab')==='games';
let openBetaFeedback=new URLSearchParams(location.search).get('feedback')==='beta';
try{if(openBetaFeedback)sessionStorage.setItem('examio-beta-feedback','1');else openBetaFeedback=sessionStorage.getItem('examio-beta-feedback')==='1';}catch{}
const els = { tbTitle: $('tb-title'), tbQuestions: $('tb-questions'), tbError: $('tb-error') };
const socket = io();
let resultViewVersion=0;
let trashVersion=0, pendingTrashDelete=null;
let sessionPreferences=null;let resultSort='newest';
let auth, account, current, historySession, library = [], folders = [], aiConfigured=false, exportEmailConfigured=false, uploadMaxBytes=5*1024*1024, importMode="import", sessionList = [], editingId = null, tbQuestions = [], popup, recoveringPassword = false;
let accountGeneration = 0,creationVersion=0,professorTimerSnapshot=null;

let lastWorkspaceTab = 'launch';
let popupSessionId = null, openingDisplay = false, launching = false;
function clearPrivateWorkspace() {
  gameWorkspace.reset();$('admin-link').hidden=true;if(shortGradeDialog.open)shortGradeDialog.close();shortGradeDialog.querySelector('form').reset();for(const el of shortGradeDialog.querySelectorAll('p'))el.textContent='';
  tab('launch');
  quizSharing.reset();
  closeCreation();exportsController.close();
  $('workspace-tabs').hidden=true;finishFolderDrag();if($('question-detail-dialog').open)$('question-detail-dialog').close();questionData=null;
  settings.reset();tour.reset();$('launch-show-names').checked=false;$('launch-show-scores-live').checked=false;$('result-detail-rows').replaceChildren();$('result-settings-content').replaceChildren();delete $('result-settings-content').dataset.signature;delete $('result-settings-content').dataset.sessionId;$('result-settings').open=false;lastWorkspaceTab='launch';accountGeneration++;creationVersion++;professorTimerSnapshot=null;if($('answer-ai-dialog').open)$('answer-ai-dialog').close();$('answer-ai-status').textContent='';closeEntry();launchTest=null;$('new-title').value='';for(const id of ['tb-folder','new-folder-choice'])$(id).replaceChildren();$('launch-test-title').textContent='';if($('launch-dialog').open)$('launch-dialog').close();$('creation-choice').hidden=true;
  trashVersion++;pendingTrashDelete=null;if($('trash-confirm').open)$('trash-confirm').close();$('trash-confirm-message').textContent='';$('trash-items').replaceChildren();
  resultSort='newest';current=null; historySession=null; library=[]; folders=[]; sessionList=[]; $('import-source').value='';$('import-file').value='';$('import-panel').hidden=true;$('draft-review').textContent=''; editingId=null; tbQuestions=[];
  detachResultsPanel();$('in-session-section').append($('dashboard'));document.querySelectorAll('.session-group').forEach(el=>el.remove());sessionGroupSelection.clear();
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
async function token() { if(sessionPreferences?.blocked)return '';const session=(await auth.auth.getSession()).data.session;return sessionPreferences?.blocked?'':session?.access_token||''; }
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
  gameWorkspace.setActive(name==='games');
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
let draggedFolder=null;
function finishFolderDrag(){if(!draggedFolder)return;draggedFolder.placeholder.remove();draggedFolder.row.classList.remove('folder-dragging');draggedFolder=null;}
function folderHandle(folder,row){
 const handle=document.createElement('button');handle.type='button';handle.className='drag-handle folder-drag-handle';handle.textContent='↕';handle.draggable=true;handle.title=t('Drag to reorder folders');handle.setAttribute('aria-label',t('Move folder')+' '+folder.name);handle.onclick=e=>e.preventDefault();
 handle.ondragstart=event=>{event.stopPropagation();const placeholder=document.createElement('div');placeholder.className='folder-drop-preview';placeholder.textContent=folder.name;placeholder.style.height=row.getBoundingClientRect().height+'px';placeholder.dataset.folderId=folder.id;draggedFolder={row,placeholder,id:folder.id};event.dataTransfer.setData('text/plain','folder:'+folder.id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setDragImage(row,30,20);requestAnimationFrame(()=>{if(draggedFolder?.row===row){row.after(placeholder);row.classList.add('folder-dragging');}});};
 handle.ondragend=finishFolderDrag;
 handle.onkeydown=action(async event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const ids=folders.map(f=>f.id),index=ids.indexOf(folder.id),next=index+(event.key==='ArrowUp'?-1:1);if(next<0||next>=ids.length)return;[ids[index],ids[next]]=[ids[next],ids[index]];await api('/folder-order','PUT',{ids});await refresh();});
 return handle;
}
function setupFolderDrop(){const root=$('library-tests');root.addEventListener('dragover',event=>{
 if(!draggedFolder?.placeholder.parentElement)return;event.preventDefault();const {row,placeholder}=draggedFolder;const rows=[...root.children].filter(el=>el!==row&&el!==placeholder&&el.dataset.folderId!==undefined&&el.dataset.folderId!=='');const before=rows.find(el=>{const rect=el.getBoundingClientRect();return event.clientY<rect.top+rect.height/2;})||[...root.children].find(el=>el.dataset.folderId==='')||null;if(before===placeholder||placeholder.nextElementSibling===before)return;const positions=rows.map(el=>el.getBoundingClientRect().top);root.insertBefore(placeholder,before);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)rows.forEach((el,i)=>{const delta=positions[i]-el.getBoundingClientRect().top;if(delta)el.animate([{transform:'translateY('+delta+'px)'},{transform:'translateY(0)'}],{duration:150});});
 });root.addEventListener('drop',action(async event=>{if(!draggedFolder)return;event.preventDefault();const {row}=draggedFolder;const ids=[...root.children].filter(el=>el!==row&&el.dataset.folderId).map(el=>el.dataset.folderId);finishFolderDrag();try{await api('/folder-order','PUT',{ids});}finally{await refresh();}}));}
setupFolderDrop();
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
function createQuizSharingUI({api,getFolders,isSignedIn,notify,onImported,contacts=null}) {
  const el=id=>document.getElementById(id);
  let generation=0,requestVersion=0,loading=false,timer=null,share=null,busy=false;
  const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  const status=message=>{el('shares-status').textContent=message;};
  function setBusy(value){busy=value;contacts?.setBusy(value);for(const id of ['share-submit','share-email','share-cancel'])el(id).disabled=value;}
  function reset(){contacts?.reset();generation++;requestVersion++;loading=false;share=null;setBusy(false);clearInterval(timer);timer=null;for(const id of ['share-dialog','shares-dialog'])if(el(id).open)el(id).close();for(const id of ['shares-incoming','shares-outgoing'])el(id).replaceChildren();el('shares-open').hidden=true;el('shares-open').textContent='Shared with me';el('share-email').value='';el('share-quiz-title').textContent='';el('share-error').textContent='';if(el('shares-dialog').dataset)delete el('shares-dialog').dataset.signature;status('');}
  function openShare(test){if(busy)return;share={id:test.id,requestId:crypto.randomUUID(),email:null};el('share-quiz-title').textContent=test.title;el('share-email').value='';el('share-error').textContent='';setBusy(false);el('share-dialog').showModal();contacts?.open();el('share-email').focus();}
  el('share-dialog').oncancel=event=>{if(busy)event.preventDefault();};
  el('share-dialog').onclose=()=>{share=null;contacts?.reset();};
  el('share-cancel').onclick=()=>{if(!busy)el('share-dialog').close();};
  el('share-form').onsubmit=async event=>{
    event.preventDefault();if(busy||!share||!el('share-email').reportValidity())return;
    const email=el('share-email').value.trim();
    if(share.email!==null&&share.email!==email)share.requestId=crypto.randomUUID();
    share.email=email;const attempt={...share},version=generation;
    setBusy(true);el('share-error').textContent='';
    try{const result=await api('/tests/'+encodeURIComponent(attempt.id)+'/share','POST',{email,requestId:attempt.requestId});if(version!==generation)return;el('share-dialog').close();notify(result.message||'If this account can receive quizzes, a request has been sent.');await refresh();}
    catch(error){if(version===generation)el('share-error').textContent=error.message;}
    finally{if(version===generation)setBusy(false);}
  };
  function requestCard(item,incoming){
    const entry=make('article',undefined,'share-request');entry.append(make('h3',item.title));
    entry.append(make('p',incoming?'From '+item.senderEmail+' · '+item.questionCount+' questions':'To '+item.recipientEmail+' · '+item.status));
    let select;
    if(incoming){const label=make('label','Import into class folder');select=make('select');const options=[{id:'',name:'Uncategorized Test'},...getFolders()];for(const folder of options){const option=make('option',folder.name);option.value=folder.id;select.append(option);}label.append(select);entry.append(label);}
    const actions=make('div',undefined,'actions'),error=make('p','', 'error');error.setAttribute('role','alert');
    const perform=async(method)=>{const version=generation;const controls=[...actions.children,...(select?[select]:[])];if(controls.some(control=>control.disabled))return;controls.forEach(control=>control.disabled=true);error.textContent='';
      try{await api('/shares/'+encodeURIComponent(item.id)+'/'+method,'POST',method==='accept'?{folderId:select.value||null}:undefined);if(version!==generation)return;entry.remove?.();if(method==='accept'){await onImported();if(version!==generation)return;notify('Quiz imported into your library.');}await refresh();}
      catch(e){if(version===generation)error.textContent=e.message;}finally{if(version===generation)controls.forEach(control=>control.disabled=false);}
    };
    if(incoming){const accept=make('button','Accept & Import','primary');accept.type='button';accept.onclick=()=>perform('accept');const decline=make('button','Decline');decline.type='button';decline.onclick=()=>perform('decline');actions.append(accept,decline);}
    else if(item.status==='pending'){const cancel=make('button','Cancel request');cancel.type='button';cancel.onclick=()=>perform('cancel');actions.append(cancel);}
    entry.append(actions,error);return entry;
  }
  async function refresh(){
    if(!isSignedIn()||document.hidden||loading)return;loading=true;const version=generation,request=++requestVersion;
    try{const data=await api('/shares');if(version!==generation||request!==requestVersion)return;const incoming=Array.isArray(data.incoming)?data.incoming:[],outgoing=Array.isArray(data.outgoing)?data.outgoing:[];
      el('shares-open').hidden=false;el('shares-open').textContent='Shared with me'+(incoming.length?' ('+incoming.length+')':'');
      // Leave choices/focus intact during periodic checks while the inbox is open.
      const signature=JSON.stringify(data);if(el('shares-dialog').open&&el('shares-dialog').dataset?.signature===signature)return;
      if(el('shares-dialog').dataset)el('shares-dialog').dataset.signature=signature;
      el('shares-incoming').replaceChildren(...incoming.map(item=>requestCard(item,true)));el('shares-outgoing').replaceChildren(...outgoing.map(item=>requestCard(item,false)));
      if(!incoming.length)el('shares-incoming').append(make('p','No pending quizzes.'));if(!outgoing.length)el('shares-outgoing').append(make('p','No sent requests.'));status('');
    }catch(error){if(version===generation&&el('shares-dialog').open)status(error.message);}
    finally{if(version===generation&&request===requestVersion)loading=false;}
  }
  el('shares-open').onclick=()=>{el('shares-dialog').showModal();refresh();};
  el('shares-close').onclick=()=>el('shares-dialog').close();
  el('shares-refresh').onclick=()=>refresh();
  function start(){el('shares-open').hidden=false;if(!timer)timer=setInterval(()=>{if(isSignedIn()&&!document.hidden)refresh();},30000);refresh();}
  return {openShare,refresh,start,reset};
}
// End quiz sharing controller

const sharingContacts=window.createSharingContacts({api,t});
const quizSharing=createQuizSharingUI({api,contacts:sharingContacts,getFolders:()=>folders,isSignedIn:()=>!!account,notify:notice,onImported:async()=>{await refresh();}});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&account)quizSharing.refresh();});
async function refresh() {
  [library, sessionList, folders,quickLaunchPreferences] = await Promise.all([api('/tests'), api('/sessions'),api('/folders'),api('/launch-preferences')]);applyQuizLayout();
  const expandedPreviews=new Set([...document.querySelectorAll('.quiz-preview-toggle[aria-expanded=true]')].map(el=>el.dataset.testId));
  const expanded=new Set([...document.querySelectorAll('#launch-tests details[open],#library-tests details[open]')].map(folder=>folder.dataset.folderKey));
  if(draggedTest||draggedFolder)return;
  renderFolderOptions();
  detachResultsPanel();
  $('in-session-section').append($('dashboard'));
  for (const id of ['launch-tests', 'library-tests', 'active-sessions', 'result-sessions']) $(id).replaceChildren();
  if (!library.length) {
    $('launch-tests').append(card(t('A fresh start'), t('Create your first test in Library, or launch the calculator.')));
    $('library-tests').append(card('Your library starts here', 'Save a test and use it again with any class.'));
  }
  const groups={};
  for(const root of ['launch-tests','library-tests']) for(const folder of [...folders,{id:'',name:t('Uncategorized Test')}]) {
    const count=library.filter(t=>(t.folderId||'')===folder.id).length;
    if(!count && !folders.some(f=>f.id===folder.id) && root!=='library-tests')continue;
    const detail=document.createElement('details');detail.className='folder';detail.dataset.folderId=folder.id;detail.dataset.folderKey=root+':'+folder.id;detail.open=expanded.has(detail.dataset.folderKey);
    const summary=document.createElement('summary');summary.textContent=`${folder.name} (${count})`;if(root==='library-tests'&&folder.id)summary.append(folderActions(folder),folderHandle(folder,detail));detail.append(summary);
    const list=document.createElement('div');list.className=root==='library-tests'?'library-rows':'cards';list.dataset.folderId=folder.id;if(root==='library-tests')setupQuizDrop(detail,list);detail.append(list);$(root).append(detail);groups[root+folder.id]=list;
  }
  for (const test of library) {
    const launch = card(test.title, t('{count} questions · Saved test',{count:test.questions.length}));
    const launchActions=document.createElement('div');launchActions.className='actions';launchActions.append(button(t('Launch test ↗'), () => openLaunch(test), 'primary'),button(t('Quick Launch'),action(async()=>{if(!quickLaunchPreferences){openLaunch(test);$('launch-error').textContent=t('Choose your options and save Quick Launch preferences first.');return;}await launchSession({...quickLaunchPreferences,testId:test.id,language:window.examioLanguage.current});})));launch.append(launchActions); (groups['launch-tests'+(test.folderId||'')]||$('launch-tests')).append(launch);
    const saved=document.createElement('article');saved.className='library-test-row';
    const title=document.createElement('button');title.type='button';title.className='quiz-preview-toggle';title.dataset.testId=test.id;title.setAttribute('aria-expanded','false');const arrow=document.createElement('span');arrow.className='quiz-preview-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='▸';const titleText=document.createElement('strong');titleText.textContent=test.title;title.append(arrow,titleText);saved.append(title);let preview;const showPreview=()=>{if(!preview){preview=window.createExamioQuizPreview(test,t);preview.id='quiz-preview-'+test.id;title.setAttribute('aria-controls',preview.id);saved.append(preview);}const open=title.getAttribute('aria-expanded')!=='true';title.setAttribute('aria-expanded',String(open));arrow.textContent=open?'▾':'▸';preview.hidden=!open;};title.onclick=showPreview;
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
    actions.append(button('Share',()=>quizSharing.openShare(test)));
    actions.append(button(t('Download PDF'),()=>downloadFile('/api/tests/'+encodeURIComponent(test.id)+'/pdf',test.title+'.pdf')));const menu=document.createElement('details');menu.className='quiz-actions-menu';const menuToggle=document.createElement('summary');menuToggle.textContent='⋮';menuToggle.setAttribute('aria-label',t('Quiz options for {title}',{title:test.title}));menuToggle.title=t('Quiz options');menu.append(menuToggle,actions);menu.ontoggle=()=>{if(menu.open)for(const other of document.querySelectorAll('.quiz-actions-menu[open]'))if(other!==menu)other.open=false;};actions.addEventListener('click',event=>{if(event.target.closest('button'))menu.open=false;});const tools=document.createElement('div');tools.className='quiz-row-tools';tools.append(menu,handle);saved.append(tools);if(expandedPreviews.has(test.id))showPreview(); (groups['library-tests'+(test.folderId||'')]||$('library-tests')).append(saved);
  }
  for (const s of sessionList) {
    if (s.mode === 'test') {
      const c = card(s.title, `${new Date(window.examioResultOrder.completedAt(s)).toLocaleString()} · ${s.phase} · ${s.students.length} joined`);
      c.classList.add('result-session-card');c.dataset.sessionId=s.id;
      c.append(button(t('View results'), async () => { const version=++resultViewVersion; const session=await api(`/sessions/${s.id}`); if(version!==resultViewVersion)return; historySession=session; showResultSummary();renderResults(); }));
      $('result-sessions').append(c);
    }

  }
  if (!sessionList.some(s => s.mode === 'test')) $('result-sessions').append(card('No test results yet', 'Results from tests will be saved here. Calculator sessions do not create results.'));
  if(current && !sessionList.some(s=>s.id===current.id && s.phase!=='ended')){current=null;renderDashboard();}
  renderSessionGroups();
  applyResultSort();
  if(historySession&&!placeResultsPanel())closeResults();
  quizSharing.start();
}
function openBuilder(test) {
  closeCreation();creationVersion++;els.tbQuestions.inert=false;$('tb-start-btn').disabled=false;$('tb-add-q-btn').disabled=false;$('tb-answer-ai').disabled=!aiConfigured;$('answer-ai-status').textContent='';tab('library');$('creation-choice').hidden=true;$('import-panel').hidden=true; editingId = test?.id || null;
  $('test-builder').hidden = false; $('builder-heading').textContent = test?.id ? t('Edit test') : 'Create a test';
  els.tbTitle.value = test?.title || ''; renderFolderOptions(test?.folderId||''); $('draft-review').textContent=''; tbQuestions = structuredClone(test?.questions || []); hideTbError();
  if (!tbQuestions.length) addQuestion(); else renderTestBuilder();
  $('test-builder').scrollIntoView({ behavior: 'smooth' });
}
$('new-test').onclick = () => {$('creation-back').hidden=true;closeCreation();creationVersion++;tab('library');$('test-builder').hidden=true;$('import-panel').hidden=true;$('creation-choice').hidden=false;$('new-title').value='';$('new-folder-choice').value='';resetImport();document.querySelector('.creation-methods').hidden=false;$('creation-dialog').showModal();};
$('create-manual').onclick=()=>openBuilder({title:$('new-title').value.trim(),folderId:$('new-folder-choice').value});
$('creation-cancel').onclick=closeCreation;$('creation-close').onclick=closeCreation;
$('creation-back').onclick=()=>{creationVersion++;importRequest?.abort();importRequest=null;$('import-panel').hidden=true;document.querySelector('.creation-methods').hidden=false;$('creation-choice').hidden=false;$('creation-back').hidden=true;};
$('import-file').onchange=()=>{$('clear-import-file').hidden=!$('import-file').files.length;};$('clear-import-file').onclick=()=>{$('import-file').value='';$('clear-import-file').hidden=true;};
$('tb-add-q-btn').onclick = () => { if (tbQuestions.length < 100) addQuestion(); };
$('tb-cancel-btn').onclick = () =>{creationVersion++;$('test-builder').hidden=true;};
$('tb-start-btn').onclick = action(async () => {
  const collected = collectTest(); if (collected.error) return showTbError(collected);
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
async function openSession(id) { current = await api(`/sessions/${id}`);sessionGroupSelection.set(sessionGroupKey(current),id);await watch();renderSessionGroups();renderDashboard();tab('launch'); }
// Access tokens are refreshed by Supabase; every new watch is verified by the server.
async function watch() {
  if (!current || !socket.connected) return;
  const accessToken = await token();
  const res = await new Promise(resolve => socket.timeout(10000).emit('professor:watch', { sessionId: current.id, token: accessToken }, (err,r) => resolve(err ? { ok:false,error:'Connection timed out' } : r)));
  if (!res.ok) throw new Error(res.error);
  if(current?.id===res.view?.id){current=mergeSessionPolicy(current,res.view);renderDashboard();}
};
$('calculator-launch').onclick = action(async () => {
  const existing = sessionList.find(s => s.mode === 'calculator' && s.phase !== 'ended');
  if (existing) { await openSession(existing.id); await openClassroomDisplay(current); }
  else await launchSession({ mode: 'calculator',language:window.examioLanguage.current });
});
$('display-open').onclick = action(() => current && openClassroomDisplay(current));
$('test-start').onclick = action(async () => { if(!current)return;const id=current.id;if (!confirm(current.security?.inactivityFail===false?'Start this test now?':'Start this test now? Hidden pages for more than 5 seconds will receive FAIL.')) return; updateSession(await api(`/sessions/${id}/start`, 'POST', {})); });
$('session-end').onclick = action(async () => {
  if (!current||!confirm('End this session?')) return;
  const id=current.id;await api(`/sessions/${id}/end`, 'POST', {});
  if(current?.id===id){current=null;renderDashboard();}
  await refresh();
});
const inactivityFailPending = new Set();
function mergeSessionPolicy(previous,updated) {
  const next={...previous,...updated};
  if((updated.inactivityFailVersion??0)<(previous.inactivityFailVersion??0)){
    next.security=previous.security;next.inactivityFailVersion=previous.inactivityFailVersion;
  }
  return next;
}
function renderInactivityFailControl() {
  const available=current?.mode==='test'&&['waiting','running','paused'].includes(current.phase);
  $('session-fail-control').hidden=!available;
  $('session-fail-toggle').checked=current?.security?.inactivityFail===true;
  $('session-fail-toggle').disabled=!available||current.security?.enabled!==true||inactivityFailPending.has(current.id);
  $('session-fail-hint').textContent=t(current?.security?.enabled===false?'Monitoring is off. Existing FAIL results stay unchanged.':'Existing FAIL results stay unchanged.');
}
async function changeInactivityFail() {
  const id=current?.id;
  if(!id||current.mode!=='test'||!['waiting','running','paused'].includes(current.phase)||current.security?.enabled!==true||inactivityFailPending.has(id)){renderInactivityFailControl();return;}
  const enabled=$('session-fail-toggle').checked;
  inactivityFailPending.add(id);renderInactivityFailControl();notice('');
  try {
    const updated=await api(`/sessions/${id}/inactivity-fail`,'POST',{enabled});
    // Socket updates may have changed phase/students while the request was pending.
    if(current?.id===id&&updated.id===id)current=mergeSessionPolicy(current,{security:updated.security,inactivityFailVersion:updated.inactivityFailVersion??0});
  } catch(error) {if(current?.id===id)notice(error.message);}
  finally {inactivityFailPending.delete(id);renderDashboard();}
}
$('session-fail-toggle').onchange=changeInactivityFail;
function renderDashboard() {
  renderInactivityFailControl();
  if (!current || current.phase==='ended') {professorTimerSnapshot=null;current=null;$('dashboard').hidden=true;$('live-students').replaceChildren();$('calculator-card').hidden=false;return;}
  $('dashboard').hidden = false; $('session-title').textContent = current.title;
  $('calculator-card').hidden = current.mode === 'calculator' && current.phase !== 'ended';
  $('session-phase').textContent = current.phase === 'waiting' ? t('Waiting room open · Questions appear when you start the test.') : current.phase === 'paused'?t('Test paused'):current.phase === 'running' ? t('Session in progress') : t('Session ended · Results saved');
  const teacher=current.deliveryType==='teacher'&&current.phase==='running';$('teacher-next-question').hidden=!teacher||current.teacherQuestion>=current.questionCount;$('teacher-next-question').textContent=current.teacherQuestion===current.questionCount-1?t('Finish questions'):t('Next question →');$('teacher-question-status').hidden=!teacher;$('teacher-question-status').textContent=t('Question {number} of {total}',{number:Math.min((current.teacherQuestion||0)+1,current.questionCount),total:current.questionCount});
  $('test-start').hidden = current.phase !== 'waiting'; $('session-end').hidden = current.phase === 'ended';
  $('test-pause').hidden=current.mode!=='test'||!['running','paused'].includes(current.phase);$('test-pause').textContent=current.phase==='paused'?t('Resume test'):t('Pause test');
  $('extend-time').hidden=!['running','paused'].includes(current.phase)||(!current.deadlineAt&&current.remainingMs==null);
  if(current.deadlineAt && (!professorTimerSnapshot||professorTimerSnapshot.id!==current.id||professorTimerSnapshot.serverNow!==current.serverNow||professorTimerSnapshot.deadlineAt!==current.deadlineAt))professorTimerSnapshot={id:current.id,serverNow:current.serverNow||Date.now(),deadlineAt:current.deadlineAt,receivedAt:performance.now()};renderProfessorTimer();
  $('session-rename').hidden=current.mode!=='test';
  $('launch-score-switch').hidden=current.mode!=='test';
  const scores = current.students.filter(s => s.result&&Number.isFinite(s.result.percentage)).map(s => s.result.percentage);
  $('live-summary').textContent = `${current.students.length} joined · ${current.students.filter(s => s.status === 'green' && !s.result && !s.completed && !s.recoveryState).length} active` +
    (current.mode === 'test' ? ` · ${current.students.filter(s=>s.result).length} submitted · ${current.students.filter(s => s.failed).length} FAIL${scores.length && $('launch-show-scores-live').checked ? ` · Average ${Math.round(scores.reduce((a,b) => a+b,0)/scores.length)}%` : ''}` : ' · '+current.students.filter(s=>s.completed).length+' completed');
  renderTable($('live-students'), current);
}
function renderProfessorTimer(){
 if(current?.phase==='paused'){$('session-timer').textContent=t('Test paused')+(current.remainingMs==null?'':' · '+Math.ceil(current.remainingMs/60000)+' '+t('minutes remaining'));return;}
 if(!current?.deadlineAt||current.phase!=='running'||!professorTimerSnapshot){$('session-timer').textContent='';return;}
 const seconds=Math.max(0,Math.ceil((professorTimerSnapshot.deadlineAt-(professorTimerSnapshot.serverNow+performance.now()-professorTimerSnapshot.receivedAt))/1000));
 $('session-timer').textContent='Time remaining: '+Math.floor(seconds/60)+' min '+String(seconds%60).padStart(2,'0')+' sec · Ends '+new Date(professorTimerSnapshot.deadlineAt).toLocaleTimeString();
}
setInterval(renderProfessorTimer,500);
for(const id of ['launch-show-names','launch-show-scores-live'])$(id).onchange=()=>{if(current)renderDashboard();};
function renderTable(container, session) {
  const isLaunch=container.id==='live-students'||container.dataset.live==='true';
  const masked=isLaunch&&!(container.dataset.live==='true'?container.closest('.session-group').querySelector('[data-show-names]').checked:$('launch-show-names').checked);
  const showScores=!isLaunch||(container.dataset.live==='true'?container.closest('.session-group').querySelector('[data-show-scores]').checked:$('launch-show-scores-live').checked);
  const table = document.createElement('table');
  if(session.mode === 'calculator') {
    table.innerHTML='<thead><tr><th>'+t('Student number')+'</th><th>'+t('Name')+'</th><th>'+t('Status')+'</th><th>'+t('Review')+'</th></tr></thead>';
    const body=document.createElement('tbody');
    for(const s of session.students) {
      const row=document.createElement('tr');
      for(const value of [s.number,masked?'••••••':s.name,s.failed ? t('FAILED') : s.completed?'Completed and closed':s.status === 'green' ? t('Active') : t('Inactive')]) { const cell=document.createElement('td'); cell.textContent=value; row.append(cell); }
      const review=document.createElement('td');if(s.failed && session.phase==='running')review.append(button(t('Unlock & continue'),()=>unlockStudent(session,s)));row.append(review);body.append(row);
    }
    table.append(body);if(session.requireStudentNumber===false)for(const row of table.rows)row.cells[0]?.remove(); container.replaceChildren(table); return;
  }
  table.innerHTML = '<thead><tr><th>'+t('Student number')+'</th><th>'+t('Name')+'</th><th>'+t('Status')+'</th><th>'+t('Student progress')+'</th>'+(showScores?'<th>'+t('Score')+'</th><th>'+t('Original score')+'</th>':'')+'<th>'+t('Review')+'</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const s of [...session.students].sort((a,b) => session.requireStudentNumber===false?a.name.localeCompare(b.name):a.number.localeCompare(b.number, undefined, { numeric:true }))) {
    const tr = document.createElement('tr');
    for (const text of [s.number,masked?'••••••':s.name]) { const td=document.createElement('td'); td.textContent=text; tr.append(td); }
    const recovery=isLaunch&&['running','paused'].includes(session.phase)&&!s.result&&!s.completed&&!s.finalized&&['offline','awaiting-unlock'].includes(s.recoveryState)?s.recoveryState:null;
    const state=document.createElement('td'); const pill=document.createElement('span');
    pill.className=`pill ${s.failed||(s.status==='red'&&!recovery)?'red':recovery?'reconnect-pill':''}`;
    pill.textContent=s.failed?t('FAILED'):s.completed?t('Completed and closed'):s.result?t('Test Submitted'):recovery?t(recovery==='offline'?'Logged out':'Waiting for unlock'):s.status==='green'?t('Active'):t('Inactive');
    state.append(pill);
    if(s.failed&&recovery){const badge=document.createElement('span');badge.className='pill reconnect-pill';badge.textContent=t(recovery==='offline'?'Logged out':'Waiting for unlock');state.append(badge);}
    tr.append(state);
    const progress=document.createElement('td');progress.textContent=s.progress?`${s.result?t('Finished'):s.progress.question?t('Question {number} of {total}',{number:s.progress.question,total:s.progress.total}):t('Not started')} · ${t('{answered}/{total} answered',s.progress)}`:'—';tr.append(progress);
    if(showScores) for (const text of [s.result?.pending?t('Grading…'):s.score === null ? t('Pending') : `${s.score} / ${s.total}${s.result ? ` · ${s.result.percentage}%` : ''}`, s.result?.originalScore==null?'—':s.result ? `${s.result.originalScore} / ${s.total}` : '—']) { const td=document.createElement('td'); td.textContent=text; tr.append(td); }
    const review=document.createElement('td');
    if(!s.failed&&recovery==='awaiting-unlock')review.append(button('Unlock reconnect',()=>unlockReconnectStudent(session,s)));
    if(s.failed && !s.finalized && (s.result || session.phase==='running')) review.append(button(s.result?t('Override FAIL'):t('Unlock & continue'),()=>unlockStudent(session,s)));
    if(s.failed && !s.result)review.append(button(t('Submit Fail score'),()=>submitFail(session,s),'danger'));
    const details=document.createElement('details');details.dataset.studentId=s.id; const summary=document.createElement('summary'); summary.textContent=t('{count} monitoring events',{count:s.events.length});if(s.events.length>5)summary.className='monitoring-alert'; details.append(summary);
    const list=document.createElement('ul'); for (const e of s.events) { const li=document.createElement('li'); li.textContent=`${new Date(e.at).toLocaleTimeString()} · ${e.type}${e.reason ? ` · ${e.reason}` : ''}`; list.append(li); } details.append(list); review.append(details); tr.append(review); tbody.append(tr);
  }
  table.append(tbody);if(session.requireStudentNumber===false)for(const row of table.rows)row.cells[0]?.remove();container.replaceChildren(table);
}
function detachResultsPanel(){const panel=$('result-detail');if(panel?.parentElement?.id==='result-sessions')$('results').append(panel);}
function placeResultsPanel(){if(!historySession)return false;const row=[...document.querySelectorAll('.result-session-card')].find(el=>el.dataset.sessionId===historySession.id);if(!row)return false;const panel=$('result-detail');if(row.nextElementSibling!==panel)row.after(panel);return true;}
function closeResults() {
  if($('question-detail-dialog').open)$('question-detail-dialog').close();questionData=null;
  $('result-details').hidden=true;$('result-detail-rows').replaceChildren();
  resultViewVersion++;
  historySession=null;
  $('result-detail').hidden=true;
  $('result-students').replaceChildren();
}
$('result-close').onclick=()=>{const row=[...document.querySelectorAll('.result-session-card')].find(el=>el.dataset.sessionId===historySession?.id);closeResults();(row?.querySelector('button')||$('results-refresh')).focus();};
function renderResultStatistics(students){const stats=window.examioResultAnalysis.statistics(students),root=$('result-stats');root.replaceChildren();for(const [label,value] of [[t('Students'),stats.students],[t('Completion'),stats.completion+'%'],[t('Class average'),stats.average==null?'—':stats.average+'%']]){const cell=document.createElement('div'),title=document.createElement('span'),number=document.createElement('strong');title.textContent=label;number.textContent=value;cell.append(title,number);root.append(cell);}}
function renderResults() { placeResultsPanel();$('result-detail').hidden=false; $('result-title').textContent=historySession.title;renderResultSettings(historySession); $('result-delete').hidden=false; $('result-rename').hidden=false;renderResultStatistics(historySession.students); renderTable($('result-students'),historySession); }
async function deleteResults(session) {
  if(!confirm(`Move the saved results for “${session.title}” to Trash for 30 days?${session.phase!=='ended'?' This will end the active session first.':''}`)) return;
  if(session.phase!=='ended')await api(`/sessions/${session.id}/end`,'POST',{});
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
let detailsRequest=null,detailsSnapshot='',detailsPhase,questionData=null,questionIndex=0,questionResultsVisible=false;
function detailsVisible(){return historySession&&!$('results').hidden&&!$('result-details').hidden&&!document.hidden;}
function renderAnswerGrid(data){
  questionData=data;if(data.summaryStudents)renderResultStatistics(data.summaryStudents);if($('question-detail-dialog').open)renderQuestionDetail();
  const root=$('result-detail-rows');
  const table=document.createElement('table');table.className='answer-grid';
  const header=table.createTHead().insertRow();
  for(const [index,label] of ['Student number','Name','State',...data.questions].entries()){
    const th=document.createElement('th');th.scope='col';
    if(index<3)th.textContent=t(label);
    else{const control=button('Q'+(index-2),()=>{questionIndex=index-3;questionResultsVisible=false;renderQuestionDetail();$('question-detail-dialog').showModal();});control.title=label;control.setAttribute('aria-label',t('Question')+' '+(index-2)+': '+label);th.append(control);}
    header.append(th);
  }
  const averages=table.createTFoot().insertRow();averages.className='question-average-row';const averageLabel=document.createElement('th');averageLabel.colSpan=3;averageLabel.scope='row';averageLabel.textContent=t('Class average');averages.append(averageLabel);for(let index=0;index<data.questions.length;index++){const value=window.examioResultAnalysis.questionStatistics(data.students,index).average;averages.insertCell().textContent=value==null?'—':value+'%';}
  const body=table.createTBody();
  for(const student of [...data.students].sort((a,b)=>historySession?.requireStudentNumber===false?a.name.localeCompare(b.name):a.number.localeCompare(b.number,undefined,{numeric:true}))){
    const row=body.insertRow();
    for(const value of [student.number,student.name,student.submitted?t('Submitted'):data.phase==='ended'?t('No submission'):t('Draft')])row.insertCell().textContent=value;
    for(const answer of student.answers){
      const cell=row.insertCell();cell.className='answer-'+answer.status;
      const state=answer.status==='correct'?'Correct':answer.status==='incorrect'?'Incorrect':'Unanswered';
      cell.textContent=answer.status==='grading'?t('Grading…'):(answer.status==='correct'?'✓ ':answer.status==='incorrect'?'✗ ':'')+(answer.letter||answer.answer||'—')+(answer.status==='partial'?' · '+answer.points+'/'+answer.maxPoints:'');
      cell.title=state+' · '+answer.question+' · Answer: '+(answer.answer||'Unanswered');
      cell.setAttribute('aria-label',cell.title);if(data.questionDetails?.[answer.number-1]?.type==='short'&&student.submitted){const review=button(t('Review score'),()=>reviewShortAnswer(student,answer,data.questionDetails[answer.number-1]));cell.append(document.createElement('br'),review);}
    }
  }
  root.replaceChildren();
  if(historySession?.requireStudentNumber===false){
    for(const row of table.tHead.rows)row.cells[0]?.remove();
    for(const row of table.tBodies[0].rows)row.cells[0]?.remove();
    averageLabel.colSpan=2;
  }
  if(data.students.length)root.append(table);else root.textContent=t('No students joined.');
}
function renderQuestionDetail(){
 if(!questionData)return;const q=questionData.questionDetails?.[questionIndex],text=q?.text||questionData.questions[questionIndex],stats=window.examioResultAnalysis.questionStatistics(questionData.students,questionIndex);
 $('question-detail-title').textContent=(questionIndex+1)+'. '+text;$('question-detail-position').textContent=(questionIndex+1)+' / '+questionData.questions.length;$('question-detail-previous').disabled=questionIndex===0;$('question-detail-next').disabled=questionIndex===questionData.questions.length-1;$('question-detail-toggle').textContent=questionResultsVisible?t('Hide results'):t('Show results');
 const root=$('question-detail-content');root.replaceChildren();const count=document.createElement('p');count.textContent=t('{answered}/{total} students answered',{answered:stats.answered,total:questionData.students.length});root.append(count);
 if(q?.image){const image=document.createElement('img');image.src=q.image;image.alt=t('Question image');image.className='tb-image';root.append(image);}
 const options=['blank','short'].includes(q?.type)?null:q?.options;
 if(options)for(const [index,option] of options.entries()){const line=document.createElement('div');line.className='question-answer-row';const label=document.createElement('span');label.textContent=String.fromCharCode(65+index)+'. '+option.text;line.append(label);if(option.image){const image=document.createElement('img');image.src=option.image;image.alt=option.text;image.className='tb-image';line.append(image);}if(questionResultsVisible){line.classList.add(option.id===q.correctOptionId?'question-answer-correct':'question-answer-incorrect');const percentage=document.createElement('strong');percentage.className='question-result-percentage';percentage.textContent=(stats.answered?Math.round((stats.options[option.id]||0)/stats.answered*10000)/100:0)+'%';line.append(percentage);}root.append(line);}
 else if(questionResultsVisible){const key=document.createElement('p');key.className='question-answer-correct';key.textContent=t('Correct answer')+': '+(q?.type==='short'?q.modelAnswer:(q?.acceptedAnswers||[]).join(' / '));root.append(key);for(const [answer,count] of Object.entries(stats.blanks)){const row=document.createElement('p');row.textContent=answer+' · '+count;root.append(row);}}
 if(questionResultsVisible){const average=document.createElement('p');average.textContent=t('Class average')+': '+(stats.average==null?'—':stats.average+'%');root.append(average);}
}
$('question-detail-close').onclick=()=> $('question-detail-dialog').close();
$('question-detail-toggle').onclick=()=>{questionResultsVisible=!questionResultsVisible;renderQuestionDetail();};
for(const [id,delta] of [['question-detail-previous',-1],['question-detail-next',1]])$(id).onclick=()=>{questionIndex+=delta;renderQuestionDetail();};
async function refreshAnswerGrid(){
  if(!detailsVisible())return;
  const id=historySession.id,version=resultViewVersion;
  if(detailsRequest?.version===version)return;
  const request={version};detailsRequest=request;
  try{
    const data=await api('/sessions/'+encodeURIComponent(id)+'/details?live=1');
    if(version!==resultViewVersion||!detailsVisible())return;
    detailsPhase=data.summaryStudents?.some(s=>s.result?.pending)?'grading':data.phase;
    const snapshot=JSON.stringify(data);
    if(snapshot!==detailsSnapshot){detailsSnapshot=snapshot;if(data.summaryStudents){historySession.students=data.summaryStudents;renderResults();}renderAnswerGrid(data);}
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
const exportsController=window.createExamioExports({getSession:()=>historySession,getEmail:()=>account?.email,getEmailConfigured:()=>exportEmailConfigured,downloadFile,api,saveToDrive:async(session,detail)=>{const generation=accountGeneration;const response=await fetch('/api/sessions/'+encodeURIComponent(session.id)+'/export?format=xlsx&detail='+(detail?'1':'0'),{headers:{Authorization:'Bearer '+await token()}});if(!response.ok)throw Error('Unable to load grades. Please sign in and retry.');const workbook=await response.blob();if(generation!==accountGeneration)throw Error('Account changed. Please retry.');return window.examioSaveGoogleSheet({accessToken:sessionPreferences?.getGoogleProviderToken(account.id),workbook,title:session.title+(detail?' - Detailed Results':' - Summary Grades')});},connectDrive:async(session,detail)=>{sessionStorage.setItem('examio-drive-return',JSON.stringify({owner:account.id,session:session.id,detail}));sessionPreferences.beginSignIn({oauth:true});const {error}=await auth.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/professor.html',scopes:'https://www.googleapis.com/auth/drive.file',queryParams:{prompt:'consent',login_hint:account.email,include_granted_scopes:'true'}}});if(error){sessionPreferences.cancelNavigation();sessionStorage.removeItem('examio-drive-return');throw error;}},notify:notice}); $('results-refresh').onclick=action(refresh);
socket.on('connect',()=> { if (account) { if($('notice').textContent.startsWith('Live connection lost'))notice(''); watch().catch(e=>notice(e.message)); } });
socket.on('disconnect',()=> { if (account) notice('Live connection lost. Sessions remain saved; reconnecting…'); });
socket.on('professor:update',view=> { const listed=sessionList.find(s=>s.id===view.id);if(view.phase==='ended'||(listed&&(listed.title!==view.title||listed.phase!==view.phase)))refresh().catch(e=>notice(e.message));const index=sessionList.findIndex(s=>s.id===view.id);if(index!==-1)sessionList[index]=mergeSessionPolicy(sessionList[index],view);renderOtherSessionPanels();if (current?.id === view.id) { current=mergeSessionPolicy(current,view); renderDashboard(); } if (historySession?.id===view.id) { historySession=mergeSessionPolicy(historySession,view); renderResults(); } });
socket.on('auth:expired',()=> { notice('Please sign in again to reconnect the private dashboard.'); });
let workspaceSignIn,registration;
function signedIn() {
  if(sessionPreferences?.blocked)return Promise.resolve();
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
    const authSession=(await auth.auth.getSession()).data.session;if(generation!==accountGeneration||sessionPreferences?.blocked||!authSession)return;
    if(registration&&await registration.resume(authSession))return;
    document.getElementById("admin-link").hidden=!verified.adminAllowed;settings.setAccount(verified);$('account-name').textContent=account.email;$('login').hidden=true;$('workspace').hidden=false;$('workspace-tabs').hidden=false;$('signout').hidden=false;
    if(openGameTab&&workspaceTab==='launch')tab('games');
    socket.connect();
    try {
      const onboarding=await api('/onboarding','POST',{language:window.examioLanguage.current});
      await refresh(); await watch();
      if(generation===accountGeneration&&openBetaFeedback){openBetaFeedback=false;try{sessionStorage.removeItem('examio-beta-feedback');}catch{}const clean=new URL(location.href);clean.searchParams.delete('feedback');history.replaceState(null,'',clean);await settings.open('beta');return;}
      if(generation===accountGeneration){let pending=null;try{pending=JSON.parse(sessionStorage.getItem('examio-drive-return')||'null');sessionStorage.removeItem('examio-drive-return');}catch{}if(pending&&pending.owner===account.id){historySession=await api('/sessions/'+encodeURIComponent(pending.session));tab('results');showResultSummary();renderResults();exportsController.open();notice(t('Google Drive connected. Choose Save to Drive to create your Google Sheet.'));}else tour.offer(onboarding);}
    } catch(e) { if(generation===accountGeneration)notice(e.message); }
  }catch(e){if(generation!==accountGeneration)return;settings.reset();account=null;$('login').hidden=false;$('workspace').hidden=true;$('signout').hidden=true;$('auth-message').textContent=e.message;}
}
async function initAuth() {
  const config=await (await fetch('/api/config')).json();
  if (!config.supabaseUrl || !config.supabaseKey) { $('auth-message').textContent='Professor sign-in needs Development authentication configuration. See V2_SETUP.md.'; $('login').querySelectorAll('input,button').forEach(el=>el.disabled=true); return; }
  aiConfigured=Boolean(config.aiConfigured);exportEmailConfigured=Boolean(config.exportEmailConfigured);if(Number.isSafeInteger(config.uploadMaxBytes)&&config.uploadMaxBytes>0)uploadMaxBytes=config.uploadMaxBytes;
  const preferences=sessionPreferences=window.createExamioSessionPreferences(config.supabaseUrl);
  $('remember-login').checked=preferences.remember;
  $('remember-login').onchange=()=>{preferences.beginSignIn();preferences.setRemember($('remember-login').checked);};
  auth=window.createOnScreenAuth(config.supabaseUrl, config.supabaseKey, {auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,storage:preferences.storage}});
  registration=window.createExamioRegistration({auth,api,onBeginSignIn:oauth=>preferences.beginSignIn({oauth}),onComplete:()=>setTimeout(()=>{void signedIn();},0)});
  let localSignout=null;
  function showSignedOut(){clearPrivateWorkspace();account=null;registration.reset();$('workspace').hidden=true;$('login').hidden=false;$('signout').hidden=true;$('remember-login').checked=false;if($('signout-dialog').open)$('signout-dialog').close();if(localSignout)localSignout.done=true;}
  // A stale tab must not broadcast another SDK sign-out over a newer login.
  preferences.onInvalidated(()=>{showSignedOut();auth.auth.stopAutoRefresh?.();});
  auth.auth.onAuthStateChange((event) => {
    if (event==='PASSWORD_RECOVERY') { recoveringPassword=true; $('login').hidden=false; $('workspace').hidden=true; $('login-form').hidden=true; $('google').hidden=true; $('new-password-form').hidden=false; }
    if (event==='SIGNED_IN' && !account&&!preferences.blocked) setTimeout(()=>{if(!account)void signedIn();},0);
    if (event==='TOKEN_REFRESHED'&&!preferences.blocked) setTimeout(()=>{if(account)watch().catch(e=>notice(e.message));},0);
    if (event==='SIGNED_OUT') {if(!preferences.blocked)preferences.clearSession({broadcast:!!localSignout&&!localSignout.done});showSignedOut();}
  });
  $('login-form').onsubmit=async e=> { e.preventDefault();preferences.beginSignIn(); try{const {error}=await auth.auth.signInWithPassword({email:$('email').value,password:$('password').value}); $('auth-message').textContent=t(error?.message || '');}catch(error){$('auth-message').textContent=error.message;} };
  $('google').onclick=async()=> {preferences.beginSignIn({oauth:true}); const {error}=await auth.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/professor.html'}}); if(error){preferences.cancelNavigation();$('auth-message').textContent=error.message;} };
  $('signout').onclick=()=> { $('signout-error').textContent='';$('settings-menu').open=false;$('signout-dialog').showModal();$('signout-cancel').focus(); };
  for(const id of ['signout-cancel','signout-close'])$(id).onclick=()=> $('signout-dialog').close();
  $('signout-confirm').onclick=async()=>{
    $('signout-confirm').disabled=true;
    const job=localSignout={done:false};
    try{const {error}=await auth.auth.signOut({scope:'local'});if(!job.done){preferences.clearSession();showSignedOut();}if(error&&!account)$('auth-message').textContent=t('Signed out on this computer. Server sign-out could not be confirmed.');}
    catch(error){if(!job.done){preferences.clearSession();showSignedOut();}if(!account)$('auth-message').textContent=t('Signed out on this computer. Server sign-out could not be confirmed.');}
    finally{if(localSignout===job)localSignout=null;$('signout-confirm').disabled=false;}
  };
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
let launchTest=null,quickLaunchPreferences=null;
function resetLaunchOptions(){
 $('launch-room-enabled').checked=false;$('launch-room-name').value='';$('launch-room-name').disabled=true;$('launch-room-field').hidden=true;
 $('launch-time-enabled').checked=false;$('launch-duration').value='10';$('launch-duration').disabled=true;$('launch-time-field').hidden=true;
 for(const id of ['launch-show-scores','launch-corrections','launch-monitoring','launch-fail-hidden','launch-text-selection','launch-copy-block','launch-fullscreen','launch-tab-visibility','launch-focus'])$(id).checked=true;
 $('launch-shuffle').checked=false;$('launch-shuffle-questions').checked=false;$('launch-deterrents').open=false;
 updateLaunchSecurity();
}
function updateLaunchSecurity(){$('launch-security-controls').disabled=!$('launch-monitoring').checked;}
$('launch-monitoring').onchange=updateLaunchSecurity;
$('launch-room-enabled').onchange=()=>{$('launch-room-name').disabled=!$('launch-room-enabled').checked;$('launch-room-field').hidden=!$('launch-room-enabled').checked;if(!$('launch-room-name').disabled)$('launch-room-name').focus();};
$('launch-time-enabled').onchange=()=>{$('launch-duration').disabled=!$('launch-time-enabled').checked;$('launch-time-field').hidden=!$('launch-time-enabled').checked;if(!$('launch-duration').disabled)$('launch-duration').focus();};
function openLaunch(test){launchTest=test;$('launch-test-title').textContent=test.title;resetLaunchOptions();$('launch-error').textContent='';$('launch-dialog').showModal();}
$('launch-cancel').onclick=()=> $('launch-dialog').close();
function selectedDeliveryType(){return document.querySelector('[name="delivery-type"]:checked').value;}
function updateDeliveryType(){const mode=selectedDeliveryType();$('launch-only-attempt').disabled=mode!=='free';$('launch-immediate-feedback').disabled=mode==='free';$('launch-feedback-option').hidden=mode==='free';$('launch-shuffle-questions').disabled=mode==='teacher';if(mode!=='free')$('launch-only-attempt').checked=false;if(mode==='free')$('launch-immediate-feedback').checked=false;if(mode==='teacher')$('launch-shuffle-questions').checked=false;}
document.querySelectorAll('[name="delivery-type"]').forEach(el=>el.onchange=updateDeliveryType);
function collectLaunchOptions(){return {...($('launch-room-enabled').checked?{roomName:$('launch-room-name').value.trim()}:{}),deliveryType:selectedDeliveryType(),onlyOneAttempt:$('launch-only-attempt').checked,immediateFeedback:$('launch-immediate-feedback').checked,requireStudentNumber:$('launch-student-numbers').checked,language:window.examioLanguage.current,durationMinutes:$('launch-time-enabled').checked?Number($('launch-duration').value):0,showScores:true,showCorrections:true,shuffleAnswers:$('launch-shuffle').checked,security:{enabled:$('launch-monitoring').checked,inactivityFail:$('launch-fail-hidden').checked,shuffleQuestions:$('launch-shuffle-questions').checked,textSelection:$('launch-text-selection').checked,copyPaste:$('launch-copy-block').checked,fullscreen:$('launch-fullscreen').checked,tabVisibility:$('launch-tab-visibility').checked,focusVisibility:$('launch-focus').checked}};}
$('launch-save-preferences').onclick=action(async()=>{if(!$('launch-form').reportValidity())return;quickLaunchPreferences=await api('/launch-preferences','PUT',collectLaunchOptions());$('launch-error').textContent='';notice(t('Quick Launch preferences saved.'));$('launch-dialog').close();});
$('launch-form').onsubmit=async e=>{e.preventDefault();$('launch-confirm').disabled=true;try{await launchSession({testId:launchTest.id,...collectLaunchOptions()});$('launch-dialog').close();}catch(e){$('launch-error').textContent=t(e.message);}finally{$('launch-confirm').disabled=false;}};
function applyQuizLayout(){applyResultsLayout();let layout='grid';try{layout=localStorage.getItem('examio-quiz-layout-'+account?.id)==='list'?'list':'grid';}catch{}$('launch-tests').dataset.layout=layout;document.querySelectorAll('[data-quiz-layout]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.quizLayout===layout)));}
document.querySelectorAll('[data-quiz-layout]').forEach(el=>el.onclick=()=>{try{localStorage.setItem('examio-quiz-layout-'+account.id,el.dataset.quizLayout);}catch{}applyQuizLayout();});
$('teacher-next-question').onclick=action(async()=>{if(!current)return;$('teacher-next-question').disabled=true;try{updateSession(await api('/sessions/'+current.id+'/next-question','POST',{questionIndex:current.teacherQuestion||0}));}finally{$('teacher-next-question').disabled=false;}});
$('extend-time').onclick=action(async()=>{if(!current)return;const id=current.id;const updated=await api('/sessions/'+id+'/extend','POST',{});updateSession(updated);if(current?.id===id)notice('Added 1 minute (60 seconds). New end time: '+new Date(updated.deadlineAt).toLocaleTimeString());});
$('test-pause').onclick=action(async()=>{if(!current||!['running','paused'].includes(current.phase))return;const id=current.id,verb=current.phase==='paused'?'resume':'pause';$('test-pause').disabled=true;try{updateSession(await api('/sessions/'+id+'/'+verb,'POST',{}));}finally{$('test-pause').disabled=false;}});
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
function updateSession(updated){const index=sessionList.findIndex(s=>s.id===updated.id);if(index!==-1)sessionList[index]=mergeSessionPolicy(sessionList[index],updated);renderOtherSessionPanels();if(current?.id===updated.id){current=mergeSessionPolicy(current,updated);renderDashboard();}if(historySession?.id===updated.id){historySession=mergeSessionPolicy(historySession,updated);renderResults();}}
async function unlockReconnectStudent(session,student){updateSession(await api('/sessions/'+encodeURIComponent(session.id)+'/unlock-reconnect','POST',{studentId:student.id}));}
function unlockStudent(session,student){openEntry({title:student.result?t('Override FAIL'):t('Unlock & continue'),label:'Reason',max:500,help:'Review '+student.name+'’s incident, then record why you are allowing continuation.',save:student.result?t('Override FAIL'):t('Unlock & continue')},async reason=>updateSession(await api('/sessions/'+session.id+'/override','POST',{studentId:student.id,reason})));}
function submitFail(session,student){openEntry({title:t('Submit Fail score'),label:'Reason',value:'Confirmed by professor',max:500,help:'Finalize '+student.name+' at 0%. This closes their attempt and stops their connection. Their saved answers and original score remain in the private record.',save:t('Submit Fail score')},async reason=>updateSession(await api('/sessions/'+session.id+'/finalize-fail','POST',{studentId:student.id,reason})));}
function renameResults(session){openEntry({title:session.phase==='ended'?'Rename results':'Rename session',value:session.title,help:'This name will be used for this session, its results and Excel filename. The Library test stays unchanged.'},async title=>{updateSession(await api('/sessions/'+session.id,'PATCH',{title}));await refresh();});}
$('result-rename').onclick=()=>renameResults(historySession);$('session-rename').onclick=()=>renameResults(current);
let importRequest=null;
function closeCreation(){creationVersion++;importRequest?.abort();importRequest=null;$('creation-dialog').close();}
function resetImport(){ $('clear-import-file').hidden=true;$('import-source').value='';$('import-file').value='';$('generation-prompt').value='';$('ai-consent').checked=false;$('import-use-ai').checked=true;$('ai-count').value='10';$('ai-types').value='mixed';$('ai-difficulty').value='medium';$('import-status').textContent='';}
function updateImportMode(){const useAI=importMode==='generate'||$('import-use-ai').checked;$('ai-options').hidden=!useAI;$('import-submit').disabled=Boolean(importRequest)||(useAI&&!aiConfigured);$('import-submit').textContent=importMode==='generate'?'Generate questions':useAI?'Prepare questions with AI':'Import questions';}
function openImport(mode){
 $('creation-back').hidden=false;
 importRequest?.abort();importRequest=null;creationVersion++;importMode=mode;resetImport();document.querySelector('.creation-methods').hidden=true;$('creation-choice').hidden=false;$('import-panel').hidden=false;
 $('generation-settings').hidden=mode!=='generate';$('generation-prompt-label').hidden=mode!=='generate';$('import-ai-toggle').hidden=mode==='generate';$('import-format-help').hidden=mode==='generate';$('import-file-label').hidden=mode==='paste';$('import-source-label').hidden=mode!=='paste';
 $('import-heading').textContent=mode==='generate'?'Generate Questions':mode==='paste'?'Copy-Paste Questions':'Upload a Quiz';
 $('import-help').textContent=mode==='generate'?'Describe a topic, attach a PDF or DOCX, or use both. Review all generated questions and answers before saving.':'Import existing questions, preserving their wording and supplied answers. Review the prepared draft before saving.';
 $('ai-consent-text').textContent='Send this content to OpenAI to prepare questions and answers. API usage charges apply.';$('ai-config-note').textContent=aiConfigured?'':'AI is not configured. Existing formatted questions can still be imported with Use AI turned off.';updateImportMode();
}
$('import-use-ai').onchange=updateImportMode;
$('upload-test').onclick=()=>openImport('extract');$('create-paste').onclick=()=>openImport('paste');$('create-ai').onclick=()=>openImport('generate');$('import-cancel').onclick=closeCreation;
$('creation-dialog').addEventListener('cancel',closeCreation);
async function prepareImport(){
 if(importRequest)return;const mode=importMode,useAI=mode==='generate'||$('import-use-ai').checked,version=creationVersion,generation=accountGeneration;
 if(useAI&&!aiConfigured)return;
 if(useAI&&!$('ai-consent').checked){$('import-status').textContent=t('Confirm that this material may be sent to OpenAI.');return;}
 const data=new FormData(),file=$('import-file').files[0],source=$('import-source').value,prompt=$('generation-prompt').value.trim();
 if(file&&file.size>uploadMaxBytes){$('import-status').textContent='Choose a PDF or DOCX up to '+(uploadMaxBytes/1024/1024)+' MB.';return;}
 if(mode==='generate'?!file&&!prompt:mode==='paste'?!source.trim():!file){$('import-status').textContent=mode==='generate'?'Enter a topic or attach a PDF or DOCX.':mode==='paste'?'Paste your questions.':'Choose a PDF or DOCX file.';return;}
 if(file)data.append('file',file);if(source.trim())data.append('source',source);
 if(mode==='generate'){data.append('prompt',prompt);for(const key of ['count','types','difficulty'])data.append(key,$('ai-'+key).value);}
 const route=mode==='generate'?'generate':useAI?'import-ai':'import',controller=new AbortController();importRequest=controller;updateImportMode();$('import-status').textContent='Preparing questions…';
 try{const response=await fetch('/api/'+route,{method:'POST',headers:{Authorization:'Bearer '+await token()},body:data,signal:controller.signal});const result=await response.json();if(generation!==accountGeneration||version!==creationVersion)return;if(!response.ok)throw new Error(result.error||'Could not prepare draft.');if(!result.test?.questions?.length)throw new Error('No questions were recognized. Check the format and try again.');
 const title=$('new-title').value.trim(),folderId=$('new-folder-choice').value;openBuilder({...result.test,title:title||result.test.title,folderId});editingId=null;$('draft-review').textContent=[result.test.questions.length+' questions prepared. Review the answers before saving.',...(result.warnings||[])].join(' ');
 }catch(e){if(e.name!=='AbortError'&&generation===accountGeneration&&version===creationVersion)$('import-status').textContent=e.message;}
 finally{if(importRequest===controller){importRequest=null;if(version===creationVersion)updateImportMode();}}
}
$('import-form').onsubmit=action(async e=>{e.preventDefault();await prepareImport();});
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
function imageControl(target,labelText,compact=false) {
  const panel=document.createElement('div');
  const label=document.createElement('label');label.textContent=labelText;
  const picker=document.createElement('input');picker.type='file';picker.accept='image/png,image/jpeg,image/webp';
  if(compact){panel.className='tb-option-image-tools';picker.hidden=true;picker.setAttribute('aria-label',labelText);const upload=button(t(target.image?'Change image':'Upload image'),()=>picker.click());upload.title=labelText;panel.append(upload,picker);}else{label.append(picker);panel.append(label);}
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
 hideTbError();
 els.tbQuestions.replaceChildren();
 tbQuestions.forEach((q,i)=> {
  const card=document.createElement('div');card.className='tb-q-card';card.dataset.index=i;
  const header=document.createElement('div');header.className='tb-q-header';const handle=document.createElement('span');handle.textContent='⠿ '+t('Question')+' '+(i+1);handle.draggable=true;handle.className='drag-handle';handle.title='Drag to reorder';handle.ondragstart=e=>{draggingQuestion=i;e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move';};handle.ondragend=()=>draggingQuestion=null;
  card.ondragover=e=> {if(draggingQuestion!==null)e.preventDefault();};card.ondrop=e=> {e.preventDefault();if(draggingQuestion!==null)moveQuestion(draggingQuestion,i);draggingQuestion=null;};header.append(handle);
  const up=button('↑',()=>moveQuestion(i,i-1));up.disabled=i===0;up.setAttribute('aria-label','Move question '+(i+1)+' up');const down=button('↓',()=>moveQuestion(i,i+1));down.disabled=i===tbQuestions.length-1;down.setAttribute('aria-label','Move question '+(i+1)+' down');header.append(up,down);
  const pointsLabel=document.createElement('label');pointsLabel.textContent=t('Points');const points=document.createElement('input');points.type='number';points.className='tb-points';points.min='0.01';points.max='1000';points.step='0.01';points.value=q.points??1;points.setAttribute('aria-label','Question '+(i+1)+' points');points.oninput=()=>q.points=Number(points.value);pointsLabel.append(points);header.append(pointsLabel);
  if(tbQuestions.length>1)header.append(button(t('Remove question'),()=>{tbQuestions.splice(i,1);renderTestBuilder();}));card.append(header);
  const type=document.createElement('select');type.className='tb-q-type';type.setAttribute('aria-label','Question '+(i+1)+' type');for(const [value,label] of [['mc','Multiple choice'],['blank','Fill in the blank'],['truefalse','True / False'],['short','Short answer']]){const o=document.createElement('option');o.value=value;o.textContent=label;type.append(o);}type.value=q.type||'mc';type.onchange=()=>{q.type=type.value;if(q.type==='truefalse'){q.options=[{id:q.id+'_true',text:'True'},{id:q.id+'_false',text:'False'}];q.correctOptionId='';}else if(q.type==='short'){q.modelAnswer=q.modelAnswer||'';q.gradingGuidance=q.gradingGuidance||'';}else if(q.type==='blank'){q.acceptedAnswers=q.acceptedAnswers||[];q.caseSensitive=q.caseSensitive||false;}else if(!q.options){q.options=[{id:q.id+'_a',text:''},{id:q.id+'_b',text:''}];q.correctOptionId='';}renderTestBuilder();};card.append(type);
  const text=document.createElement('input');text.className='tb-q-text';text.placeholder='Question text…';text.setAttribute('aria-label','Question '+(i+1)+' text');text.maxLength=1000;text.value=q.text;text.oninput=()=>q.text=text.value;card.append(text,imageControl(q,'Question image (optional)'));
  if(q.type==='short') {const model=document.createElement('label');model.textContent=t('Model answer');const input=document.createElement('textarea');input.className='tb-model-answer';input.maxLength=2000;input.rows=3;input.value=q.modelAnswer||'';input.oninput=()=>q.modelAnswer=input.value;model.append(input);const guide=document.createElement('label');guide.textContent=t('Marking guidance (optional)');const guidance=document.createElement('textarea');guidance.className='tb-grading-guidance';guidance.maxLength=2000;guidance.rows=2;guidance.value=q.gradingGuidance||'';guidance.oninput=()=>q.gradingGuidance=guidance.value;guide.append(guidance);const note=document.createElement('p');note.textContent=t('AI awards partial credit against your model answer. You can review and override the score in Detailed Results.');card.append(model,guide,note);
  } else if(q.type==='blank') {
   const label=document.createElement('label');label.textContent=t('Accepted answers (one per line)');const answers=document.createElement('textarea');answers.className='tb-accepted';answers.rows=3;answers.value=(q.acceptedAnswers||[]).join('\n');answers.oninput=()=>q.acceptedAnswers=answers.value.split('\n').map(s=>s.trim()).filter(Boolean);label.append(answers);card.append(label);
   const sensitive=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.checked=q.caseSensitive;check.onchange=()=>q.caseSensitive=check.checked;sensitive.append(check,' Case sensitive');card.append(sensitive);
  } else {
   (q.options||[]).forEach((o,j)=>{const row=document.createElement('div');row.className='tb-option-row';row.dataset.optionId=o.id;if(q.correctOptionId)row.classList.add(q.correctOptionId===o.id?'answer-key-correct':'answer-key-incorrect');const radio=document.createElement('input');radio.type='radio';radio.name=q.id;radio.checked=q.correctOptionId===o.id;radio.setAttribute('aria-label','Correct answer '+String.fromCharCode(65+j));radio.onchange=()=>{q.correctOptionId=o.id;for(const answerRow of card.querySelectorAll('.tb-option-row')){answerRow.classList.toggle('answer-key-correct',answerRow.dataset.optionId===o.id);answerRow.classList.toggle('answer-key-incorrect',answerRow.dataset.optionId!==o.id);}};const input=document.createElement('input');input.className='tb-opt-text';input.maxLength=500;input.placeholder='Option '+String.fromCharCode(65+j);input.value=o.text;input.readOnly=q.type==='truefalse';input.oninput=()=>o.text=input.value;row.append(radio,input);if(q.type!=='truefalse'&&q.options.length>2)row.append(button(t('Remove option'),()=>{q.options.splice(j,1);if(q.correctOptionId===o.id)q.correctOptionId='';renderTestBuilder();}));row.append(imageControl(o,'Image for option '+String.fromCharCode(65+j)+' (optional)',true));card.append(row);});
   if(q.type!=='truefalse'&&q.options.length<5)card.append(button(t('+ Add Option'),()=>{q.options.push({id:q.id+'_'+crypto.randomUUID(),text:''});renderTestBuilder();}));
  }
  if(q.answerExplanation){const reason=document.createElement('p');reason.className='answer-rationale';reason.textContent='AI answer rationale: '+q.answerExplanation;card.append(reason);}
  updateAnswerWarning(card,q,i);card.addEventListener('input',()=>{hideTbError();updateAnswerWarning(card,q,i);});card.addEventListener('change',()=>{hideTbError();updateAnswerWarning(card,q,i);});
  if(q.evidence){const evidence=document.createElement('details');evidence.className='source-evidence';const summary=document.createElement('summary');summary.textContent=t('Source excerpt');const excerpt=document.createElement('p');excerpt.textContent=q.evidence;evidence.append(summary,excerpt);card.append(evidence);}els.tbQuestions.append(card);
 });
}
function collectTest() {
 if(pendingImages)return {error:'Wait for images to finish loading.'};
 const imageSize=tbQuestions.reduce((sum,q)=>sum+(q.image?.length||0)+(q.type==='blank'?0:(q.options||[]).reduce((total,o)=>total+(o.image?.length||0),0)),0);
 if(imageSize>600000)return {error:'These images are too large together. Remove or resize some images before saving.'};
 const title=els.tbTitle.value.trim();if(!title)return {error:'Please enter a test title.',field:'#tb-title'};
 for(const [i,q] of tbQuestions.entries()) {
  if(!Number.isFinite(q.points??1)||(q.points??1)<=0||(q.points??1)>1000||Math.abs((q.points??1)*100-Math.round((q.points??1)*100))>0.000001)return {error:'Q'+(i+1)+': Enter positive points, up to 1000, with at most 2 decimals.',questionIndex:i,field:'.tb-points'};
  if(!q.text.trim())return {error:'Q'+(i+1)+': Question text is required.',questionIndex:i,field:'.tb-q-text'};
  if(q.type==='short'){if(!q.modelAnswer?.trim())return {error:'Question '+(i+1)+': Enter a model answer.',questionIndex:i,field:'.tb-model-answer'};}
  else if(q.type==='blank'){
   const detail={questionIndex:i,field:'.tb-accepted'};
   if(!q.acceptedAnswers?.length)return {error:'Question '+(i+1)+' needs a correct answer before this quiz can be saved. Enter it in Accepted answers, one answer per line.',...detail};
   if(q.acceptedAnswers.length>20)return {error:'Question '+(i+1)+': Enter at most 20 accepted answers, one per line.',...detail};
   if(q.acceptedAnswers.some(a=>a.length>300))return {error:'Question '+(i+1)+': Each accepted answer must be 300 characters or fewer.',...detail};
  }
  else {if(q.options.some(o=>!o.text.trim()))return {error:'Q'+(i+1)+': Each option needs text.',questionIndex:i,field:'.tb-opt-text',optionIndex:q.options.findIndex(o=>!o.text.trim())};if(!q.correctOptionId)return {error:'Question '+(i+1)+': Please mark the correct answer before saving.',questionIndex:i,field:'input[type=radio]'};}
 }
 const questions=tbQuestions.map(q=>q.type==='short'?{id:q.id,type:'short',points:q.points??1,text:q.text,modelAnswer:q.modelAnswer,gradingGuidance:q.gradingGuidance||'',...(q.image?{image:q.image}:{}),...(q.evidence?{evidence:q.evidence}:{})}:q.type==='blank'?{id:q.id,type:'blank',points:q.points??1,text:q.text,...(q.image?{image:q.image}:{}),acceptedAnswers:q.acceptedAnswers,caseSensitive:q.caseSensitive,...(q.evidence?{evidence:q.evidence}:{}),...(q.answerExplanation?{answerExplanation:q.answerExplanation}:{})}:{id:q.id,type:q.type==='truefalse'?'truefalse':'mc',points:q.points??1,text:q.text,...(q.image?{image:q.image}:{}),options:q.options,correctOptionId:q.correctOptionId,...(q.evidence?{evidence:q.evidence}:{}),...(q.answerExplanation?{answerExplanation:q.answerExplanation}:{})});
 return {test:{title,folderId:$('tb-folder').value||null,questions}};
}
function updateAnswerWarning(card,q,index){
 let warning=card.querySelector('.tb-answer-warning');
 const missing=q.type==='short'?!q.modelAnswer?.trim():q.type==='blank'?!q.acceptedAnswers?.length:!q.correctOptionId;
 if(!missing){warning?.remove();return;}
 if(!warning){warning=document.createElement('p');warning.className='tb-answer-warning';card.querySelector('.tb-q-header').after(warning);}
 warning.textContent='Question '+(index+1)+' needs a correct answer. '+(q.type==='short'?'Enter the model answer below.':q.type==='blank'?'Enter it in Accepted answers below.':'Select the correct choice below.');
}
function showTbError(detail){
 hideTbError();
 const {error,questionIndex,field,optionIndex}=detail;
 els.tbError.textContent=error;els.tbError.hidden=false;
 const card=Number.isInteger(questionIndex)?els.tbQuestions.children[questionIndex]:null;
 const target=card?(Number.isInteger(optionIndex)?card.querySelectorAll('.tb-opt-text')[optionIndex]:card.querySelector(field)):field?document.querySelector(field):els.tbError;
 if(card){
  card.classList.add('tb-q-invalid');
  const message=document.createElement('p');message.className='tb-q-error error';message.id='tb-question-error';message.setAttribute('role','alert');message.textContent=error;
  if(target){target.setAttribute('aria-invalid','true');target.setAttribute('aria-describedby',message.id);(target.closest('label,.tb-option-row')||target).after(message);}
  if(!message.isConnected)card.append(message);
 }
 if(target){if(target===els.tbError)target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'instant'});}
}
function hideTbError(){
 els.tbError.hidden=true;
 for(const card of els.tbQuestions.querySelectorAll('.tb-q-invalid'))card.classList.remove('tb-q-invalid');
 for(const el of els.tbQuestions.querySelectorAll('[aria-describedby="tb-question-error"]')){el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');}
 for(const el of els.tbQuestions.querySelectorAll('.tb-q-error'))el.remove();
}

document.addEventListener('click',event=>{for(const menu of document.querySelectorAll('.quiz-actions-menu[open]'))if(!menu.contains(event.target))menu.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const menu=document.querySelector('.quiz-actions-menu[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();event.preventDefault();}}});

const shortGradeDialog=document.createElement('dialog');shortGradeDialog.className='short-grade-dialog';shortGradeDialog.innerHTML='<form><h2>Review short answer</h2><p class="grade-question"></p><h3>Student response</h3><p class="grade-response"></p><h3>Model answer</h3><p class="grade-model"></p><p class="grade-assessment"></p><label>Points<input name="points" type="number" min="0" step="0.01" required></label><label>Reason for score change<textarea name="reason" required maxlength="500"></textarea></label><p class="grade-error" role="alert"></p><div class="actions"><button type="submit" class="primary">Save score</button><button type="button" class="grade-close">Cancel</button></div></form>';document.body.append(shortGradeDialog);shortGradeDialog.querySelector('.grade-close').onclick=()=>shortGradeDialog.close();
function reviewShortAnswer(student,answer,question){const reviewSessionId=historySession.id,reviewVersion=resultViewVersion;const form=shortGradeDialog.querySelector('form');shortGradeDialog.querySelector('.grade-question').textContent=question.text;shortGradeDialog.querySelector('.grade-response').textContent=answer.answer||t('Unanswered');shortGradeDialog.querySelector('.grade-model').textContent=question.modelAnswer;shortGradeDialog.querySelector('.grade-assessment').textContent=(answer.pending?t('Grading…'):answer.points+' / '+answer.maxPoints)+' · '+(answer.explanation||'')+(answer.aiPoints!=null?' · AI original: '+answer.aiPoints:'');form.elements.points.max=answer.maxPoints;form.elements.points.value=answer.points??'';form.elements.reason.value='';shortGradeDialog.querySelector('.grade-error').textContent='';form.onsubmit=async event=>{event.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;try{const updated=await api('/sessions/'+reviewSessionId+'/grade-override','POST',{studentId:student.id,questionId:question.id,points:Number(form.elements.points.value),reason:form.elements.reason.value});shortGradeDialog.close();if(historySession?.id===reviewSessionId&&resultViewVersion===reviewVersion){historySession=updated;renderResults();detailsSnapshot='';await refreshAnswerGrid();}}catch(error){shortGradeDialog.querySelector('.grade-error').textContent=error.message;}finally{submit.disabled=false;}};shortGradeDialog.showModal();}

let summaryGradeRequest=false;setInterval(async()=>{if(summaryGradeRequest||!historySession||$('results').hidden||document.hidden||detailsVisible()||!historySession.students?.some(s=>s.result?.pending))return;const id=historySession.id,version=resultViewVersion;summaryGradeRequest=true;try{const updated=await api('/sessions/'+encodeURIComponent(id));if(historySession?.id===id&&resultViewVersion===version){historySession=updated;renderResults();}}catch{}finally{summaryGradeRequest=false;}},2000);

function applyResultsLayout(){let layout='grid';try{layout=localStorage.getItem('examio-result-layout-'+account?.id)==='list'?'list':'grid';}catch{}$('result-sessions').dataset.layout=layout;document.querySelectorAll('[data-result-layout]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.resultLayout===layout)));}
document.querySelectorAll('[data-result-layout]').forEach(el=>el.onclick=()=>{if(!account)return;try{localStorage.setItem('examio-result-layout-'+account.id,el.dataset.resultLayout);}catch{}applyResultsLayout();});

function applyResultSort(){const root=$('result-sessions'),cards=new Map([...root.querySelectorAll('.result-session-card')].map(el=>[el.dataset.sessionId,el]));for(const s of window.examioResultOrder.sort(sessionList,resultSort,window.examioLanguage.current))if(cards.has(s.id))root.append(cards.get(s.id));document.querySelectorAll('[data-result-sort]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.resultSort===resultSort)));placeResultsPanel();}
document.querySelectorAll('[data-result-sort]').forEach(el=>el.onclick=()=>{resultSort=el.dataset.resultSort;applyResultSort();});

function formatResultElapsed(session){
 if(session.startedAt==null)return t('Not started');
 if(session.endedAt==null)return t('In progress');
 const seconds=Math.max(0,Math.floor((session.endedAt-session.startedAt)/1000));
 const hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);
 return [hours?hours+' '+t('h'):'',minutes?minutes+' '+t('min'):'',seconds%60+' '+t('sec')].filter(Boolean).join(' ');
}
function renderResultSettings(session){
 const root=$('result-settings-content');
 const signature=JSON.stringify(['id','deliveryType','roomName','requireStudentNumber','durationMinutes','onlyOneAttempt','immediateFeedback','showScores','showCorrections','security','shuffleAnswers','createdAt','startedAt','endedAt'].map(key=>session[key]));
 if(root.dataset.signature===signature)return;
 if(root.dataset.sessionId!==session.id)$('result-settings').open=false;
 root.dataset.sessionId=session.id;root.dataset.signature=signature;root.replaceChildren();
 const sec=session.security||{};
 const section=label=>{const heading=document.createElement('h3');heading.className='result-settings-section';heading.textContent=t(label);root.append(heading);};
 const row=(label,value)=>{const el=document.createElement('div');el.className='result-setting-row';const name=document.createElement('span');name.textContent=t(label);const val=document.createElement('span');if(typeof value==='boolean'){val.className='result-setting-state '+(value?'enabled':'disabled');val.textContent=value?'✓':'✕';val.setAttribute('aria-label',t(value?'Enabled':'Disabled'));}else val.textContent=value;el.append(name,val);root.append(el);return el;};
 section('General settings');
 row('Test type',t(({free:'Free Navigation',one:'One & Done!',teacher:'Teacher Lead'})[session.deliveryType]||'Free Navigation'));
 row('Room name',session.roomName||'—');row('Student numbers',session.requireStudentNumber!==false);
 row('Time limit',session.durationMinutes?session.durationMinutes+' '+t('min'):t('None'));row('Only one attempt',!!session.onlyOneAttempt);
 section('Feedback');row('Immediate feedback',!!session.immediateFeedback);row('Show final score',session.showScores!==false);row('Show errors & corrections',!!session.showCorrections);
 section('Monitoring');row('Monitoring & cheating deterrents',sec.enabled!==false);
 for(const [key,label]of [['inactivityFail','5 second inactivity fail'],['shuffleQuestions','Shuffle questions'],['textSelection','Text-selection restrictions'],['copyPaste','Copy/paste blocking'],['fullscreen','Fullscreen requests'],['tabVisibility','Tab visibility monitoring'],['focusVisibility','Focus & visibility changes']])row(label,sec[key]===true);
 row('Shuffle answers',!!session.shuffleAnswers);
 section('Test time');
 row('Elapsed test time',formatResultElapsed(session)).title=t('Time from start to completion, including pauses.');
 for(const [key,label]of [['startedAt','Started'],['endedAt','Completed']])row(label,session[key]!=null?new Date(session[key]).toLocaleString():'—');
}

document.addEventListener('click',event=>{const info=$('result-settings');if(info&&!info.contains(event.target))info.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape')$('result-settings').open=false;});

const sessionGroupSelection=new Map();
function sessionGroupKey(session){return session.mode==='calculator'?'calculator':folders.some(f=>f.id===session.folderId)?session.folderId:'';}
function renderSessionGroups(){
 const staging=$('in-session-section');staging.hidden=true;staging.append($('dashboard'));document.querySelectorAll('.session-group').forEach(el=>el.remove());
 const active=sessionList.filter(s=>s.phase!=='ended'),groups=new Map();for(const session of active){const key=sessionGroupKey(session);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(session);}
 for(const [key,sessions]of groups){const group=document.createElement('section');group.className='card session-group';group.dataset.folderId=key;const heading=document.createElement('h2');heading.className='session-group-title';heading.textContent=t('Tests In Session');group.append(heading);const tabs=document.createElement('div');tabs.className='session-group-tabs';tabs.setAttribute('role','tablist');group.append(tabs);const selected=current&&sessionGroupKey(current)===key?current.id:sessions.some(s=>s.id===sessionGroupSelection.get(key))?sessionGroupSelection.get(key):sessions[0].id;sessionGroupSelection.set(key,selected);for(const session of sessions){const tab=button(session.title+' · '+t(session.phase),()=>openSession(session.id));tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(session.id===selected));tabs.append(tab);}const body=document.createElement('div');body.className='session-group-body';body.dataset.sessionId=selected;group.append(body);const folder=[...document.querySelectorAll('#launch-tests>.folder')].find(el=>el.dataset.folderId===key);if(key==='calculator')$('calculator-card').after(group);else if(folder)folder.after(group);else $('launch-tests').append(group);if(current?.id===selected){body.append($('dashboard'));renderDashboard();}else renderOtherSessionPanel(body,sessions.find(s=>s.id===selected));}
}
function renderOtherSessionPanel(body,session){if(!session)return;const snapshot=JSON.stringify({...session,remainingMs:undefined,serverNow:undefined});if(body.dataset.snapshot===snapshot)return;body.dataset.snapshot=snapshot;const names=body.querySelector('[data-show-names]')?.checked||false,scores=body.querySelector('[data-show-scores]')?.checked||false;const expandedEvents=new Set([...body.querySelectorAll('details[open][data-student-id]')].map(el=>el.dataset.studentId));body.replaceChildren();const title=document.createElement('h2');title.textContent=session.title;const phase=document.createElement('p');phase.textContent=t(session.phase);body.append(title,phase);const actions=document.createElement('div');actions.className='actions';const run=(verb,payload={})=>action(async()=>{const updated=await api('/sessions/'+session.id+'/'+verb,'POST',payload);updateSession(updated);if(verb==='end')await refresh();});if(session.phase==='waiting')actions.append(button(t('Start test'),action(async()=>{if(confirm(t('Start this test now?')))await run('start')();}),'primary'));if(['running','paused'].includes(session.phase)&&session.mode==='test')actions.append(button(t(session.phase==='paused'?'Resume test':'Pause test'),run(session.phase==='paused'?'resume':'pause'),'primary'));if(session.deliveryType==='teacher'&&session.phase==='running'&&session.teacherQuestion<session.questionCount)actions.append(button(t('Next question →'),run('next-question',{questionIndex:session.teacherQuestion||0}),'primary'));actions.append(button(t('Open classroom display ↗'),action(async()=>openClassroomDisplay(await api('/sessions/'+session.id)))),button(t('Rename session'),()=>renameResults(session)),button(t('End session'),action(async()=>{if(confirm(t('End this session?')))await run('end')();}),'danger'));if(session.deadlineAt||session.remainingMs!=null)actions.append(button(t('Extend 1 minute'),run('extend')));body.append(actions);const privacy=document.createElement('div');privacy.className='actions';for(const [key,label,checked]of [['names','Show names',names],['scores','Show scores',scores]]){const el=document.createElement('label');el.className='privacy-switch';const input=document.createElement('input');input.type='checkbox';input.setAttribute('role','switch');input.dataset[key==='names'?'showNames':'showScores']='';input.checked=checked;const track=document.createElement('span');track.className='switch-track';track.setAttribute('aria-hidden','true');el.append(input,track,document.createTextNode(t(label)));privacy.append(el);input.onchange=()=>renderTable(table,session);}body.append(privacy);const summary=document.createElement('p');summary.textContent=session.students.length+' '+t('joined')+' · '+session.students.filter(s=>s.result).length+' '+t('submitted');body.append(summary);const table=document.createElement('div');table.className='table-wrap';table.dataset.live='true';body.append(table);renderTable(table,session);for(const details of table.querySelectorAll('details[data-student-id]'))details.open=expandedEvents.has(details.dataset.studentId);}
function renderOtherSessionPanels(){for(const body of document.querySelectorAll('.session-group-body')){if(body.contains($('dashboard')))continue;renderOtherSessionPanel(body,sessionList.find(s=>s.id===body.dataset.sessionId));}}
let sessionGroupPolling=false;setInterval(async()=>{if(!account||document.hidden||$('launch').hidden||sessionGroupPolling||!sessionList.some(s=>s.phase!=='ended'))return;sessionGroupPolling=true;const generation=accountGeneration;try{const list=await api('/sessions');if(generation!==accountGeneration)return;const changed=list.filter(s=>s.phase!=='ended').map(s=>s.id+':'+s.phase+':'+s.title).join('|')!==sessionList.filter(s=>s.phase!=='ended').map(s=>s.id+':'+s.phase+':'+s.title).join('|');sessionList=list;if(changed){if(current)current=list.find(s=>s.id===current.id)||null;renderSessionGroups();}else renderOtherSessionPanels();}catch{}finally{sessionGroupPolling=false;}},2000);

function positionResultSettings(){
 const info=$('result-settings');if(!info.open)return;
 const rect=info.getBoundingClientRect(),content=$('result-settings-content');
 const header=$('professor-navigation')?.getBoundingClientRect();const ceiling=Math.max(12,Math.min(innerHeight-180,(header?.bottom||0)+12));
 const height=Math.max(160,Math.min(900,innerHeight-ceiling-16)),width=Math.min(390,innerWidth-32);
 const top=Math.max(ceiling,Math.min(rect.top-140,innerHeight-height-16));
 content.style.setProperty('--settings-left',Math.max(16,Math.min(rect.left,innerWidth-width-16))-rect.left+'px');
 content.style.setProperty('--settings-top',top-rect.top+'px');
 content.style.setProperty('--settings-height',height+'px');
}
$('result-settings').addEventListener('toggle',positionResultSettings);
window.addEventListener('resize',positionResultSettings);
