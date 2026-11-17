// Authoritative delivery rules. Session JSON persists cursors and locked answers.
const exam=()=>require('./exam');
const grading=require('./grading');
const type=s=>s.deliveryType||'free';
const sequential=s=>type(s)!=='free';
const order=(s,st)=>st.questionOrder||s.test.questions.map(q=>q.id);
const index=(s,st)=>type(s)==='teacher'?(s.teacherQuestion||0):(st.questionCursor||0);
function options(input){
 const deliveryType=input.deliveryType??'free',onlyOneAttempt=input.onlyOneAttempt??false,immediateFeedback=input.immediateFeedback??false,requireStudentNumber=input.requireStudentNumber??true;
 if(!['free','one','teacher'].includes(deliveryType)||[onlyOneAttempt,immediateFeedback,requireStudentNumber].some(v=>typeof v!=='boolean'))throw Error('Invalid test delivery options');
 return {deliveryType,onlyOneAttempt:deliveryType==='free'&&onlyOneAttempt,immediateFeedback:deliveryType!=='free'&&immediateFeedback,requireStudentNumber,...(input.deliveryType!==undefined?{deliveryVersion:1}:{})};
}
function writable(s,id){const e=exam(),st=e.student(s,id);if(s.mode!=='test'||s.phase!=='running'||st.submission||e.isFailed(st))throw Error('Test answers are locked');return st;}
function mergedAnswers(s,st,answers){
 const valid=exam().validateAnswers(s,answers),locked=st.committedAnswers||{};
 for(const [id,value]of Object.entries(valid)){
  if(Object.hasOwn(locked,id)&&locked[id]!==value)throw Error('This answer has already been submitted');
  if(sequential(s)&&!Object.hasOwn(locked,id)&&id!==order(s,st)[index(s,st)])throw Error('Only the current question can be answered');
 }
 return {...valid,...locked};
}
function saveDraft(s,id,answers){const st=writable(s,id);st.draft=mergedAnswers(s,st,answers);}
function answerQuestion(s,id,questionId,answer,now=Date.now()){
 const st=writable(s,id);if(typeof questionId!=='string'||!s.test.questions.some(q=>q.id===questionId))throw Error('Invalid question');
 if(!sequential(s)&&!s.onlyOneAttempt)throw Error('Individual answer submission is unavailable');

 const valid=exam().validateAnswers(s,{[questionId]:answer});if(!String(answer).trim())throw Error('Enter an answer before continuing');
 st.committedAnswers||=Object.create(null);
 if(Object.hasOwn(st.committedAnswers,questionId)){if(st.committedAnswers[questionId]!==answer)throw Error('This answer has already been submitted');return;}
 if(sequential(s)&&order(s,st)[index(s,st)]!==questionId)throw Error('This question is no longer open');
 st.committedAnswers[questionId]=valid[questionId];st.draft={...st.draft,...st.committedAnswers};st.progressQuestionId=questionId;st.lastSeen=now;
 if(type(s)==='one'&&!s.immediateFeedback)st.questionCursor=index(s,st)+1;
}
function nextQuestion(s,id,questionId){const st=writable(s,id);if(type(s)!=='one')throw Error('Your professor controls the next question');if(typeof questionId!=='string')throw Error('Invalid question position');const qid=order(s,st)[index(s,st)];if(qid!==questionId){if(Object.hasOwn(st.committedAnswers||{},questionId))return;throw Error('Invalid question position');}if(s.immediateFeedback&&grading.assessment(s.test.questions.find(q=>q.id===qid),st.committedAnswers?.[qid],st).pending)throw Error('Answer is still grading');if(!Object.hasOwn(st.committedAnswers||{},qid))throw Error('Submit this answer first');st.questionCursor=index(s,st)+1;}
function advanceQuestion(s,ownerId,expected,now=Date.now()){if(s.ownerId!==ownerId)throw Error('Session not found');exam().sweep(s,now);if(type(s)!=='teacher'||s.phase!=='running')throw Error('Teacher Lead is not running');if(!Number.isInteger(expected)||expected<0||expected>s.test.questions.length)throw Error('Invalid question position');if(expected!==(s.teacherQuestion||0))return;const qid=s.test.questions[expected]?.id;for(const st of s.students){if(st.submission)continue;if(typeof st.draft?.[qid]==='string'&&st.draft[qid].trim()){st.committedAnswers||=Object.create(null);st.committedAnswers[qid]=st.draft[qid];}else if(st.draft){delete st.draft[qid];}}s.teacherQuestion=Math.min(s.test.questions.length,expected+1);}
function flow(s,st){
 const ids=order(s,st),i=index(s,st),id=ids[i],locked=Object.hasOwn(st.committedAnswers||{},id),ready=sequential(s)&&(i>=ids.length||(type(s)==='teacher'&&i===ids.length-1&&locked));
 const value={type:type(s),onlyOneAttempt:!!s.onlyOneAttempt,immediateFeedback:!!s.immediateFeedback,total:ids.length,index:i,questionId:id||null,locked,readyToSubmit:ready,lockedIds:Object.keys(st.committedAnswers||{})};
 if(s.immediateFeedback&&locked&&s.phase==='running'&&!st.submission){const q=s.test.questions.find(q=>q.id===id),a=st.committedAnswers[id],choice=q.options?.find(o=>o.id===a),key=q.options?.find(o=>o.id===q.correctOptionId);const aResult=grading.assessment(q,a,st);value.feedback=aResult.pending?{pending:true}:{question:q.text,answer:grading.textQuestion(q)?a:choice?.text||'',correct:grading.answerKey(q),isCorrect:aResult.points===aResult.maxPoints,points:aResult.points,maxPoints:aResult.maxPoints,explanation:aResult.explanation};}
 return value;
}
function visibleQuestions(s,st){if(!sequential(s))return order(s,st);const id=order(s,st)[index(s,st)];return id?[id]:[];}
function compareStudents(s,a,b){return s.requireStudentNumber===false?a.name.localeCompare(b.name, s.language==='ko'?'ko':'en')||a.number.localeCompare(b.number):a.number.localeCompare(b.number,'en',{numeric:true})||a.number.localeCompare(b.number);}
module.exports={options,type,sequential,index,order,saveDraft,mergedAnswers,answerQuestion,nextQuestion,advanceQuestion,flow,visibleQuestions,compareStudents};
