const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { createStore } = require('../store');

test('committed library and live session recover through a new repository; failed mutation rolls back', async () => {
  const db = new PGlite();
  const pool = { query: (...a) => db.query(...a), connect: async () => ({ query: (...a) => db.query(...a), release() {} }) };
  try {
    const store = createStore(pool);
    await store.init();
    const folder=await store.createFolder('prof-a','Class A');
    await store.saveTest('prof-a', { id: 't1', title: 'Saved', questions: [] });
    await store.createSession({ id: 's1', ownerId: 'prof-a', phase: 'running', students: [], test: { title: 'Snapshot' } });
    await store.mutate('s1', s => { s.students.push({ number: '001', name: 'Kim' }); });
    await assert.rejects(store.mutate('s1', s => { s.students = []; throw new Error('write rejected'); }));
    const restored = createStore(pool);
    assert.deepEqual(await restored.listFolders('prof-a'),[folder]);assert.deepEqual(await restored.listFolders('prof-b'),[]);assert.equal(await restored.getFolder('prof-b',folder.id),null);
    assert.equal((await restored.getSession('s1')).students[0].number, '001');
    assert.equal((await restored.listTests('prof-a'))[0].title, 'Saved');
    assert.deepEqual(await restored.listTests('prof-b'), []);
    assert.equal(await restored.getTest('prof-b', 't1'), null);
    assert.equal((await restored.listSessions('prof-a')).length, 1);
    assert.deepEqual(await restored.listSessions('prof-b'), []);
    assert.equal(await restored.renameFolder('prof-b',folder.id,'Other'),null);assert.equal((await restored.renameFolder('prof-a',folder.id,'Class B')).name,'Class B');
    await restored.saveTest('prof-a',{id:'filed',title:'Filed',folderId:folder.id,questions:[]});assert.equal(await restored.deleteFolder('prof-b',folder.id),false);assert.equal(await restored.deleteFolder('prof-a',folder.id),true);assert.equal((await restored.getTest('prof-a','filed')).folderId,null);assert.deepEqual(await restored.listFolders('prof-a'),[]);
    await restored.init();
    assert.equal((await restored.getSession('s1')).students.length, 1);
  } finally { await db.close(); }
});

test('Trash isolates owners and restores or expires quizzes and results', async () => {
  const db = new PGlite();
  const pool = { query: (...args) => db.query(...args), connect: async () => ({ query: (...args) => db.query(...args), release() {} }) };
  try {
    const store = createStore(pool);
    await store.init();
    await store.saveTest('owner', { id: 'quiz', title: 'Quiz', questions: [] });
    await store.createSession({ id: 'results', ownerId: 'owner', mode: 'test', phase: 'ended', resultTitle: 'Final results', test: {title: 'Quiz'}, students: [] });
    assert.equal(await store.deleteTest('owner','quiz'), true);
    await store.mutate('results', session => { session.deletedAt = Date.now(); });
    assert.deepEqual(await store.listTests('owner'), []);
    assert.deepEqual(await store.listSessions('owner'), []);
    assert.equal(await store.getSession('results'), null);
    assert.deepEqual(await store.listTrash('other'), []);
    assert.equal(await store.changeTrash('other','quizzes','quiz',true), false);
    assert.equal(await store.changeTrash('owner','constructor','quiz',true), false);
    const trash = await store.listTrash('owner');
    const quiz = trash.find(item => item.kind === 'quizzes');
    const results = trash.find(item => item.kind === 'results');
    assert.equal(results.title, 'Final results');
    assert.equal(quiz.expiresAt - quiz.deletedAt, 30 * 24 * 60 * 60 * 1000);
    assert.equal(await store.changeTrash('owner','quizzes','quiz',true,quiz.expiresAt), false);
    assert.equal(await store.changeTrash('owner','quizzes','quiz',true), true);
    assert.equal((await store.getTest('owner','quiz')).title, 'Quiz');
    assert.equal(await store.changeTrash('owner','results','results',true), true);
    assert.equal((await store.getSession('results')).resultTitle, 'Final results');
    await store.mutate('results', session => { session.deletedAt = results.deletedAt; });
    await store.deleteTest('owner','quiz');
    assert.equal(await store.changeTrash('owner','quizzes','quiz',false), true);
    await store.purgeExpiredTrash(results.expiresAt);
    assert.equal((await db.query("SELECT id FROM onscreen_v2_sessions WHERE id='results'")).rows.length, 0);
    assert.equal((await db.query("SELECT id FROM onscreen_v2_tests WHERE id='quiz'")).rows.length, 0);
  } finally { await db.close(); }
});
