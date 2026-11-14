(function(root){
  const uid=()=>globalThis.crypto.randomUUID();
  function newQuestion(){return {id:uid(),type:'mc',text:'',durationSeconds:20,options:Array.from({length:4},()=>({id:uid(),text:''})),correctOptionId:''};}
  function secondsLeft(deadline,serverNow,receivedAt,now=Date.now()){return Math.max(0,Math.ceil((deadline-serverNow-(now-receivedAt))/1000));}
  function roundTime(view, receivedAt, now) {
    const {phase, startsAt, deadlineAt, serverNow} = view;
    if (!['countdown','question'].includes(phase) ||
        ![startsAt, deadlineAt, serverNow].every(Number.isFinite) || deadlineAt <= startsAt) return null;
    const prep = phase === 'countdown';
    const duration = prep ? 5000 : deadlineAt - startsAt;
    const remaining = Math.min(duration, Math.max(0, (prep ? startsAt : deadlineAt) - serverNow - (now - receivedAt)));
    return {seconds: Math.ceil(remaining / 1000), progress: remaining / duration,
      urgent: !prep && remaining <= 5000, label: prep ? 'READING TIME' : 'SECONDS LEFT'};
  }
  function resumeRecord(storage,id,generate=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('')){
    const key='examio-game:'+id;let record;try{record=JSON.parse(storage.getItem(key));}catch{}
    if(!record||typeof record.resumeToken!=='string'||record.resumeToken.length<32){record={resumeToken:generate()};storage.setItem(key,JSON.stringify(record));}return record;
  }
  function mediaSource(media){if(!media||!['image','audio','video','youtube'].includes(media.type))return null;if(media.type==='image'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(media.url))return media.url;try{const u=new URL(media.url);if(u.protocol!=='https:'||u.username||u.password)return null;if(media.type==='youtube'){if(!['youtube.com','www.youtube.com'].includes(u.hostname)||u.pathname!=='/watch')return null;const id=u.searchParams.get('v');return /^[A-Za-z0-9_-]{11}$/.test(id||'')?'https://www.youtube-nocookie.com/embed/'+id:null;}return u.href;}catch{return null;}}
  function forgetExpiredSession(storage,id,status){if(!id||![404,410].includes(status))return false;storage.removeItem('examio-game:'+id);return true;}
  function requestInit(body,headers={},method=body===undefined?'GET':'POST',{signal}={}){
    const multipart=typeof root.FormData==='function'&&body instanceof root.FormData;
    return {method,headers:body===undefined||multipart?headers:{'Content-Type':'application/json',...headers},
      body:body===undefined||multipart?body:JSON.stringify(body),...(signal?{signal}:{})};
  }
  const symbols = [['▲','triangle'],['◆','diamond'],['●','circle'],['■','square'],['★','star']];
  const phaseOrder = ['lobby','media','countdown','question','reveal','leaderboard','podium','closed'];
  function choiceSlots(count) {
    if (!Number.isInteger(count) || count < 2 || count > symbols.length) return [];
    return symbols.slice(0,count).map(([symbol,name],slot)=>({symbol,slot,label:'Choice '+String.fromCharCode(65+slot)+', '+name}));
  }
  function resultKind(view) {
    if (view.answer?.correct === true) return 'correct';
    if (view.answer?.correct === false) return 'wrong';
    return view.roundEndReason === 'timeout' ? 'timeout' : 'unanswered';
  }
  function isOlderView(next, previous) {
    if (!previous || previous.id !== next.id || next.phase === 'closed') return false;
    if (previous.phase === 'closed' || next.serverNow < previous.serverNow ||
        next.questionIndex < previous.questionIndex) return true;
    if (next.questionIndex !== previous.questionIndex) return false;
    return phaseOrder.indexOf(next.phase) < phaseOrder.indexOf(previous.phase) ||
      (next.phase === 'question' && previous.answered === true && next.answered === false);
  }
  function priorRows(rows) {
    return [...rows].sort((a,b)=>(a.previousRank ?? a.rank)-(b.previousRank ?? b.rank) ||
      a.nickname?.localeCompare(b.nickname || '') || 0);
  }
  function nextPollDelay(view, receivedAt, now=Date.now()) {
    const boundary = view?.phase === 'countdown' ? view.startsAt : view?.phase === 'question' ? view.deadlineAt : null;
    if (!Number.isFinite(boundary) || !Number.isFinite(view?.serverNow)) return 1000;
    return Math.max(150,Math.min(1000,boundary-view.serverNow-(now-receivedAt)+20));
  }
  const api={newQuestion,secondsLeft,roundTime,resumeRecord,mediaSource,forgetExpiredSession,requestInit,
    choiceSlots,resultKind,isOlderView,priorRows,nextPollDelay};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root.document)return;
  const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const status=(text,error=false)=>{$('status').textContent=text||'';$('status').classList.toggle('error',error);};
  async function json(url,body,headers,method,options){const response=await fetch(url,requestInit(body,headers,method,options));let data;try{data=await response.json();}catch{throw new Error('Unable to reach Examio. Please retry.');}if(!response.ok)throw Object.assign(new Error(data.error||'Request failed'),{status:response.status});return data;}
  async function professor(){const config=await json('/api/config');if(!config.supabaseUrl||!config.supabaseKey)throw new Error('Sign-in is not configured.');const preferences=window.createExamioSessionPreferences(config.supabaseUrl);const auth=window.createOnScreenAuth(config.supabaseUrl,config.supabaseKey,{auth:{flowType:'pkce',persistSession:true,storage:preferences.storage}});const session=(await auth.auth.getSession()).data.session;if(!session){$('signin').hidden=false;throw new Error('Sign in to your professor account, then return to Games.');}const call=async(path,method='GET',body,options)=>{const token=(await auth.auth.getSession()).data.session?.access_token;if(!token){$('signin').hidden=false;throw Object.assign(new Error('Please sign in again.'),{status:401});}return json('/api'+path,body,{Authorization:'Bearer '+token},method,options);};call.config=Object.freeze({aiConfigured:config.aiConfigured===true,uploadMaxBytes:config.uploadMaxBytes});return call;}
  function button(text,fn,cls=''){const b=el('button',text,cls);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status(e.message,true);}finally{b.disabled=false;}};return b;}
  function picture(src,alt='Question image'){if(typeof src!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(src))return null;const img=el('img');img.src=src;img.alt=alt;img.className='question-image';return img;}
  function avatar(id, cls='player-avatar') {
    const img=el('img');img.src=GameAvatars.image(id);img.alt='';img.className=cls;
    img.decoding='async';return img;
  }
  const reduced=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const pointsText=value=>Number(value||0).toLocaleString()+' pts';
  const countEpoch=new WeakMap();
  function countUp(node, from, to, prefix='', suffix=' pts') {
    const epoch=(countEpoch.get(node)||0)+1;countEpoch.set(node,epoch);
    const show=n=>{node.textContent=prefix+Number(n).toLocaleString()+suffix;};
    if(!Number.isFinite(from)||!Number.isFinite(to)||from===to||reduced()||!root.requestAnimationFrame){show(to);return;}
    const start=performance.now();
    const frame=now=>{
      if (!node.isConnected||countEpoch.get(node)!==epoch) return;
      const ratio=Math.min(1,(now-start)/680);
      show(ratio===1?to:Math.round(from+(to-from)*(1-(1-ratio)**3)));
      if(ratio<1)root.requestAnimationFrame(frame);
    };
    show(from);
    root.requestAnimationFrame(frame);
  }
  function leaderboard(view) {
    const box=el('div',undefined,'rankings'),list=el('ol');
    (view.leaderboard||[]).forEach(p=>{
      const row=el('li',undefined,p.rank<=3?'top-rank':'');row.dataset.player=p.id;
      row.append(el('span',String(p.rank),'rank'),avatar(p.avatarId),el('strong',p.nickname),el('span',pointsText(p.score),'points'));
      list.append(row);
    });
    box.append(list);return box;
  }
  function animateBoard(board,rows) {
    if(reduced())return;
    const list=board.querySelector('ol'),nodes=new Map([...list.children].map(row=>[row.dataset.player,row]));
    const old=priorRows(rows),before=new Map();
    old.forEach(p=>list.append(nodes.get(p.id)));
    old.forEach(p=>before.set(p.id,nodes.get(p.id).getBoundingClientRect().top));
    rows.forEach(p=>list.append(nodes.get(p.id)));
    rows.forEach(p=>{
      const row=nodes.get(p.id),dy=before.get(p.id)-row.getBoundingClientRect().top;
      if(dy)row.animate?.([{transform:'translateY('+dy+'px)'},{transform:'translateY(0)'}],{duration:650,easing:'cubic-bezier(.22,.78,.22,1)'});
      countUp(row.querySelector('.points'),p.previousScore,p.score);
    });
  }
  let clock,lastRender,lastView;
  function runRoundClock(view, stage) {
    const timer=$('round-timer');
    if(!timer)return;
    const receivedAt=performance.now(),prep=view.phase==='countdown';
    timer.hidden=!roundTime(view,receivedAt,receivedAt);
    if(timer.hidden)return;
    const value=timer.querySelector('.round-timer-value'),label=timer.querySelector('.round-timer-label');
    let previousSeconds;
    const update=()=>{
      const time=roundTime(view,receivedAt,performance.now());
      if(previousSeconds!==time.seconds){
        previousSeconds=time.seconds;value.textContent=time.seconds;label.textContent=time.label;
        timer.setAttribute('aria-label',prep?'Reading time: '+time.seconds+' seconds':time.seconds+' seconds left');
      }
      timer.style.setProperty('--remaining',time.progress);timer.dataset.urgent=String(time.urgent);
      if(time.seconds>0)return false;
      clearInterval(clock);
      if(!prep)stage.querySelectorAll('button.choice').forEach(button=>{button.disabled=true;button.dataset.expired='true';});
      return true;
    };
    if(!update())clock=setInterval(update,50);
  }
  function appendPrompt(stage,q) {
    if(!q)return;
    stage.append(el('h2',q.text,'question-text'));
    const img=picture(q.image);if(img)stage.append(img);
  }
  function mediaStage(stage,view,isPlayer) {
    if(isPlayer){stage.append(el('h2','Look at the classroom screen'));return;}
    const source=mediaSource(view.media);
    if(!source){stage.append(el('p','Media is unavailable. You can continue to the question.'));return;}
    const type=view.media.type,node=el(type==='youtube'?'iframe':type==='image'?'img':type);
    node.src=source;node.className='game-media';
    if(type==='image')node.alt='Review material before the question';
    if(['audio','video'].includes(type)){node.controls=true;node.preload='metadata';}
    if(type==='youtube'){node.title='YouTube review video';node.allow='encrypted-media; fullscreen; picture-in-picture';node.referrerPolicy='strict-origin-when-cross-origin';node.allowFullscreen=true;}
    stage.append(node);
  }
  function lobby(stage,view,isPlayer) {
    if(isPlayer){
      const card=el('div',undefined,'player-result');
      card.append(el('h2',"You're in!"),avatar(view.avatarId,'player-avatar feature-avatar'),el('strong',view.nickname,'result-detail'));
      stage.append(card);return;
    }
    stage.append(el('h2','Waiting for the teacher to start'),el('p',(view.players||[]).length+' players connected'));
    const roster=el('div',undefined,'roster');
    for(const p of view.players||[]){
      const item=el('span',undefined,'roster-player');
      item.append(avatar(p.avatarId),el('span',p.nickname+(p.connected?'':' · reconnecting')));roster.append(item);
    }
    stage.append(roster);
  }
  function choices(stage,view,answer) {
    const q=view.question,isPlayer=Boolean(answer);
    const slots=choiceSlots(isPlayer?q?.slotCount:q?.options?.length);
    if(!slots.length)return;
    const grid=el('div',undefined,'choices'+(isPlayer?' controller-choices':''));grid.dataset.slots=slots.length;
    for(const {slot,symbol,label} of slots){
      const item=el(isPlayer?'button':'div',undefined,'choice choice-'+slot);
      const shape=el('span',symbol,'choice-symbol');shape.setAttribute('aria-hidden','true');item.append(shape);
      if(isPlayer){
        item.type='button';item.setAttribute('aria-label',label);item.disabled=view.answered||view.serverNow>=view.deadlineAt;
        item.onclick=async()=>{
          if(item.disabled)return;
          item.disabled=true;
          try{await answer(view.questionIndex,slot);}
          finally{if(item.isConnected&&!item.dataset.expired)item.disabled=Boolean(view.answered);}
        };
        if(view.answer?.slot===slot)item.classList.add('chosen');
      }else{
        const opt=q.options[slot];item.append(el('span',opt.text,'choice-text'));
        const img=picture(opt.image,'Answer choice image');if(img)item.append(img);
        if(view.phase==='reveal'&&opt.id===q.correctOptionId){
          item.classList.add('correct');item.append(el('strong','Correct','correct-label'));
        }
      }
      grid.append(item);
    }
    stage.append(grid);
    if(isPlayer&&view.answered)stage.append(el('p','Answer received','answer-feedback controller-confirmed'));
  }
  function voteChart(q,animated) {
    const chart=el('ul',undefined,'vote-chart'+(animated?' animated-chart':''));
    chart.setAttribute('aria-label','Class votes by answer choice');
    const counts=q.options.map(o=>q.counts?.[o.id]||0),max=Math.max(1,...counts);
    choiceSlots(counts.length).forEach(({slot,symbol,label})=>{
      const count=counts[slot],option=q.options[slot],correct=option.id===q.correctOptionId;
      const bar=el('li',undefined,'vote-column choice-'+slot);
      bar.setAttribute('aria-label',label+': '+count+' '+(count===1?'vote':'votes')+(correct?', correct answer':''));
      const shape=el('span',symbol,'vote-symbol');shape.setAttribute('aria-hidden','true');
      const countLabel=el('strong',String(count),'vote-count');
      const fill=el('span',undefined,'vote-fill');fill.setAttribute('aria-hidden','true');fill.style.setProperty('--vote-share',count/max);
      const slotLabel=el('span',String.fromCharCode(65+slot)+(correct?' ✓':''),'vote-letter');
      bar.append(countLabel,fill,shape,slotLabel);chart.append(bar);
    });
    return chart;
  }
  function playerResult(view) {
    const phase=view.phase,kind=resultKind(view),card=el('div',undefined,'player-result');
    card.dataset.result=phase==='podium'?'final':kind;
    const config={correct:['Correct!','M7 13l3 3 7-8'],wrong:['Wrong answer','M8 8l8 8m0-8l-8 8'],
      timeout:["Time’s up!",'M12 5a7 7 0 1 0 .001 14A7 7 0 0 0 12 5zm0 3v4l2.5 1.5M10 3h4'],
      unanswered:['No answer received','M9 12h6']};
    const [caption,icon]=config[kind];
    if(phase==='podium'){
      card.append(el('h2','Game complete!'),avatar(view.avatarId,'player-avatar feature-avatar'),el('strong','Final place: #'+view.rank,'result-detail'));
      return card;
    }
    const badge=el('span',undefined,'result-badge');badge.setAttribute('aria-hidden','true');
    const ns='http://www.w3.org/2000/svg',mark=document.createElementNS(ns,'svg'),stroke=document.createElementNS(ns,'path');
    mark.setAttribute('viewBox','0 0 24 24');stroke.setAttribute('d',icon);mark.append(stroke);badge.append(mark);
    card.append(el('h2',caption),badge,avatar(view.avatarId,'player-avatar feature-avatar'));
    if(phase==='leaderboard')card.append(el('strong','Your place: #'+view.rank,'result-detail'));
    else card.append(el('strong',kind==='correct'?'+'+Number(view.answer.points||0).toLocaleString()+' pts':'Keep going!','result-detail'));
    return card;
  }
  function podium(stage,view,animated) {
    const ceremony=el('div',undefined,'podium'+(animated?' staged-podium':''));
    const beams=el('div',undefined,'celebration-beams');beams.setAttribute('aria-hidden','true');
    beams.append(el('span'),el('span'),el('span'));
    stage.append(beams,el('h2','Well played, everyone!','podium-heading'));
    const winners=(view.leaderboard||[]).filter(p=>p.rank<=3);
    const distinctRanks=[...new Set(winners.map(p=>p.rank))].sort((a,b)=>b-a);
    for(const p of winners){
      const winner=el('div',undefined,'podium-place');
      winner.dataset.place=p.rank;winner.style.setProperty('--entrance',distinctRanks.indexOf(p.rank)*600+'ms');
      winner.append(el('span',['1ST PLACE','2ND PLACE','3RD PLACE'][p.rank-1],'podium-label'),avatar(p.avatarId),el('p',p.nickname),el('strong',pointsText(p.score)));
      ceremony.append(winner);
    }
    stage.append(ceremony);
  }
  function render(view,{answer}={}) {
    const isPlayer=Boolean(answer),sameGame=lastView?.id===view.id;
    if(isOlderView(view,lastView))return;
    const changedPhase=!sameGame||lastView.phase!==view.phase||lastView.questionIndex!==view.questionIndex;
    const previous=lastView;
    const animate=Boolean(sameGame&&changedPhase&&!reduced());
    const fingerprint=JSON.stringify(view.phase==='media'?{id:view.id,phase:view.phase,questionIndex:view.questionIndex,media:view.media}
      :['countdown','question'].includes(view.phase)?{id:view.id,phase:view.phase,questionIndex:view.questionIndex,question:view.question,startsAt:view.startsAt,deadlineAt:view.deadlineAt,answered:view.answered,answer:view.answer,score:view.score}
      :!isPlayer&&['leaderboard','podium'].includes(view.phase)?{id:view.id,phase:view.phase,questionIndex:view.questionIndex,leaderboard:(view.leaderboard||[]).map(({connected,...row})=>row)}
      :!isPlayer&&view.phase==='reveal'?{id:view.id,phase:view.phase,questionIndex:view.questionIndex,question:view.question}
      :{...view,serverNow:0});
    lastView=view;
    if(fingerprint===lastRender)return;
    lastRender=fingerprint;clearInterval(clock);
    const stage=$('stage');stage.replaceChildren();stage.dataset.phase=view.phase;
    if(changedPhase) stage.dataset.transition=animate?'quick':'';
    else stage.dataset.transition='';
    if($('game-title'))$('game-title').textContent=view.title||'Live quiz';
    $('phase').textContent=isPlayer?(view.questionIndex>=0?'Question '+(view.questionIndex+1)+' / '+view.questionCount:'')
      :{lobby:'Ready to play?',media:'Watch & listen',countdown:'Question '+(view.questionIndex+1)+' of '+view.questionCount,question:'Question '+(view.questionIndex+1)+' of '+view.questionCount,reveal:'Class vote',leaderboard:'Leaderboard',podium:'Final results',closed:'Game ended'}[view.phase]||view.phase;
    const q=view.question;
    if(view.phase==='lobby')lobby(stage,view,isPlayer);
    if(view.phase==='media')mediaStage(stage,view,isPlayer);
    if(view.phase==='countdown'){
      if(isPlayer)stage.append(el('h2','Look at the classroom screen','ready-message'));
      else appendPrompt(stage,q);
    }
    if(view.phase==='question'){if(!isPlayer)appendPrompt(stage,q);choices(stage,view,answer);}
    if(view.phase==='reveal'&&!isPlayer&&q){
      appendPrompt(stage,q);stage.append(voteChart(q,animate));choices(stage,view,answer);
      if(q.answerExplanation)stage.append(el('p',q.answerExplanation,'explanation'));
    }
    if(isPlayer&&['reveal','leaderboard','podium'].includes(view.phase))stage.append(playerResult(view));
    if(!isPlayer&&view.phase==='podium')podium(stage,view,animate);
    if(!isPlayer&&['leaderboard','podium'].includes(view.phase)){
      const board=leaderboard(view);stage.append(board);
      if(animate&&view.phase==='leaderboard')animateBoard(board,view.leaderboard||[]);
    }
    if(view.phase==='closed')stage.append(el('h2','Thanks for playing!'));
    if($('score')&&view.score!==undefined){
      const score=$('score');
      if(isPlayer&&animate&&view.phase==='leaderboard')countUp(score,view.previousScore??previous.score,view.score);
      else countUp(score,view.score,view.score);
    }
    runRoundClock(view,stage);
  }
  Object.assign(api,{$,el,status,json,professor,button,picture,render,leaderboard});root.GameClient=api;
})(typeof window==='undefined'?globalThis:window);
