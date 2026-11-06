const socket=io();const $=id=>document.getElementById(id);
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
function render(view) {
  $('title').textContent=view.title;
  $('phase').textContent=view.phase==='waiting'?'Scan to join · Waiting for your professor to start':view.phase==='ended'?'Session ended':'Session in progress';
  $('count').textContent=`${view.students.length} joined · ${view.students.filter(s=>s.status==='green').length} active`;
  $('students').replaceChildren(...view.students.map(s=> {const tile=document.createElement('div');tile.className=`student ${s.status==='red'?'red':''}`;const dot=document.createElement('span');dot.className='dot';const name=document.createElement('span');name.textContent=s.name;tile.append(dot,name);return tile;}));
}
socket.on('connect',()=> {
  if(!sessionId||!token) return $('connection').textContent='Launch a session from the professor workspace to open this display.';
  socket.timeout(10000).emit('display:watch',{sessionId,token},(err,res)=> {
    if(err||!res.ok) return $('connection').textContent=res?.error||'Connection interrupted. Reconnecting…';
    displayReady=true;$('connection').textContent='';$('qr').src=res.qrDataUrl;$('qr-toggle').hidden=false;render(res.view);
  });
});
socket.on('display:update',render);socket.on('disconnect',()=> { $('connection').textContent='Connection interrupted. Reconnecting…';document.querySelectorAll('.student').forEach(el=>el.classList.add('red')); });
$('qr-toggle').onclick=()=> { const expanded=$('qr-toggle').classList.toggle('expanded');$('qr-toggle').setAttribute('aria-expanded',String(expanded));$('qr-toggle').setAttribute('aria-label',expanded?'Minimize join QR code':'Expand join QR code');$('qr-toggle').querySelector('span').textContent=expanded?'Click to minimize':'Click to enlarge'; };
document.addEventListener('keydown',e=> {if(e.key==='Escape'&&$('qr-toggle').classList.contains('expanded')) $('qr-toggle').click();});
