const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {createStore}=require('../store'),{createApp}=require('../server'),game=require('../game');
const quiz={title:'Review',questions:[{id:'q',type:'mc',text:'Which?',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]};
const token=i=>String(i).padStart(43,'x');
const avatarId=i=>'avatar-'+String(i).padStart(2,'0');
const player=i=>({nickname:'Player '+i,resumeToken:token(i),avatarId:avatarId(i)});
test('large class is a strict boolean and explicitly selected per launch',()=>{
 assert.equal(game.validateGame(quiz).largeClass,false);
 assert.equal(game.validateGame({...quiz,largeClass:true}).largeClass,true);
 assert.throws(()=>game.validateGame({...quiz,largeClass:'true'}),/large class/i);
 const input={...quiz,largeClass:true},s=game.newSession('owner',input,Date.now(),{largeClass:true});input.largeClass=false;
 assert.equal(game.lobbyView(s).largeClass,true);assert.equal(game.lobbyView(s).takenAvatarIds.length,0);
});
test('base and large lobbies assign only allowed, exclusive picks and preserve rejoin when full',()=>{
 for(const size of [30,50]){
  const s=game.newSession('owner',quiz,Date.now(),{largeClass:size===50});
  assert.throws(()=>game.join(s,player(size+1)),/avatar/i);
  const first=game.join(s,player(1));
  assert.throws(()=>game.join(s,{...player(2),avatarId:avatarId(1)}),e=>e.status===409);
  for(let i=2;i<=size;i++)game.join(s,player(i));
  assert.equal(game.lobbyView(s).takenAvatarIds.length,size);
  assert.throws(()=>game.join(s,{...player(size+1),avatarId:avatarId(1)}),e=>e.status===409&&/full/i.test(e.message));
  assert.equal(game.join(s,{...player(1),avatarId:avatarId(51)}).playerId,first.playerId);
  assert.equal(game.playerView(s,first.playerId).avatarId,avatarId(1));
  assert.ok(!JSON.stringify(game.lobbyView(s)).includes('Player 1'));
 }
});
test('old lobby data is not rewritten and existing reconnects keep their assigned avatar',()=>{
 const s=game.newSession('owner',quiz,Date.now(),{largeClass:true});
 const p=game.join(s,player(36));delete s.game.largeClass;delete s.roomName;delete s.requireNames;
 assert.equal(game.lobbyView(s).requireNames,true);
 assert.equal(game.join(s,player(36)).playerId,p.playerId);
 assert.equal(game.playerView(s,p.playerId).avatarId,avatarId(36));
});
test('picker uses a six-column visible-page grid, small arrows, and defers initial thumbnails until lobby load',()=>{
 const html=fs.readFileSync(require.resolve('../public/game-player.html'),'utf8');
 const js=fs.readFileSync(require.resolve('../public/game-player.js'),'utf8');
 const css=fs.readFileSync(require.resolve('../public/game-picker.css'),'utf8');
 assert.match(html,/id="avatar-prev"/);assert.match(html,/id="avatar-next"/);assert.match(html,/id="avatar-pages"[^>]*hidden/);
 assert.match(js,/GameAvatars\.ids\.slice\(start,end\)/);assert.match(css,/repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(js,/img\.src=GameAvatars\.still\(avatar\)/);assert.match(js,/await join\(\);poll\(\);/);
});
test('valid game room name and simultaneous claims coexist with graded route',async t=>{
 const db=new PGlite();let q=Promise.resolve();
 const pool={async connect(){const prev=q;let release;q=new Promise(r=>release=r);await prev;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};
 const store=createStore(pool);await store.init();const runtime=createApp({store,verifyUser:async tok=>tok==='owner'?{id:'owner',email:'owner@example.com'}:null,sweepInterval:0});
 await new Promise((r,j)=>runtime.server.listen(0,'127.0.0.1',r).on('error',j));const base='http://127.0.0.1:'+runtime.server.address().port;
 t.after(async()=>{await runtime.close();await db.close();});
 const call=async(path,body,auth)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer owner'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
 const saved=await call('/api/games',{...quiz,largeClass:true},true);assert.equal(saved.body.largeClass,true);
 const launched=await call('/api/game-sessions',{gameId:saved.body.id,largeClass:true},true);assert.equal(launched.status,200);
 const {id,roomName,pin,displayToken}=launched.body,path='/game-api/'+id;assert.match(roomName,/^Game: [A-Za-z]+ [A-Za-z]+$/);
 assert.throws(()=>require('../rooms').roomName(roomName));
 const testName=roomName.slice(6);assert.deepEqual((await call('/api/rooms/resolve',{roomName:testName})).body,{joinUrl:'/game-player.html?session='+id});
 const testSession=require('../exam').newSession('owner',null,Date.now(),{roomName:testName});
 await store.createSession(testSession);
 assert.equal((await call('/api/rooms/resolve',{roomName:testName})).status,409);
 const collision=game.newSession('other',quiz);collision.roomName=roomName.toUpperCase();
 const newRoom=await store.createGameSession(collision);assert.notEqual(newRoom.roomName.toLowerCase(),roomName.toLowerCase());
 assert.equal((await store.findGameRoom(roomName.toLowerCase())).id,id);

 assert.deepEqual((await call('/api/rooms/resolve',{roomName:roomName.toUpperCase().replace(': ',':  ')})).body,{joinUrl:'/game-player.html?session='+id});
 assert.equal((await call('/api/rooms/resolve',{roomName:roomName.replace(/ [A-Za-z]+$/,' Nonexistent')})).status,404);
 assert.equal((await call('/game-api/resolve',{pin})).body.sessionId,id);
 assert.equal((await call(path+'/display',{displayToken})).body.roomName,roomName);
 const newP1={...player(1),avatarId:avatarId(50)},newP2={...player(2),avatarId:avatarId(50)};
 assert.deepEqual((await Promise.all([call(path+'/join',newP1),call(path+'/join',newP2)])).map(r=>r.status).sort(),[200,409]);
 const lobby=(await call(path+'/lobby')).body;assert.deepEqual(lobby,{largeClass:true,requireNames:true,takenAvatarIds:[avatarId(50)],phase:'lobby'});
 await call('/api/game-sessions/'+id+'/close',{},true);
 assert.deepEqual((await call('/api/rooms/resolve',{roomName:testName})).body,{joinUrl:'/student.html?session='+testSession.id});
 assert.equal((await call('/api/rooms/resolve',{roomName})).status,404);
 assert.equal((await call('/api/game-sessions',{gameId:saved.body.id,requireNames:'false'},true)).status,400);
 const open=await call('/api/game-sessions',{gameId:saved.body.id,requireNames:false,largeClass:true},true);
 assert.equal(open.status,200);
 assert.equal((await call('/game-api/'+open.body.id+'/lobby')).body.requireNames,false);
 const nameless=await call('/game-api/'+open.body.id+'/join',{avatarId:avatarId(50),resumeToken:token(3)});
 assert.equal(nameless.status,200);assert.equal(nameless.body.view.nickname,'Golden Lion Cub');
 assert.equal((await call('/api/game-sessions/'+open.body.id,null,true)).body.players[0].nickname,'Golden Lion Cub');
});

async function simulatePhone({record={},largeClass=true,requireNames=true,takenAvatarIds=[],onJoin,onRecovery}={}){
 const vm=require('node:vm'),elements=new Map(),images=[],calls=[],timers=new Map();let sequence=0,lobby={largeClass,requireNames,takenAvatarIds,phase:'lobby'};
 function el(tag='div'){
  const attrs=new Map(),css=new Set();
  return {tag,children:[],dataset:{},set src(value){attrs.set('src',value);images.push(value);},
   get src(){return attrs.get('src');},classList:{toggle(key,value){value?css.add(key):css.delete(key);},contains:k=>css.has(k),add:k=>css.add(k),remove:k=>css.delete(k)},
   focus(){},setAttribute(k,v){attrs.set(k,v);},getAttribute:k=>attrs.get(k),removeAttribute:k=>attrs.delete(k),
   append(...c){this.children.push(...c);},replaceChildren(...c){this.children=c;},
   querySelector(){return this.children.find(c=>!c.disabled);},
   addEventListener(k,fn){this[k]=fn;},showModal(){this.open=true;},close(){this.open=false;this.closeEvent?.();}};
 }
 const $=id=>{if(!elements.has(id)){const node=el();node.value='';if(id==='avatar-preview'){node.addEventListener=(k,fn)=>{node.closeEvent=fn;};}elements.set(id,node);}return elements.get(id);};
 const src=fs.readFileSync(require.resolve('../public/game-player.js'),'utf8');
 await vm.runInNewContext(src,{URLSearchParams,location:{search:'?session=room'},history:{replaceState(){}},document:{createElement:el,body:el()},localStorage:{setItem(){}},
  setTimeout(fn){timers.set(++sequence,fn);return sequence;},clearTimeout(id){timers.delete(id);},
  GameTeamPlayer:{updateLobby(){},selection(){return {};},show(){}},
  GameAvatars:require('../public/game-avatars.js'),
  GameClient:{$,status(){},resumeRecord:()=>({resumeToken:token(10),...record}),forgetExpiredSession:()=>false,isOlderView:()=>false,nextPollDelay:()=>1000,render(){},
   async json(path,body){calls.push([path,body]);if(path.endsWith('/lobby'))return lobby;if(path.endsWith('/join'))return onJoin?onJoin(body):{playerId:'p',view:{avatarId:body.avatarId}};if(path.endsWith('/recovery'))return onRecovery?onRecovery(body):{code:'SYNTHETIC'};return {avatarId:record.avatarId};}}
 });
 return {$,images,calls,setLobby:v=>{lobby=v;},async poll(){const first=timers.entries().next().value;if(!first)throw Error('No poll scheduled');timers.delete(first[0]);await first[1]();}};
}
test('phone pages lazily load 30 then 20 thumbnails and a mid-preview claim cannot be confirmed',async()=>{
 const phone=await simulatePhone(),{$,images}=phone;
 assert.equal($('avatar-picker').children.length,30);assert.equal(images.length,30);
 assert.equal($('avatar-pages').hidden,false);assert.equal($('avatar-prev').disabled,true);assert.equal($('avatar-range').textContent,'Characters 1–30 of 50');assert.equal($('avatar-page-label').textContent,'Page 1 of 2');
 $('avatar-next').onclick();assert.equal($('avatar-picker').children.length,20);assert.equal(images.length,50);assert.equal($('avatar-range').textContent,'Characters 31–50 of 50');assert.equal($('avatar-page-label').textContent,'Page 2 of 2');
 const first=$('avatar-picker').children[0];assert.equal(first.dataset.avatar,avatarId(31));
 first.onclick();assert.equal($('avatar-preview-image').src,'/game-avatars/'+avatarId(31)+'-celebrate.webp');assert.equal($('avatar-preview-confirm').disabled,false);
 phone.setLobby({largeClass:true,takenAvatarIds:[avatarId(31)],phase:'lobby'});await phone.poll();
 assert.equal($('avatar-preview-confirm').disabled,true);assert.equal(first.disabled,true);assert.equal(first.classList.contains('is-taken'),true);
 assert.match(first.getAttribute('aria-label'),/taken/);
 $('avatar-preview-confirm').onclick();assert.equal($('join-submit').disabled,true);
 $('avatar-prev').onclick();assert.equal($('avatar-picker').children.length,30);
});
test('standard phones have no pager and established reconnects download no picker assets',async()=>{
 const first=await simulatePhone({largeClass:false});assert.equal(first.$('avatar-pages').hidden,true);
 assert.equal(first.images.length,30);
 const rejoin=await simulatePhone({record:{nickname:'Returning',playerId:'old',avatarId:avatarId(31)}});
 assert.deepEqual(rejoin.calls.map(([url])=>url),['/game-api/room/join','/game-api/room/state']);
 assert.equal(rejoin.images.length,0);assert.equal(rejoin.$('join-form-section').hidden,true);
});

test('a no-name phone joins by avatar without a nickname form field or payload',async()=>{
 const {$,calls}=await simulatePhone({requireNames:false});
 assert.equal($('nickname-label').hidden,true);assert.equal($('nickname').required,false);
 $('avatar-picker').children[0].onclick();$('avatar-preview-confirm').onclick();
 assert.equal($('join-submit').disabled,false);
 await $('join-form').onsubmit({preventDefault(){}});
 const submitted=calls.find(([url])=>url.endsWith('/join'))?.[1];
 assert.equal(submitted.avatarId,avatarId(1));assert.equal(Object.hasOwn(submitted,'nickname'),false);
 assert.equal($('join-form-section').hidden,true);
});
test('a no-name phone uses only claimed character IDs for teacher-approved recovery',async()=>{
 const {$,calls}=await simulatePhone({requireNames:false,takenAvatarIds:[avatarId(2)],onJoin(){throw new Error('Await teacher');}});
 await $('recover').onclick();
 assert.equal($('character-recovery').open,true);
 assert.deepEqual($('recovery-avatar').children.map(o=>o.value),['',avatarId(2)]);
 $('recovery-avatar').value=avatarId(2);
 await $('character-recovery-form').onsubmit({preventDefault(){}});
 assert.equal($('character-recovery').open,false);
 assert.match($('recovery-code').textContent,/SYNTHETIC/);
 const submitted=calls.find(([url])=>url.endsWith('/recovery'))?.[1];
 assert.equal(submitted.avatarId,avatarId(2));assert.equal(Object.hasOwn(submitted,'nickname'),false);
 const check=calls.find(([url])=>url.endsWith('/join'))?.[1];
 assert.deepEqual(Object.keys(check),['resumeToken']);
});
