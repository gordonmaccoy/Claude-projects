const {t,apply:applyStudentLanguage}=window.examioLanguage;
const params = new URLSearchParams(location.search);
const sessionId = (params.get('session') || '').toUpperCase();
const $ = id => document.getElementById(id);
const els = {
  joinSection:$('join-section'), calcSection:$('calculator-section'),testSection:$('test-section'),
  sessionCode:$('session-code'),form:$('join-form'),nameInput:$('name-input'),joinError:$('join-error'),meName:$('me-name'),
  connDot:$('conn-dot'),testConnDot:$('test-conn-dot'),expression:$('expression'),result:$('result'),keys:document.querySelector('.keys'),
  themeToggle:$('theme-toggle'),testThemeToggle:$('test-theme-toggle'),themeColor:$('theme-color'),testTitle:$('test-title'),
  testQuestions:$('test-questions'),testActions:$('test-actions'),testSubmitBtn:$('test-submit-btn'),testDone:$('test-done'),doneScore:$('done-score'),
};
function applyTheme(value) { const theme=value==='dark'?'dark':'light'; document.documentElement.dataset.theme=theme; els.themeColor.content=theme==='dark'?'#082d5b':'#f4f7f2'; try{localStorage.setItem('exam-monitor-theme',theme);}catch{} }
try { applyTheme(localStorage.getItem('exam-monitor-theme')); } catch { applyTheme('light'); }
for(const el of [els.themeToggle,els.testThemeToggle]) el.onclick=()=>applyTheme(document.documentElement.dataset.theme==='light'?'dark':'light');

