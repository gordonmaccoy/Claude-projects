(async()=>{
 const {$,status,json,render,resumeRecord,forgetExpiredSession,isOlderView,nextPollDelay}=GameClient;const params=new URLSearchParams(location.search);let id=params.get('session'),record=null,joined=false,recovering=false,polling=false,view=null,answerBusy=false,pollTimer,viewReceived=0,avatarDirty=false,avatarId=GameAvatars.ids[0];
 $('join-pin').value=params.get('pin')||'';if(id){$('join-pin-label').hidden=true;$('join-pin').required=false;}
 function chooseAvatar(id){avatarId=id;for(const b of $('avatar-picker').children){b.setAttribute('aria-pressed',String(b.dataset.avatar===id));}}
 let pendingAvatar=null,previewOrigin=null;
 const preview=$('avatar-preview'),previewImage=$('avatar-preview-image');
 function previewAvatar(id,index,origin){
  pendingAvatar=id;previewOrigin=origin;
  previewImage.src=GameAvatars.image(id);
  $('avatar-preview-name').textContent=GameAvatars.names[index];
  preview.showModal();$('avatar-preview-confirm').focus();
 }
 $('avatar-preview-back').onclick=()=>preview.close();
 $('avatar-preview-confirm').onclick=()=>{if(pendingAvatar){chooseAvatar(pendingAvatar);avatarDirty=true;}preview.close();};
 preview.addEventListener('close',()=>{pendingAvatar=null;previewImage.removeAttribute('src');previewOrigin?.focus();previewOrigin=null;});
 for(const [index,id] of GameAvatars.ids.entries()){
  const b=document.createElement('button');b.type='button';b.dataset.avatar=id;
  b.setAttribute('aria-label',GameAvatars.names[index]);b.title=GameAvatars.names[index];
  b.setAttribute('aria-pressed',String(id===avatarId));b.setAttribute('aria-haspopup','dialog');
  const img=document.createElement('img');img.src=GameAvatars.still?.(id)||GameAvatars.image(id);img.alt='';img.decoding='async';
  b.append(img);b.onclick=()=>previewAvatar(id,index,b);$('avatar-picker').append(b);
 }

 function clearExpired(error){if(forgetExpiredSession(localStorage,id,error.status)){record=null;joined=false;recovering=false;clearTimeout(pollTimer);$('score').textContent='';$('join-form-section').hidden=true;$('play-area').hidden=false;render({id,phase:'closed',title:'Game ended'},{answer});const link=document.createElement('a');link.href='/game-player.html';link.textContent='Join another game';$('stage').append(link);return true;}return false;}
 function save(){localStorage.setItem('examio-game:'+id,JSON.stringify(record));}
 async function resolve(){if(!id){const result=await json('/game-api/resolve',{pin:$('join-pin').value.trim()});id=result.sessionId;history.replaceState(null,'','/game-player.html?session='+encodeURIComponent(id));$('join-pin-label').hidden=true;$('join-pin').required=false;}if(!record){record=resumeRecord(localStorage,id);if(record.avatarId&&!avatarDirty)chooseAvatar(record.avatarId);if(record.nickname&&!$('nickname').value)$('nickname').value=record.nickname;}return id;}
 const payload=()=>({playerId:record.playerId,resumeToken:record.resumeToken});
 function show(next){if(isOlderView(next,view))return;view=next;viewReceived=Date.now();document.body.classList.add('is-playing');if(next.avatarId&&record.avatarId!==next.avatarId){record.avatarId=next.avatarId;save();}joined=true;recovering=false;$('join-form-section').hidden=true;$('play-area').hidden=false;render(view,{answer});}
 async function join(){await resolve();record.nickname=$('nickname').value.trim()||record.nickname;record.avatarId=avatarId;if(!record.nickname)throw new Error('Enter a nickname.');save();const result=await json('/game-api/'+encodeURIComponent(id)+'/join',{nickname:record.nickname,resumeToken:record.resumeToken,avatarId:record.avatarId});record.playerId=result.playerId;record.resumeToken=result.resumeToken||record.resumeToken;save();show(result.view);status('');}
 async function answer(questionIndex,slot){if(answerBusy||view?.answered||view?.phase!=='question'||view.questionIndex!==questionIndex)return;answerBusy=true;try{const result=await json('/game-api/'+encodeURIComponent(id)+'/answer',{...payload(),questionIndex,slot});show(result.view);status('');}catch(e){if(clearExpired(e)){status('This game has ended or expired.',true);return;}status('Answer not confirmed: '+e.message+' You may retry while time remains.',true);}finally{answerBusy=false;}}
 async function poll(){clearTimeout(pollTimer);if(polling)return;polling=true;let nextDelay;try{if(recovering){await join();$('recovery-code').textContent='Score restored!';}else if(joined){show(await json('/game-api/'+encodeURIComponent(id)+'/state',payload()));status('');}}catch(e){nextDelay=e.status===429?5000:1000;if(clearExpired(e)){status('This game has ended or expired.',true);return;}if(recovering){/* Teacher has not approved yet. Keep the recovery code visible. */}else if([401,403].includes(e.status)){joined=false;document.body.classList.remove('is-playing');$('play-area').hidden=true;$('join-form-section').hidden=false;status('This device no longer has access. Ask your teacher about score recovery.',true);}else status('Connection interrupted. Reconnecting; your earned score is kept.',true);}finally{polling=false;if(joined||recovering)pollTimer=setTimeout(poll,nextDelay??nextPollDelay(view,viewReceived));}}
 $('join-form').onsubmit=async event=>{event.preventDefault();const submit=event.submitter;submit.disabled=true;try{await join();if(!polling)poll();}catch(e){clearExpired(e);status(e.message,true);}finally{submit.disabled=false;}};
 $('recover').onclick=async()=>{try{await resolve();const nickname=$('nickname').value.trim();if(!nickname)throw new Error('Enter your original nickname first.');record.nickname=nickname;save();const result=await json('/game-api/'+encodeURIComponent(id)+'/recovery',{nickname,resumeToken:record.resumeToken});$('recovery-code').textContent='Tell your teacher this recovery code: '+result.code+'. Keep this page open.';recovering=true;poll();}catch(e){clearExpired(e);status(e.message,true);}};
 try{if(id){await resolve();if(record.playerId&&record.nickname){await join();poll();}}}catch(e){clearExpired(e);status(e.message,true);}
})();
