const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const html=name=>readFileSync(join(__dirname,'..','public',name+'.html'),'utf8');

test('players are told before joining that their display name and score will be in a host-only report',()=>{
 const page=html('game-player');
 const notice=page.indexOf('id="game-report-notice"');
 assert.ok(notice>0&&notice<page.indexOf('id="join-submit"'));
 assert.match(page.slice(notice,page.indexOf('id="join-submit"')),/Only your game host can see the saved report.*display name and score in completed games/s);
});

test('privacy and account deletion describe saved game reports',()=>{
 const privacy=html('privacy'),professor=html('professor');
 assert.match(privacy,/Game reports remain until/);
 assert.match(privacy,/only available to the signed-in professor who hosted the game/i);
 const dialog=professor.match(/<dialog id="settings-delete-dialog".*?<\/dialog>/s)[0];
 assert.match(dialog,/saved game reports/);
});
