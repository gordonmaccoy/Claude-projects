const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'../public',file),'utf8');

test('report section is immediately after Games in progress and professor-only',()=>{
 const html=read('game-library.html');
 assert.match(html,/<\/section><\/section>\s*<section id="game-reports" hidden/);
 assert.match(html,/Game Reports/);
 assert.match(html,/game-reports\.js/);
 for(const file of ['game-display.html','game-player.html'])assert.doesNotMatch(read(file),/game-reports/);
});

class FakeElement {
 constructor(tag,text,className){Object.assign(this,{tag,textContent:text||'',className,children:[],attrs:{},listeners:{},dataset:{}});}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,fn){this.listeners[k]=fn;}
 focus(){this.focused=true;}
}
const report=(id,completedAt)=>({id,title:'Quiz <b>'+id+'</b>',completedAt,startedAt:completedAt-91000,durationMs:91000,percentCorrect:75,participantCount:4,questionCount:8});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('reports are sorted and collapsed, with lazy Summary, Participants and Questions',async()=>{
 const {mount}=require('../public/game-reports');
 const dom=new Map();const $=id=>{if(!dom.has(id))dom.set(id,new FakeElement(id));return dom.get(id);};
 let requests=[];
 const controller=mount({$,el:(...args)=>new FakeElement(...args),api:async route=>{
  requests.push(route);
  if(route==='/game-reports')return [report('older',100000),report('newer',200000)];
  return {...report('newer',200000),participants:[{name:'Test <i>Player</i>',score:430,rank:1,percentCorrect:75,unanswered:2}],questions:[{prompt:'What <em>color</em>?',percentCorrect:75}]};
 }});
 await controller.refresh();
 const cards=$('game-report-list').children;
 assert.deepEqual(cards.map(x=>x.children[1].dataset.reportId),['newer','older']);
 const disclosure=cards[0].children[1];
 assert.equal(disclosure.open,false);
 assert.deepEqual(requests,['/game-reports']);
 disclosure.open=true;await disclosure.listeners.toggle();await tick();
 const body=disclosure.children[1],tabs=body.children[0].children,panel=body.children[1];
 assert.deepEqual(tabs.map(x=>x.textContent),['Summary','Participants (4)','Questions (8)']);
 assert.equal(tabs[0].attrs['aria-selected'],'true');
 assert.match(JSON.stringify(panel),/75%/);
 tabs[1].onclick();assert.match(JSON.stringify(panel),/Test <i>Player<\/i>/);assert.equal(tabs[0].attrs['aria-selected'],'false');
 tabs[2].onclick();assert.match(JSON.stringify(panel),/What <em>color<\/em>\?/);
 assert.equal(requests.at(-1),'/game-reports/newer');
});
test('report deletion only sends checked IDs after confirmation',async()=>{
 const {mount}=require('../public/game-reports');
 const dom=new Map();const $=id=>{if(!dom.has(id))dom.set(id,new FakeElement(id));return dom.get(id);};
 let confirmed=false,rows=[report('a',200000),report('b',100000)],actions=[];
 const controller=mount({$,el:(...args)=>new FakeElement(...args),confirm:()=>confirmed,api:async(path,verb,body)=>{
  if(verb==='POST'){actions.push({path,body});rows=rows.filter(row=>!body.ids.includes(row.id));return {deleted:1};}
  return rows;
 }});
 await controller.refresh();
 const select=$('select-game-reports'),remove=$('delete-game-reports');
 assert.equal(remove.disabled,true);
 select.onclick();
 const checkbox=$('game-report-list').children[1].children[0].children[0];
 checkbox.checked=true;checkbox.onchange();
 assert.equal(remove.disabled,false);
 await remove.onclick();assert.deepEqual(actions,[]);
 confirmed=true;await remove.onclick();
 assert.deepEqual(actions,[{path:'/game-reports/delete',body:{ids:['b']}}]);
 assert.equal($('game-report-list').children.length,1);assert.equal(remove.disabled,true);
});
test('tabs support keyboard movement, and invalidation clears private content and stops pending refreshes',async()=>{
 const {mount}=require('../public/game-reports');
 const dom=new Map();const $=id=>{if(!dom.has(id))dom.set(id,new FakeElement(id));return dom.get(id);};
 let pending, defer=false, requests=0;
 const controller=mount({$,el:(...args)=>new FakeElement(...args),api:async path=>{
  requests++;
  if(path==='/game-reports/a')return {...report('a',200000),participants:[{name:'Synthetic visitor',rank:1,score:30,percentCorrect:100,unanswered:0}],questions:[]};
  if(defer)return new Promise(resolve=>{pending=resolve;});
  return [report('a',200000)];
 }});
 await controller.refresh();
 const disclosure=$('game-report-list').children[0].children[1];
 disclosure.open=true;await disclosure.listeners.toggle();
 const tabs=disclosure.children[1].children[0].children;
 let prevented=false;
 tabs[0].listeners.keydown({key:'ArrowRight',preventDefault:()=>{prevented=true;}});
 assert.equal(prevented,true);assert.equal(tabs[1].focused,true);
 assert.equal(tabs[1].attrs['aria-selected'],'true');assert.equal(tabs[0].tabIndex,-1);
 defer=true;const refreshing=controller.refresh();
 controller.invalidate();pending([report('other',300000)]);await refreshing;await controller.refresh();
 assert.equal($('game-reports').hidden,true);
 assert.equal($('game-report-list').children.length,0);
 assert.equal(requests,3);
});
test('an in-flight detail response does not render after report invalidation',async()=>{
 const {mount}=require('../public/game-reports');
 const dom=new Map();const $=id=>{if(!dom.has(id))dom.set(id,new FakeElement(id));return dom.get(id);};
 let resolveDetails;
 const controller=mount({$,el:(...args)=>new FakeElement(...args),api:path=>
  path==='/game-reports'?Promise.resolve([report('a',200000)]):new Promise(resolve=>{resolveDetails=resolve;})
 });
 await controller.refresh();
 const disclosure=$('game-report-list').children[0].children[1];
 disclosure.open=true;
 const load=disclosure.listeners.toggle();
 controller.invalidate();
 resolveDetails({...report('a',200000),participants:[{name:'Synthetic private name'}],questions:[]});
 await load;
 assert.deepEqual($('game-report-list').children,[]);
 assert.equal(disclosure.children[1].children[0].textContent,'Loading report…');
});
test('an inactive account clears private reports from the list, detail and delete flows',async()=>{
 const {mount}=require('../public/game-reports');
 for(const action of ['list','detail','delete']){
  const dom=new Map();const $=id=>{if(!dom.has(id))dom.set(id,new FakeElement(id));return dom.get(id);};
  let inactive=false;
  const controller=mount({$,el:(...args)=>new FakeElement(...args),confirm:()=>true,api:async()=>{
   if(inactive)throw Object.assign(new Error('Account inactive'),{status:423});
   return [report('a',200000)];
  }});
  await controller.refresh();inactive=true;
  const list=$('game-report-list'),[label,disclosure]=list.children[0].children;
  if(action==='list')await controller.refresh();
  if(action==='detail'){disclosure.open=true;await disclosure.listeners.toggle();}
  if(action==='delete'){
   $('select-game-reports').onclick();
   label.children[0].checked=true;label.children[0].onchange();
   await $('delete-game-reports').onclick();
  }
  assert.equal(list.children.length,0,action);
  assert.match($('game-report-status').textContent,/account is inactive/);
  assert.equal($('delete-game-reports').disabled,true,action);
 }
});
