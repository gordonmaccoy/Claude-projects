const { randomBytes, randomInt, createHash } = require('node:crypto');
const token = () => randomBytes(24).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
function validateTest(input) {
  let imageBudget=600000;
  function image(value) {
    if(value==null||value==='')return {};
    if(typeof value!=='string'||value.length>180000||value.length>imageBudget||
       !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return null;
    imageBudget-=value.length;
    return {image:value};
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 80) return null;
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 100) return null;

  const seenQuestions = new Set();
  const questions = [];
  for (const q of input.questions) {
    if (!q || typeof q !== 'object' || typeof q.id !== 'string' || !q.id || q.id.length > 100 || seenQuestions.has(q.id) ||
        typeof q.text !== 'string' || !q.text.trim() || q.text.length > 1000) return null;
    const picture=image(q.image);if(!picture)return null;
    seenQuestions.add(q.id);
    const points=q.points===undefined?1:q.points;
    if(typeof points!=='number'||!Number.isFinite(points)||points<=0||points>1000||Math.abs(points*100-Math.round(points*100))>0.000001)return null;
    const answerKeyConflict=q.answerKeyConflict===true;
    const answerExplanation=typeof q.answerExplanation==='string'?q.answerExplanation.slice(0,1000):'';
    const evidence = typeof q.evidence === 'string' ? q.evidence.slice(0,1000) : '';
    if (q.type === 'blank') {
      if (!Array.isArray(q.acceptedAnswers) || !q.acceptedAnswers.length || q.acceptedAnswers.length > 20 ||
          q.acceptedAnswers.some(a => typeof a !== 'string' || !a.trim() || a.length > 300) ||
          (q.caseSensitive !== undefined && typeof q.caseSensitive !== 'boolean')) return null;
      questions.push({ id:q.id, type:'blank', points,...picture,answerExplanation,answerKeyConflict, text:q.text.trim(), acceptedAnswers:[...new Set(q.acceptedAnswers.map(a=>a.trim()))], caseSensitive:q.caseSensitive === true, evidence });
      continue;
    }
    if ((q.type !== undefined && q.type !== 'mc') || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5 || typeof q.correctOptionId !== 'string') return null;
    const seenOptions = new Set(), options = [];
    for (const o of q.options) {
      if (!o || typeof o.id !== 'string' || !o.id || o.id.length > 100 || seenOptions.has(o.id) ||
          typeof o.text !== 'string' || !o.text.trim() || o.text.length > 500) return null;
      const optionPicture=image(o.image);if(!optionPicture)return null;
      seenOptions.add(o.id); options.push({id:o.id,text:o.text.trim(),...optionPicture});
    }
    if (!seenOptions.has(q.correctOptionId)) return null;
    questions.push({id:q.id,type:'mc',points,...picture,answerExplanation,answerKeyConflict,text:q.text.trim(),options,correctOptionId:q.correctOptionId,evidence});
  }
  return { title: input.title.trim(), questions };
}

