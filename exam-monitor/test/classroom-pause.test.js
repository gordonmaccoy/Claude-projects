const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('class display keeps paused remaining time frozen and labels the pause',()=>{
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',setAttribute(){},replaceChildren(){},classList:{contains(){return false;}}});return elements.get(id);};let now=0;
 const context=vm.createContext({window:{examioLanguage:{setup(){},t:text=>text},addEventListener(){}},location:{hash:'#session/token',reload(){}},io:()=>({on(){}}),document:{documentElement:{dataset:{}},getElementById:el,addEventListener(){}},performance:{now:()=>now},setInterval(){},BroadcastChannel:class{}});
 vm.runInContext(fs.readFileSync(require.resolve('../public/classroom.js'),'utf8'),context);context.view={phase:'paused',remainingMs:65000,title:'Quiz',students:[]};vm.runInContext('render(view)',context);assert.equal(el('class-timer').hidden,false);assert.equal(el('class-time').textContent,'1:05');assert.match(el('phase').textContent,/paused/i);now=30000;vm.runInContext('renderTimer()',context);assert.equal(el('class-time').textContent,'1:05');
});
test('class display inherits session language and offers a remembered theme',()=>{
 const elements=new Map(),values=new Map();let language;
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',setAttribute(){},replaceChildren(){},classList:{contains(){return false;}}});return elements.get(id);};
 const context=vm.createContext({window:{examioLanguage:{apply(value){language=value;},t:text=>text},addEventListener(){}},location:{hash:'#session/token',reload(){}},io:()=>({on(){}}),document:{documentElement:{dataset:{}},getElementById:el,addEventListener(){}},localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},performance:{now:()=>0},setInterval(){},BroadcastChannel:class{}});
 vm.runInContext(fs.readFileSync(require.resolve('../public/classroom.js'),'utf8'),context);context.view={phase:'waiting',language:'ko',title:'Quiz',students:[]};vm.runInContext('render(view)',context);assert.equal(language,'ko');el('class-theme-toggle').onclick();assert.equal(values.get('exam-monitor-theme'),'dark');
});
