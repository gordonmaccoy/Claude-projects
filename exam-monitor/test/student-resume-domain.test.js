const {test}=require('node:test'),assert=require('node:assert/strict'),exam=require('../exam');
const token='original-client-private-resume-capability-24010001';
const wrongToken='different-client-private-resume-capability-24010001';
const reload=s=>JSON.parse(JSON.stringify(s));
function enrolled(){
 const quiz=exam.validateTest({title:'Resume regression',questions:[
  {id:'choice',type:'mc',text:'Choose A',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'},
  {id:'blank',type:'blank',text:'Write yes',acceptedAnswers:['yes']}
 ]});
 const s=exam.newSession('professor',quiz,1000,{durationMinutes:10});
 const credentials=exam.join(s,{name:'Alex',number:'24010001',resumeToken:token},1100);
 return {s,credentials};
}
test('original persisted client token resumes same attempt and draft across serialized reload',()=>{
 const {s,credentials}=enrolled();exam.start(s,2000);s.students[0].draft=exam.validateAnswers(s,{choice:'a',blank:'yes'});exam.progress(s,credentials.studentId,'blank');
 const restored=reload(s),before=structuredClone(restored);
 assert.deepEqual(exam.join(restored,{resumeToken:token},5000),credentials);assert.deepEqual(restored,before);assert.equal(restored.students.length,1);
 const view=exam.studentView(restored,restored.students[0]);assert.deepEqual(view.draft,{choice:'a',blank:'yes'});assert.equal(view.phase,'running');assert.equal(view.failed,false);assert.equal(restored.deadlineAt,602000);assert.equal(restored.students[0].progressQuestionId,'blank');
});
test('lost enrollment ACK retries with original token are idempotent with or without name and number',()=>{
 const {s,credentials}=enrolled();let restored=reload(s);
 for(const request of [{resumeToken:token},{name:'Alex',number:'24010001',resumeToken:token}]){assert.deepEqual(exam.join(restored,request,3000),credentials);restored=reload(restored);assert.equal(restored.students.length,1);}
 assert.equal(restored.students[0].name,'Alex');assert.equal(restored.students[0].number,'24010001');assert.equal(restored.students[0].tokenHash,exam.hash(token));
});
test('name and number or a wrong token cannot take over the existing attempt',()=>{
 const {s}=enrolled(),restored=reload(s),before=structuredClone(restored);
 for(const request of [{name:'Alex',number:'24010001'},{name:'Alex',number:'24010001',resumeToken:wrongToken},{name:'Imposter',number:'24010001',resumeToken:wrongToken},{resumeToken:wrongToken},{resumeToken:'invalid'}])assert.throws(()=>exam.join(restored,request,4000),/already joined|Invalid resume token/);
 assert.deepEqual(restored,before);
});
test('resume preserves a paused attempt, its remaining time and draft',()=>{
 const {s,credentials}=enrolled();exam.start(s,2000);s.students[0].draft=exam.validateAnswers(s,{choice:'b'});exam.pause(s,'professor',3000);
 const restored=reload(s),before=structuredClone(restored);assert.deepEqual(exam.join(restored,{resumeToken:token},9000),credentials);assert.deepEqual(restored,before);assert.equal(restored.phase,'paused');assert.equal(restored.remainingMs,599000);assert.deepEqual(exam.studentView(restored,restored.students[0]).draft,{choice:'b'});assert.throws(()=>exam.submit(restored,credentials.studentId,{choice:'a'},9001),/not running/);
});
test('resume preserves a failed attempt and cannot bypass the professor lock',()=>{
 const {s,credentials}=enrolled();exam.start(s,2000);s.students[0].draft=exam.validateAnswers(s,{choice:'a'});exam.visibility(s,credentials.studentId,false,3000);exam.sweep(s,8001);
 const restored=reload(s),before=structuredClone(restored);assert.deepEqual(exam.join(restored,{resumeToken:token},9000),credentials);assert.deepEqual(restored,before);assert.equal(exam.isFailed(restored.students[0]),true);assert.equal(exam.studentView(restored,restored.students[0]).failed,true);assert.throws(()=>exam.submit(restored,credentials.studentId,{choice:'a'},9001),/Call professor/);assert.equal(restored.students.length,1);
});
test('resume preserves submitted and ended results without reopening the attempt',()=>{
 const {s,credentials}=enrolled();exam.start(s,2000);exam.submit(s,credentials.studentId,{choice:'a',blank:'yes'},3000);
 for(const phase of ['running','ended']){const restored=reload(s);restored.phase=phase;if(phase==='ended')restored.endedAt=4000;const before=structuredClone(restored);assert.deepEqual(exam.join(restored,{resumeToken:token},5000),credentials);assert.deepEqual(restored,before);const view=exam.studentView(restored,restored.students[0]);assert.equal(view.result.score,2);assert.equal(view.result.percentage,100);assert.equal(view.test,null);assert.deepEqual(view.draft,{});assert.throws(()=>exam.submit(restored,credentials.studentId,{choice:'b'},5001),/already submitted|not running/);}
});
