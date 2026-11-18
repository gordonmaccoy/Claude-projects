const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=name=>fs.readFileSync(new URL('../public/'+name,'file://'+__filename),'utf8');
const node=()=>({hidden:false,checked:true,children:[],className:'',textContent:'',append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(){},classList:{add(){}}});
test('classroom badges separate disconnect from inactive and FAIL and honor activity masking',()=>{
 const nodes={};const el=id=>nodes[id]??=(node());
 const context=vm.createContext({window:{examioLanguage:{t:s=>s,apply(){}},addEventListener(){}},io:()=>({on(){}}),location:{hash:'#session/token'},localStorage:{getItem(){},setItem(){}},document:{documentElement:{dataset:{}},getElementById:el,createElement:(...args)=>({...node(...args),dataset:{}}),addEventListener(){}},setInterval(){},BroadcastChannel:class{}});
 vm.runInContext(source('classroom.js'),context);
 context.view={phase:'running',title:'Quiz',students:[{name:'Ada',status:'red',recoveryState:'offline'},{name:'Bo',status:'green',recoveryState:'awaiting-unlock'},{name:'Cal',status:'red'},{name:'Dee',status:'failed',recoveryState:'offline'}]};
 vm.runInContext('render(view)',context);
 const tiles=()=>el('students').children;
 assert.deepEqual(tiles().map(n=>n.children.at(-1).textContent),['Logged out','Waiting for unlock','Cal','FAIL']);
 assert.match(tiles()[0].className,/reconnect/);
 assert.deepEqual(tiles()[3].children.slice(2).map(n=>n.textContent),['Logged out','FAIL']);
 assert.doesNotMatch(tiles()[0].className,/ red|failed/);
 el('class-live-activity').checked=false;el('class-live-activity').onchange();
 assert.deepEqual(tiles().map(n=>n.children.at(-1).textContent),['Connected','Connected','Connected','Connected']);
 context.view.calculator=true;el('class-live-activity').checked=true;el('class-live-activity').onchange();
 assert.equal(tiles()[0].children.at(-1).textContent,'Ada');
});

test('student reconnect lock is separate from FAIL and pause and does not use completed or calculator state',()=>{
 const js=source('student.js'),a=js.indexOf('function reconnectLocked('),b=js.indexOf('function showView(',a);
 assert.ok(a>=0 && b>a);
 const context=vm.createContext({});
 vm.runInContext(js.slice(a,b),context);
 const running={mode:'test',phase:'running',recoveryLocked:true};
 assert.equal(context.reconnectLocked(running),true);
 for(const changes of [{phase:'paused'},{phase:'ended'},{phase:'waiting'},{failed:true},{result:{}},{completed:true},{terminal:true},{mode:'calculator'}])assert.equal(context.reconnectLocked({...running,...changes}),false);
 assert.match(source('student.html'),/<div id="reconnect-lock"[^>]*hidden>/);
 assert.match(js,/if\(paused\|\|recovery\)clearTimeout\(draftTimer\)/);
 assert.match(js,/'reconnect-lock'\)\.hidden=!recovery/);
 assert.match(js,/els\.testSection\.inert=locked\|\|paused\|\|recovery/);
 assert.equal((js.match(/reconnectLocked\(currentView\)/g)||[]).length>=3,true);
});

test('professor separately exposes reconnect unlock on live graded rows only',()=>{
 const js=source('professor.js'),a=js.indexOf('function renderTable('),b=js.indexOf('function closeResults(',a);
 const calls=[],context=vm.createContext({t:s=>s,$:()=>({checked:false}),document:{createElement:(...args)=>({...node(...args),dataset:{}})},button:(text,fn)=>({textContent:text,fn}),unlockStudent(){},submitFail(){},unlockReconnectStudent:(session,student)=>calls.push([session.id,student.id])});
 vm.runInContext(js.slice(a,b),context);
 const render=(patch={},rowPatch={},id='live-students')=>{
  const table={...node(),id,dataset:{}};
  context.renderTable(table,{id:'s',mode:'test',phase:'running',students:[{id:'p',number:'1',name:'Ada',events:[],status:'red',recoveryState:'awaiting-unlock',...rowPatch}],...patch});
  return table.children[0].children.at(-1).children[0].children;
 };
 const cells=render();
 assert.equal(cells[1].textContent,'••••••');
 assert.equal(cells[2].children[0].textContent,'Waiting for unlock');
 cells.at(-1).children.find(n=>n.textContent==='Unlock reconnect').fn();
 assert.deepEqual(calls,[['s','p']]);
 assert.ok(!render({}, {failed:true}).at(-1).children.some(n=>n.textContent==='Unlock reconnect'));
 assert.equal(render({}, {recoveryState:'offline'})[2].children[0].textContent,'Logged out');
 assert.ok(!render({phase:'ended'}).at(-1).children.some(n=>n.textContent==='Unlock reconnect'));
 assert.ok(!render({}, {},'result-students').at(-1).children.some(n=>n.textContent==='Unlock reconnect'));
 assert.match(js,/\/unlock-reconnect['"],'POST',\{studentId:student\.id\}/);
});
