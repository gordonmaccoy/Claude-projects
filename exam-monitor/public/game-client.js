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
  const phaseOrder = ['lobby','intro','media','countdown','question','responses-closed','reveal','leaderboard','podium','closed'];
  function choiceSlots(count) {
    if (!Number.isInteger(count) || count < 2 || count > symbols.length) return [];
    return symbols.slice(0,count).map(([symbol,name],slot)=>({symbol,slot,label:'Choice '+String.fromCharCode(65+slot)+', '+name}));
  }
  function sceneCopy(view) {
    if (view.phase === 'intro') return view.questionIndex === 0
      ? {kicker:'GAME START', heading:'Get ready!', detail:"Let’s begin!"}
      : {kicker:'NEXT ROUND', heading:'Get ready for question '+(view.questionIndex+1)+'!',detail:'Look at the classroom screen.'};
    if (view.phase === 'responses-closed') return {
      kicker:'ROUND COMPLETE', heading:'Responses closed', detail:'Answer breakdown coming up…'};
    return null;
  }
  function introArtwork(view){
    const n=view?.questionIndex;
    return view?.phase==='intro'&&Number.isInteger(n)&&n>=0&&n<25?'/game-intro/question-'+(n+1)+'.webp':null;
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
  const SCORE_DURATION_MS=1020;
  function scoreProgress(view,receivedAt,now=Date.now()){
    if(view?.phase!=='leaderboard'||![view.scoreStartsAt,view.serverNow].every(Number.isFinite))return 1;
    return Math.max(0,Math.min(1,(view.serverNow+Math.max(0,now-receivedAt)-view.scoreStartsAt)/SCORE_DURATION_MS));
  }
  function nextPollDelay(view, receivedAt, now=Date.now()) {
    const boundary = view?.phase === 'intro' ? view.introEndsAt : view?.phase === 'responses-closed' ? view.revealAt
      : view?.phase === 'countdown' ? view.startsAt : view?.phase === 'question' ? view.deadlineAt
      : view?.phase === 'leaderboard' ? (view.serverNow<view.scoreStartsAt?view.scoreStartsAt:
        view.serverNow<view.scoreEndsAt?view.scoreEndsAt:null)
      : view?.phase === 'podium' ? (view.podiumSchedule?.find(x=>x.at>view.serverNow)?.at ??
        (view.rankRevealAt>view.serverNow?view.rankRevealAt:null) ??
        (view.podiumCompleteAt>view.serverNow?view.podiumCompleteAt:null)) : null;
    if (!Number.isFinite(boundary) || !Number.isFinite(view?.serverNow)) return 1000;
    return Math.max(150,Math.min(1000,boundary-view.serverNow-(now-receivedAt)+20));
  }
  const api={newQuestion,secondsLeft,roundTime,resumeRecord,mediaSource,forgetExpiredSession,requestInit,
    choiceSlots,sceneCopy,introArtwork,resultKind,isOlderView,priorRows,nextPollDelay,scoreProgress,SCORE_DURATION_MS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root.document)return;
  const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const status=(text,error=false)=>{$('status').textContent=text||'';$('status').classList.toggle('error',error);};
  async function json(url,body,headers,method,options){const response=await fetch(url,requestInit(body,headers,method,options));let data;try{data=await response.json();}catch{throw new Error('Unable to reach Examio. Please retry.');}if(!response.ok)throw Object.assign(new Error(data.error||'Request failed'),{status:response.status});return data;}
  async function professor(){const config=await json('/api/config');if(!config.supabaseUrl||!config.supabaseKey)throw new Error('Sign-in is not configured.');const preferences=window.createExamioSessionPreferences(config.supabaseUrl);const auth=window.createOnScreenAuth(config.supabaseUrl,config.supabaseKey,{auth:{flowType:'pkce',persistSession:true,storage:preferences.storage}});const session=(await auth.auth.getSession()).data.session;if(!session){$('signin').hidden=false;throw new Error('Sign in to your professor account, then return to Games.');}const call=async(path,method='GET',body,options)=>{const token=(await auth.auth.getSession()).data.session?.access_token;if(!token){$('signin').hidden=false;throw Object.assign(new Error('Please sign in again.'),{status:401});}return json('/api'+path,body,{Authorization:'Bearer '+token},method,options);};call.config=Object.freeze({aiConfigured:config.aiConfigured===true,uploadMaxBytes:config.uploadMaxBytes});return call;}
  function button(text,fn,cls=''){const b=el('button',text,cls);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status(e.message,true);}finally{b.disabled=false;}};return b;}
  function picture(src,alt='Question image'){if(typeof src!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(src))return null;const img=el('img');img.src=src;img.alt=alt;img.className='question-image';return img;}
  function avatar(id, cls='player-avatar') {
    const img=el('img');img.src=cls.includes('feature-avatar')&&GameAvatars.feature ? GameAvatars.feature(id) : GameAvatars.image(id);img.alt='';img.className=cls;
    img.decoding='async';return img;
  }
  const reduced=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const warmedIntros=new Set();
  function warmNextArtwork(view){
    if(!root.Image||!['lobby','intro','media','countdown','question','responses-closed','reveal','leaderboard'].includes(view.phase))return;
    const next=view.phase==='lobby'?0:view.questionIndex+1;
    if(next>=view.questionCount)return;
    const src=introArtwork({phase:'intro',questionIndex:next});
    if(!src||warmedIntros.has(src))return;
    warmedIntros.add(src);
    const image=new root.Image();image.fetchPriority='low';image.src=src;
  }
  const pointsText=value=>Number(value||0).toLocaleString()+' pts';
  const countEpoch=new WeakMap();
  function countUp(node, from, to, timeline, prefix='', suffix=' pts') {
    const epoch=(countEpoch.get(node)||0)+1;countEpoch.set(node,epoch);
    const show=n=>{node.textContent=prefix+Number(n).toLocaleString()+suffix;};
    if(!timeline||!Number.isFinite(from)||!Number.isFinite(to)||from===to||reduced()||!root.requestAnimationFrame){show(to);return;}
    const frame=now=>{
      if (!node.isConnected||countEpoch.get(node)!==epoch) return;
      const ratio=scoreProgress(timeline.view,timeline.receivedAt,now);
      show(ratio===1?to:Math.round(from+(to-from)*(1-(1-ratio)**3)));
      if(ratio<1)root.requestAnimationFrame(frame);
    };
    frame(performance.now());
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
  function animateBoard(board,rows,timeline) {
    const progress=scoreProgress(timeline.view,timeline.receivedAt,performance.now());
    if(reduced()||progress>=1||!rows.some(p=>Number.isFinite(p.previousScore)))return;
    const list=board.querySelector('ol'),nodes=new Map([...list.children].map(row=>[row.dataset.player,row]));
    const old=priorRows(rows),before=new Map();
    old.forEach(p=>list.append(nodes.get(p.id)));
    old.forEach(p=>before.set(p.id,nodes.get(p.id).getBoundingClientRect().top));
    rows.forEach(p=>list.append(nodes.get(p.id)));
    rows.forEach(p=>{
      const row=nodes.get(p.id),dy=before.get(p.id)-row.getBoundingClientRect().top;
      if(dy)row.animate?.([{transform:'translateY('+dy+'px)'},{transform:'translateY(0)'}],{duration:SCORE_DURATION_MS,delay:-SCORE_DURATION_MS*progress,easing:'cubic-bezier(.22,.78,.22,1)'});
      countUp(row.querySelector('.points'),p.previousScore,p.score,timeline);
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
  function renderScene(stage,view) {
    const scene=sceneCopy(view),card=el('div',undefined,'game-scene');
    const end=view.phase==='intro'?view.introEndsAt:view.revealAt;
    const duration=view.phase==='intro'?2200:Math.max(1,end-view.roundEndedAt);
    const elapsed=Number.isFinite(end)&&Number.isFinite(view.serverNow)?Math.max(0,duration+view.serverNow-end):0;
    card.style.setProperty('--scene-elapsed',(-elapsed)+'ms');
    card.style.setProperty('--scene-duration',duration+'ms');
    const flare=el('span',undefined,'game-scene-flare');flare.setAttribute('aria-hidden','true');
    if(view.phase==='intro'){
      card.classList.add('illustrated-intro');
      const title=el('div',undefined,'intro-heading');
      title.append(el('p',scene.kicker,'game-scene-kicker'),el('h2',scene.heading),el('p',scene.detail,'game-scene-detail'));
      const number=el('span',String(view.questionIndex+1),'intro-number-fallback');
      const art=el('div',undefined,'intro-artwork');art.setAttribute('aria-hidden','true');art.append(number);
      const src=introArtwork(view);
      if(src){
        const img=el('img');img.alt='';img.decoding='async';
        img.addEventListener('load',()=>{number.hidden=true;},{once:true});
        img.addEventListener('error',()=>img.remove(),{once:true});
        img.src=src;art.append(img);
      }
      card.append(flare,title,art);
    }else card.append(flare,el('p',scene.kicker,'game-scene-kicker'),el('h2',scene.heading),el('p',scene.detail,'game-scene-detail'));
    stage.append(card);
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
    stage.append(el('h2','Waiting for game to start'),el('p',(view.players||[]).length+' players connected'));
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
    const panel=el('section',undefined,'vote-panel');
    const chart=el('ul',undefined,'vote-chart'+(animated?' animated-chart':''));
    const counts=q.options.map(o=>q.counts?.[o.id]||0),total=counts.reduce((sum,n)=>sum+n,0);
    const heading=el('div',undefined,'vote-heading');
    heading.append(el('h3','Answer breakdown'),el('span',total+' '+(total===1?'response':'responses')));
    chart.setAttribute('aria-label','Class votes by answer choice');
    choiceSlots(counts.length).forEach(({slot,label})=>{
      const count=counts[slot],option=q.options[slot],correct=option.id===q.correctOptionId;
      const bar=el('li',undefined,'vote-row choice-'+slot);
      bar.setAttribute('aria-label',label+': '+count+' '+(count===1?'vote':'votes')+(correct?', correct answer':''));
      const slotLabel=el('span',String.fromCharCode(65+slot),'vote-letter');
      const description=el('div',undefined,'vote-answer');
      description.append(el('span',option.text));
      const img=picture(option.image,'Answer choice image');if(img)description.append(img);
      if(correct){bar.classList.add('vote-correct');description.append(el('strong','✓ Correct','vote-key'));}
      const track=el('span',undefined,'vote-track'),fill=el('span',undefined,'vote-fill');
      track.setAttribute('aria-hidden','true');fill.style.setProperty('--vote-share',total?100*count/total+'%':'0%');track.append(fill);
      bar.append(slotLabel,description,track,el('strong',String(count),'vote-count'));chart.append(bar);
    });
    panel.append(heading,chart);return panel;
  }
  function playerResult(view) {
    const phase=view.phase,kind=resultKind(view),card=el('div',undefined,'player-result');
    card.dataset.result=phase==='podium'?'final':kind;
    const config={correct:['Correct!','M7 13l3 3 7-8'],wrong:['Wrong answer','M8 8l8 8m0-8l-8 8'],
      timeout:["Time’s up!",'M12 5a7 7 0 1 0 .001 14A7 7 0 0 0 12 5zm0 3v4l2.5 1.5M10 3h4'],
      unanswered:['No answer received','M9 12h6']};
    const [caption,icon]=config[kind];
    if(phase==='podium'){
      card.append(el('h2','Game complete!'),avatar(view.avatarId,'player-avatar feature-avatar'));
      const tile=el('div',undefined,'player-rank-tile');
      if(Number.isInteger(view.rank)){
        tile.dataset.place=String(view.rank);
        tile.append(el('span','Final place'),el('strong','#'+view.rank));
        if(Number.isFinite(view.score))tile.append(el('span',pointsText(view.score)));
      }else tile.append(el('span','Watch the classroom podium'));
      card.append(tile);
      return card;
    }
    const badge=el('span',undefined,'result-badge');badge.setAttribute('aria-hidden','true');
    const ns='http://www.w3.org/2000/svg',mark=document.createElementNS(ns,'svg'),stroke=document.createElementNS(ns,'path');
    mark.setAttribute('viewBox','0 0 24 24');stroke.setAttribute('d',icon);mark.append(stroke);badge.append(mark);
    card.append(el('h2',caption),badge,avatar(view.avatarId,'player-avatar feature-avatar'));
    if(phase==='leaderboard'&&(view.scoreStartsAt==null||view.serverNow>=view.scoreStartsAt)){
      if(kind==='correct'&&Number.isFinite(view.answer?.points)){
        const earned=el('strong','+'+view.answer.points.toLocaleString()+' pts','result-detail round-earned');
        earned.setAttribute('aria-live','off');card.append(earned);
      }
      card.append(el('span','Your place: #'+view.rank,'result-detail'));
    }
    else card.append(el('span',view.finalRound?'Watch the classroom podium':kind==='correct'?'Score reveal on the classroom screen.':'Keep going!','result-detail'));
    return card;
  }
  function podiumComplete(view){
    return view.serverNow>=(view.podiumCompleteAt??view.podiumSchedule?.at(-1)?.at??0);
  }
  function podium(stage,view,previous) {
    const ceremony=el('div',undefined,'podium podium-risers');
    const winners=(view.leaderboard||[]).filter(p=>p.rank<=3);
    const schedule=view.podiumSchedule||[];
    const ranks=[...new Set(winners.map(p=>p.rank))].sort((a,b)=>b-a);
    const featured=ranks.at(-1),places={1:'First place',2:'Second place',3:'Third place'};
    const prior=previous?.phase==='podium'?previous.leaderboard||[]:[];
    const recentlyRevealed=rank=>!reduced()&&previous?.id===view.id&&
      !prior.some(p=>p.rank===rank)&&schedule.some(x=>x.rank===rank&&view.serverNow>=x.at&&view.serverNow-x.at<1800);
    stage.append(el('div','EXAMIO FINALE','podium-kicker'));
    const first=winners.some(p=>p.rank===1);
    if(first){
      stage.dataset.winner='true';const spot=el('span',undefined,'winner-spotlight');spot.setAttribute('aria-hidden','true');stage.append(spot);
      if(recentlyRevealed(1)){
        const confetti=el('div',undefined,'podium-confetti');confetti.setAttribute('aria-hidden','true');
        for(let i=0;i<48;i++){
          const fleck=el('i');
          fleck.style.setProperty('--i',i);fleck.style.setProperty('--left',(7+i*17%87)+'%');
          fleck.style.setProperty('--drift',(i%2?1:-1)*(24+i%8*8)+'px');confetti.append(fleck);
        }
        stage.append(confetti);
      }
    }
    stage.append(el('h2',featured?places[featured]:'And the winners are…','podium-heading'));
    for(const rank of ranks){
      const group=el('section',undefined,'podium-step');group.dataset.place=rank;
      group.setAttribute('aria-label',places[rank]);
      const groupWinners=winners.filter(p=>p.rank===rank);
      if(recentlyRevealed(rank))group.classList.add('podium-enter');
      const people=el('div',undefined,'podium-finishers');
      const base=el('div',undefined,'podium-block');
      const medal=el('span',String(rank),'podium-medal');medal.dataset.metal={1:'gold',2:'silver',3:'bronze'}[rank];
      medal.setAttribute('aria-hidden','true');base.append(medal);
      const names=el('ul',undefined,'podium-names');
      for(const p of groupWinners.slice(0,3)){
        const entry=el('article',undefined,'podium-person');
        entry.append(avatar(p.avatarId,'player-avatar feature-avatar'));people.append(entry);
        const label=el('li');label.append(el('strong',p.nickname),el('span',pointsText(p.score),'podium-total'));names.append(label);
      }
      if(groupWinners.length>3)names.append(el('li','+'+(groupWinners.length-3)+' tied','podium-total'));
      base.append(names);
      group.append(people,base);ceremony.append(group);
    }
    stage.append(ceremony);
  }
  function standingsCredits(view){
    const rows=(view.leaderboard||[]).filter(row=>row.rank>=4).sort((a,b)=>a.rank-b.rank);
    if(!rows.length)return null;
    const credits=el('section',undefined,'final-standings');
    const heading=el('div',undefined,'standings-header');heading.append(el('h3','Class standings'));
    const viewport=el('div',undefined,'standings-list');viewport.tabIndex=0;viewport.setAttribute('tabindex','0');
    viewport.setAttribute('role','region');viewport.setAttribute('aria-label','Class standings, fourth place onward');
    const list=el('ol');
    for(const p of rows){
      const row=el('li',undefined,'standings-row');row.dataset.place=String(p.rank);
      row.append(el('span','#'+p.rank,'standings-place'),el('strong',p.nickname),el('span',pointsText(p.score),'standings-score'));
      list.append(row);
    }
    viewport.append(list);credits.append(heading,viewport);
    if(!reduced()&&root.requestAnimationFrame){
      const button=el('button','Pause scroll','standings-play');button.type='button';heading.append(button);
      let running,startedAt,pixels,epoch=0;
      const pause=()=>{
        if(!running)return;
        running=false;epoch++;button.textContent='Resume scroll';
      };
      const start=(delay=0)=>{
        const ticket=++epoch;running=true;startedAt=null;pixels=Number(viewport.scrollTop)||0;
        button.textContent='Pause scroll';
        const frame=time=>{
          if(!credits.isConnected||ticket!==epoch)return;
          if(startedAt===null){startedAt=time+delay;}
          const end=viewport.scrollHeight-viewport.clientHeight;
          if(end<=0){running=false;button.hidden=true;return;}
          if(time>=startedAt){
            viewport.scrollTop=Math.min(end,pixels+(time-startedAt)*.047);
            if(viewport.scrollTop>=end-1){running=false;button.textContent='Replay scroll';return;}
          }
          root.requestAnimationFrame(frame);
        };
        root.requestAnimationFrame(frame);
      };
      button.onclick=()=>{
        if(running){pause();return;}
        if(viewport.scrollTop>=viewport.scrollHeight-viewport.clientHeight-1)viewport.scrollTop=0;
        start();
      };
      for(const e of ['wheel','touchstart','focusin','pointerdown'])viewport.addEventListener(e,pause,{passive:true});
      start(850);
    }
    return credits;
  }
  function render(view,{answer}={}) {
    const receivedAt=performance.now(),timeline={view,receivedAt};
    const isPlayer=Boolean(answer),sameGame=lastView?.id===view.id;
    if(isOlderView(view,lastView))return;
    warmNextArtwork(view);
    const changedPhase=!sameGame||lastView.phase!==view.phase||lastView.questionIndex!==view.questionIndex;
    const previous=lastView;
    const animate=Boolean(sameGame&&changedPhase&&!reduced());
    const fingerprint=JSON.stringify(view.phase==='media'?{id:view.id,phase:view.phase,questionIndex:view.questionIndex,media:view.media}
      :['intro','responses-closed'].includes(view.phase)?{id:view.id,phase:view.phase,questionIndex:view.questionIndex,finalRound:view.finalRound,score:view.score}
      :['countdown','question'].includes(view.phase)?{id:view.id,phase:view.phase,questionIndex:view.questionIndex,question:view.question,startsAt:view.startsAt,deadlineAt:view.deadlineAt,answered:view.answered,answer:view.answer,score:view.score}
      :!isPlayer&&['leaderboard','podium'].includes(view.phase)?{id:view.id,phase:view.phase,questionIndex:view.questionIndex,scoreStartsAt:view.scoreStartsAt,podiumSchedule:view.podiumSchedule,podiumComplete:podiumComplete(view),leaderboard:(view.leaderboard||[]).map(({connected,...row})=>row)}
      :!isPlayer&&view.phase==='reveal'?{id:view.id,phase:view.phase,questionIndex:view.questionIndex,question:view.question}
      :{...view,serverNow:0});
    lastView=view;
    if(fingerprint===lastRender)return;
    lastRender=fingerprint;clearInterval(clock);
    const stage=$('stage');stage.replaceChildren();stage.dataset.phase=view.phase;delete stage.dataset.winner;
    if(changedPhase) stage.dataset.transition=animate?'quick':'';
    else stage.dataset.transition='';
    if($('game-title'))$('game-title').textContent=view.title||'Live quiz';
    $('phase').textContent=isPlayer?(view.questionIndex>=0?'Question '+(view.questionIndex+1)+' / '+view.questionCount:'')
      :{lobby:'Ready to play?',intro:'Get ready','responses-closed':'Round complete',media:'Watch & listen',countdown:'Question '+(view.questionIndex+1)+' of '+view.questionCount,question:'Question '+(view.questionIndex+1)+' of '+view.questionCount,reveal:'Class vote',leaderboard:'Leaderboard',podium:'Final results',closed:'Game ended'}[view.phase]||view.phase;
    const q=view.question;
    if(view.phase==='lobby')lobby(stage,view,isPlayer);
    if(view.phase==='media')mediaStage(stage,view,isPlayer);
    if(sceneCopy(view))renderScene(stage,view);
    if(view.phase==='countdown'){
      if(isPlayer)stage.append(el('h2','Look at the classroom screen','ready-message'));
      else appendPrompt(stage,q);
    }
    if(view.phase==='question'){if(!isPlayer)appendPrompt(stage,q);choices(stage,view,answer);}
    if(view.phase==='reveal'&&!isPlayer&&q){
      appendPrompt(stage,q);stage.append(voteChart(q,animate));
      if(q.answerExplanation)stage.append(el('p',q.answerExplanation,'explanation'));
    }
    if(isPlayer&&['reveal','leaderboard','podium'].includes(view.phase)){
      const result=playerResult(view);stage.append(result);
      const earned=result.querySelector('.round-earned');if(earned)countUp(earned,0,view.answer.points,timeline,'+');
    }
    if(!isPlayer&&view.phase==='podium'){
      podium(stage,view,previous);
      if(podiumComplete(view)){const credits=standingsCredits(view);if(credits)stage.append(credits);}
    }
    if(!isPlayer&&view.phase==='leaderboard'){
      const board=leaderboard(view);stage.append(board);
      animateBoard(board,view.leaderboard||[],timeline);
    }
    if(view.phase==='closed')stage.append(el('h2','Thanks for playing!'));
    if($('score')){
      const score=$('score');
      score.hidden=!Number.isFinite(view.score);
      if(score.hidden){countEpoch.set(score,(countEpoch.get(score)||0)+1);score.textContent='';}
      else if(isPlayer&&view.phase==='leaderboard')countUp(score,view.previousScore,view.score,timeline);
      else countUp(score,view.score,view.score);
    }
    runRoundClock(view,stage);
  }
  Object.assign(api,{$,el,status,json,professor,button,picture,render,leaderboard});root.GameClient=api;
})(typeof window==='undefined'?globalThis:window);