const resumeKey=`onscreen-resume-${sessionId}`, draftKey=`onscreen-draft-${sessionId}`, calculatorKey=`onscreen-calculator-${sessionId}`;
const socket=io({autoConnect:false}); let joined=false, currentView=null, renderedTest=false, testAnswers={}, submitting=false, draftTimer, updateVersion=0, memoryToken=null;
let completingCalculator=false;
const securityGuard=window.examioStudentSecurity({document,window,root:els.testQuestions,button:$('student-fullscreen'),status:$('fullscreen-status'),t,report:type=>{if(joined&&socket.connected)socket.emit('student:security',{type},()=>{});}});
let reconnectTimer, connectionVersion=0;
const connectionNotice=$('student-connection');
const message=text=>$('student-notice').textContent=t(text || '');
const emit=(event,data)=>new Promise(resolve=>socket.timeout(10000).emit(event,data,(err,res)=>resolve(err?{ok:false,timedOut:true,error:t('The connection timed out. Please try again.')}:res)));
function showJoinError(text) { els.joinError.hidden=false; els.joinError.textContent=t(text); }
function savedToken() { try { return memoryToken || localStorage.getItem(resumeKey); } catch { return memoryToken; } }
function saveDraft() { try { localStorage.setItem(draftKey,JSON.stringify(testAnswers)); } catch {} }
async function join(input) {
  if(input.name && input.number) {
    memoryToken = savedToken() || Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
    input.resumeToken=memoryToken;
    try { localStorage.setItem(resumeKey,memoryToken); } catch { message(t('Resume is available while this page stays open. This browser cannot save the resume link across reloads.')); }
  }
  const connection=connectionVersion;
  const res=await emit('student:join',{sessionId,...input});
  if(connection!==connectionVersion)return;
  if(!res.ok) { if(joined) {
    connectionNotice.textContent=res.timedOut?t('Still reconnecting…'):t(res.error);
    if(res.timedOut&&input.resumeToken&&socket.connected) reconnectTimer=setTimeout(()=>join({resumeToken:input.resumeToken}),1500);
  } else showJoinError(res.error); return; }
  clearTimeout(reconnectTimer);connectionNotice.textContent='';setConnected(true);
  joined=true; memoryToken=res.resumeToken; try{localStorage.setItem(resumeKey,res.resumeToken);}catch{ message(t('Resume is available while this page stays open. This browser cannot save the resume link across reloads.')); }
  els.joinError.hidden=true; els.meName.textContent=res.view.name;
  showView(res.view); await visibility();
}
async function initializeStudentLanguage() {
  try {
    if(sessionId) {
      const response=await fetch(`/session-language/${encodeURIComponent(sessionId)}`);
      if(!response.ok)throw new Error('Session language unavailable');
      applyStudentLanguage((await response.json()).language);
    }
  } catch {
    connectionNotice.textContent=t('Connection interrupted. Reconnecting…');
    setTimeout(initializeStudentLanguage,1500);
    return;
  }
  connectionNotice.textContent='';
  els.sessionCode.textContent=sessionId || t('missing');
  els.joinSection.hidden=false;
  socket.connect();
}
initializeStudentLanguage();
socket.on('connect',async()=> {
  clearTimeout(reconnectTimer);
  const resumeToken=savedToken();
  if(resumeToken) await join({resumeToken});
  else setConnected(true);
});
socket.on('disconnect',()=> {
  connectionVersion++;
  setConnected(false);
  clearTimeout(reconnectTimer);
  if(!joined || currentView?.result || currentView?.terminal)return;
  reconnectTimer=setTimeout(()=>{if(!socket.connected)connectionNotice.textContent=t('Reconnecting… Keep this page open.');},1500);
});
function setConnected(ok) { for (const el of [els.connDot,els.testConnDot]) { el.classList.toggle('offline',!ok); el.title=ok?t('Connected'):t('Disconnected'); } }
els.form.onsubmit=async e=> { e.preventDefault(); const b=els.form.querySelector('button'); b.disabled=true; try { await join({name:els.nameInput.value.trim(),number:$('number-input').value.trim()}); } finally { b.disabled=false; } };
function showView(view) {
  const previousExtension=currentView?.extensionVersion;currentView=view;
  if(previousExtension!==undefined && view.extensionVersion>previousExtension){extensionNoticeUntil=performance.now()+6000;$('time-notice').textContent=t('Your professor extended the time by {minutes} minute.', {minutes:view.lastExtension?.minutes||1});}
  if((view.result||view.failed||view.phase==='ended'||view.phase==='paused')&&$('submit-dialog').open)$('submit-dialog').close();
  timerSnapshot={deadlineAt:view.deadlineAt,serverNow:view.serverNow,receivedAt:performance.now()};
  if(view.terminal){clearTimeout(draftTimer);clearTimeout(reconnectTimer);connectionNotice.textContent='';if(!view.completed||!completingCalculator)socket.disconnect();}
  securityGuard.update(view);
  const warnings=[];
  if(view.security?.enabled&&view.security?.inactivityFail)warnings.push(t('Leaving this page hidden for more than 5 seconds results in FAIL and a score of zero. Tell your professor about interruptions.'));
  if(view.security?.enabled&&view.security?.tabVisibility)warnings.push(t('Leaving or returning to this page is recorded.'));
  if(view.security?.enabled&&view.security?.focusVisibility)warnings.push(t('Leaving or returning focus to this window is recorded.'));
  if(view.security?.enabled&&view.security?.fullscreen)warnings.push(t('Use the fullscreen button when the activity starts. Fullscreen changes are recorded.'));
  $('security-policy-warning').textContent=warnings.join(' ');
  const paused=view.phase==='paused'&&!view.result&&!view.completed;
  $('pause-lock').hidden=!paused;
  if(paused)clearTimeout(draftTimer);
  const locked=Boolean(view.failed && !view.result && view.phase==='running');
  $('activity-lock').hidden=!locked;
  els.calcSection.inert=locked||paused; els.testSection.inert=locked||paused;
  if(!locked && $('student-notice').textContent.startsWith(t('FAIL'))) message('');
  els.joinSection.hidden=true; els.calcSection.hidden=true; els.testSection.hidden=true; $('waiting-section').hidden=true;
  if(view.completed) {
    try{localStorage.removeItem(calculatorKey);}catch{}
    els.testSection.hidden=false;els.testDone.hidden=false;els.testActions.hidden=true;els.testQuestions.replaceChildren();
    els.testTitle.textContent=t('Calculator completed');
    els.doneScore.textContent=t('You can now close this tab.');
    $('student-corrections').hidden=true;
    message('');
    return;
  }
  if(view.result) {
    els.testSection.hidden=false; els.testDone.hidden=false; els.testActions.hidden=true; els.testQuestions.replaceChildren();
    els.testTitle.textContent=t('Test submitted'); els.doneScore.textContent=view.result.hidden?t('Your test was submitted. Your professor will share the results.'):t('Your score: {score} / {total} · {percentage}%',view.result)+(view.result.failed?' · '+t('FAIL'):'');
    renderCorrections(view.corrections);
    $('test-timer').hidden=true;$('time-notice').textContent='';try{localStorage.removeItem(draftKey);}catch{} return;
  }
  if(view.phase==='ended') { try{localStorage.removeItem(calculatorKey);}catch{} message(t('Your professor ended the session.')); els.joinSection.hidden=false; els.form.querySelector('button').disabled=true; return; }
  if(view.mode==='calculator') { els.calcSection.hidden=false; return; }
  if(paused){els.testSection.hidden=false;els.testTitle.textContent=view.test?.title||t('Test');els.testActions.hidden=true;return;}
  if(view.phase==='waiting') { $('waiting-section').hidden=false; return; }
  els.testSection.hidden=false; els.testTitle.textContent=view.test?.title || t('Test'); els.testActions.hidden=false; els.testDone.hidden=true;

  if(view.test && !renderedTest) {
    renderedTest=true; testAnswers={...view.draft};
    try { const local=JSON.parse(localStorage.getItem(draftKey)||'{}'); for(const q of view.test.questions) if(q.type==='blank' ? typeof local[q.id]==='string' && local[q.id].length<=300 : q.options.some(o=>o.id===local[q.id])) testAnswers[q.id]=local[q.id]; } catch {}
    renderTestQuestions(view.test.questions);
  }
}
socket.on('student:finished',view=>{showView(view);socket.disconnect();});
socket.on('student:update',view=> { if(joined) showView(view); });
function appendQuestionImage(parent,source) {
  if(!source)return;
  const image=document.createElement('img');
  image.className='question-image';image.alt=t('Image supplied by the professor');image.src=source;
  parent.append(image);
}
function renderCorrections(rows) {
  const container=$('student-corrections');
  container.replaceChildren();container.hidden=!Array.isArray(rows)||!rows.length;
  if(container.hidden)return;
  const heading=document.createElement('h2');heading.textContent=t('Corrections');container.append(heading);
  for(const row of rows) {
    const entry=document.createElement('article');
    const prompt=document.createElement('p');prompt.textContent=row.number+'. '+row.question;entry.append(prompt);
    appendQuestionImage(entry,row.image);
    const answer=document.createElement('p');answer.className='correction-incorrect';answer.textContent='Your answer: '+(row.answer||t('Unanswered'));entry.append(answer);appendQuestionImage(entry,row.answerImage);
    const correct=document.createElement('p');correct.className='correction-correct';correct.textContent='Correct answer: '+row.correct;entry.append(correct);appendQuestionImage(entry,row.correctImage);
    container.append(entry);
  }
}
$('calculator-complete').onclick=async()=>{
  const button=$('calculator-complete');
  button.disabled=true;completingCalculator=true;
  try {
    const response=await emit('student:complete-calculator',{});
    if(response.view)showView(response.view);
    if(!response.ok&&!currentView?.completed)message(response.error);
    if(currentView?.completed){socket.disconnect();window.close();}
  } finally {completingCalculator=false;button.disabled=false;}
};
function renderTestQuestions(questions) {
  els.testQuestions.replaceChildren();
  questions.forEach((q,i)=> {
    const card=document.createElement('div');card.className='tq-card';const p=document.createElement('p');p.className='tq-text';p.textContent=`${i+1}. ${q.text} (${t((q.points??1)===1?'{points} point':'{points} points',{points:q.points??1})})`;card.append(p);appendQuestionImage(card,q.image);
    card.dataset.questionId=q.id;
    const options=document.createElement('div'); options.className='tq-options';
    if(q.type==='blank') {
      const input=document.createElement('input');input.type='text';input.className='blank-answer';input.maxLength=300;input.setAttribute('aria-label',t('Answer to question {number}',{number:i+1}));input.autocomplete='off';input.value=testAnswers[q.id]||'';
      input.oninput=()=> { testAnswers[q.id]=input.value;if(input.value.trim())lastAnsweredQuestion=q.id;updateVersion++;saveDraft();clearTimeout(draftTimer);draftTimer=setTimeout(uploadDraft,400); };options.append(input);
    }
    (q.options||[]).forEach((o,j)=> {
      const label=document.createElement('label');label.className='tq-option';const radio=document.createElement('input');radio.type='radio';radio.name=q.id;radio.value=o.id;radio.checked=testAnswers[q.id]===o.id;
      radio.onchange=()=> { testAnswers[q.id]=o.id;lastAnsweredQuestion=q.id; updateVersion++;saveDraft();clearTimeout(draftTimer);draftTimer=setTimeout(uploadDraft,400); };
      const letter=document.createElement('span');letter.className='tq-opt-letter';letter.textContent=String.fromCharCode(65+j);
      const text=document.createElement('span');text.className='tq-opt-text';text.textContent=o.text;label.append(radio,letter,text);appendQuestionImage(text,o.image);options.append(label);
    });card.append(options);els.testQuestions.append(card);
  });

}
let lastAnsweredQuestion=null;
async function uploadDraft() {
  if(!joined || currentView?.failed || currentView?.result || currentView?.phase!=='running' || currentView?.mode!=='test') return;
  if(!socket.connected)return;
  const version=updateVersion;const res=await emit('student:draft',{answers:testAnswers,questionId:lastAnsweredQuestion});
  if(currentView?.result||currentView?.terminal)return;
  if(!res.ok && version===updateVersion) message(res.timedOut?t('Answers are saved on this device. Waiting to sync…'):res.error);
  else if(res.ok && version===updateVersion && !currentView?.failed) message(t('Answers saved.'));
}
els.testSubmitBtn.onclick=()=> {
 if(submitting||currentView?.failed||currentView?.result||currentView?.phase!=='running')return;
 const unanswered=currentView.test.questions.map((q,i)=>testAnswers[q.id]?.trim()?null:i+1).filter(n=>n!==null);
 $('submit-warning').textContent=unanswered.length?t(unanswered.length===1?'You have {count} unanswered question ({numbers}). Unanswered questions receive zero points. Submit anyway?':'You have {count} unanswered questions ({numbers}). Unanswered questions receive zero points. Submit anyway?',{count:unanswered.length,numbers:unanswered.join(', ')}):t('Submit your test? You cannot change your answers afterwards.');
 $('submit-dialog').showModal();
};
$('submit-review').onclick=()=> $('submit-dialog').close();
$('submit-confirm').onclick=async()=>{
 if(submitting||currentView?.failed||currentView?.result||currentView?.phase!=='running')return;
 submitting=true;els.testSubmitBtn.disabled=true;$('submit-confirm').disabled=true;clearTimeout(draftTimer);
 const res=await emit('student:submit',{answers:testAnswers});
 submitting=false;els.testSubmitBtn.disabled=false;$('submit-confirm').disabled=false;
 if(res.ok){$('submit-dialog').close();message('');showView(res.view);}else{if(res.view)showView(res.view);message(res.error);}
};
let timerSnapshot=null,extensionNoticeUntil=0,timerSyncing=false;
function updateTimer(){
 const running=currentView?.mode==='test'&&currentView?.phase==='running'&&!currentView?.result&&timerSnapshot?.deadlineAt;
 $('test-timer').hidden=!running;if(!running)return;
 const remaining=Math.max(0,Math.ceil((timerSnapshot.deadlineAt-(timerSnapshot.serverNow+performance.now()-timerSnapshot.receivedAt))/1000));
 $('time-left').textContent=remaining<=10?String(remaining):`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;$('test-timer').classList.toggle('critical',remaining<=10);
 if(performance.now()>extensionNoticeUntil)$('time-notice').textContent=remaining===0?t('Time is up. Submitting your saved answers…'):remaining<=10?t('Submitting automatically in {seconds} seconds.',{seconds:remaining}):remaining<=60?t('One minute or less remains.'):'';
 if(remaining===0){els.testQuestions.inert=true;els.testSubmitBtn.disabled=true;if(socket.connected&&!timerSyncing){timerSyncing=true;emit('student:sync',{}).then(r=>{timerSyncing=false;if(r.view)showView(r.view);});}}
 else{els.testQuestions.inert=!!currentView?.failed;els.testSubmitBtn.disabled=submitting;}
}
setInterval(updateTimer,250);
async function visibility() { if(!joined || currentView?.result || currentView?.phase==='ended' || !socket.connected) return; const res=await emit('student:visibility',{visible:!document.hidden}); if(res.view)showView(res.view);if(!res.ok && !res.timedOut && !currentView?.terminal) message(res.error); }
document.addEventListener('visibilitychange',visibility);
window.addEventListener('pagehide',()=> { if(joined && !currentView?.result && currentView?.phase!=='ended') socket.emit('student:visibility',{visible:false},()=>{}); });
setInterval(()=> { if(joined&&!currentView?.terminal) { visibility(); if(currentView?.mode==='test' && !currentView?.result) uploadDraft(); } },3000);
if(!sessionId) { showJoinError('Scan your professor’s QR code to join.');els.form.querySelector('button').disabled=true; }
// --- Calculator ---

// expression is the string we evaluate. UI shows it as the top line.
// result is shown as the bottom line after '='.
// After '=', the next digit starts a fresh expression; the next operator
// continues from the last result.
let expression = '';
let lastResult = null;
let justEvaluated = false;

const OP_DISPLAY = { '+': '+', '-': '\u2212', '*': '\u00d7', '/': '\u00f7' };
const SAFE_RE = /^[\d+\-*/.()\s]+$/;

// Keep calculator work on this device through a locked-page reload.
try {
  const saved=JSON.parse(localStorage.getItem(calculatorKey)||'null');
  if(saved && typeof saved.expression==='string' && saved.expression.length<=10000 && (!saved.expression || SAFE_RE.test(saved.expression))) {
    expression=saved.expression;lastResult=typeof saved.lastResult==='string' && saved.lastResult.length<=300?saved.lastResult:null;justEvaluated=saved.justEvaluated===true;
  }
} catch {}
function render() {
  try{localStorage.setItem(calculatorKey,JSON.stringify({expression,lastResult,justEvaluated}));}catch{}
  const raw = expression || '0';
  // Pretty-print operators for the top display without changing the eval string.
  let shown = raw.replace(/[+\-*/]/g, (c) => OP_DISPLAY[c] || c);
  // After '=', append "=" to the expression line to echo the evaluated form.
  if (justEvaluated && expression) shown += ' =';
  els.expression.textContent = shown;
  els.result.classList.toggle('error', String(lastResult) === 'Error');
  if (lastResult !== null) {
    els.result.textContent = lastResult;
    els.result.classList.remove('placeholder');
  } else {
    // Placeholder: echo the in-progress expression numerically (or 0).
    els.result.textContent = '0';
    els.result.classList.add('placeholder');
    els.result.classList.remove('error');
  }
}

function appendNum(d) {
  if (justEvaluated) { expression = ''; lastResult = null; justEvaluated = false; }
  expression += d;
  render();
}

function appendDot() {
  if (justEvaluated) { expression = ''; lastResult = null; justEvaluated = false; }
  // Only one dot per current number token.
  const tail = expression.split(/[+\-*/()]/).pop() || '';
  if (tail.includes('.')) return;
  // If no digit yet in this number, prefix with 0 for readability.
  if (!/\d$/.test(expression)) expression += '0';
  expression += '.';
  render();
}

function appendOp(op) {
  if (justEvaluated && lastResult !== null && String(lastResult) !== 'Error') {
    expression = String(lastResult);
    lastResult = null;
    justEvaluated = false;
  }
  // Replace a trailing operator instead of stacking.
  if (/[+\-*/]$/.test(expression)) {
    expression = expression.slice(0, -1) + op;
  } else if (expression === '' && op !== '-') {
    // Don't let the expression start with +, *, /. A leading '-' is fine.
    return;
  } else {
    expression += op;
  }
  render();
}

function appendParen(which) {
  if (justEvaluated) { expression = ''; lastResult = null; justEvaluated = false; }
  if (which === '(') {
    // Insert implicit multiplication if a digit or ')' precedes.
    if (/[\d)]$/.test(expression)) expression += '*';
    expression += '(';
  } else {
    // Only close if there's an unmatched '(' and the previous char isn't an operator/'('.
    const opens = (expression.match(/\(/g) || []).length;
    const closes = (expression.match(/\)/g) || []).length;
    if (opens <= closes) return;
    if (/[+\-*/(]$/.test(expression) || expression === '') return;
    expression += ')';
  }
  render();
}

function backspace() {
  if (justEvaluated) { lastResult = null; justEvaluated = false; render(); return; }
  expression = expression.slice(0, -1);
  render();
}

function clearAll() {
  expression = '';
  lastResult = null;
  justEvaluated = false;
  render();
}

function evaluate() {
  if (!expression) return;
  if (!SAFE_RE.test(expression)) {
    lastResult = 'Error';
    justEvaluated = true;
    render();
    return;
  }
  // Auto-close any open parens for convenience.
  let toEval = expression;
  const opens = (toEval.match(/\(/g) || []).length;
  const closes = (toEval.match(/\)/g) || []).length;
  for (let i = 0; i < opens - closes; i++) toEval += ')';

  try {
    // Safe because SAFE_RE restricts characters to digits + operators + parens.
    // No identifiers, no property access, nothing else can pass.
    const value = Function('"use strict"; return (' + toEval + ')')();
    if (typeof value !== 'number' || !isFinite(value)) {
      lastResult = typeof value === 'number' ? String(value) : 'Error';
    } else {
      // Trim floating-point noise.
      lastResult = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)));
    }
  } catch {
    lastResult = 'Error';
  }
  justEvaluated = true;
  render();
}

els.keys.addEventListener('click', (e) => {
  const btn = e.target.closest('button.key');
  if (!btn || currentView?.failed || currentView?.phase!=='running') return;
  const action = btn.dataset.action;
  switch (action) {
    case 'num':         appendNum(btn.dataset.value); break;
    case 'dot':         appendDot(); break;
    case 'op':          appendOp(btn.dataset.value); break;
    case 'paren-open':  appendParen('('); break;
    case 'paren-close': appendParen(')'); break;
    case 'backspace':   backspace(); break;
    case 'clear':       clearAll(); break;
    case 'equals':      evaluate(); break;
  }
});

// Basic keyboard support for desktop testing.
document.addEventListener('keydown', (e) => {
  if (els.calcSection.hidden || currentView?.failed || currentView?.phase!=='running') return;
  const k = e.key;
  if (/^[0-9]$/.test(k))         { appendNum(k); e.preventDefault(); return; }
  if (k === '.')                 { appendDot(); e.preventDefault(); return; }
  if ('+-*/'.includes(k))        { appendOp(k); e.preventDefault(); return; }
  if (k === '(' || k === ')')    { appendParen(k); e.preventDefault(); return; }
  if (k === 'Enter' || k === '=') { evaluate(); e.preventDefault(); return; }
  if (k === t('Backspace'))         { backspace(); e.preventDefault(); return; }
  if (k === 'Escape' || k === 'c' || k === 'C') { clearAll(); e.preventDefault(); return; }
});

render();