function launchOptions(input={}) {
 const durationMinutes=input.durationMinutes??0,showScores=input.showScores??true,shuffleAnswers=input.shuffleAnswers??false,showCorrections=input.showCorrections??false;
 if(!Number.isInteger(durationMinutes)||durationMinutes<0||durationMinutes>360||typeof showScores!=='boolean'||typeof shuffleAnswers!=='boolean'||typeof showCorrections!=='boolean')throw new Error('Invalid launch options');
 return {durationMinutes,showScores,shuffleAnswers,showCorrections};
}
function newSession(ownerId, test, now = Date.now(), options={}) {
 const settings=launchOptions(options);
  return { id: randomBytes(6).toString('hex').toUpperCase(), ownerId, displayToken: token(),
    mode: test ? 'test' : 'calculator', test: test ? structuredClone(test) : null,
    phase: test ? 'waiting' : 'running', createdAt: now, startedAt: test ? null : now,
    ...settings,deadlineAt:null,extensionVersion:0,endedAt: null, students: [] };
}
function join(s, input, now = Date.now()) {
  if (typeof input.resumeToken === 'string') {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(input.resumeToken)) throw new Error('Invalid resume token');
    const st = s.students.find(x => x.tokenHash === hash(input.resumeToken));
    if (st) return { studentId: st.id, resumeToken: input.resumeToken };
    if (!input.name || !input.number) throw new Error('Invalid resume token');
  }
  if (s.phase === 'ended') throw new Error('Session ended');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const number = typeof input.number === 'string' ? input.number.trim() : '';
  if (!/^[0-9]{1,64}$/.test(number)) throw new Error('Student number must contain digits only (0–9)');
  if (!name || name.length > 80 || !number || number.length > 64 || /[\x00-\x1f]/.test(name + number)) throw new Error('Student number and name are required (maximum 64 / 80 characters)');
  if (s.students.some(x => x.number === number)) throw new Error('Student number already joined. Resume on the original browser or ask your professor.');
  if (s.students.length >= 1000) throw new Error('Classroom is full');
  const resumeToken = input.resumeToken || token();
  const st = { id: token(), tokenHash: hash(resumeToken), number, name, visible: true, lastSeen: now,
    hiddenSince: null, failedAt: null, overrideAt: null, draft: {}, submission: null, events: [] };
  if(s.shuffleAnswers && s.test){st.optionOrder={};for(const q of s.test.questions){if(q.type==='blank')continue;const order=q.options.map(o=>o.id);for(let i=order.length-1;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}st.optionOrder[q.id]=order;}}
  s.students.push(st);
  return { studentId: st.id, resumeToken };
}
function student(s, id) {
  const st = s.students.find(x => x.id === id);
  if (!st) throw new Error('Student not found');
  return st;
}
function isFailed(st) { return st.failedAt !== null && st.overrideAt === null; }
function sweep(s, now = Date.now()) {
  let changed = false;
  if (s.phase !== 'running') return false;
  const cutoff=s.deadlineAt && now>=s.deadlineAt?s.deadlineAt:now;
  for (const st of s.students) {
    if (!st.completedAt && !st.submission && !isFailed(st) && st.hiddenSince !== null && cutoff - st.hiddenSince > 5000) {
      st.failedAt = cutoff; st.overrideAt = null;
      st.events.push({ type: 'fail', at: cutoff, hiddenSince: st.hiddenSince });
      changed = true;
    }
  }
  if(s.deadlineAt && now>=s.deadlineAt){
    for(const st of s.students)if(!st.submission){const answers=validateAnswers(s,st.draft||{});st.submission={answers,originalScore:scoreAnswers(s.test,answers),submittedAt:s.deadlineAt,autoSubmitted:true};st.draft={};st.events.push({type:'time-expired',at:s.deadlineAt});}
    s.phase='ended';s.endedAt=s.deadlineAt;changed=true;
  }
  return changed;
}
function extend(s,ownerId,minutes=1,now=Date.now()){
 if(s.ownerId!==ownerId)throw new Error('Session not found');
 sweep(s,now);
 if(s.mode!=='test'||s.phase!=='running'||!s.deadlineAt||!Number.isInteger(minutes)||minutes<1||minutes>60)throw new Error('Invalid timer extension; test ended or has no timer');
 s.deadlineAt+=minutes*60000;s.extensionVersion=(s.extensionVersion||0)+1;s.lastExtension={at:now,minutes,professorId:ownerId};
}
function start(s, now = Date.now()) {
  if (s.phase !== 'waiting') throw new Error('Test is not waiting');
  s.phase = 'running'; s.startedAt = now; s.deadlineAt=s.durationMinutes?now+s.durationMinutes*60000:null;
  for (const st of s.students) st.hiddenSince = st.visible ? null : now;
}
function visibility(s, id, visible, now = Date.now()) {
  if (typeof visible !== 'boolean') throw new Error('Invalid visibility');
  sweep(s, now); // evaluate the elapsed interval BEFORE a return clears it
  const st = student(s, id);
  if (st.completedAt || st.submission || s.phase === 'ended') return;
  const wasVisible = st.visible;
  if (st.visible !== visible) st.events.push({ type: visible ? 'visible' : 'hidden', at: now });
  st.visible = visible; st.lastSeen = now;
  if (visible) st.hiddenSince = null;
  else if (s.phase === 'running' && st.hiddenSince === null && wasVisible) st.hiddenSince = now;
}
function validateAnswers(s, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('Invalid answers');
  const valid = Object.create(null);
  for (const [id, value] of Object.entries(answers)) {
    const q = s.test?.questions.find(q => q.id === id);
    if (!q) throw new Error('Invalid question');
    if (q.type === 'blank') { if (typeof value !== 'string' || value.length > 300) throw new Error('Invalid blank answer'); }
    else if (!q.options.some(o => o.id === value)) throw new Error('Invalid answer option');
    valid[id] = value;
  }
  return valid;
}
function correctAnswer(q, answer) {
  const normalize=(value,sensitive)=> { const v=String(value || '').normalize('NFKC').trim().replace(/\s+/g,' '); return sensitive ? v : v.toLowerCase(); };
  return q.type==='blank'?q.acceptedAnswers.some(a=>normalize(a,q.caseSensitive)===normalize(answer,q.caseSensitive)):answer===q.correctOptionId;
}
function scoreAnswers(test,answers) {
  return test.questions.reduce((sum,q)=>sum+(correctAnswer(q,answers[q.id])?Math.round((q.points??1)*100):0),0)/100;
}
function incorrectAnswers(s,st) {
  if(!st.submission||!s.test)return [];
  return s.test.questions.flatMap((q,index)=>{
    const answer=st.submission.answers?.[q.id];
    if(correctAnswer(q,answer))return [];
    const chosen=q.options?.find(o=>o.id===answer), key=q.options?.find(o=>o.id===q.correctOptionId);
    return [{number:index+1,question:q.text,image:q.image,answer:q.type==='blank'?(answer?.trim()||''):chosen?.text||'',
      correct:q.type==='blank'?q.acceptedAnswers.join(' / '):key?.text||'',answerImage:chosen?.image,correctImage:key?.image}];
  });
}
function detailedResults(s) {
  return s.students.map(st=>({number:st.number,name:st.name,submitted:Boolean(st.submission),incorrect:incorrectAnswers(s,st).map(({image,answerImage,correctImage,...row})=>row)}));
}
function completeCalculator(s,id,now=Date.now()) {
  const st=student(s,id);
  if(s.mode!=='calculator'||s.phase!=='running'||isFailed(st))throw Error('Calculator cannot be completed in this state');
  if(!st.completedAt){st.completedAt=now;st.hiddenSince=null;st.events.push({type:'calculator-completed',at:now});}
}
function totalPoints(test){return (test?.questions||[]).reduce((sum,q)=>sum+Math.round((q.points??1)*100),0)/100;}
function result(s, st) {
  if (!st.submission) return null;
  const score = isFailed(st) ? 0 : st.submission.originalScore;
  return { score, originalScore: st.submission.originalScore, total: totalPoints(s.test),
    percentage: Math.round(score / totalPoints(s.test) * 10000) / 100,
    failed: isFailed(st), submittedAt: st.submission.submittedAt };
}
function submit(s, id, answers, now = Date.now()) {
  sweep(s,now);
  if (s.mode !== 'test' || s.phase !== 'running') throw new Error('Test is not running');
  const st = student(s, id);
  if (st.submission) throw new Error('Student already submitted');
  const valid = validateAnswers(s, answers);
  sweep(s, now);
  if (isFailed(st)) throw new Error('Call professor: activity is locked');
  st.submission = { answers: valid, originalScore: scoreAnswers(s.test, valid), submittedAt: now };
  st.draft = {};
  return result(s, st);
}
function progress(s,id,questionId) {
 const st=student(s,id);
 if(s.mode!=='test'||s.phase!=='running'||st.submission||isFailed(st))throw new Error('Invalid progress state');
 if(typeof questionId!=='string'||!s.test.questions.some(q=>q.id===questionId)||typeof st.draft?.[questionId]!=='string'||!st.draft[questionId].trim())throw new Error('Invalid answered question');
 st.progressQuestionId=questionId;
}
function finalizeFail(s,id,professorId,reason,now=Date.now()) {
 if(s.ownerId!==professorId)throw new Error('Session not found');
 const st=student(s,id);
 if(s.mode!=='test'||!isFailed(st)||st.submission)throw new Error('Invalid failed test enrollment');
 if(typeof reason!=='string'||!reason.trim()||reason.length>500)throw new Error('Reason required (maximum 500 characters)');
 const answers=validateAnswers(s,st.draft||{});
 st.submission={answers,originalScore:scoreAnswers(s.test,answers),submittedAt:now,professorFinalized:true};st.draft={};
 st.events.push({type:'fail-submitted',at:now,professorId,reason:reason.trim()});
}
function override(s, id, professorId, reason, now = Date.now()) {
  if (s.ownerId !== professorId) throw new Error('Session not found');
  const st = student(s, id);
  if(st.submission?.professorFinalized)throw new Error('Finalized fail score cannot be unlocked');
  if (!isFailed(st)) throw new Error('Student has no active failure');
  if(!st.submission && s.phase!=='running')throw new Error('Session ended; continuation is unavailable');
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw new Error('Override reason required (maximum 500 characters)');
  st.overrideAt = now;
  // Forgive the existing interval; any later hidden transition can create a new incident.
  st.hiddenSince = null;
  st.events.push({ type: 'override', at: now, professorId, reason: reason.trim() });
}
function status(st, now) { if(st.completedAt)return 'green'; if(st.submission) return isFailed(st)?'red':'green'; return isFailed(st) || !st.visible || now - st.lastSeen > 10000 ? 'red' : 'green'; }
function publicView(s, now = Date.now()) {
  return { title: s.resultTitle || s.test?.title || 'Classroom calculator', phase: s.phase,deadlineAt:s.deadlineAt||null,
    students: s.students.map(st => ({ name: st.name, status: isFailed(st)?'failed':st.completedAt?'completed':st.submission?'submitted':status(st,now) })) };
}
function privateView(s, now = Date.now()) {
  return { id: s.id, mode: s.mode, title: s.resultTitle || s.test?.title || 'Classroom calculator', phase: s.phase,
    durationMinutes:s.durationMinutes||0,deadlineAt:s.deadlineAt||null,showScores:s.showScores!==false,shuffleAnswers:!!s.shuffleAnswers,extensionVersion:s.extensionVersion||0,
    createdAt: s.createdAt, startedAt: s.startedAt, endedAt: s.endedAt, displayToken: s.displayToken,
    students: s.students.map(st => ({ id: st.id, number: st.number, name: st.name, status: status(st, now),
      failed: isFailed(st), completed:Boolean(st.completedAt), result: result(s, st), events: st.events,
      finalized:Boolean(st.submission?.professorFinalized),
      progress:s.mode==='test'?{question:Math.max(0,s.test.questions.findIndex(q=>q.id===st.progressQuestionId)+1),answered:s.test.questions.filter(q=>{const a=(st.submission?.answers||st.draft||{})[q.id];return typeof a==='string'&&a.trim();}).length,total:s.test.questions.length}:null,
      score: result(s, st)?.score ?? (isFailed(st) ? 0 : null), total: totalPoints(s.test) })) };
}
function studentView(s, st) {
  const internal=result(s,st);const final=internal?{score:internal.score,total:internal.total,percentage:internal.percentage,failed:internal.failed,submittedAt:internal.submittedAt}:null;
  return { phase: s.phase, mode: s.mode, name: st.name, failed: isFailed(st), completed:Boolean(st.completedAt),terminal:Boolean(st.completedAt||st.submission?.professorFinalized),deadlineAt:s.deadlineAt||null,extensionVersion:s.extensionVersion||0,lastExtension:s.lastExtension?{minutes:s.lastExtension.minutes}:null,
    test: s.test && s.phase === 'running' && !st.submission ? { title: s.resultTitle || s.test.title,
      questions: s.test.questions.map(q => ({ id: q.id, type:q.type || 'mc', points:q.points??1,text: q.text, ...(q.image?{image:q.image}:{}), ...(q.type === 'blank' ? {} : {options:st.optionOrder?.[q.id]?st.optionOrder[q.id].map(id=>q.options.find(o=>o.id===id)):q.options}) })) } : null,
    ...(final && !final.failed && s.showCorrections===true?{corrections:incorrectAnswers(s,st)}:{}),
    draft: st.submission ? {} : st.draft, result:final && s.showScores===false?{hidden:true,failed:final.failed,submittedAt:final.submittedAt}:final };
}
module.exports = { validateTest, newSession, join, student, start, sweep, visibility, submit, override,
  launchOptions,detailedResults,completeCalculator,totalPoints,extend,finalizeFail, progress, scoreAnswers, validateAnswers, publicView, privateView, studentView, hash, isFailed };

