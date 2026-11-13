const {test}=require('node:test'),assert=require('node:assert/strict'),exam=require('../exam');
const quiz={title:'Security',questions:Array.from({length:5},(_,i)=>({id:'q'+i,text:'Question '+i,options:[{id:'a',text:'Yes'},{id:'b',text:'No'}],correctOptionId:'a'}))};
const setup=security=>{const s=exam.newSession('p',quiz,1000,{security,shuffleAnswers:true});const j=exam.join(s,{number:'001',name:'Kim'},1000);return {s,id:j.studentId,st:s.students[0]};};
test('master off disables every deterrent, leaves green and records no events while grading and timer still work',()=>{
const {s,id,st}=setup({enabled:false,shuffleQuestions:true});exam.start(s,2000);exam.visibility(s,id,false,3000);exam.securityEvent(s,id,'focus-lost',3100);exam.sweep(s,10000);
assert.equal(exam.isFailed(st),false);assert.equal(exam.publicView(s,30000).students[0].status,'green');assert.equal(exam.privateView(s,30000).students[0].status,'green');assert.deepEqual(st.events,[]);assert.equal(st.optionOrder,undefined);assert.equal(st.questionOrder,undefined);assert.ok(Object.values(exam.studentView(s,st).security).every(v=>v===false));
assert.equal(exam.submit(s,id,{q0:'a'},11000).score,1);
});
test('failure and visibility logging are independent; focus and fullscreen never fail',()=>{
let {s,id,st}=setup({inactivityFail:false});exam.start(s,2000);exam.visibility(s,id,false,3000);exam.sweep(s,10000);assert.equal(exam.isFailed(st),false);assert.equal(st.events[0].type,'hidden');
({s,id,st}=setup({tabVisibility:false}));exam.start(s,2000);exam.visibility(s,id,false,3000);assert.deepEqual(st.events,[]);exam.sweep(s,8000);assert.equal(exam.isFailed(st),false);exam.sweep(s,8001);assert.equal(exam.isFailed(st),true);
({s,id,st}=setup({}));exam.start(s,2000);exam.securityEvent(s,id,'focus-lost',3000);exam.securityEvent(s,id,'focus-lost',3001);exam.securityEvent(s,id,'fullscreen-entered',3002);exam.securityEvent(s,id,'fullscreen-exit',3003);exam.sweep(s,20000);assert.equal(exam.isFailed(st),false);assert.deepEqual(st.events.map(e=>e.type),['focus-lost','fullscreen-entered','fullscreen-exit']);assert.throws(()=>exam.securityEvent(s,id,'fail',21000),/Invalid/);
});
test('no deterrent events while waiting, paused or finished; independent switches are honored',()=>{
const {s,id,st}=setup({focusVisibility:false,fullscreen:false,inactivityFail:false});exam.securityEvent(s,id,'focus-lost',1100);exam.visibility(s,id,false,1200);assert.deepEqual(st.events,[]);exam.start(s,2000);exam.securityEvent(s,id,'focus-lost',2100);exam.securityEvent(s,id,'fullscreen-entered',2100);assert.deepEqual(st.events,[]);exam.pause(s,'p',3000);exam.visibility(s,id,true,4000);exam.visibility(s,id,false,5000);exam.securityEvent(s,id,'focus-lost',5100);assert.deepEqual(st.events,[]);exam.resume(s,'p',6000);exam.visibility(s,id,true,6100);exam.submit(s,id,{},6200);const n=st.events.length;exam.securityEvent(s,id,'focus-lost',6300);exam.visibility(s,id,false,6400);assert.equal(st.events.length,n);
});
test('question shuffling persists per student, grades IDs, maps corrections and progress without leaking keys',()=>{
const {s,id,st}=setup({shuffleQuestions:true});exam.start(s,2000);assert.deepEqual([...st.questionOrder].sort(),quiz.questions.map(q=>q.id).sort());const first=exam.studentView(s,st).test.questions;assert.deepEqual(first.map(q=>q.id),st.questionOrder);assert.deepEqual(exam.studentView(JSON.parse(JSON.stringify(s)),st).test.questions,first);assert.equal(first[0].correctOptionId,undefined);st.draft={[st.questionOrder[0]]:'a'};exam.progress(s,id,st.questionOrder[0]);assert.equal(exam.privateView(s).students[0].progress.question,1);const answers=Object.fromEntries(st.questionOrder.map(id=>[id,'a']));assert.equal(exam.submit(s,id,answers,3000).score,5);
});
test('security flags reject nonbooleans, unknown fields and preserve legacy policy',()=>{
for(const security of [{enabled:'false'},{fullscreen:1},{unknown:true},null,[]])assert.throws(()=>setup(security),/Invalid/);
const {s,st}=setup({});delete s.security;assert.equal(exam.studentView(s,st).security.fullscreen,false);assert.equal(exam.studentView(s,st).security.focusVisibility,false);assert.equal(exam.studentView(s,st).security.inactivityFail,true);
});
test('shuffled corrections follow student numbering while teacher detailed columns stay canonical',()=>{
const {s,id,st}=setup({shuffleQuestions:true});s.showCorrections=true;st.questionOrder=['q4','q3','q2','q1','q0'];exam.start(s,2000);exam.submit(s,id,{q4:'b',q0:'b'},3000);const corrections=exam.studentView(s,st).corrections;assert.deepEqual(corrections.map(r=>r.number),[1,2,3,4,5]);assert.equal(corrections[0].question,'Question 4');assert.equal(exam.detailedResults(s)[0].answers[0].question,'Question 0');
});
test('master off still auto-submits at deadline and completes calculators without monitoring events',()=>{
const {s,id,st}=setup({enabled:false});s.durationMinutes=1;exam.start(s,2000);st.draft={q0:'a'};exam.sweep(s,62000);assert.equal(st.submission.originalScore,1);assert.deepEqual(st.events,[]);
const calc=exam.newSession('p',null,1000,{security:{enabled:false}}),joined=exam.join(calc,{name:'Kim',number:'1'},1000);exam.completeCalculator(calc,joined.studentId,2000);assert.deepEqual(calc.students[0].events,[]);assert.equal(exam.publicView(calc).students[0].status,'completed');
});
