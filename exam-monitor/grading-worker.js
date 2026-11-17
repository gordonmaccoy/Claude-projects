const {randomUUID}=require('node:crypto'),grading=require('./grading');
function createGradingWorker({store,grade,broadcast=async()=>{}}){
 const running=new Map();let closed=false,ticking=false;
 async function run(id){
  // Claims are persisted under the session row lock; provider calls never hold it.
  for(let i=0;i<8&&!closed;i++){
   const {session,result:job}=await store.mutate(id,s=>{grading.prepare(s);const now=Date.now();for(const st of s.students)for(const q of s.test?.questions||[]){const g=st.grades?.[q.id];if(!g||g.status==='graded'||(g.status==='processing'&&g.leaseUntil>now)||(g.nextAttemptAt||0)>now)continue;const claim=randomUUID();g.status='processing';g.claim=claim;g.leaseUntil=now+120000;g.attempts=(g.attempts||0)+1;return {studentId:st.id,questionId:q.id,key:g.key,claim,question:q,answer:(st.submission?.answers||st.committedAnswers)[q.id]};}return null;});
   if(!job)return;await broadcast(session);
   let value,error;try{value=await grade(job.question,job.answer);}catch(e){error=e;}
   const updated=await store.mutate(id,s=>{const g=s.students.find(st=>st.id===job.studentId)?.grades?.[job.questionId];if(!g||g.key!==job.key||g.claim!==job.claim)return;
    if(!error){try{grading.complete(s,job.studentId,job.questionId,job.key,value);return;}catch(e){error=e;}}
    g.status='pending';g.nextAttemptAt=Date.now()+Math.min(3600000,15000*2**Math.min(g.attempts-1,8));g.error='AI grading is delayed. Retrying automatically.';delete g.claim;delete g.leaseUntil;grading.prepare(s);
   });await broadcast(updated.session);
  }
 }
 function process(id){if(closed)return Promise.resolve();if(running.has(id))return running.get(id);const p=run(id).finally(()=>running.delete(id));running.set(id,p);return p;}
 async function tick(){if(ticking||closed)return;ticking=true;try{const sessions=await store.gradingSessions?.()||[];for(let i=0;i<sessions.length;i+=2)await Promise.all(sessions.slice(i,i+2).map(s=>process(s.id)));}finally{ticking=false;}}
 return {process,tick,async close(){closed=true;await Promise.allSettled([...running.values()]);}};
}
module.exports={createGradingWorker};
