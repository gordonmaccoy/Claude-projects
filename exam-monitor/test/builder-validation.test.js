const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
// Exercise the actual browser collector without starting auth/network infrastructure.
const source = fs.readFileSync(require.resolve('../public/professor.js'), 'utf8');
function collect(question) {
  const context = { pendingImages: 0, tbQuestions: [question], els: { tbTitle: { value: 'Review quiz' } }, $: () => ({ value: 'class-folder' }) };
  vm.runInNewContext(source.slice(source.indexOf('function collectTest()'), source.indexOf('function showTbError(')), context);
  return context.collectTest();
}
const blank = { id: 'q1', type: 'blank', text: 'Capital: ____', acceptedAnswers: [] };
test('missing blank answer identifies its field and explains the correction', () => {
  const result = collect(blank);
  assert.match(result.error, /needs a correct answer/);
  assert.equal(result.questionIndex, 0);
  assert.equal(result.field, '.tb-accepted');
});
test('blank answer count and length failures have distinct guidance', () => {
  assert.match(collect({ ...blank, acceptedAnswers: Array(21).fill('a') }).error, /at most 20/);
  assert.match(collect({ ...blank, acceptedAnswers: ['x'.repeat(301)] }).error, /300 characters/);
});
test('valid blank answers still save and preserve selected folder', () => {
  const result = collect({ ...blank, acceptedAnswers: ['Seoul', '서울'] });
  assert.equal(result.error, undefined);
  assert.equal(result.test.folderId, 'class-folder');
  assert.deepEqual(Array.from(result.test.questions[0].acceptedAnswers), ['Seoul', '서울']);
});
test('missing MC answer targets the correct-answer control', () => {
  const result = collect({ id: 'q2', type: 'mc', text: 'Capital?', options: [{id:'a',text:'Seoul'},{id:'b',text:'Paris'}], correctOptionId: '' });
  assert.equal(result.field, 'input[type=radio]');
  assert.equal(result.questionIndex, 0);
});
