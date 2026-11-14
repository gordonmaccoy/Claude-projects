(function(root){
  const uid=()=>globalThis.crypto.randomUUID();
  function newQuestion(){return {id:uid(),type:'mc',text:'',durationSeconds:20,options:Array.from({length:4},()=>({id:uid(),text:''})),correctOptionId:''};}
  function secondsLeft(deadline,serverNow,receivedAt,now=Date.now()){return Math.max(0,Math.ceil((deadline-serverNow-(now-receivedAt))/1000));}
  function roundTime(view, receivedAt, now) {
    const {phase, startsAt, deadlineAt, serverNow} = view;
    if (!['countdown','question'].includes(phase) ||
        ![startsAt, deadlineAt, serverNow].every(Number.isFinite) || deadlineAt <= startsAt) return null;
    const prep = phase === 'countdown';
    const duration = prep ? 3000 : deadlineAt - startsAt;
    const remaining = Math.min(duration, Math.max(0, (prep ? startsAt : deadlineAt) - serverNow - (now - receivedAt)));
    return {seconds: Math.ceil(remaining / 1000), progress: remaining / duration,
      urgent: !prep && remaining <= 5000, label: prep ? 'GET READY' : 'SECONDS LEFT'};
  }
  function resumeRecord(storage,id,generate=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('')){
    const key='examio-game:'+id;let record;try{record=JSON.parse(storage.getItem(key));}catch{}
    if(!record||typeof record.resumeToken!=='string'||record.resumeToken.length<32){record={resumeToken:generate()};storage.setItem(key,JSON.stringify(record));}return record;
  }
  function mediaSource(media){if(!media||!['image','audio','video','youtube'].includes(media.type))return null;if(media.type==='image'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(media.url))return media.url;try{const u=new URL(media.url);if(u.protocol!=='https:'||u.username||u.password)return null;if(media.type==='youtube'){if(!['youtube.com','www.youtube.com'].includes(u.hostname)||u.pathname!=='/watch')return null;const id=u.searchParams.get('v');return /^[A-Za-z0-9_-]{11}$/.test(id||'')?'https://www.youtube-nocookie.com/embed/'+id:null;}return u.href;}catch{return null;}}
  function forgetExpiredSession(storage,id,status){if(!id||![404,410].includes(status))return false;storage.removeItem('examio-game:'+id);return true;}
  const api={newQuestion,secondsLeft,roundTime,resumeRecord,mediaSource,forgetExpiredSession};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root.document)return;
  const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const status=(text,error=false)=>{$('status').textContent=text||'';$('status').classList.toggle('error',error);};
  async function json(url,body,headers={},method=body===undefined?'GET':'POST'){const response=await fetch(url,{method,headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await response.json();}catch{throw new Error('Unable to reach Examio. Please retry.');}if(!response.ok)throw Object.assign(new Error(data.error||'Request failed'),{status:response.status});return data;}
  async function professor(){const config=await json('/api/config');if(!config.supabaseUrl||!config.supabaseKey)throw new Error('Sign-in is not configured.');const preferences=window.createExamioSessionPreferences(config.supabaseUrl);const auth=window.createOnScreenAuth(config.supabaseUrl,config.supabaseKey,{auth:{flowType:'pkce',persistSession:true,storage:preferences.storage}});const session=(await auth.auth.getSession()).data.session;if(!session){$('signin').hidden=false;throw new Error('Sign in to your professor account, then return to Games.');}return async(path,method='GET',body)=>{const token=(await auth.auth.getSession()).data.session?.access_token;if(!token){$('signin').hidden=false;throw new Error('Please sign in again.');}return json('/api'+path,body,{Authorization:'Bearer '+token},method);};}
  function button(text,fn,cls=''){const b=el('button',text,cls);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status(e.message,true);}finally{b.disabled=false;}};return b;}
  function picture(src,alt='Question image'){if(typeof src!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(src))return null;const img=el('img');img.src=src;img.alt=alt;img.className='question-image';return img;}
  function avatar(id){const img=el('img');img.src=GameAvatars.image(id);img.alt='';img.className='player-avatar';return img;}
  function leaderboard(view){const box=el('div',undefined,'rankings');const list=el('ol');for(const p of view.leaderboard||[]){const row=el('li',undefined,p.rank<=3?'top-rank':'');row.append(el('span',String(p.rank),'rank'),avatar(p.avatarId),el('strong',p.nickname),el('span',Number(p.score).toLocaleString()+' pts','points'));list.append(row);}box.append(list);return box;}
  let clock,lastRender;
  function runRoundClock(view, stage, answer) {
    const timer = $('round-timer');
    if (!timer) return;
    const receivedAt = performance.now();
    timer.hidden = !roundTime(view, receivedAt, receivedAt);
    if (timer.hidden) return;
    const value = timer.querySelector('.round-timer-value'), label = timer.querySelector('.round-timer-label');
    const prep = view.phase === 'countdown';
    let previousSeconds;
    const update = () => {
      const now = performance.now();
      const time = roundTime(view, receivedAt, now);
      if (previousSeconds !== time.seconds) {
        previousSeconds = time.seconds;
        value.textContent = time.seconds;
        label.textContent = time.label;
        timer.setAttribute('aria-label', prep ? 'Starting in '+time.seconds+' seconds' : time.seconds+' seconds left');
      }
      timer.style.setProperty('--remaining', time.progress);
      timer.dataset.urgent = String(time.urgent);
      if (time.seconds > 0) return false;
      clearInterval(clock);
      if (prep && view.question) {
        render({...view, phase:'question', serverNow:view.serverNow + (now - receivedAt)}, {answer});
      } else {
        stage.querySelectorAll('button.choice').forEach(button => {button.disabled=true;});
      }
      return true;
    };
    if (!update()) clock = setInterval(update, 50);
  }
  function render(view,{answer}={}){const fingerprint=JSON.stringify(view.phase==='media'?{id:view.id,phase:view.phase,questionIndex:view.questionIndex,media:view.media}:['countdown','question'].includes(view.phase)?{id:view.id,phase:view.phase,question:view.question,startsAt:view.startsAt,deadlineAt:view.deadlineAt,answered:view.answered,answer:view.answer,score:view.score}:!answer&&['leaderboard','podium'].includes(view.phase)?{id:view.id,phase:view.phase,questionIndex:view.questionIndex,leaderboard:(view.leaderboard||[]).map(({connected,...row})=>row)}:{...view,serverNow:0});if(fingerprint===lastRender)return;lastRender=fingerprint;clearInterval(clock);const stage=$('stage');stage.replaceChildren();if($('game-title'))$('game-title').textContent=view.title||'Live quiz';stage.dataset.phase=view.phase;$('phase').textContent=answer?(view.questionIndex>=0?'Question '+(view.questionIndex+1)+' / '+view.questionCount:'') : {lobby:'Ready to play?',media:'Watch & listen',countdown:'Get ready',question:'Question '+(view.questionIndex+1)+' of '+view.questionCount,reveal:'The answer is…',leaderboard:'Leaderboard',podium:'Final results',closed:'Game ended'}[view.phase]||view.phase;
    if(view.phase==='lobby'&&answer){stage.append(avatar(view.avatarId),el('h2',view.nickname),el('p','Waiting for the game to start'));}
    if(view.phase==='lobby'&&!answer){stage.append(el('h2','Waiting for the teacher to start'),el('p',(view.players||[]).length+' players connected'));const roster=el('div',undefined,'roster');for(const p of view.players||[]){const item=el('span',undefined,'roster-player');item.append(avatar(p.avatarId),el('span',p.nickname+(p.connected?'':' · reconnecting')));roster.append(item);}stage.append(roster);}
    if(view.phase==='countdown'){stage.append(el('h2','Get ready for question '+(view.questionIndex+1),'ready-message'));}
    if(view.phase==='media'){if(answer){stage.append(el('h2','Look at the classroom screen'),el('p','Your teacher will start the question when everyone is ready.'));}else{const source=mediaSource(view.media);if(!source)stage.append(el('p','Media is unavailable. You can continue to the question.'));else{const type=view.media.type;const node=el(type==='youtube'?'iframe':type==='image'?'img':type);node.src=source;node.className='game-media';if(type==='image')node.alt='Review material before the question';if(['audio','video'].includes(type)){node.controls=true;node.preload='metadata';}if(type==='youtube'){node.title='YouTube review video';node.allow='encrypted-media; fullscreen; picture-in-picture';node.referrerPolicy='strict-origin-when-cross-origin';node.allowFullscreen=true;}stage.append(node);}}}
    const q=view.question;
    if(q&&['question','reveal'].includes(view.phase)){const heading=el('h2',q.text,'question-text');stage.append(heading);const image=picture(q.image);if(image)stage.append(image);
      const choices=el('div',undefined,'choices');q.options.forEach((o,index)=>{const item=answer?button('',()=>answer(q.id,o.id),'choice choice-'+index):el('div',undefined,'choice choice-'+index);item.append(el('span',String.fromCharCode(65+index),'choice-letter'),el('span',o.text,'choice-text'));const img=picture(o.image,'Answer choice image');if(img)item.append(img);if(view.phase!=='question'&&o.id===q.correctOptionId)item.classList.add('correct');if(q.counts)item.append(el('small',(q.counts[o.id]||0)+' answers'));if(answer)item.disabled=view.phase!=='question'||view.answered||secondsLeft(view.deadlineAt,view.serverNow,Date.now())<=0;choices.append(item);});stage.append(choices);
      if(view.phase==='question'&&view.answered)stage.append(el('p','Answer received. Waiting for the reveal.','answer-feedback'));
      if(view.phase==='reveal'){if(view.answer)stage.append(el('p',view.answer.correct?'Correct! +'+view.answer.points+' points':'Not this time. Keep going!','answer-feedback'));if(q.answerExplanation)stage.append(el('p',q.answerExplanation,'explanation'));}}
    if(answer&&['leaderboard','podium'].includes(view.phase)){stage.append(avatar(view.avatarId),el('h2',view.nickname),el('p',(view.phase==='podium'?'Final place: ':'Your place: ')+'#'+view.rank));}
    if(!answer&&['leaderboard','podium'].includes(view.phase)){if(view.phase==='podium'){const winners=el('div',undefined,'podium');const beams=el('div',undefined,'celebration-beams');beams.setAttribute('aria-hidden','true');beams.append(el('span'),el('span'),el('span'));stage.append(beams);for(const p of (view.leaderboard||[]).filter(p=>p.rank<=3)){const winner=el('div',undefined,'podium-place');winner.dataset.place=p.rank;winner.append(el('span',['1ST PLACE','2ND PLACE','3RD PLACE'][p.rank-1],'podium-label'),avatar(p.avatarId),el('p',p.nickname),el('strong',Number(p.score).toLocaleString()+' pts'));winners.append(winner);}stage.append(el('h2','Well played, everyone!'),winners);}stage.append(leaderboard(view));}
    if(view.phase==='closed')stage.append(el('h2','Thanks for playing!'));
    if($('score')&&view.score!==undefined)$('score').textContent=Number(view.score).toLocaleString()+' pts';
    runRoundClock(view,stage,answer);
    if(answer){fitPlayer();for(const img of stage.querySelectorAll('img'))if(!img.complete)img.addEventListener('load',fitPlayer,{once:true});}
  }
  function fitPlayer(){const stage=$('stage');if(!stage||!['question','reveal'].includes(stage.dataset.phase)||!document.body.classList.contains('is-playing'))return;stage.style.removeProperty('--fit');for(let i=20;i>=10&&stage.scrollHeight>stage.clientHeight+1;i--)stage.style.setProperty('--fit',i/20);}
  root.addEventListener('resize',fitPlayer);
  Object.assign(api,{$,el,status,json,professor,button,picture,render,leaderboard});root.GameClient=api;
})(typeof window==='undefined'?globalThis:window);
