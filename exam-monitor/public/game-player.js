(async()=>{
 const {$,status,json,render,resumeRecord,forgetExpiredSession,isOlderView,nextPollDelay}=GameClient;const params=new URLSearchParams(location.search);let id=params.get('session'),record=null,joined=false,recovering=false,polling=false,view=null,answerBusy=false,pollTimer,viewReceived=0,avatarId=null;
 $('join-pin').value=params.get('pin')||'';if(id){$('join-pin-label').hidden=true;$('join-pin').required=false;}
 const picker=$('avatar-picker'),joinSubmit=$('join-submit'),preview=$('avatar-preview'),previewImage=$('avatar-preview-image');
 let lobby=null,taken=new Set(),pickerPage=0,pickerRendered='',lobbyTimer,pendingAvatar=null,previewOrigin=null,joining=false,lobbyBusy=false,lobbyError='';
 const assetName=avatar=>GameAvatars.names[GameAvatars.ids.indexOf(avatar)];
 const requireNames=()=>lobby?.requireNames!==false;
 function previewAvatar(avatar,origin){
  if(taken.has(avatar))return;
  pendingAvatar=avatar;previewOrigin=origin;
  GameAvatars.setSprite(previewImage,avatar,{celebrate:true});
  $('avatar-preview-name').textContent=assetName(avatar);
  $('avatar-preview-confirm').disabled=false;preview.showModal();$('avatar-preview-confirm').focus();
 }
 function drawPicker(){
  if(!lobby||joined||recovering)return;
  const large=lobby.largeClass;
  if(!large)pickerPage=0;
  const start=pickerPage===0?0:30,end=pickerPage===0?30:50,signature=start+':'+end;
  const isOpen=lobby.phase==='lobby';
  if(signature!==pickerRendered){
   const buttons=GameAvatars.ids.slice(start,end).map(avatar=>{
    const b=document.createElement('button');b.type='button';b.dataset.avatar=avatar;b.setAttribute('aria-haspopup','dialog');
    const img=document.createElement('img');img.alt='';img.decoding='async';img.src=GameAvatars.still(avatar);img.loading='lazy';
    b.append(img);b.onclick=()=>previewAvatar(avatar,b);return b;
   });
   picker.replaceChildren(...buttons);pickerRendered=signature;
  }
  if(taken.has(avatarId))avatarId=null;
  for(const b of picker.children){
   const avatar=b.dataset.avatar,isTaken=taken.has(avatar),name=assetName(avatar);
   b.disabled=isTaken||!isOpen;b.title=name+(isTaken?' (taken)':'');
   b.setAttribute('aria-label',b.title);
   b.setAttribute('aria-pressed',String(avatar===avatarId));
   b.classList.toggle('is-taken',isTaken);
  }
  $('avatar-pages').hidden=!large||!isOpen;
  const pageLabel='Page '+(pickerPage+1)+' of 2';
  $('avatar-range').textContent=large?'Characters '+(start+1)+'–'+end+' of 50':'Choose from 30 characters';
  if($('avatar-page-label').textContent!==pageLabel)$('avatar-page-label').textContent=pageLabel;
  $('avatar-prev').disabled=pickerPage===0;$('avatar-next').disabled=pickerPage===1;
  const size=large?50:30,full=GameAvatars.ids.slice(0,size).filter(a=>taken.has(a)).length>=size;
  const choiceLabel=!isOpen?'This game has already started. You can still recover your score.':
   full?'All characters are taken. If you already joined, recover your score.':
   avatarId?'Selected: '+assetName(avatarId):'Select a character to continue.';
  if($('avatar-choice').textContent!==choiceLabel)$('avatar-choice').textContent=choiceLabel;
  $('avatar-field').hidden=false;
  joinSubmit.textContent="Let's play";joinSubmit.disabled=joining||!isOpen||full||!avatarId;
  if(preview.open&&pendingAvatar){
   const unavailable=taken.has(pendingAvatar)||!isOpen;
   $('avatar-preview-confirm').disabled=unavailable;
   $('avatar-preview-name').textContent=assetName(pendingAvatar)+(unavailable?' · Unavailable':'');
  }
 }
 function page(n){
  pickerPage=n;drawPicker();(n===0?$('avatar-next'):$('avatar-prev')).focus();
 }
 $('avatar-prev').onclick=()=>page(0);$('avatar-next').onclick=()=>page(1);
 $('avatar-preview-back').onclick=()=>preview.close();
 $('avatar-preview-confirm').onclick=()=>{if(pendingAvatar&&!taken.has(pendingAvatar)&&lobby?.phase==='lobby'){avatarId=pendingAvatar;drawPicker();}preview.close();};
 preview.addEventListener('close',()=>{pendingAvatar=null;previewImage.onerror=null;previewImage.removeAttribute('src');if(previewOrigin&&!previewOrigin.disabled)previewOrigin.focus();else picker.querySelector('button:not(:disabled)')?.focus();previewOrigin=null;});
 async function loadLobby(){
  clearTimeout(lobbyTimer);if(joined||recovering||lobbyBusy||!id)return;
  lobbyBusy=true;let delay=2600;
  try{
   lobby=await json('/game-api/'+encodeURIComponent(id)+'/lobby');
   if(joined||recovering)return;
   taken=new Set(lobby.takenAvatarIds);GameTeamPlayer.updateLobby(lobby);
   if(lobbyError&&$('status').textContent===lobbyError)status('');
   lobbyError='';$('nickname-label').hidden=!requireNames();$('nickname').required=requireNames();$('recover').hidden=false;drawPicker();
  }catch(e){delay=e.status===429?8000:3500;if(clearExpired(e))return;if(!lobby){lobbyError=e.message;status(e.message,true);}}
  finally{lobbyBusy=false;if(!joined&&!recovering&&id&&(!lobby||lobby.phase==='lobby'))lobbyTimer=setTimeout(loadLobby,delay);}
 }
 function clearExpired(error){if(forgetExpiredSession(localStorage,id,error.status)){record=null;joined=false;recovering=false;clearTimeout(pollTimer);clearTimeout(lobbyTimer);id=null;$('score').textContent='';$('join-form-section').hidden=true;$('play-area').hidden=false;render({id,phase:'closed',title:'Game ended'},{answer});const link=document.createElement('a');link.href='/game-player.html';link.textContent='Join another game';$('stage').append(link);return true;}return false;}
 function save(){localStorage.setItem('examio-game:'+id,JSON.stringify(record));}
 async function resolve(){if(!id){const result=await json('/game-api/resolve',{pin:$('join-pin').value.trim()});id=result.sessionId;history.replaceState(null,'','/game-player.html?session='+encodeURIComponent(id));$('join-pin-label').hidden=true;$('join-pin').required=false;}if(!record){record=resumeRecord(localStorage,id);if(record.nickname&&!$('nickname').value)$('nickname').value=record.nickname;}return id;}
 const payload=()=>({playerId:record.playerId,resumeToken:record.resumeToken});
 function show(next){if(isOlderView(next,view))return;view=next;viewReceived=Date.now();clearTimeout(lobbyTimer);document.body.classList.add('is-playing');if(next.avatarId&&record.avatarId!==next.avatarId){record.avatarId=next.avatarId;save();}joined=true;recovering=false;$('join-form-section').hidden=true;$('play-area').hidden=false;render(view,{answer});GameTeamPlayer.show(next,async name=>{const result=await json('/game-api/'+encodeURIComponent(id)+'/team',{...payload(),name});show(result.view);});}
 async function join(){
  await resolve();
  const body={resumeToken:record.resumeToken};
  // Reconnect and pending recovery must never create a new player.
  if(!record.playerId&&!recovering){
   if(requireNames()){body.nickname=$('nickname').value.trim();if(!body.nickname)throw new Error('Enter a nickname.');}
   body.avatarId=avatarId;Object.assign(body,GameTeamPlayer.selection());
  }
  const result=await json('/game-api/'+encodeURIComponent(id)+'/join',body);
  record.playerId=result.playerId;record.resumeToken=result.resumeToken||record.resumeToken;
  record.nickname=result.view.nickname||record.nickname;save();show(result.view);status('');
 }
 async function answer(questionIndex,slot){if(answerBusy||view?.answered||view?.phase!=='question'||view.questionIndex!==questionIndex)return;answerBusy=true;try{const result=await json('/game-api/'+encodeURIComponent(id)+'/answer',{...payload(),questionIndex,slot});show(result.view);status('');}catch(e){if(clearExpired(e)){status('This game has ended or expired.',true);return;}status('Answer not confirmed: '+e.message+' You may retry while time remains.',true);}finally{answerBusy=false;}}
 async function poll(){clearTimeout(pollTimer);if(polling)return;polling=true;let nextDelay;try{if(recovering){await join();$('recovery-code').textContent='Score restored!';}else if(joined){show(await json('/game-api/'+encodeURIComponent(id)+'/state',payload()));status('');}}catch(e){nextDelay=e.status===429?5000:1000;if(clearExpired(e)){status('This game has ended or expired.',true);return;}if(recovering){/* Teacher has not approved yet. Keep the recovery code visible. */}else if([401,403].includes(e.status)){joined=false;document.body.classList.remove('is-playing');$('play-area').hidden=true;$('join-form-section').hidden=false;status('This device no longer has access. Ask your teacher about score recovery.',true);loadLobby();}else status('Connection interrupted. Reconnecting; your earned score is kept.',true);}finally{polling=false;if(joined||recovering)pollTimer=setTimeout(poll,nextDelay??nextPollDelay(view,viewReceived));}}
 $('join-form').onsubmit=async event=>{
  event.preventDefault();if(joining||recovering)return;joining=true;joinSubmit.disabled=true;
  try{
   if(!lobby){await resolve();if(!record.playerId){await loadLobby();if(lobby)(requireNames()?$('nickname'):picker.querySelector('button:not(:disabled)'))?.focus();return;}}
   if(!record.playerId&&(!avatarId||taken.has(avatarId)))throw new Error('Choose a character that is not taken.');
   await join();if(!polling)poll();
  }catch(e){if(!clearExpired(e)){status(e.message,true);if(e.status===409)await loadLobby();}}
  finally{joining=false;if(lobby)drawPicker();else joinSubmit.disabled=!!id;}
 };
 const recoveryDialog=$('character-recovery'),recoverySelect=$('recovery-avatar'),recoveryError=$('character-recovery-error');
 async function requestRecovery(player){
  const result=await json('/game-api/'+encodeURIComponent(id)+'/recovery',{...player,resumeToken:record.resumeToken});
  $('recovery-code').textContent='Tell your teacher this recovery code: '+result.code+'. Keep this page open.';
  recovering=true;joinSubmit.disabled=true;poll();
 }
 $('recover').onclick=async()=>{
  try{
   if(recovering||!lobby)return;
   if(requireNames()){
    const nickname=$('nickname').value.trim();if(!nickname){$('nickname').focus();throw new Error('Enter your original nickname first.');}
    await requestRecovery({nickname});return;
   }
   const claimed=GameAvatars.ids.filter(avatar=>taken.has(avatar));
   if(!claimed.length)throw new Error('No players have joined this game yet.');
   const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose your character';
   recoverySelect.replaceChildren(placeholder,...claimed.map(avatar=>{const option=document.createElement('option');option.value=avatar;option.textContent=assetName(avatar);return option;}));
   recoverySelect.value=claimed.includes(record.avatarId)?record.avatarId:'';
   recoveryError.textContent='';recoveryDialog.showModal();recoverySelect.focus();
  }catch(e){if(e.status===410)clearExpired(e);status(e.message,true);}
 };
 $('cancel-character-recovery').onclick=()=>recoveryDialog.close();
 $('character-recovery-form').onsubmit=async event=>{
  event.preventDefault();const submit=$('request-character-recovery');
  if(submit.disabled||!taken.has(recoverySelect.value))return;
  submit.disabled=true;recoveryError.textContent='';
  try{await requestRecovery({avatarId:recoverySelect.value});recoveryDialog.close();}
  catch(e){recoveryError.textContent=e.message;}
  finally{submit.disabled=false;}
 };
 try{if(id||$('join-pin').value){joinSubmit.disabled=true;await resolve();if(record.playerId){await join();poll();}else await loadLobby();}}catch(e){if(!clearExpired(e)){status(e.message,true);if(id)await loadLobby();}}finally{if(lobby)drawPicker();else joinSubmit.disabled=!!id;}
})();
