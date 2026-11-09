const { test } = require('node:test');
const assert = require('node:assert/strict');
const exam = require('../exam');
const fixture = () => exam.newSession('p1', { title: 'Quiz', questions: [{ id: 'q', text: '2+2?', options: [{ id: 'a', text: '4' }, { id: 'b', text: '5' }], correctOptionId: 'a' }] }, 1000);
test('waiting room withholds questions and failure; public view never leaks private data', () => {
  const s = fixture(); const j = exam.join(s, { name: 'Kim', number: '001' }, 1000);
  exam.visibility(s, j.studentId, false, 1100); exam.sweep(s, 20000);
  assert.equal(s.students[0].failedAt, null);
  assert.equal(exam.studentView(s, s.students[0]).test, null);
  const pub = exam.publicView(s, 20000);
  assert.deepEqual(Object.keys(pub.students[0]).sort(), ['name', 'status']);
  assert.equal(JSON.stringify(pub).includes('001'), false);
  assert.equal(JSON.stringify(pub).includes('correctOptionId'), false);
  assert.throws(() => exam.submit(s, j.studentId, { q: 'a' }, 20000), /not running/);
});
test('strict >5 second confirmed hidden rule retains raw score and supports audited override', () => {
  const s = fixture(); const j = exam.join(s, { name: 'Kim', number: '001' }, 1000);
  exam.start(s, 2000); exam.visibility(s, j.studentId, false, 3000);
  exam.sweep(s, 8000); assert.equal(s.students[0].failedAt, null);
  exam.visibility(s, j.studentId, true, 8001);
  assert.throws(() => exam.submit(s, j.studentId, { q: 'a' }, 8002), /Call professor/);
  assert.equal(exam.privateView(s).students[0].score, 0);
  assert.equal(exam.publicView(s, 8002).students[0].status, 'failed');
  exam.override(s, j.studentId, 'p1', 'OS interruption', 9000);
  assert.equal(s.students[0].events.at(-1).type, 'override');
  assert.equal(exam.publicView(s, 9000).students[0].status, 'green');
  assert.equal(exam.submit(s, j.studentId, { q: 'a' }, 9000).score, 1);
  assert.throws(() => exam.submit(s, j.studentId, { q: 'b' }, 9001), /already submitted/);
});
test('student numbers accept digits only and preserve leading zeroes', () => {
  for(const number of ['Kim','123 Kim','1.5','-100','12e3','１２３']) assert.throws(()=>exam.join(fixture(),{name:'Kim',number}),/digits/);
  const s=fixture();exam.join(s,{name:'Kim',number:'000123'});assert.equal(s.students[0].number,'000123');
});
test('calculator locks after >5 seconds hidden and professor can unlock without losing enrollment', () => {
  const s=exam.newSession('p1',null,1000);const j=exam.join(s,{name:'Kim',number:'001'},1000);
  exam.visibility(s,j.studentId,false,2000);exam.sweep(s,7000);assert.equal(exam.isFailed(s.students[0]),false);
  exam.sweep(s,7001);assert.equal(exam.studentView(s,s.students[0]).failed,true);
  assert.equal(exam.publicView(s,7001).students[0].status,'failed');
  assert.throws(()=>exam.override(s,j.studentId,'p2','Not owner',8000));
  exam.override(s,j.studentId,'p1','Phone interruption',8000);assert.equal(exam.isFailed(s.students[0]),false);
});
test('submitted state is terminal: no later visibility incidents, disconnections or FAIL', () => {
  const s=fixture();const j=exam.join(s,{name:'Kim',number:'001'},1000);exam.start(s,2000);exam.submit(s,j.studentId,{q:'a'},3000);
  const before=s.students[0].events.length;exam.visibility(s,j.studentId,false,4000);exam.sweep(s,15000);
  assert.equal(s.students[0].events.length,before);assert.equal(exam.publicView(s,20000).students[0].status,'submitted');
});
test('mixed blank and multiple-choice questions grade alternatives without exposing answer keys', () => {
  const raw={title:'Mixed',questions:[{id:'b',type:'blank',text:'The capital is ___.',acceptedAnswers:['Seoul','Seoul City'],caseSensitive:false},
    {id:'m',text:'2+2?',options:[{id:'a',text:'4'},{id:'b',text:'5'}],correctOptionId:'a'}]};
  const valid=exam.validateTest(raw);assert.ok(valid);const s=exam.newSession('p1',valid,1000);const j=exam.join(s,{name:'Kim',number:'001'},1000);exam.start(s,2000);
  const view=exam.studentView(s,s.students[0]);assert.equal(view.test.questions[0].acceptedAnswers,undefined);
  assert.equal(view.test.questions[0].type,'blank');assert.equal(exam.submit(s,j.studentId,{b:'  SEOUL   city ',m:'a'},3000).score,2);
  assert.equal(exam.scoreAnswers({questions:[{id:'b',type:'blank',acceptedAnswers:['NaCl'],caseSensitive:true}]},{b:'nacl'}),0);
  assert.equal(exam.scoreAnswers({questions:[{id:'b',type:'blank',acceptedAnswers:['NaCl'],caseSensitive:true}]},{b:' NaCl '}),1);
  assert.equal(exam.validateTest({title:'Bad',questions:[{id:'q',type:'blank',text:'Blank',acceptedAnswers:[]}]}),null);
});
test('network silence alone never fails; returning before threshold clears hidden interval; submitted students stop accruing failures', () => {
  const s = fixture(); const j = exam.join(s, { name: 'Kim', number: '001' }, 1000);
  exam.start(s, 2000); exam.sweep(s, 30000);
  assert.equal(s.students[0].failedAt, null);
  assert.equal(exam.publicView(s, 30000).students[0].status, 'red');
  exam.visibility(s, j.studentId, false, 31000); exam.visibility(s, j.studentId, true, 35000); exam.sweep(s, 40000);
  assert.equal(s.students[0].failedAt, null);
  exam.submit(s, j.studentId, { q: 'a' }, 40001);
  exam.visibility(s, j.studentId, false, 41000); exam.sweep(s, 50000);
  assert.equal(s.students[0].failedAt, null);
});
test('join requires text number and name; duplicate number needs original resume token; answers and tests are validated', () => {
  const s = fixture();
  assert.throws(() => exam.join(s, { name: 'Kim', number: '' }, 1000));
  const j = exam.join(s, { name: 'Kim', number: '001' }, 1000);
  assert.throws(() => exam.join(s, { name: 'Imposter', number: '001' }, 1000), /already joined/);
  assert.equal(exam.join(s, { resumeToken: j.resumeToken }, 1100).studentId, j.studentId);
  exam.start(s, 2000);
  assert.throws(() => exam.submit(s, j.studentId, { unknown: 'a' }, 2100));
  assert.throws(() => exam.submit(s, j.studentId, { q: 'c' }, 2100));
  assert.equal(exam.validateTest({ title: 'Invalid', questions: [] }), null);
  assert.equal(exam.studentView(s, s.students[0]).test.questions[0].correctOptionId, undefined);
});
test('override forgives current hidden interval; a later hidden transition can fail again', () => {
  const s = fixture(); const j = exam.join(s, { name: 'Kim', number: '001' }, 1000);
  exam.start(s, 2000); exam.visibility(s, j.studentId, false, 3000); exam.sweep(s, 8001);
  exam.override(s, j.studentId, 'p1', 'Approved interruption', 9000);
  exam.visibility(s, j.studentId, false, 12000); exam.sweep(s, 20000);
  assert.equal(exam.isFailed(s.students[0]), false);
  exam.visibility(s, j.studentId, true, 21000); exam.visibility(s, j.studentId, false, 22000); exam.sweep(s, 27001);
  assert.equal(exam.isFailed(s.students[0]), true);
});
test('pre-saved join capability recovers a lost enrollment ACK and resumes final score after session end', () => {
  const s = fixture(); const resumeToken = 'client-generated-private-random-capability-123456789';
  const first = exam.join(s, { name: 'Kim', number: '001', resumeToken }, 1000);
  const retry = exam.join(s, { resumeToken }, 1100);
  assert.equal(first.studentId, retry.studentId); assert.equal(s.students.length, 1);
  exam.start(s, 2000); exam.submit(s, first.studentId, { q: 'a' }, 3000);
  s.phase = 'ended';
  assert.equal(exam.join(s, { resumeToken }, 4000).studentId, first.studentId);
  assert.equal(exam.studentView(s, s.students[0]).result.score, 1);
  assert.throws(() => exam.join(s, { name: 'Other', number: '002' }, 4000), /ended/);
});

