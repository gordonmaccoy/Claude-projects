const {createHash}=require('node:crypto');
const round=n=>Math.round(n*100)/100;
const normalize=s=>String(s||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const textQuestion=q=>q.type==='blank'||q.type==='short';
const answerKey=q=>q.type==='short'?q.modelAnswer:q.type==='blank'?q.acceptedAnswers.join(' / '):q.options?.find(o=>o.id===q.correctOptionId)?.text||'';
function assessment(q,answer,st,{original=false}={}){
 const max=q.points??1;
 if(q.type!=='short'){const correct=require('./exam').correctAnswer(q,answer);return {points:correct?max:0,maxPoints:max,status:answer?(correct?'correct':'incorrect'):'pending',pending:false,explanation:''};}
 if(!original&&st?.grades?.[q.id]?.override){const g=st.grades[q.id],points=g.override.points;return {points,maxPoints:max,status:points===max?'correct':points===0?'incorrect':'partial',pending:false,explanation:g.override.reason,aiPoints:g.status==='graded'?g.aiPoints:null,override:g.override};}
 if(!String(answer||'').trim())return {points:0,maxPoints:max,status:'incorrect',pending:false,explanation:'Unanswered.'};
 if(normalize(answer)===normalize(q.modelAnswer))return {points:max,maxPoints:max,status:'correct',pending:false,explanation:'Matches the model answer.'};
 const g=st?.grades?.[q.id],points=!original&&g?.override?g.override.points:g?.status==='graded'?g.aiPoints:null;
 return {points,maxPoints:max,status:points===null?'grading':points===max?'correct':points===0?'incorrect':'partial',pending:points===null,explanation:!original&&g?.override?g.override.reason:g?.explanation||'',aiPoints:g?.status==='graded'?g.aiPoints:null,override:g?.override||null};
}
function total(test,answers,st,original=false){let n=0;for(const q of test.questions){const a=assessment(q,answers[q.id],st,{original});if(a.pending)return null;n+=Math.round(a.points*100);}return n/100;}
function prepare(s){
 if(!s.test?.questions?.some(q=>q.type==='short'))return;
 let pending=false;
 for(const st of s.students){const answers=st.submission?.answers||st.committedAnswers||{};
  for(const q of s.test.questions.filter(q=>q.type==='short')){
   const answer=answers[q.id];if(!Object.hasOwn(answers,q.id))continue;
   const key=createHash('sha256').update(JSON.stringify([q,answer])).digest('hex');st.grades||={};
   if(st.grades[q.id]?.key!==key){const a=assessment(q,answer,null);Object.defineProperty(st.grades,q.id,{enumerable:true,configurable:true,writable:true,value:{key,status:a.pending?'pending':'graded',...(a.pending?{}:{aiPoints:a.points,explanation:a.explanation}),attempts:0,nextAttemptAt:0}});}
   if(st.grades[q.id].status!=='graded')pending=true;
  }
  if(st.submission)st.submission.originalScore=total(s.test,st.submission.answers,st,true);
 }
 s.gradingPending=pending;
}
function complete(s,studentId,questionId,key,value){
 const st=s.students.find(st=>st.id===studentId),q=s.test.questions.find(q=>q.id===questionId),g=st?.grades?.[questionId];
 if(!g||g.key!==key||g.status==='graded')return false;
 if(typeof value.points!=='number'||!Number.isFinite(value.points)||typeof value.explanation!=='string')throw Error('Invalid AI assessment');
 g.status='graded';g.aiPoints=round(Math.max(0,Math.min(q.points??1,value.points)));g.explanation=value.explanation.slice(0,1000);g.gradedAt=Date.now();delete g.claim;delete g.leaseUntil;prepare(s);return true;
}
function override(s,studentId,questionId,ownerId,points,reason,now=Date.now()){
 if(s.ownerId!==ownerId)throw Error('Session not found');
 const st=s.students.find(st=>st.id===studentId),q=s.test?.questions.find(q=>q.id===questionId);
 if(!st||!q||q.type!=='short'||!st.submission)throw Error('Invalid short answer submission');
 if(typeof points!=='number'||!Number.isFinite(points)||points<0||points>(q.points??1)||Math.abs(points*100-Math.round(points*100))>1e-6)throw Error('Invalid points');
 if(typeof reason!=='string'||!reason.trim()||reason.length>500)throw Error('Override reason required');
 prepare(s);st.grades||={};st.grades[q.id]||={status:'graded',aiPoints:0,explanation:'Unanswered.'};const g=st.grades[q.id];g.audit||=[];
 if(g.audit.length>=100)throw Error('Too many score changes');g.audit.push({at:now,ownerId,previous:g.override?.points??g.aiPoints??null,points,reason:reason.trim()});g.override={points,reason:reason.trim(),at:now,ownerId};prepare(s);
}
module.exports={assessment,total,prepare,complete,override,textQuestion,answerKey};
