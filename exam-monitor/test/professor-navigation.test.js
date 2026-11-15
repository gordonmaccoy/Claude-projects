const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=name=>fs.readFileSync(new URL('../public/'+name,'file://'+__filename),'utf8');

test('professor navigation groups quiz actions before Game Library and places Trash last',()=>{
 const nav=read('professor.html').match(/<nav id="workspace-tabs"[^>]*>[\s\S]*?<\/nav>/)?.[0];
 assert.ok(nav);
 assert.match(nav,/\bhidden\b/,'signed-out navigation stays hidden');
 const controls=[...nav.matchAll(/<(button|a) ([^>]+)>([^<]+)<\/\1>/g)];
 assert.deepEqual(controls.map(match=>match[3]),['Launch Quiz','Quiz Library','Quiz Results','Game Library','Trash']);
 assert.deepEqual(controls.filter(m=>m[1]==='button').map(m=>m[2].match(/data-tab="([^"]+)"/)?.[1]),['launch','library','results','trash']);
 assert.match(controls[3][2],/href="\/game-library\.html"/);
 assert.match(controls[4][2],/data-tab="trash"/);
});
test('workspace navigation wraps, places Trash against the right edge, and translates its labels',()=>{
 const css=read('professor.css'),ko=read('ko.js');
 assert.match(css,/#workspace-tabs\s*\{[^}]*flex-wrap:\s*wrap/);
 assert.match(css,/#workspace-tabs \[data-tab="trash"\]\s*\{[^}]*margin-inline-start:\s*auto/);
 assert.match(css,/#workspace-tabs :is\(button,\.game-nav-link\)\s*\{/);
 for(const label of ['Launch Quiz','Quiz Library','Quiz Results','Game Library','Trash'])assert.match(ko,new RegExp('"'+label+'":\\s*"[^"]+"'));
});
