(async()=>{
 const { $,el,status,professor,button,newQuestion,picture}=GameClient;let api,host,reports,games=[],folders=[],tests=[],draft=null,editorVersion=0,importController=null,reviewController=null;const openFolders=new Map([['uncategorized',true]]);
 let sessions=[],launching=false,sessionRevision=0;
 const sessionParam=()=>new URLSearchParams(location.search).get('session');
 function closeEditor(){editorVersion++;reviewController?.abort();reviewController=null;$('game-form').inert=false;$('save-game').disabled=false;$('cancel-edit').disabled=false;draft=null;$('editor').hidden=true;$('library').hidden=false;$('editor-error').textContent='';}
 function edit(game){editorVersion++;reviewController?.abort();$('review-game-ai').disabled=!api?.config?.aiConfigured;$('review-game-ai').title=api?.config?.aiConfigured?'':'AI checking is not configured.';$('draft-review').hidden=true;$('draft-review').textContent='';draft=game?structuredClone(game):{title:'',folderId:null,questions:[newQuestion()]};$('title').value=draft.title;renderFolderOptions();$('editor-heading').textContent=draft.id?'Edit game':'Create a game';$('library').hidden=true;$('editor').hidden=false;renderQuestions();$('title').focus();}
 function renderFolderOptions(){
  const select=$('game-folder');select.replaceChildren();const uncategorized=el('option','Uncategorized Games');uncategorized.value='';select.append(uncategorized);
  for(const folder of folders){const option=el('option',folder.name);option.value=folder.id;select.append(option);}
  select.value=folders.some(folder=>folder.id===draft?.folderId)?draft.folderId:'';
 }
 function renderFolders(){
  $('games').replaceChildren();
  const known=new Set(folders.map(folder=>folder.id));
  const groups=[{id:'uncategorized',name:'Uncategorized Games',items:games.filter(game=>!known.has(game.folderId))},...folders.map(folder=>({...folder,items:games.filter(game=>game.folderId===folder.id)}))];
  for(const group of groups){
   const section=el('details',undefined,'game-folder');section.dataset.folderId=group.id;section.open=openFolders.get(group.id)===true;
   const summary=el('summary');summary.append(el('span',group.name,'game-folder-name'),el('span','('+group.items.length+')','game-folder-count'));section.append(summary);
   const grid=el('div',undefined,'game-grid');
   for(const game of group.items){const card=el('article',undefined,'game-card');card.append(el('h2',game.title),el('small',game.questions.length+' questions · Individual competition'),gameActions(game,card));grid.append(card);}
   if(!group.items.length)grid.append(el('p',group.id==='uncategorized'?'No uncategorized games. Create a game or copy a test to get started.':'No games in this folder yet. Choose this folder when creating or editing a game.','folder-empty'));
   section.append(grid);section.addEventListener('toggle',()=>{openFolders.set(group.id,section.open);if(!section.open&&openActions&&section.contains(openActions.trigger))closeActions();});$('games').append(section);
  }
 }
 function label(text,input){const l=el('label',text);l.append(input);return l;}
 function renderQuestions(){const list=$('questions');list.replaceChildren();draft.questions.forEach((q,index)=>{const card=el('section',undefined,'question-card');const header=el('div',undefined,'question-header');header.append(el('h2','Question '+(index+1)),button('Remove',()=>{if(draft.questions.length===1)throw new Error('Keep at least one question.');draft.questions.splice(index,1);renderQuestions();},'danger'));card.append(header);if(q.answerKeyConflict)card.append(el('p','Answer needs review: the supplied key and AI review disagree. Check the question and choose the correct answer.','answer-review-warning'));else if(!q.correctOptionId)card.append(el('p','Choose a correct answer before saving.','answer-review-warning'));const text=el('textarea');text.required=true;text.maxLength=1000;text.value=q.text;text.oninput=()=>q.text=text.value;card.append(label('Question',text));const duration=el('input');duration.type='number';duration.min=5;duration.max=240;duration.step=1;duration.required=true;duration.value=q.durationSeconds||20;duration.oninput=()=>q.durationSeconds=Number(duration.value);card.append(label('Seconds to answer',duration));
  const mediaBox=el('details');mediaBox.open=Boolean(q.media);mediaBox.append(el('summary','Optional media before this question'));const mediaType=el('select');for(const [value,name] of [['','None'],['image','Image'],['audio','Audio'],['video','Video'],['youtube','YouTube video']]){const opt=el('option',name);opt.value=value;mediaType.append(opt);}mediaType.value=q.media?.type||'';const mediaUrl=el('input');mediaUrl.type='url';mediaUrl.placeholder='https://…';mediaUrl.value=q.media?.url||'';mediaUrl.disabled=!mediaType.value;const updateMedia=()=>{if(!mediaType.value){delete q.media;mediaUrl.disabled=true;}else{mediaUrl.disabled=false;q.media={type:mediaType.value,url:mediaUrl.value.trim()};}};mediaType.onchange=updateMedia;mediaUrl.oninput=updateMedia;mediaBox.append(label('Media type',mediaType),label('Public HTTPS media URL',mediaUrl),el('p','Media plays on the host/classroom screen before the timer starts. Use a direct playable image/audio/video URL or a YouTube link. The teacher controls playback; students wait. External providers receive playback requests.'));card.append(mediaBox);

  const image=picture(q.image);if(image){card.append(image,button('Remove image',()=>{delete q.image;renderQuestions();}));}const upload=el('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.onchange=async()=>{const file=upload.files?.[0];if(!file)return;if(file.size>130000||!['image/png','image/jpeg','image/webp'].includes(file.type)){status('Use a PNG, JPEG or WebP image up to 130 KB.',true);return;}const reader=new FileReader();reader.onload=()=>{q.image=String(reader.result);renderQuestions();};reader.onerror=()=>status('Unable to load image.',true);reader.readAsDataURL(file);};card.append(label('Question image (optional, up to 130 KB)',upload));card.append(el('p','Select the correct answer.'));q.options.forEach((o,i)=>{const row=el('div',undefined,'option-edit');const correct=el('input');correct.type='radio';correct.name='correct-'+q.id;correct.checked=o.id===q.correctOptionId;correct.setAttribute('aria-label','Correct answer '+String.fromCharCode(65+i));correct.onchange=()=>{q.correctOptionId=o.id;q.answerKeyConflict=false;const warning=card.querySelector('.answer-review-warning');if(warning)warning.remove();};correct.onclick=correct.onchange;const input=el('input');input.required=true;input.maxLength=500;input.value=o.text;input.setAttribute('aria-label','Answer '+String.fromCharCode(65+i));input.oninput=()=>o.text=input.value;row.append(correct,input,button('Remove',()=>{if(q.options.length<=2)throw new Error('Each question needs at least two choices.');q.options.splice(i,1);if(q.correctOptionId===o.id)q.correctOptionId='';renderQuestions();}));card.append(row);});if(q.options.length<5)card.append(button('+ Add choice',()=>{q.options.push({id:crypto.randomUUID(),text:''});renderQuestions();}));const explanation=el('textarea');explanation.maxLength=1000;explanation.value=q.answerExplanation||'';explanation.oninput=()=>q.answerExplanation=explanation.value;card.append(label('Explanation after reveal (optional)',explanation));list.append(card);});}
 // A disclosure of ordinary buttons: native Tab/Enter/Space behavior, not an ARIA menu.
 let openActions=null, actionSequence=0;
 function closeActions(restoreFocus=false){
  if(!openActions)return;
  const {trigger,panel,card}=openActions;openActions=null;
  panel.hidden=true;trigger.setAttribute('aria-expanded','false');card.classList.remove('actions-open');
  if(restoreFocus&&trigger.isConnected)trigger.focus();
 }
 function positionActions(){
  if(!openActions)return;
  const {trigger,panel}=openActions,rect=trigger.getBoundingClientRect();
  const margin=8,width=Math.min(240,window.innerWidth-margin*2);
  panel.style.width=width+'px';panel.style.maxHeight=Math.max(44,window.innerHeight-margin*2)+'px';
  const height=panel.getBoundingClientRect().height;
  panel.style.left=Math.max(margin,Math.min(rect.right-width,window.innerWidth-width-margin))+'px';
  panel.style.top=Math.max(margin,Math.min(rect.bottom+6+height<=window.innerHeight-margin?rect.bottom+6:rect.top-height-6,window.innerHeight-height-margin))+'px';
 }
 document.addEventListener('pointerdown',event=>{if(openActions&&!openActions.trigger.contains(event.target)&&!openActions.panel.contains(event.target))closeActions();});
 document.addEventListener('focusin',event=>{if(openActions&&!openActions.trigger.contains(event.target)&&!openActions.panel.contains(event.target))closeActions();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&openActions){event.preventDefault();closeActions(true);}});
 window.addEventListener('resize',positionActions);
 window.addEventListener('scroll',positionActions,true);
 let launchTarget=null;
 const launchDialog=$('launch-dialog');
 $('cancel-launch').onclick=()=>launchDialog.close();
 launchDialog.addEventListener('close',()=>{if(!launchDialog.open)launchTarget=null;});
 $('launch-form').onsubmit=async event=>{
  event.preventDefault();
  if(launching||!launchTarget)return;
  const gameId=launchTarget.id,requireNames=$('launch-require-names').checked,largeClass=$('launch-large-class').checked;
  launching=true;$('launch-large-class').disabled=true;launchDialog.close();
  const display=window.open('about:blank','_blank','popup,width=1280,height=800');if(display)display.opener=null;
  try{
   const session=await api('/game-sessions','POST',{gameId,requireNames,largeClass});
   $('launch-large-class').checked=false;
   sessionRevision++;sessions=[...sessions.filter(s=>s.id!==session.id),session];
   selectSession(session.id,true);
   const url=GameHost.displayHref(session);
   if(display&&!display.closed&&url)display.location.replace(url);
   else {display?.close();host.showStatus('Game ready. Use Open classroom display to show the game on your projector.');}
  }catch(error){display?.close();status(error.message,true);}
  finally{launching=false;$('launch-large-class').disabled=false;}
 };
 function gameActions(game,card){
  const actions=el('div',undefined,'game-card-actions');
  const launch=el('button','Launch Game','primary');launch.type='button';launch.setAttribute('aria-haspopup','dialog');
  launch.onclick=()=>{
   if(launching)return;
   closeActions();launchTarget=game;
   $('launch-title').textContent=game.title;
   $('launch-require-names').checked=true;
   $('launch-large-class').checked=false;
   launchDialog.showModal();
   $('launch-require-names').focus();
  };
  const disclosure=el('div',undefined,'game-actions-disclosure');
  const trigger=el('button',undefined,'game-actions-toggle');trigger.type='button';
  const dots=el('span','⋯');dots.setAttribute('aria-hidden','true');trigger.append(dots);
  trigger.setAttribute('aria-label','More actions for '+game.title);trigger.setAttribute('aria-expanded','false');
  const panel=el('div',undefined,'game-actions-panel');panel.id='game-actions-'+(++actionSequence);panel.hidden=true;
  panel.setAttribute('role','group');panel.setAttribute('aria-label','Actions for '+game.title);trigger.setAttribute('aria-controls',panel.id);
  trigger.onclick=()=>{const wasOpen=openActions?.trigger===trigger;closeActions();if(wasOpen)return;openActions={trigger,panel,card};panel.hidden=false;trigger.setAttribute('aria-expanded','true');card.classList.add('actions-open');positionActions();};
  trigger.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();if(openActions?.trigger!==trigger)trigger.click();panel.querySelector('button').focus();}});
  panel.append(button('Edit',()=>{closeActions(true);edit(game);}),button('Copy to Tests',async()=>{
   closeActions(true);if(!confirm('Create an independent test copy with 1 academic point per question? Game timers, pre-question media and scores are not copied.'))return;
   await api('/games/'+encodeURIComponent(game.id)+'/to-test','POST',{});status('Copied to Test Library. The game is unchanged.');
  }),button('Delete',async()=>{
   closeActions(true);if(!confirm('Delete this saved game? Active games are not affected.'))return;
   await api('/games/'+encodeURIComponent(game.id),'DELETE');await refresh();$('new-game').focus();
  },'danger'));
  disclosure.append(trigger,panel);actions.append(launch,disclosure);return actions;
 }
 async function refresh(){
  const atRevision=sessionRevision;
  const reportRefresh=reports?.refresh();
  const language=document.documentElement.lang==='ko'?'ko':'en';
  const result=await Promise.all([api('/games?language='+language),api('/game-sessions'),api('/game-folders')]);
  closeActions();games=result[0];folders=result[2];renderFolders();
  if(atRevision!==sessionRevision)return;
  sessions=result[1];
  const requested=sessionParam();
  if(requested&&!sessions.some(session=>session.id===requested)){host.select(null);updateSessionUrl(null);status('That game has ended or expired.',true);}
  else if(requested&&host.id!==requested)host.select(requested,sessions.find(row=>row.id===requested));
  renderSessions();
  await reportRefresh;
 }
 function updateSessionUrl(id){
  const url=new URL(location.href);if(id)url.searchParams.set('session',id);else url.searchParams.delete('session');
  history.replaceState(null,'',url);
 }
 function renderSessions(){
  const items=$('active-games');items.replaceChildren();
  for(const session of sessions){
   const url=new URL(location.href);url.searchParams.set('session',session.id);
   const link=el('a',session.title||'Live quiz','active-game-link');link.href=url.href;
   if(host.id===session.id)link.setAttribute('aria-current','true');
   link.addEventListener('click',event=>{
    if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();selectSession(session.id,true);
   });
   items.append(link);
  }
 }
 function selectSession(id,focus=false){
  const session=sessions.find(row=>row.id===id);if(!session)return;
  updateSessionUrl(id);host.select(id,session);renderSessions();
  if(focus){const panel=$('game-host-panel');panel.focus({preventScroll:true});panel.scrollIntoView({block:'nearest'});}
 }
 function forgetSession(id){
  sessionRevision++;sessions=sessions.filter(session=>session.id!==id);
  if(sessionParam()===id)updateSessionUrl(null);
  renderSessions();
 }
 let savingFolder=false;
 $('new-folder').onclick=()=>{$('folder-form').reset();$('folder-error').textContent='';$('folder-dialog').showModal();$('folder-name').focus();};
 $('folder-cancel').onclick=()=>{if(!savingFolder)$('folder-dialog').close();};
 $('folder-dialog').addEventListener('cancel',event=>{if(savingFolder)event.preventDefault();});
 $('folder-form').onsubmit=async event=>{
  event.preventDefault();if(savingFolder)return;
  const name=$('folder-name').value.trim();if(!name){$('folder-error').textContent='Enter a folder name.';$('folder-name').focus();return;}
  savingFolder=true;$('save-folder').disabled=true;$('folder-cancel').disabled=true;$('folder-error').textContent='';
  try{const folder=await api('/game-folders','POST',{name});openFolders.set(folder.id,true);$('folder-dialog').close();await refresh();status('Folder created. Choose it when creating or editing a game.');}
  catch(error){if($('folder-dialog').open)$('folder-error').textContent=error.message;else status('Folder created, but the library could not refresh. Use Refresh to reload it.',true);}
  finally{savingFolder=false;$('save-folder').disabled=false;$('folder-cancel').disabled=false;}
 };
 $('new-game').onclick=openCreation;$('cancel-edit').onclick=()=>{if(confirm('Discard unsaved changes?'))closeEditor();};$('add-question').onclick=()=>{if(draft.questions.length>=100){status('A game can contain up to 100 questions.',true);return;}draft.questions.push(newQuestion());renderQuestions();$('questions').lastElementChild.scrollIntoView({block:'start',behavior:'smooth'});};$('refresh').onclick=()=>refresh().catch(e=>status(e.message,true));
 $('game-form').onsubmit=async event=>{
  event.preventDefault();
  if(!draft||$('save-game').disabled)return;
  const version=editorVersion;
  const formDraft={...structuredClone(draft),title:$('title').value.trim(),folderId:$('game-folder').value||null};
  delete formDraft.largeClass; // Historical library settings no longer control a launched room.
  const missing=formDraft.questions.findIndex(q=>!q.correctOptionId||q.answerKeyConflict);
  if(missing>=0){
   $('questions').children[missing].scrollIntoView({block:'center',behavior:'smooth'});
   $('editor-error').textContent='Choose a correct answer for question '+(missing+1)+'.';
   return;
  }
  $('save-game').disabled=true;$('cancel-edit').disabled=true;$('review-game-ai').disabled=true;$('game-form').inert=true;$('editor-error').textContent='';
  try{
   await api('/games'+(formDraft.id?'/'+encodeURIComponent(formDraft.id):''),formDraft.id?'PUT':'POST',formDraft);
   if(version!==editorVersion)return;
   openFolders.set(formDraft.folderId||'uncategorized',true);closeEditor();
   try{await refresh();status('Game saved.');}
   catch{status('Game saved, but the library could not refresh. Use Refresh to reload it.',true);}
  }catch(error){if(version===editorVersion)$('editor-error').textContent=error.message;}
  finally{if(version===editorVersion){$('game-form').inert=false;$('save-game').disabled=false;$('cancel-edit').disabled=false;$('review-game-ai').disabled=!api.config?.aiConfigured;}}
 };
 // Creation is a draft-only workflow. Only the editor's Save game persists it.
 let creationVersion=0,importMode='file',creationOptions={title:'',folderId:null};
 function fillCreationFolders(){const select=$('create-folder');select.replaceChildren();const first=el('option','Uncategorized Games');first.value='';select.append(first);for(const folder of folders){const option=el('option',folder.name);option.value=folder.id;select.append(option);}}
 function openCreation(){creationVersion++;closeActions();fillCreationFolders();$('create-title').value='';$('create-folder').value='';creationOptions={title:'',folderId:null};$('create-dialog').showModal();$('create-title').focus();}
 function captureCreation(){if(!$('create-title').reportValidity())return false;creationOptions={title:$('create-title').value.trim(),folderId:$('create-folder').value||null};return true;}
 function cancelCreation(){creationVersion++;importController?.abort();for(const id of ['create-dialog','copy-dialog','import-dialog'])if($(id).open)$(id).close();$('new-game').focus();}
 function backToCreation(){creationVersion++;importController?.abort();for(const id of ['copy-dialog','import-dialog'])if($(id).open)$(id).close();$('create-dialog').showModal();}
 for(const id of ['create-close','create-cancel','copy-cancel','import-cancel'])$(id).onclick=cancelCreation;
 for(const id of ['create-dialog','copy-dialog','import-dialog'])$(id).addEventListener('cancel',event=>{event.preventDefault();cancelCreation();});
 $('copy-back').onclick=backToCreation;$('import-back').onclick=backToCreation;
 function openSourceDraft(source,compatibleOnly,sourceLabel,warnings=[]){
  const result=GameDraft.fromSource(source,{...creationOptions,title:creationOptions.title||undefined,compatibleOnly});
  if(!result.draft?.questions?.length)throw new Error('No compatible multiple-choice questions were found. Check the source and try again.');
  for(const id of ['create-dialog','copy-dialog','import-dialog'])if($(id).open)$(id).close();
  edit(result.draft);
  const omitted=Array.isArray(result.omitted)?result.omitted.length:Number(result.omitted)||0;
  const unresolved=Array.isArray(result.unresolved)?result.unresolved.length:Number(result.unresolved)||0;
  $('draft-review').textContent=[sourceLabel+'. '+result.draft.questions.length+' questions prepared as an unsaved draft.',omitted+' question(s) omitted because they are not compatible with Games.',unresolved+' question(s) need a correct answer selected.',...warnings.filter(w=>typeof w==='string'),'Review every question and answer before saving. The original is unchanged.'].join(' ');
  $('draft-review').hidden=false;
 }
 $('create-manual').onclick=()=>{if(!captureCreation())return;$('create-dialog').close();edit({title:creationOptions.title||'Untitled game',folderId:creationOptions.folderId,questions:[newQuestion()]});};
 function openImport(mode){if(!captureCreation())return;creationVersion++;importMode=mode;$('create-dialog').close();$('import-form').reset();$('import-use-ai').disabled=!api.config?.aiConfigured;$('import-use-ai').checked=Boolean(api.config?.aiConfigured);updateImportAI();$('import-error').textContent='';$('prepare-import').disabled=false;$('prepare-import').textContent='Prepare editable draft';$('import-heading').textContent=mode==='file'?'Upload a game':'Copy-paste questions';$('import-file-label').hidden=mode!=='file';$('import-source-label').hidden=mode!=='paste';$('game-import-file').required=mode==='file';$('game-import-source').required=mode==='paste';$('import-dialog').showModal();$(mode==='file'?'game-import-file':'game-import-source').focus();}
 function updateImportAI(){const enabled=$('import-use-ai').checked;$('import-consent-label').hidden=!enabled;$('import-ai-consent').required=enabled;$('import-ai-note').textContent=api.config?.aiConfigured?'AI proposes answer keys and flags uncertainty. You make the final decision.':'AI checking is unavailable. Basic import is available.';}
 $('import-use-ai').onchange=updateImportAI;
 $('create-upload').onclick=()=>openImport('file');$('create-paste').onclick=()=>openImport('paste');
 $('import-form').onsubmit=async event=>{
  event.preventDefault();if($('prepare-import').disabled)return;const version=creationVersion;const useAI=$('import-use-ai').checked;if(useAI&&!$('import-ai-consent').checked){$('import-error').textContent='Confirm consent before sending content to OpenAI.';return;}
  $('import-error').textContent='';let body,sourceLabel;
  if(importMode==='file'){const file=$('game-import-file').files[0];if(!file||!(/\.(pdf|docx)$/i.test(file.name))){$('import-error').textContent='Choose a PDF or DOCX document.';return;}if(api.config?.uploadMaxBytes&&file.size>api.config.uploadMaxBytes){$('import-error').textContent='This file exceeds the upload size limit ('+Math.round(api.config.uploadMaxBytes/1024/1024)+' MB).';return;}body=new FormData();body.append('file',file);if(useAI){body.append('consent','true');body.append('reviewSupplied','true');}sourceLabel='Imported from '+file.name;}
  else{const source=$('game-import-source').value.trim();if(!source){$('import-error').textContent='Paste your questions first.';return;}body={source,...(useAI?{consent:true,reviewSupplied:true}:{})};sourceLabel='Imported from pasted questions';}
  $('prepare-import').disabled=true;$('prepare-import').textContent='Preparing draft…';
  importController?.abort();importController=new AbortController();
  try{const result=await api(useAI?'/import-ai':'/import','POST',body,{signal:importController.signal});if(version!==creationVersion||!$('import-dialog').open)return;openSourceDraft(result.test,true,sourceLabel,Array.isArray(result.warnings)?result.warnings:[]);}
  catch(error){if(version===creationVersion&&$('import-dialog').open)$('import-error').textContent=error.message+(useAI?' You can turn off AI checking and retry with basic import.':'');}
  finally{if(version===creationVersion){$('prepare-import').disabled=false;$('prepare-import').textContent='Prepare editable draft';}}
 };
 $('review-game-ai').onclick=async()=>{
  if(!draft||$('save-game').disabled||!api.config?.aiConfigured)return;
  if(!confirm('Send this content to OpenAI to prepare questions and answers. API usage charges apply.'))return;
  const version=editorVersion;const snapshot=JSON.stringify(draft.questions);const title=$('title').value.trim()||'Untitled game';
  reviewController?.abort();reviewController=new AbortController();$('review-game-ai').disabled=true;$('save-game').disabled=true;$('editor-error').textContent='';
  try{const result=await api('/answer-key','POST',{test:{title,questions:draft.questions},reviewSupplied:true,consent:true},{signal:reviewController.signal});
   if(version!==editorVersion||!draft)return;
   if(snapshot!==JSON.stringify(draft.questions)){throw new Error('Questions changed while AI was checking. Review was not applied; check again when ready.');}
   const reviewed=GameDraft.applyAnswerReview(draft,result.test);draft=reviewed.draft||reviewed;renderQuestions();
   $('draft-review').textContent=['AI answer review is ready. Review all suggestions before saving.',(reviewed.conflicts||0)+' question(s) have an answer conflict to confirm.',...(Array.isArray(result.warnings)?result.warnings:[]),draft.questions.filter(q=>!q.correctOptionId).length+' question(s) still need a correct answer selected.'].join(' ');$('draft-review').hidden=false;
  }catch(error){if(version===editorVersion&&draft)$('editor-error').textContent=error.message;}
  finally{if(version===editorVersion){reviewController=null;$('review-game-ai').disabled=false;$('save-game').disabled=false;}}
 };
 function copyInfo(){const test=tests.find(t=>t.id===$('copy-source').value);const unsupported=test?.questions.filter(q=>q.type&&q.type!=='mc').length||0;$('copy-info').textContent=unsupported?unsupported+' question(s) are not multiple choice. Choose compatible-only to leave them out.':'Review the copied questions and answers before saving.';$('compatible-only').checked=false;}
 $('copy-test').onclick=async()=>{
  if(!captureCreation())return;const version=++creationVersion;$('create-dialog').close();$('copy-error').textContent='';$('copy-source').replaceChildren();$('copy-info').textContent='Loading saved quizzes…';$('copy-form').querySelector('button.primary').disabled=true;$('copy-dialog').showModal();
  try{const result=await api('/tests');if(version!==creationVersion||!$('copy-dialog').open)return;tests=result;for(const test of tests){const option=el('option',test.title);option.value=test.id;$('copy-source').append(option);}if(!tests.length)throw new Error('There are no saved quizzes to copy.');copyInfo();$('copy-form').querySelector('button.primary').disabled=false;}
  catch(error){if(version===creationVersion&&$('copy-dialog').open){$('copy-info').textContent='';$('copy-error').textContent=error.message;}}
 };
 $('copy-source').onchange=copyInfo;
 $('copy-form').onsubmit=event=>{event.preventDefault();$('copy-error').textContent='';try{const source=tests.find(test=>test.id===$('copy-source').value);if(!source)throw new Error('Choose a saved quiz.');openSourceDraft(source,$('compatible-only').checked,'Copied from '+source.title);}catch(error){$('copy-error').textContent=error.message;}};
 const refreshedPodiums=new Set();
 try{api=await professor();reports=GameReports.mount({api});host=GameHost.mount({api,onPresented:view=>{
  if(view.phase==='podium'&&view.serverNow>=(view.podiumCompleteAt??0)&&!refreshedPodiums.has(view.id)){
   refreshedPodiums.add(view.id);void reports.refresh({announce:false});
  }
 },onEnded:id=>{forgetSession(id);status('Game ended.');void reports.refresh({announce:false});},onUnavailable:(id,error)=>{if([404,410].includes(error.status)){forgetSession(id);status('That game has ended or expired.',true);}else renderSessions();}});
 api.onSessionInvalidated?.(()=>{reports.invalidate();host.select(null);location.reload();});
 // Never cache a page snapshot with a private report displayed.
 window.addEventListener('pagehide',event=>{if(event.persisted)reports.invalidate();});
 window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
 await refresh();}catch(e){status(e.message,true);$('launch-large-class').disabled=true;$('new-game').disabled=true;$('new-folder').disabled=true;$('copy-test').disabled=true;}
})();
