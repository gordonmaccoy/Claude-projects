const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const test=require('node:test');
function fixture({reduced=false}={}){
 const pending=[];let tick=0;
 class Node{
  constructor(tag,text=''){
   this.tagName=tag;this._text=text;this.children=[];this.className='';this.dataset={};this.attributes={};this.styleValues={};
   this.style={setProperty:(key,value)=>{this.styleValues[key]=String(value);}};
   this.classList={add:cls=>{this.className+=' '+cls;},remove:cls=>{this.className=this.className.split(' ').filter(value=>value!==cls).join(' ');}};
  }
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  set textContent(text){this._text=String(text);this.children=[];}
  get isConnected(){return !!this.root||!!this.parent?.isConnected;}
  setAttribute(key,value){this.attributes[key]=String(value);}
  append(...nodes){
   for(const node of nodes){if(node.parent)node.parent.children.splice(node.parent.children.indexOf(node),1);node.parent=this;this.children.push(node);}
  }
  replaceChildren(){this.children.forEach(n=>{n.parent=null;});this.children=[];}
  querySelectorAll(selector){
   const results=[];
   for(const c of this.children){
    if(selector.startsWith('.')?c.className.split(' ').includes(selector.slice(1)):c.tagName===selector)results.push(c);
    results.push(...c.querySelectorAll(selector));
   }
   return results;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  getBoundingClientRect(){return {top:(this.parent?.children.indexOf(this)??0)*46};}
  animate(...args){this.animation=args;}
  addEventListener(type,fn){(this.listeners??={})[type]=fn;}
 }
 const stage=new Node('section'),phase=new Node('p'),score=new Node('strong');
 stage.root=phase.root=score.root=true;
 const document={getElementById:id=>({stage,phase,score})[id],createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag)};
 const ctx={document,clearInterval(){},performance:{now:()=>tick},matchMedia:()=>({matches:reduced}),
  requestAnimationFrame:fn=>pending.push(fn)};
 ctx.window=ctx;
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/game-avatars'),'utf8'),ctx);
 vm.runInNewContext(fs.readFileSync(process.env.GAME_CLIENT_SOURCE||require.resolve('../public/game-client'),'utf8'),ctx);
 const at=now=>{tick=now;for(const fn of pending.splice(0))fn(tick);};
 return {stage,score,render:ctx.GameClient.render,at};
}

