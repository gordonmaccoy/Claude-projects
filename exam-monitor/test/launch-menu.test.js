const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
test('launch menu keeps optional fields hidden and includes room and monitoring controls',()=>{
const html=fs.readFileSync('public/professor.html','utf8');
for(const id of ['launch-room-enabled','launch-room-name','launch-time-enabled','launch-monitoring','launch-fail-hidden','launch-shuffle-questions','launch-text-selection','launch-copy-block','launch-fullscreen','launch-tab-visibility','launch-focus'])assert.ok(html.includes('id="'+id+'"'),id);
assert.match(html,/Launch test options/);assert.doesNotMatch(html,/Step 2 preview/);assert.match(html,/id="launch-room-field"[^>]*hidden/);assert.match(html,/id="launch-time-field"[^>]*hidden/);assert.match(html,/Set Quiz Time Limit/);assert.match(html,/Switching off will disable ALL monitoring and cheating deterrents\./);assert.match(html,/id="launch-room-name"[^>]*disabled/);assert.match(html,/id="launch-corrections"[^>]*checked/);
const landing=fs.readFileSync('public/index.html','utf8');assert.match(landing,/id="room-join-form"/);assert.match(landing,/id="room-join-status"/);
});
