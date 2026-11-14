(async()=>{
 const { $,el,status,professor,button,newQuestion,picture}=GameClient;let api,games=[],tests=[],draft=null;
 function closeEditor(){draft=null;$('editor').hidden=true;$('library').hidden=false;$('editor-error').textContent='';}
 function edit(game){draft=game?structuredClone(game):{title:'',questions:[newQuestion()]};$('title').value=draft.title;$('editor-heading').textContent=draft.id?'Edit game':'Create a game';$('library').hidden=true;$('editor').hidden=false;renderQuestions();$('title').focus();}
 function label(text,input){const l=el('label',text);l.append(input);return l;}
 function renderQuestions(){const list=$('questions');list.replaceChildren();draft.questions.forEach((q,index)=>{const card=el('section',undefined,'question-card');const header=el('div',undefined,'question-header');header.append(el('h2','Question '+(index+1)),button('Remove',()=>{if(draft.questions.length===1)throw new Error('Keep at least one question.');draft.questions.splice(index,1);renderQuestions();},'danger'));card.append(header);const text=el('textarea');text.required=true;text.maxLength=1000;text.value=q.text;text.oninput=()=>q.text=text.value;card.append(label('Question',text));const duration=el('input');duration.type='number';duration.min=5;duration.max=240;duration.step=1;duration.required=true;duration.value=q.durationSeconds||20;duration.oninput=()=>q.durationSeconds=Number(duration.value);card.append(label('Seconds to answer',duration));
  const mediaBox=el('details');mediaBox.open=Boolean(q.media);mediaBox.append(el('summary','Optional media before this question'));const mediaType=el('select');for(const [value,name] of [['','None'],['image','Image'],['audio','Audio'],['video','Video'],['youtube','YouTube video']]){const opt=el('option',name);opt.value=value;mediaType.append(opt);}mediaType.value=q.media?.type||'';const mediaUrl=el('input');mediaUrl.type='url';mediaUrl.placeholder='https://…';mediaUrl.value=q.media?.url||'';mediaUrl.disabled=!mediaType.value;const updateMedia=()=>{if(!mediaType.value){delete q.media;mediaUrl.disabled=true;}else{mediaUrl.disabled=false;q.media={type:mediaType.value,url:mediaUrl.value.trim()};}};mediaType.onchange=updateMedia;mediaUrl.oninput=updateMedia;mediaBox.append(label('Media type',mediaType),label('Public HTTPS media URL',mediaUrl),el('p','Media plays on the host/classroom screen before the timer starts. Use a direct playable image/audio/video URL or a YouTube link. The teacher controls playback; students wait. External providers receive playback requests.'));card.append(mediaBox);

  const image=picture(q.image);if(image){card.append(image,button('Remove image',()=>{delete q.image;renderQuestions();}));}const upload=el('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.onchange=async()=>{const file=upload.files?.[0];if(!file)return;if(file.size>130000||!['image/png','image/jpeg','image/webp'].includes(file.type)){status('Use a PNG, JPEG or WebP image up to 130 KB.',true);return;}const reader=new FileReader();reader.onload=()=>{q.image=String(reader.result);renderQuestions();};reader.onerror=()=>status('Unable to load image.',true);reader.readAsDataURL(file);};card.append(label('Question image (optional, up to 130 KB)',upload));card.append(el('p','Select the correct answer.'));q.options.forEach((o,i)=>{const row=el('div',undefined,'option-edit');const correct=el('input');correct.type='radio';correct.name='correct-'+q.id;correct.checked=o.id===q.correctOptionId;correct.setAttribute('aria-label','Correct answer '+String.fromCharCode(65+i));correct.onchange=()=>q.correctOptionId=o.id;const input=el('input');input.required=true;input.maxLength=500;input.value=o.text;input.setAttribute('aria-label','Answer '+String.fromCharCode(65+i));input.oninput=()=>o.text=input.value;row.append(correct,input,button('Remove',()=>{if(q.options.length<=2)throw new Error('Each question needs at least two choices.');q.options.splice(i,1);if(q.correctOptionId===o.id)q.correctOptionId='';renderQuestions();}));card.append(row);});if(q.options.length<5)card.append(button('+ Add choice',()=>{q.options.push({id:crypto.randomUUID(),text:''});renderQuestions();}));const explanation=el('textarea');explanation.maxLength=1000;explanation.value=q.answerExplanation||'';explanation.oninput=()=>q.answerExplanation=explanation.value;card.append(label('Explanation after reveal (optional)',explanation));list.append(card);});}
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
 function gameActions(game,card){
  const actions=el('div',undefined,'game-card-actions');
  const launch=button('Launch Game',async()=>{
   closeActions();
   const display=window.open('about:blank','_blank','popup,width=1280,height=800');if(display)display.opener=null;
   try{const session=await api('/game-sessions','POST',{gameId:game.id});if(display&&!display.closed)display.location.replace(session.classroomControlUrl || session.displayUrl);location.href='/game-host.html?session='+encodeURIComponent(session.id);}
   catch(error){display?.close();throw error;}
  },'primary');
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
  const language=document.documentElement.lang==='ko'?'ko':'en';
  const result=await Promise.all([api('/games?language='+language),api('/game-sessions')]);
  closeActions();games=result[0];$('games').replaceChildren();
  if(!games.length)$('games').append(el('div','Your first game starts here. Create one or copy a test.','empty'));
  for(const game of games){const card=el('article',undefined,'game-card');card.append(el('h2',game.title),el('small',game.questions.length+' questions · Individual competition'),gameActions(game,card));$('games').append(card);}
  const sessions=result[1];$('active-section').hidden=!sessions.length;$('active-games').replaceChildren();
  for(const session of sessions){const link=el('a',session.title+' · '+session.phase);link.href='/game-host.html?session='+encodeURIComponent(session.id);const item=el('p');item.append(link);$('active-games').append(item);}
 }
 $('new-game').onclick=()=>edit();$('cancel-edit').onclick=()=>{if(confirm('Discard unsaved changes?'))closeEditor();};$('add-question').onclick=()=>{if(draft.questions.length>=100){status('A game can contain up to 100 questions.',true);return;}draft.questions.push(newQuestion());renderQuestions();$('questions').lastElementChild.scrollIntoView({block:'start',behavior:'smooth'});};$('refresh').onclick=()=>refresh().catch(e=>status(e.message,true));
 $('game-form').onsubmit=async event=>{event.preventDefault();$('save-game').disabled=true;$('editor-error').textContent='';try{draft.title=$('title').value.trim();const missing=draft.questions.findIndex(q=>!q.correctOptionId);if(missing>=0){$('questions').children[missing].scrollIntoView({block:'center',behavior:'smooth'});throw new Error('Choose a correct answer for question '+(missing+1)+'.');}await api('/games'+(draft.id?'/'+encodeURIComponent(draft.id):''),draft.id?'PUT':'POST',draft);closeEditor();await refresh();status('Game saved.');}catch(e){$('editor-error').textContent=e.message;}finally{$('save-game').disabled=false;}};
 function copyInfo(){const test=tests.find(t=>t.id===$('copy-source').value);const unsupported=test?.questions.filter(q=>q.type&&q.type!=='mc').length||0;$('copy-info').textContent=unsupported?unsupported+' question(s) are not multiple choice. Choose compatible-only to leave them out.':'All questions are compatible.';$('compatible-only').checked=false;}
 $('copy-test').onclick=async()=>{try{tests=await api('/tests');$('copy-source').replaceChildren();for(const t of tests){const o=el('option',t.title);o.value=t.id;$('copy-source').append(o);}if(!tests.length)throw new Error('There are no saved tests to copy.');$('copy-error').textContent='';copyInfo();$('copy-dialog').showModal();}catch(e){status(e.message,true);}};$('copy-source').onchange=copyInfo;$('copy-cancel').onclick=()=>$('copy-dialog').close();$('copy-form').onsubmit=async event=>{event.preventDefault();const submit=event.submitter;submit.disabled=true;try{await api('/games/from-test','POST',{testId:$('copy-source').value,compatibleOnly:$('compatible-only').checked});$('copy-dialog').close();await refresh();status('Independent game copy created.');}catch(e){$('copy-error').textContent=e.message;}finally{submit.disabled=false;}};
 try{api=await professor();await refresh();}catch(e){status(e.message,true);$('new-game').disabled=true;$('copy-test').disabled=true;}
})();