const common={id:'demo',phase:'leaderboard',questionCount:1,questionIndex:0,scoreStartsAt:2000,scoreEndsAt:3020};
test('phone result and classroom total use the same animation timeline between poll arrivals',()=>{
 const phone=fixture(),projector=fixture(),answer=()=>{};
 phone.render({...common,phase:'reveal',serverNow:1500,score:0,avatarId:'avatar-02',answer:{correct:true,points:1000}},{answer});
 assert.match(phone.stage.textContent,/Correct!/);
 assert.doesNotMatch(phone.stage.textContent,/1,000|\+\d+ pts/);
 assert.equal(phone.stage.querySelector('.feature-avatar').src,'/game-avatars/avatar-02-celebrate.webp');
 phone.at(3000);
 phone.render({...common,serverNow:2100,score:1000,rank:1,previousScore:0,answer:{correct:true,points:1000}},{answer});
 projector.at(3120);
 projector.render({...common,serverNow:2220,leaderboard:[{id:'a',nickname:'Fake student',rank:1,previousRank:1,score:1000,previousScore:0}]});
 phone.at(3250);projector.at(3250);
 assert.equal(phone.score.textContent,projector.stage.querySelector('.points').textContent);
 assert.equal(phone.stage.querySelector('.round-earned').textContent,'+'+phone.score.textContent);
 assert.notEqual(phone.score.textContent,'1,000 pts');
 phone.at(5000);projector.at(5000);
 assert.equal(phone.score.textContent,'1,000 pts');
 assert.equal(projector.stage.querySelector('.points').textContent,'1,000 pts');
 const reload=fixture();
 reload.render({...common,serverNow:5010,score:1000,rank:1,previousScore:0,answer:{correct:true,points:1000}},{answer});
 assert.equal(reload.score.textContent,'1,000 pts');
});
test('class vote panel gives choices meaningful text, counts, and a labeled correct answer',()=>{
 const x=fixture();
 const question={text:'Which option?',options:[{id:'a',text:'Monday'},{id:'b',text:'Tuesday'},{id:'c',text:'Wednesday'},{id:'d',text:'Thursday'}],
  counts:{a:2,b:0,c:1,d:1},correctOptionId:'c'};
 x.render({...common,phase:'reveal',serverNow:1700,question});
 const rows=x.stage.querySelectorAll('.vote-row');
 assert.equal(rows.length,4);
 assert.deepEqual(rows.map(row=>row.querySelector('.vote-count').textContent),['2','0','1','1']);
 assert.deepEqual(rows.map(row=>row.querySelector('.vote-letter').textContent),['A','B','C','D']);
 assert.equal(rows[0].querySelector('.vote-fill').styleValues['--vote-share'],'50%');
 assert.equal(rows[1].querySelector('.vote-fill').styleValues['--vote-share'],'0%');
 assert.match(rows[2].textContent,/Wednesday.*Correct/);
});
test('podium participants reveal by tier and first place alone triggers confetti',()=>{
 const x=fixture(),phone=fixture(),answer=()=>{};
 const c={...common,phase:'podium',podiumSchedule:[{rank:3,at:5000},{rank:2,at:7200},{rank:1,at:9400}]};
 const row=(rank)=>({id:String(rank),nickname:'Player '+rank,rank,score:1000-rank,avatarId:'avatar-0'+rank});
 x.render({...c,serverNow:4700,leaderboard:[]});
 assert.equal(x.stage.querySelectorAll('.podium-block').length,0);
 assert.equal(x.stage.querySelectorAll('.podium-person').length,0);
 assert.equal(x.stage.querySelector('.rankings'),null);
 x.render({...c,serverNow:5100,leaderboard:[row(3)]});
 assert.equal(x.stage.querySelectorAll('.podium-person').length,1);
 assert.equal(x.stage.querySelector('.podium-confetti'),null);
 x.render({...c,serverNow:7350,leaderboard:[row(3),row(2)]});
 assert.equal(x.stage.querySelectorAll('.podium-person').length,2);
 x.render({...c,serverNow:9510,leaderboard:[row(1),row(2),row(3)]});
 assert.equal(x.stage.querySelectorAll('.podium-person').length,3);
 assert.equal(x.stage.querySelector('.podium-person').querySelector('img').src,'/game-avatars/avatar-03-cutout.webp');
 assert.ok(x.stage.querySelector('.podium-confetti'));assert.ok(x.stage.querySelector('.winner-spotlight'));
 assert.equal(x.stage.querySelector('.rankings'),null);
 phone.render({...c,serverNow:9300,score:999},{answer});
 assert.match(phone.stage.textContent,/Watch the classroom podium/);
 phone.render({...c,serverNow:9510,rank:1,score:999},{answer});
 assert.equal(phone.stage.querySelector('.player-rank-tile').dataset.place,'1');
 assert.equal(phone.stage.querySelector('.podium-step'),null);
});
test('reduced-motion clients show steady, readable results without timed confetti',()=>{
 const x=fixture({reduced:true});
 x.render({...common,phase:'podium',serverNow:4700,podiumSchedule:[{rank:1,at:5000}],leaderboard:[]});
 x.render({...common,phase:'podium',serverNow:5001,podiumSchedule:[{rank:1,at:5000}],leaderboard:[{id:'a',rank:1,nickname:'Ada',score:1000}]});
 assert.match(x.stage.textContent,/Ada/);
 assert.equal(x.stage.querySelector('.podium-confetti'),null);
 assert.equal(x.stage.querySelector('.podium-enter'),null);
});
test('specific podium block styling can override the neutral podium reset',()=>{
 const css=fs.readFileSync(require.resolve('../public/game-stage.css'),'utf8');
 assert.match(css,/#stage :where\(\.podium-risers :is\(div,section,article\)\)/);
 assert.match(css,/#stage \.podium-block\{[^}]*height:var\(--rise\)[^}]*background:linear-gradient/s);
});

test('the professor white theme gives the vote and podium dark text on their light panels',()=>{
 const css=fs.readFileSync(require.resolve('../public/game-professor.css'),'utf8');
 assert.match(css,/\.vote-panel\{background:var\(--prof-surface\);color:var\(--prof-text\)/);
 assert.match(css,/\[data-theme=light\] \.game-host-panel #stage :is\(\.vote-row,\.vote-count,\.podium-heading,\.podium-person\)\{color:var\(--prof-text\)\}/);
 assert.match(css,/\[data-theme=light\] \.game-host-panel #stage\[data-phase=podium\]\[data-winner=true\]\{background:var\(--prof-panel\)\}/);
});

test('projector ceremony starts dark, then raises exactly one occupied tier at a time',()=>{
 const x=fixture();
 const schedule=[{rank:3,at:5000},{rank:2,at:8600},{rank:1,at:12200}];
 const row=rank=>({id:String(rank),rank,nickname:'Finalist '+rank,score:1000-rank});
 const v={...common,phase:'podium',podiumSchedule:schedule,podiumCompleteAt:16200};
 x.render({...v,serverNow:4000,leaderboard:[]});
 assert.equal(x.stage.querySelectorAll('.podium-block').length,0);
 assert.match(x.stage.textContent,/And the winners are/);
 x.render({...v,serverNow:5100,leaderboard:[row(3)]});
 assert.equal(x.stage.querySelectorAll('.podium-block').length,1);
 assert.match(x.stage.textContent,/Third place/);
 assert.equal(x.stage.querySelector('.podium-enter').dataset.place,3);
 x.render({...v,serverNow:8800,leaderboard:[row(2),row(3)]});
 assert.equal(x.stage.querySelectorAll('.podium-block').length,2);
 assert.match(x.stage.textContent,/Second place/);
 x.render({...v,serverNow:12300,leaderboard:[row(1),row(2),row(3)]});
 assert.match(x.stage.textContent,/First place/);
 assert.ok(x.stage.querySelector('.podium-confetti'));
 assert.equal(x.stage.querySelector('.rankings'),null);
 x.render({...v,serverNow:16200,leaderboard:[row(1),row(2),row(3),row(4),row(5)]});
 assert.ok(x.stage.querySelector('.final-standings'),'the rest of the class becomes visible only after winner beat');
 assert.deepEqual(x.stage.querySelectorAll('.standings-row').map(n=>n.dataset.place),['4','5']);
 assert.equal(x.stage.querySelector('.podium-confetti'),null);
});

test('server gives each occupied place its own beat and holds the winner before the full standings',()=>{
 const g=require('../game');
 const s=g.newSession('owner',{title:'Finale',questions:[{id:'q',text:'Which one?',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]},100);
 for(let i=1;i<=4;i++)g.join(s,{nickname:'P'+i,avatarId:'avatar-0'+i,resumeToken:String(i).repeat(43)},100);
 s.players.forEach((p,i)=>p.score=400-i*100);
 s.phase='leaderboard';s.questionIndex=0;s.scoreStartsAt=1000;
 g.advance(s,4000);
 const v=g.publicView(s,4000);
 assert.deepEqual(v.podiumSchedule,[{rank:3,at:5900},{rank:2,at:9500},{rank:1,at:14700}]);
 assert.equal(v.podiumCompleteAt,19700);
 assert.equal(g.publicView(s,19699).leaderboard.length,3);
 assert.equal(g.publicView(s,19700).leaderboard.length,4);
 assert.equal(g.playerView(s,s.players[3].id,19699).rank,undefined);
 assert.equal(g.playerView(s,s.players[3].id,19700).rank,4);
});

test('podium riser faces give each revealed player a name, medal and score',()=>{
 const x=fixture();
 const c={...common,phase:'podium',podiumSchedule:[{rank:3,at:5000}],serverNow:5350};
 x.render({...c,leaderboard:[{id:'p',rank:3,nickname:'Quiz Otter',score:840}]});
 const riser=x.stage.querySelector('.podium-block');
 assert.match(riser.textContent,/Quiz Otter.*840 pts/);
 assert.equal(riser.querySelector('.podium-medal').dataset.metal,'bronze');
 assert.deepEqual(x.stage.querySelectorAll('.points'),[]);
});

test('a final answer without scores leaves no stale or reconstructed phone score',()=>{
 const phone=fixture(),answer=()=>{};
 phone.render({...common,phase:'reveal',serverNow:1500,score:1234,answer:{correct:true}},{answer});
 assert.match(phone.score.textContent,/1,234 pts/);
 phone.render({...common,phase:'reveal',finalRound:true,serverNow:1550,answer:{correct:true}},{answer});
 assert.equal(phone.score.textContent,'');
 assert.doesNotMatch(phone.stage.textContent,/pts|\d[,]\d{3}/);
 assert.match(phone.stage.textContent,/Watch the classroom podium/);
 phone.render({...common,phase:'podium',finalRound:true,serverNow:1600,rank:1,podiumSchedule:[]},{answer});
 assert.doesNotMatch(phone.stage.textContent,/0 pts|1,234/);
});

test('post-podium standings are ordered, independently scrollable and omit all revealed tiers',()=>{
 const motion=fixture(),rest=fixture({reduced:true});
 const rows=[{id:'first',rank:1,nickname:'Gold',score:500},{id:'fourthA',rank:4,nickname:'Tie A',score:300},{id:'fourthB',rank:4,nickname:'Tie B',score:300},{id:'last',rank:6,nickname:'Last',score:200}];
 const c={...common,phase:'podium',serverNow:5500,podiumCompleteAt:5100,leaderboard:rows};
 for(const x of [motion,rest]){
  x.render(c);
  const list=x.stage.querySelector('.standings-list');assert.equal(list.attributes.tabindex,'0');
  assert.deepEqual(list.querySelectorAll('.standings-row').map(n=>n.dataset.place),['4','4','6']);
  assert.match(list.textContent,/Tie A.*Tie B.*Last/);
  assert.doesNotMatch(list.textContent,/Gold/);
 }
 const control=motion.stage.querySelector('.standings-play'),viewport=motion.stage.querySelector('.standings-list');
 assert.ok(control);assert.equal(rest.stage.querySelector('.standings-play'),null);
 viewport.scrollHeight=350;viewport.clientHeight=170;viewport.scrollTop=0;
 motion.at(10);assert.equal(viewport.scrollTop,0);
 motion.at(1860);assert.equal(viewport.scrollTop,47);
 viewport.listeners.wheel();motion.at(2860);assert.equal(viewport.scrollTop,47);
 assert.equal(control.textContent,'Resume scroll');
 control.onclick();motion.at(3000);motion.at(8500);
 assert.equal(viewport.scrollTop,180);assert.equal(control.textContent,'Replay scroll');
 control.onclick();assert.equal(viewport.scrollTop,0);
});
test('overflow podium ties remain named after the ceremony, without repeating podium names',()=>{
 const row=(id,rank,score)=>({id,nickname:'Player '+id,rank,score});
 const first=[row('A',1,1000),row('B',2,0),row('C',2,0),row('D',2,0),row('E',2,0)];
 const allTie=['A','B','C','D','E'].map(id=>row(id,1,0));
 const goldTie=['A','B','C','D'].map(id=>row(id,1,1000)).concat(row('E',5,0));
 for(const [leaderboard,overflow,places] of [[first,['E'],['2']],[allTie,['D','E'],['1','1']],[goldTie,['E','D'],['5','1']]]){
  const x=fixture({reduced:true}),base={...common,phase:'podium',podiumCompleteAt:5100,leaderboard};
  x.render({...base,serverNow:5000});
  assert.equal(x.stage.querySelector('.final-standings'),null);
  x.render({...base,serverNow:5200});
  const names=x.stage.querySelectorAll('.podium-names').flatMap(list=>list.querySelectorAll('strong'));
  const rest=x.stage.querySelectorAll('.standings-row');
  assert.deepEqual(rest.map(n=>n.querySelector('strong').textContent),overflow.map(id=>'Player '+id));
  assert.deepEqual(rest.map(n=>n.dataset.place),places);
  assert.deepEqual([...names,...rest.map(n=>n.querySelector('strong'))].map(n=>n.textContent).sort(),leaderboard.map(p=>p.nickname).sort());
 }
});

test('classroom vote view reserves more stage space without enlarging professor or phone polls',()=>{
 const css=fs.readFileSync(require.resolve('../public/game-stage.css'),'utf8');
 assert.match(css,/\.game-display #stage\[data-phase=reveal\] \.vote-panel\s*\{[^}]*max-width:min\(100%,88vw,1560px\)/);
 assert.match(css,/\.game-display #stage\[data-phase=reveal\] \.vote-row\s*\{[^}]*font-size:clamp\(1\.2rem,2\.8vw,2\.2rem\)/);
 assert.match(css,/\.game-display #stage\[data-phase=reveal\] \.vote-track\s*\{[^}]*height:clamp\(10px,1\.6dvh,19px\)/);
});