test('professor finalizes a failed test as terminal zero while preserving original draft grade',()=>{
 const s=fixture(),j=exam.join(s,{name:'Kim',number:'001'},1000);exam.start(s,2000);s.students[0].draft={q:'a'};exam.visibility(s,j.studentId,false,3000);exam.sweep(s,8001);
 assert.throws(()=>exam.finalizeFail(s,j.studentId,'other','Reviewed',9000));
 exam.finalizeFail(s,j.studentId,'p1','Reviewed with student',9000);
 assert.equal(exam.privateView(s).students[0].result.score,0);assert.equal(exam.privateView(s).students[0].result.originalScore,1);
 assert.equal(exam.studentView(s,s.students[0]).terminal,true);assert.throws(()=>exam.override(s,j.studentId,'p1','Stale unlock',9001),/final/i);assert.equal(exam.privateView(s).students[0].result.percentage,0);assert.equal(exam.publicView(s).students[0].status,'failed');
 assert.throws(()=>exam.finalizeFail(s,j.studentId,'p1','Again',9001));const n=s.students[0].events.length;exam.visibility(s,j.studentId,false,20000);assert.equal(s.students[0].events.length,n);
});

test('progress validates question IDs and remains private',()=>{const s=fixture(),j=exam.join(s,{name:'Kim',number:'001'},1000);exam.start(s,2000);s.students[0].draft={q:'a'};exam.progress(s,j.studentId,'q');assert.deepEqual(exam.privateView(s).students[0].progress,{question:1,answered:1,total:1});assert.throws(()=>exam.progress(s,j.studentId,'invalid'));assert.equal(exam.publicView(s).students[0].progress,undefined);exam.submit(s,j.studentId,{q:'a'},3000);assert.throws(()=>exam.progress(s,j.studentId,'q'));});

