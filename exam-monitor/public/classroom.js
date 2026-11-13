const {t}=window.examioLanguage;
const socket=io();const $=id=>document.getElementById(id);
function applyClassTheme(value){const theme=value==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('exam-monitor-theme',theme);}catch{}$('class-theme-toggle').setAttribute('aria-pressed',String(theme==='dark'));}
try{applyClassTheme(localStorage.getItem('exam-monitor-theme'));}catch{applyClassTheme('light');}
$('class-theme-toggle').onclick=()=>applyClassTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
const [sessionId,token,windowGroup]=location.hash.slice(1).split('/');
// Reusing a window can change only its fragment, which does not reload scripts.
// Reconnect with the new session capability instead of keeping the old socket.
window.addEventListener('hashchange',()=>location.reload());
let displayReady = false;
try {
  const channel = new BroadcastChannel(`onscreen-display-${windowGroup || sessionId}`);
  channel.onmessage = event => {
    if(displayReady && event.data?.type === 'focus-display') {
      window.focus();
      channel.postMessage({ type:'display-present', requestId:event.data.requestId });
      if(event.data.sessionId !== sessionId && typeof event.data.displayUrl === 'string') {
        const next=new URL(event.data.displayUrl,location.origin);
        if(next.origin === location.origin && next.pathname === '/classroom.html') location.replace(next.href);
      }
    }
  };
} catch {}
let timer,displayLanguage=null;
function renderTimer() {
  $('class-timer').hidden=!timer;
  if(!timer)return;
  const seconds=Math.max(0,Math.ceil(timer.remainingMs!=null?timer.remainingMs/1000:(timer.deadline-timer.serverNow-performance.now()+timer.received)/1000));
  $('class-time').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
setInterval(renderTimer,250);
function render(view) {
  if(['en','ko'].includes(view.language)&&displayLanguage!==view.language){window.examioLanguage.apply(view.language);displayLanguage=view.language;}
  timer=view.phase==='paused'&&view.remainingMs!=null?{remainingMs:view.remainingMs}:view.phase==='running'&&view.deadlineAt?{deadline:view.deadlineAt,serverNow:view.serverNow,received:performance.now()}:null;
  renderTimer();
  $('title').textContent=view.calculator?t('Classroom calculator'):view.title;
  $('phase').textContent=view.phase==='paused'?t('Test paused'):view.phase==='waiting'?t('Scan to join · Waiting for your professor to start'):view.phase==='ended'?t('Session ended'):t('Session in progress');
  $('count').textContent=t('{joined} joined · {active} active · {completed} completed',{joined:view.students.length,active:view.students.filter(s=>s.status==='green').length,completed:view.students.filter(s=>s.status==='completed').length});
  $('students').replaceChildren(...view.students.map(s=> {const tile=document.createElement('div');tile.className=`student ${['submitted','completed'].includes(s.status)?'submitted':s.status==='failed'?'red failed':s.status==='red'?'red':''}`;const dot=document.createElement('span');dot.className='dot';const name=document.createElement('span');name.textContent=s.name;tile.append(dot,name);if(['failed','submitted','completed'].includes(s.status)){const status=document.createElement('small');status.textContent=s.status==='failed'?t('FAIL'):s.status==='completed'?t('Completed and closed'):t('Test Submitted');tile.append(status);}return tile;}));
}
socket.on('connect',()=> {
  if(!sessionId||!token) return $('connection').textContent=t('Launch a session from the professor workspace to open this display.');
  socket.timeout(10000).emit('display:watch',{sessionId,token},(err,res)=> {
    if(err||!res.ok) return $('connection').textContent=(res?.error&&t(res.error))||t('Connection interrupted. Reconnecting…');
    displayReady=true;$('connection').textContent='';$('qr').src=res.qrDataUrl;$('qr-toggle').hidden=false;render(res.view);
  });
});
socket.on('display:update',render);socket.on('disconnect',()=> { $('connection').textContent=t('Connection interrupted. Reconnecting…');document.querySelectorAll('.student:not(.submitted)').forEach(el=>el.classList.add('red')); });
$('qr-toggle').onclick=()=> { const expanded=$('qr-toggle').classList.toggle('expanded');$('qr-toggle').setAttribute('aria-expanded',String(expanded));$('qr-toggle').setAttribute('aria-label',expanded?t('Minimize join QR code'):t('Expand join QR code'));$('qr-toggle').querySelector('span').textContent=expanded?t('Click to minimize'):t('Click to enlarge'); };
document.addEventListener('keydown',e=> {if(e.key==='Escape'&&$('qr-toggle').classList.contains('expanded')) $('qr-toggle').click();});
