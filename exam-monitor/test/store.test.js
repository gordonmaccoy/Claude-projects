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
    await restored.init();
    assert.equal((await restored.getSession('s1')).students.length, 1);
  } finally { await db.close(); }
});