test('ended failed attempt cannot be unlocked for continuation',()=>{const s=fixture(),j=exam.join(s,{name:'Kim',number:'001'},1000);exam.start(s,2000);exam.visibility(s,j.studentId,false,3000);exam.sweep(s,8001);s.phase='ended';assert.throws(()=>exam.override(s,j.studentId,'p1','Continue',9000),/ended/);});

test('weighted questions default to1 and produce point totals and percentages',()=>{const t=exam.validateTest({title:'Weighted',questions:[{id:'a',type:'blank',text:'One',acceptedAnswers:['yes'],points:2.5},{id:'b',type:'blank',text:'Two',acceptedAnswers:['yes']}]});assert.equal(t.questions[0].points,2.5);const s=exam.newSession('p',t,1000),j=exam.join(s,{name:'Kim',number:'1'},1100);exam.start(s,2000);const r=exam.submit(s,j.studentId,{a:'yes'},2500);assert.equal(r.score,2.5);assert.equal(r.total,3.5);assert.equal(r.percentage,71.43);assert.equal(exam.validateTest({...t,questions:[{...t.questions[0],points:0}]}),null);});

test('durable deadline starts with test, extension notifies, expiry submits saved partial answers once',()=>{const s=exam.newSession('p',fixture().test,1000,{durationMinutes:1,showScores:false,shuffleAnswers:true});const j=exam.join(s,{name:'Kim',number:'1'},1200);assert.equal(s.deadlineAt,null);exam.start(s,2000);assert.equal(s.deadlineAt,62000);s.students[0].draft={q:'a'};exam.extend(s,'p',1,61000);assert.equal(s.deadlineAt,122000);assert.equal(s.extensionVersion,1);exam.sweep(s,122000);assert.equal(s.phase,'ended');assert.equal(exam.privateView(s).students[0].result.percentage,100);const view=exam.studentView(s,s.students[0]);assert.equal(view.result.hidden,true);assert.equal(view.result.score,undefined);const submission=JSON.stringify(s.students[0].submission);exam.sweep(s,130000);assert.equal(JSON.stringify(s.students[0].submission),submission);assert.throws(()=>exam.extend(s,'p',1,130000));assert.throws(()=>exam.submit(s,j.studentId,{q:'b'},130000));});

