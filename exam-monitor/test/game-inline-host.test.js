const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'../public',file),'utf8');
test('Game Library contains inline host controls under Games in progress and no host navigation on Launch',()=>{
 const html=read('game-library.html'),js=read('game-library.js');
 const section=html.slice(html.indexOf('id="active-section"'),html.indexOf('id="editor"'));
 for(const id of ['game-host-panel','display-link','advance','close-game','stage','recovery'])assert.match(section,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(js,/location\.href\s*=\s*['"]\/game-host/);
 assert.match(js,/window\.open\('about:blank'/);
 assert.match(html,/id="game-theme-toggle"/);
 for(const file of ['game-player.html','game-display.html'])assert.doesNotMatch(read(file),/id="game-theme-toggle"/);
});
test('large class is a launch-only choice, unchecked by default and sent per session',()=>{
 const html=read('game-library.html'),js=read('game-library.js');
 const dialog=html.match(/<dialog id="launch-dialog"[\s\S]*?<\/dialog>/)?.[0];
 const section=html.slice(html.indexOf('id="active-section"'),html.indexOf('id="editor"'));
 assert.ok(dialog);
 assert.match(dialog,/id="launch-large-class"/);
 assert.doesNotMatch(section,/id="launch-large-class"/);
 assert.match(dialog,/31–50 players/);
 assert.doesNotMatch(html,/id="(?:create-)?large-class(?:-hint)?"/);
 assert.match(js,/\$\('launch-large-class'\)\.checked=false/);
 assert.doesNotMatch(js,/slot\.append\(setting\)/);
 assert.match(js,/largeClass=\$\('launch-large-class'\)\.checked/);
 assert.match(js,/api\('\/game-sessions','POST',\{gameId,requireNames,largeClass,/);
 assert.doesNotMatch(js,/creationOptions\.largeClass|\$\('large-class'\)/);
});
test('projector lobby shows room name, current site home and QR as a separate presentation layout',()=>{
 const html=read('game-display.html');
 assert.match(html,/game-classroom-lobby\.css/);
 assert.match(html,/id="room-name"/);
 assert.match(html,/href="\/" id="join-link"/);
 assert.match(html,/id="qr"/);
 assert.doesNotMatch(html,/theme-toggle|live-activity/);
});
test('host selection isolates old poll/action replies and relay from a second session',async()=>{
 const {createController}=require('../public/game-host');
 const shown=[],channels=[],requests=[];let fulfillOld;
 const gate=new Promise(resolve=>fulfillOld=resolve);
 const lobby=id=>({id,phase:'lobby',questionIndex:-1,players:[],classroomControlKey:'key-'+id});
 const session=(id)=>'/game-sessions/'+id;
 const controller=createController({
  api:(url,verb)=>{
   requests.push([url,verb]);
   if(url===session('old'))return gate;
   if(url===session('new'))return Promise.resolve(lobby('new'));
   return Promise.resolve({...lobby('new'),phase:'countdown'});
  },
  onView:v=>shown.push(v.id+':'+v.phase),
  control:{relay:({current})=>()=>current()?.id,openChannel(id){const c={id,close(){c.closed=true;}};channels.push(c);return c;},send(){}},
  setTimer:()=>1,clearTimer:()=>{},
 });
 controller.select('old',lobby('old'));
 controller.select('new',lobby('new'));
 fulfillOld(lobby('old'));await new Promise(r=>setImmediate(r));
 assert.deepEqual(shown,['old:lobby','new:lobby','new:lobby']);
 assert.equal(channels[0].closed,true);
 await controller.advance();
 assert.equal(requests.at(-1)[0],session('new')+'/advance');
 assert.equal(shown.at(-1),'new:countdown');
 controller.stop();
 assert.equal(channels[1].closed,true);
});
test('only a same-origin classroom address is used and old display links remain valid',()=>{
 const {displayHref}=require('../public/game-host');
 const origin='https://example.test';
 assert.equal(displayHref({classroomControlUrl:'https://other.test/game-display.html#secret',displayUrl:'/game-display.html#id/viewer'},origin),origin+'/game-display.html#id/viewer');
 assert.equal(displayHref({id:'id',displayToken:'viewer'},origin),origin+'/game-display.html#id/viewer');
 assert.equal(displayHref({classroomControlUrl:'/professor.html#id'},origin),'');
 assert.equal(displayHref({id:'id',displayToken:'viewer',classroomControlKey:'control',classroomControlUrl:'http://example.test/game-display.html#id/viewer/control'},origin),origin+'/game-display.html#id/viewer/control');
});
test('completing a close for a no-longer-selected game leaves the current game visible',async()=>{
 const {createController}=require('../public/game-host');
 const shown=[],closed=[];let resolveClose;
 const waitClose=new Promise(resolve=>resolveClose=resolve);
 const a={id:'a',phase:'lobby',players:[]},b={...a,id:'b'};
 const c=createController({api:path=>path.endsWith('/close')?waitClose:Promise.resolve(path.endsWith('/a')?a:b),
  onView:view=>shown.push(view.id),onClose:id=>closed.push(id),setTimer:()=>1,clearTimer:()=>{}});
 c.select('a',a);const waiting=c.close();c.select('b',b);
 resolveClose({ok:true});await waiting;
 assert.equal(c.id,'b');assert.equal(shown.at(-1),'b');assert.deepEqual(closed,[]);
 c.stop();
});
test('host refresh uses phase-aware polling delay after a valid classroom view',async()=>{
 const {createController}=require('../public/game-host');
 const row={id:'game',phase:'leaderboard',scoreStartsAt:7000,serverNow:7900,players:[]};const delays=[];
 const controller=createController({api:()=>Promise.resolve(row),onView(){},
  nextDelay:view=>assert.equal(view,row)||120,setTimer:(_,delay)=>delays.push(delay),clearTimer(){}});
 controller.select(row.id);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(delays,[120]);controller.stop();
});
