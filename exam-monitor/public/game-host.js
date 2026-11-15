(function(root){
 'use strict';
 function createController({
  api,onView,onError=()=>{},onClose=()=>{},control=root.GameClassroomControl,
  stale=root.GameClient?.isOlderView||(()=>false),nextDelay=root.GameClient?.nextPollDelay||(()=>1000),setTimer=setTimeout,clearTimer=clearTimeout,
 }){
  let selected=null;
  const route=run=>'/game-sessions/'+encodeURIComponent(run.id);
  function stop(){
   if(!selected)return;
   clearTimer(selected.timer);selected.abort?.abort();selected.channel?.close();
   selected=null;
  }
  function show(run,view){
   if(run!==selected||view?.id!==run.id||stale(view,run.view))return;
   run.view=view;run.receivedAt=Date.now();
   if(!run.channel&&view.classroomControlKey){
    const channel=control.openChannel(run.id,view.classroomControlKey);
    if(channel){
     const relay=control.relay({
      current:()=>run===selected&&!run.busy?run.view:null,
      advance:payload=>api(route(run)+'/classroom-control','POST',payload),
     });
     run.channel=channel;
     channel.onmessage=async({data})=>{
      const reply=await relay(data);
      if(run===selected&&reply)control.send(channel,reply);
     };
    }
   }
   onView(view,run.busy);
  }
  async function poll(run){
   if(run!==selected)return;
   let failed=false;
   try{
    run.abort=new AbortController();
    const view=await api(route(run),'GET',undefined,{signal:run.abort.signal});
    show(run,view);
    if(run===selected)onError(null);
   }catch(error){
    failed=true;
    if(run!==selected)return;
    if([401,403,404,410].includes(error.status)){
     stop();
     onError(error,run.id,true);
     return;
    }
    onError(error,run.id);
   }finally{
    if(run===selected)run.timer=setTimer(()=>poll(run),failed?1000:nextDelay(run.view,run.receivedAt));
   }
  }
  function select(id,initial){
   stop();
   if(!id)return;
   const run=selected={id,view:null,busy:false};
   if(initial)show(run,initial);
   poll(run);
  }
  async function act(action,payload){
   const run=selected;
   if(!run?.view||run.busy)return;
   run.busy=true;onView(run.view,true);
   try{
    const next=await api(route(run)+'/'+action,'POST',payload);
    if(run!==selected)return;
    if(action==='close'){stop();onClose(run.id);return;}
    show(run,next);onError(null);
    return next;
   }catch(error){
    if(run===selected)onError(error,run.id);
   }finally{
    if(run===selected){run.busy=false;onView(run.view,false);}
   }
  }
  return {select,stop,get id(){return selected?.id;},
   advance:()=>selected?.view&&act('advance',{expectedPhase:selected.view.phase,questionIndex:selected.view.questionIndex}),
   recover:(code,playerId)=>act('recover',{code,playerId}),
   close:()=>act('close',{}),
  };
 }
 function displayHref(session,origin=root.location.origin){
  // Only a classroom URL on this deployment is eligible for a new window.
  for(const value of [session?.classroomControlUrl,session?.displayUrl]){
   if(!value)continue;
   try{
    const u=new URL(value,origin);
    if(u.origin===origin&&u.pathname==='/game-display.html'&&u.hash)return u.href;
   }catch{}
  }
  if(!session?.id||!session.displayToken)return '';
  const tokens=[session.id,session.displayToken];
  if(session.classroomControlKey)tokens.push(session.classroomControlKey);
  return new URL('/game-display.html#'+tokens.map(encodeURIComponent).join('/'),origin).href;
 }
 function mount({api,onEnded=()=>{},onUnavailable=()=>{},onPresented=()=>{}}){
  const {$,el,render}=root.GameClient;
  const panel=$('game-host-panel'),display=$('display-link'),advance=$('advance'),end=$('close-game'),
   hostStatus=$('host-status'),recovery=$('recovery'),control=root.GameClassroomControl;
  let recoveryFingerprint,visibleId,resumeId;
  function showStatus(message='',error=false){
   hostStatus.textContent=message;hostStatus.classList.toggle('error',error);
  }
  const controller=createController({
   api,onView(view,busy){
    render(view);
    const url=displayHref(view);display.hidden=!url;
    if(url)display.href=url;
    const next=control.actionLabel(view);
    advance.textContent=next||({intro:'Get ready…','responses-closed':'Responses closed',podium:'Final results'}[view.phase]||'Question in progress');advance.disabled=!next||busy;end.disabled=busy;
    const players=view.players||[],requests=view.recoveryRequests||[];
    const nextFingerprint=JSON.stringify([view.id,requests,players.map(p=>({id:p.id,nickname:p.nickname}))]);
    recovery.closest('.recovery-panel').hidden=!requests.length;
    if(nextFingerprint!==recoveryFingerprint){
     recoveryFingerprint=nextFingerprint;recovery.replaceChildren();
     for(const item of requests){
      const row=el('div',undefined,'recovery-item');row.append(el('strong',item.code+' · '+item.nickname));
      const select=el('select');select.setAttribute('aria-label','Original player for recovery '+item.code);
      const placeholder=el('option','Choose original player');placeholder.value='';select.append(placeholder);
      for(const p of players){const option=el('option',p.nickname+' · '+p.score+' pts');option.value=p.id;select.append(option);}
      const restore=el('button','Restore player');restore.type='button';
      restore.onclick=async()=>{
       if(!select.value){showStatus('Select the original player.',true);return;}
       if(!root.confirm('Restore this player on the new device? The old device will lose access.'))return;
       if(await controller.recover(item.code,select.value))showStatus('Player restored. Ask them to keep their recovery page open.');
      };
      row.append(select,restore);recovery.append(row);
     }
    }
    recovery.querySelectorAll('button').forEach(button=>{button.disabled=busy;});
    onPresented(view);
   },
   onError(error,id,terminal){
    if(!error){if(hostStatus.classList.contains('error'))showStatus();return;}
    if(terminal){
     showStatus([404,410].includes(error.status)?'This game has ended or expired.':error.message,true);
     resetControls();render({id,phase:'closed',title:'Game unavailable'});visibleId=null;
     onUnavailable(id,error);
    }else showStatus(error.message,true);
   },
   onClose(id){visibleId=null;panel.hidden=true;onEnded(id);},
  });
  function resetControls(){
   display.hidden=true;display.removeAttribute('href');advance.disabled=end.disabled=true;
   advance.textContent='Connecting…';
   recoveryFingerprint=null;recovery.replaceChildren();recovery.closest('.recovery-panel').hidden=true;
  }
  function select(id,initial){
   if(controller.id===id&&id)return;
   visibleId=id;
   panel.hidden=!id;
   showStatus();resetControls();
   if(id){
    if(!initial){$('stage').replaceChildren();$('phase').textContent='Connecting…';$('game-title').textContent='Live quiz';$('round-timer').hidden=true;}
    controller.select(id,initial);
   }else controller.stop();
  }
  advance.onclick=()=>controller.advance();
  end.onclick=()=>{
   if(root.confirm('End this game and clear its temporary scores and players? This cannot be undone.'))controller.close();
  };
  root.addEventListener('pagehide',()=>{resumeId=visibleId;controller.stop();});
  root.addEventListener('pageshow',event=>{if(event.persisted&&resumeId)controller.select(resumeId);});
  return {select,showStatus,get id(){return visibleId;}};
 }
 const host={createController,displayHref,mount};
 if(typeof module!=='undefined'&&module.exports)module.exports=host;
 if(!root.document)return;
 root.GameHost=host;
 // Bookmarked legacy host pages still work, but Launch never opens them.
 if(root.document.body.classList.contains('game-stage-host')){
  const {$,professor,status}=root.GameClient;
  const id=new URLSearchParams(root.location.search).get('session');
  if(!id)status('Choose a game from the Game Library first.',true);
  else professor().then(api=>mount({api,onEnded:()=>root.location.replace('/game-library.html')}).select(id)).catch(error=>status(error.message,true));
 }
})(typeof window==='undefined'?globalThis:window);
