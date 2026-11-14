(async()=>{
 const {$,el,status,professor,button,render}=GameClient;const id=new URLSearchParams(location.search).get('session');let api,view,busy=false,stopped=false,recoveryFingerprint;
 if(!id){status('Choose a game from the Game Library first.',true);return;}
 // Relay through the authenticated host. The display never receives an account token.
 let controlChannel;
 const handleControl = GameClassroomControl.relay({
  current: () => stopped || !api ? null : view,
  advance: payload => api('/game-sessions/'+encodeURIComponent(id)+'/classroom-control','POST',payload),
 });
 function initializeControl(key) {
  if(controlChannel || typeof key!=='string')return;
  controlChannel=GameClassroomControl.openChannel(id,key);
  if(!controlChannel)return;
  controlChannel.onmessage=async({data})=>{const reply=await handleControl(data);if(reply)GameClassroomControl.send(controlChannel,reply);};
 }
 function closeControl(){controlChannel?.close();controlChannel=null;}
 addEventListener('pagehide',closeControl);
 function show(next){view=next;initializeControl(view.classroomControlKey);render(view);$('display-link').href=view.classroomControlUrl||view.displayUrl||'/game-display.html#'+encodeURIComponent(id)+'/'+encodeURIComponent(view.displayToken);$('advance').textContent={lobby:'Start game',media:'Start question',reveal:'Show leaderboard',leaderboard:view.questionIndex+1>=view.questionCount?'Show podium':'Next question'}[view.phase]||'Question in progress';$('advance').disabled=!['lobby','media','reveal','leaderboard'].includes(view.phase)||busy;const recoveryNext=JSON.stringify({requests:view.recoveryRequests,players:view.players.map(p=>({id:p.id,nickname:p.nickname}))});if(recoveryNext===recoveryFingerprint)return;recoveryFingerprint=recoveryNext;$('recovery').replaceChildren();document.querySelector('.recovery-panel').hidden=!view.recoveryRequests?.length;for(const request of view.recoveryRequests||[]){const row=el('div',undefined,'recovery-item');row.append(el('strong',request.code+' · '+request.nickname));const select=el('select');select.setAttribute('aria-label','Original player for recovery '+request.code);const placeholder=el('option','Choose original player');placeholder.value='';select.append(placeholder);for(const p of view.players){const option=el('option',p.nickname+' · '+p.score+' pts');option.value=p.id;select.append(option);}row.append(select,button('Restore player',async()=>{if(!select.value)throw new Error('Select the original player.');if(!confirm('Restore this player on the new device? The old device will lose access.'))return;show(await api('/game-sessions/'+encodeURIComponent(id)+'/recover','POST',{code:request.code,playerId:select.value}));status('Player restored. Ask them to keep their recovery page open.');}));$('recovery').append(row);}}
 $('advance').onclick=async()=>{if(busy)return;busy=true;$('advance').disabled=true;try{show(await api('/game-sessions/'+encodeURIComponent(id)+'/advance','POST',{expectedPhase:view.phase,questionIndex:view.questionIndex}));status('');}catch(e){status(e.message,true);}finally{busy=false;if(view)show(view);}};
 $('close-game').onclick=async()=>{if(!confirm('End this game and clear its temporary scores and players? This cannot be undone.'))return;try{await api('/game-sessions/'+encodeURIComponent(id)+'/close','POST',{});stopped=true;closeControl();location.href='/game-library.html';}catch(e){status(e.message,true);}};
 async function poll(){if(stopped)return;try{show(await api('/game-sessions/'+encodeURIComponent(id)));}catch(e){status(e.status===404?'This game has ended or expired. Return to the Game Library.':e.message,true);if([401,403,404,410].includes(e.status)){stopped=true;closeControl();}}finally{if(!stopped)setTimeout(poll,1000);}}
 try{api=await professor();await poll();}catch(e){status(e.message,true);}
})();