test('timer expiry preserves FAIL, and selected-answer progress ignores blank or focus-only updates',()=>{const s=exam.newSession('p',fixture().test,1000,{durationMinutes:1});const j=exam.join(s,{name:'Kim',number:'1'},1200);exam.start(s,2000);assert.throws(()=>exam.progress(s,j.studentId,'q'));s.students[0].draft={q:'a'};exam.progress(s,j.studentId,'q');assert.equal(exam.privateView(s).students[0].progress.question,1);exam.visibility(s,j.studentId,false,3000);exam.sweep(s,62000);assert.equal(exam.privateView(s).students[0].result.score,0);assert.equal(exam.privateView(s).students[0].result.originalScore,1);assert.equal(exam.publicView(s).students[0].status,'failed');assert.equal(exam.studentView(s,s.students[0]).result.originalScore,undefined);});

test('shuffled answer order persists per student without exposing correct keys or changing IDs',()=>{const s=exam.newSession('p',fixture().test,1000,{shuffleAnswers:true});const j=exam.join(s,{name:'Kim',number:'1'},1200);exam.start(s,2000);const first=exam.studentView(s,s.students[0]).test.questions[0];assert.ok(s.students[0].optionOrder.q);assert.deepEqual(first.options.map(o=>o.id).sort(),['a','b']);assert.deepEqual(exam.studentView(JSON.parse(JSON.stringify(s)),s.students[0]).test.questions[0].options,first.options);assert.equal(first.correctOptionId,undefined);assert.equal(exam.submit(s,j.studentId,{q:'a'},2100).score,1);});

test('corrections are opt-in and never reveal answers before submission', () => {
  for (const enabled of [false,true]) {
    const s=fixture();
    s.showCorrections=enabled;
    s.durationMinutes=2;
    const {studentId}=exam.join(s,{name:'Kim',number:'001'},1000);
    const student=exam.student(s,studentId);
    exam.start(s,2000);
    assert.equal(exam.publicView(s,2000).deadlineAt,122000);
    assert.equal(exam.studentView(s,student).corrections,undefined);
    exam.submit(s,studentId,{q:'b'},3000);
    const details=exam.detailedResults(s)[0];
    assert.equal(details.incorrect[0].answer,'5');
    assert.equal(details.incorrect[0].correct,'4');
    assert.equal(exam.studentView(s,student).corrections?.[0]?.correct,enabled?'4':undefined);
    const zip=require('fflate').unzipSync(require('../export').workbook(s,true));
    const sheet=Buffer.from(zip['xl/worksheets/sheet1.xml']).toString();
    assert.match(sheet,/student answer/);
    assert.match(sheet,/>001<\/t>/);
    assert.match(sheet,/r="F2"[^>]*><is><t xml:space="preserve">4/);
  }
});

test('calculator completion is terminal without a grade or visibility failure', () => {
  const s=exam.newSession('owner',null,1000);
  const {studentId}=exam.join(s,{name:'Kim',number:'001'},1000);
  const student=exam.student(s,studentId);
  exam.completeCalculator(s,studentId,2000);
  exam.visibility(s,studentId,false,3000);
  exam.sweep(s,10000);
  assert.equal(exam.isFailed(student),false);
  assert.equal(exam.studentView(s,student).terminal,true);
  assert.equal(exam.studentView(s,student).result,null);
  assert.equal(exam.publicView(s).students[0].status,'completed');
});

test('validated question and choice images reach only the authorized test view',()=>{
  const input=fixture().test;
  const image='data:image/png;base64,iVBORw0KGgo=';
  input.questions[0].image=image;
  input.questions[0].options[0].image=image;
  const test=exam.validateTest(input);
  const s=exam.newSession('owner',test,1000);
  const {studentId}=exam.join(s,{name:'Kim',number:'001'},1000);
  exam.start(s,2000);
  assert.equal(exam.studentView(s,exam.student(s,studentId)).test.questions[0].options[0].image,image);
  assert.equal(JSON.stringify(exam.publicView(s)).includes(image),false);
  input.questions[0].image='data:image/svg+xml;base64,AAAA';
  assert.equal(exam.validateTest(input),null);
});
