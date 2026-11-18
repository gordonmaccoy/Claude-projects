const {test}=require('node:test'),assert=require('node:assert/strict'),exam=require('../exam');
function setup(security={inactivityFail:false}){const s=exam.newSession('p',{title:'Quiz',questions:[{id:'q',text:'?',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]},1000,{security});const j=exam.join(s,{name:'Kim',number:'001'},1000);exam.connectStudent(s,j.studentId,'socket',1000);exam.start(s,2000);const st=exam.student(s,j.studentId);st.draft={q:'a'};return {s,st,j};}
test('only sustained actual disconnect locks; return at threshold locks even without scheduled sweep',()=>{
 const {s,st,j}=setup();exam.visibility(s,st.id,false,3000);exam.sweep(s,20000);assert.equal(exam.studentView(s,st).recoveryLocked,false);
 exam.disconnectStudent(s,st.id,'socket',20000);exam.connectStudent(s,st.id,'short',29999);assert.equal(exam.studentView(s,st).recoveryLocked,false);
 exam.disconnectStudent(s,st.id,'short',30000);exam.connectStudent(s,st.id,'back',40000);assert.equal(exam.studentView(s,st).recoveryLocked,true);assert.equal(exam.privateView(s).students[0].recoveryState,'awaiting-unlock');
 assert.equal(exam.join(s,{resumeToken:j.resumeToken},40001).studentId,st.id);assert.equal(st.failedAt,null);assert.deepEqual(st.draft,{q:'a'});assert.equal(exam.studentView(s,st).test,null);
 assert.throws(()=>exam.submit(s,st.id,{q:'b'},40002),/locked/);assert.throws(()=>exam.progress(s,st.id,'q'),/state/);
 exam.unlockReconnect(s,st.id,'p',40003);assert.deepEqual(st.draft,{q:'a'});assert.equal(exam.studentView(s,st).recoveryLocked,false);assert.equal(exam.submit(s,st.id,{q:'a'},40004).score,1);
});
test('offline state requires grace, stale socket cannot disconnect newer connection, owner must unlock after return',()=>{
 const {s,st}=setup();exam.disconnectStudent(s,st.id,'socket',3000);exam.sweep(s,12999);assert.equal(exam.publicView(s).students[0].recoveryState,null);exam.sweep(s,13000);assert.equal(exam.publicView(s).students[0].recoveryState,'offline');
 assert.throws(()=>exam.unlockReconnect(s,st.id,'p',13001),/reconnect/);exam.connectStudent(s,st.id,'new',14000);exam.disconnectStudent(s,st.id,'socket',15000);assert.equal(st.connectionId,'new');
 assert.throws(()=>exam.unlockReconnect(s,st.id,'other',15000),/not found/);exam.unlockReconnect(s,st.id,'p',15000);assert.equal(exam.privateView(s).students[0].recoveryState,null);
});
test('waiting, calculator, completed and master-off excluded; pause does not consume grace or reset exam countdown',()=>{
 const {s,st}=setup({enabled:false});exam.disconnectStudent(s,st.id,'socket',3000);exam.sweep(s,20000);assert.equal(exam.studentView(s,st).recoveryLocked,false);
 const a=setup();a.s.phase='waiting';exam.disconnectStudent(a.s,a.st.id,'socket',3000);exam.start(a.s,20000);exam.sweep(a.s,40000);assert.equal(exam.studentView(a.s,a.st).recoveryLocked,false);
 const b=setup();exam.disconnectStudent(b.s,b.st.id,'socket',3000);exam.pause(b.s,'p',4000);exam.sweep(b.s,40000);assert.equal(exam.studentView(b.s,b.st).recoveryLocked,false);exam.resume(b.s,'p',50000);exam.connectStudent(b.s,b.st.id,'back',59999);assert.equal(exam.studentView(b.s,b.st).recoveryLocked,false);
 const c=setup();exam.submit(c.s,c.st.id,{q:'a'},2500);exam.disconnectStudent(c.s,c.st.id,'socket',3000);exam.sweep(c.s,30000);assert.equal(exam.studentView(c.s,c.st).recoveryLocked,false);
 const d=setup();d.s.mode='calculator';exam.disconnectStudent(d.s,d.st.id,'socket',3000);exam.sweep(d.s,30000);assert.equal(exam.studentView(d.s,d.st).recoveryLocked,false);
});
test('independent FAIL remains; explicit reasoned professor override clears both while reconnect unlock never changes FAIL',()=>{
 const {s,st}=setup({inactivityFail:true});exam.visibility(s,st.id,false,3000);exam.disconnectStudent(s,st.id,'socket',3000);exam.connectStudent(s,st.id,'back',14000);assert.equal(exam.isFailed(st),true);assert.equal(exam.studentView(s,st).recoveryLocked,true);
 exam.unlockReconnect(s,st.id,'p',14001);assert.equal(exam.isFailed(st),true);assert.equal(exam.studentView(s,st).recoveryLocked,false);
 exam.disconnectStudent(s,st.id,'back',15000);exam.connectStudent(s,st.id,'again',25000);exam.override(s,st.id,'p','Accidental close excused',26000);assert.equal(exam.isFailed(st),false);assert.equal(exam.studentView(s,st).recoveryLocked,false);assert.deepEqual(st.draft,{q:'a'});
});
test('deadline auto-submits locked draft without grade penalty or extending time',()=>{
 const {s,st}=setup();s.deadlineAt=20000;exam.disconnectStudent(s,st.id,'socket',3000);exam.sweep(s,13000);exam.sweep(s,20000);assert.equal(s.phase,'ended');assert.equal(exam.studentView(s,st).result.score,1);assert.equal(exam.studentView(s,st).recoveryLocked,false);assert.throws(()=>exam.unlockReconnect(s,st.id,'p',21000));
});
test('still-offline attempt gets fresh ten-second grace after teacher resumes',()=>{
 const {s,st}=setup();exam.disconnectStudent(s,st.id,'socket',3000);exam.pause(s,'p',4000);exam.resume(s,'p',50000);exam.sweep(s,59999);assert.equal(exam.studentView(s,st).recoveryLocked,false);exam.sweep(s,60000);assert.equal(exam.studentView(s,st).recoveryLocked,true);
 exam.connectStudent(s,st.id,'back',61000);exam.visibility(s,st.id,true,61000);assert.equal(exam.privateView(s,61001).students[0].status,'red');
});
test('excusing independent FAIL while offline does not waive pending or established re-entry permission',()=>{
 for(const at of [9000,14000]){const {s,st}=setup({inactivityFail:true});exam.visibility(s,st.id,false,3000);exam.disconnectStudent(s,st.id,'socket',3000);exam.sweep(s,at);exam.override(s,st.id,'p','Excuse visibility event',at);exam.connectStudent(s,st.id,'back',15000);assert.equal(exam.isFailed(st),false);assert.equal(exam.studentView(s,st).recoveryLocked,true);}
});
test('an observed disconnect preserves the last check-in and stays green during the rejoin grace',()=>{
 const {s,st}=setup();const lastSeen=st.lastSeen;
 exam.disconnectStudent(s,st.id,'socket',3000);
 assert.equal(st.lastSeen,lastSeen);
 assert.equal(exam.privateView(s,12999).students[0].status,'green');
 exam.sweep(s,13000);
 assert.equal(exam.privateView(s,13000).students[0].recoveryState,'offline');
 assert.equal(exam.isFailed(st),false);
});
