const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(require('node:path').join(__dirname,'../public',name),'utf8');
function node(tag='div'){
 const n={tag,dataset:{},children:[],attributes:{},className:'',textContent:'',classList:{add(){},remove(){},toggle(){}},listeners:{},requests:[],
 append(...items){n.children.push(...items);},replaceChildren(...items){n.children=items;},
 setAttribute(k,v){n.attributes[k]=v;},getAttribute(k){return n.attributes[k]??null;},removeAttribute(k){delete n.attributes[k];},
 querySelector(selector){return n.children.find(x=>selector.startsWith('.')&&x.className?.split(' ').includes(selector.slice(1)))??null;},
 addEventListener(k,callback){n.listeners[k]=callback;},showModal(){n.open=true;},close(){n.open=false;n.listeners.close?.();},focus(){}};
 Object.defineProperty(n,'src',{get(){return n.getAttribute('src');},set(v){n.setAttribute('src',v);n.requests.push(v);}});
 return n;
}
function app(reduced=false){
 const nodes={},get=id=>nodes[id]??=(node());const context={console,URLSearchParams,location:{search:'?session=g1'},localStorage:{},
 performance:{now:()=>0},setInterval(){},clearInterval(){},setTimeout(){},clearTimeout(){},
 matchMedia:()=>({matches:reduced}),document:{createElement:node,createElementNS:(_,t)=>node(t),getElementById:get,body:node('body')}};
 context.window=context;vm.createContext(context);
 vm.runInContext(read('game-avatars.js'),context);vm.runInContext(read('game-client.js'),context);
 return {get,context};
}
test('correct reveal alone loads the matching celebration and falls back to still on error',()=>{
 const {get,context}=app(),GameClient=context.GameClient;
 const base={id:'g1',phase:'reveal',avatarId:'avatar-50',questionIndex:0,questionCount:5,serverNow:100,score:0};
 const resultImg=()=>get('stage').children[0].children.find(x=>x.tag==='img');
 GameClient.render({...base,answer:{correct:true}},{answer(){}});
 const active=resultImg();
 assert.equal(active.src,'/game-avatars/avatar-50-celebrate.webp');
 active.onerror();assert.equal(active.src,'/game-avatars/avatar-50-cutout.webp');
 active.onerror();assert.equal(active.src,null);assert.deepEqual(active.requests,['/game-avatars/avatar-50-celebrate.webp','/game-avatars/avatar-50-cutout.webp']);
 GameClient.render({...base,phase:'leaderboard',answer:{correct:true},rank:1},{answer(){}});
 assert.equal(resultImg().src,'/game-avatars/avatar-50-cutout.webp');
 GameClient.render({...base,phase:'podium',rank:1},{answer(){}});
 assert.equal(resultImg().src,'/game-avatars/avatar-50-cutout.webp');
 GameClient.render({...base,questionIndex:1,answer:{correct:false}},{answer(){}});
 assert.equal(resultImg().src,'/game-avatars/avatar-50-cutout.webp');
});
test('reduced motion and unknown avatar IDs do not request a celebration',()=>{
 const {get,context}=app(true);
 context.GameClient.render({id:'g1',phase:'reveal',answer:{correct:true},avatarId:'avatar-29',questionIndex:0,questionCount:1,score:0},{answer(){}});
 assert.equal(get('stage').children[0].children.find(x=>x.tag==='img').src,'/game-avatars/avatar-29-cutout.webp');
 const regular=app().context.GameAvatars;
 assert.equal(regular.celebration('avatar-00'),null);
 assert.equal(regular.celebration('../../secret'),null);
});
test('picker only loads a celebration on opening the selected avatar preview',async()=>{
 const {get,context}=app();
 context.GameClient.status=()=>{};context.GameClient.resumeRecord=()=>({});
 context.GameClient.json=async()=>({phase:'lobby',takenAvatarIds:[],largeClass:true});
 context.GameTeamPlayer={updateLobby(){}};
 await vm.runInContext(read('game-player.js'),context);
 const image=get('avatar-preview-image'),picker=get('avatar-picker');
 assert.equal(image.src,null);
 assert.equal(picker.children.length,30);
 assert.ok(picker.children.every(button=>button.children[0].src.endsWith('-cutout-thumb.webp')));
 picker.children[4].onclick();assert.equal(image.src,'/game-avatars/avatar-05-celebrate.webp');
 image.onerror();assert.equal(image.src,'/game-avatars/avatar-05-cutout.webp');
 get('avatar-preview-back').onclick();assert.equal(image.src,null);assert.equal(image.onerror,null);
 get('avatar-next').onclick();picker.children[19].onclick();
 assert.equal(image.src,'/game-avatars/avatar-50-celebrate.webp');
});

test('shared roster, team and podium avatars remain light static transparent sprites',()=>{
 const {context}=app();
 const solo=context.GameClient.teamAvatar({avatarId:'avatar-03'});
 assert.equal(solo.src,'/game-avatars/avatar-03-cutout-thumb.webp');
 const podium=context.GameClient.teamAvatar({avatarId:'avatar-03'},'player-avatar feature-avatar');
 assert.equal(podium.src,'/game-avatars/avatar-03-cutout.webp');
 const team=context.GameClient.teamAvatar({members:[{nickname:'A',avatarId:'avatar-03'},{nickname:'B',avatarId:'avatar-05'}]});
 assert.deepEqual(team.children.map(x=>x.src),['/game-avatars/avatar-03-cutout-thumb.webp','/game-avatars/avatar-05-cutout-thumb.webp']);
 solo.onerror();assert.equal(solo.src,'/game-avatars/avatar-03-cutout.webp');
 solo.onerror();assert.equal(solo.src,null);
});
