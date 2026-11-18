const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/professor.js'),'utf8');
function harness(session){
 const nodes=Object.fromEntries(['session-fail-control','session-fail-toggle','session-fail-hint'].map(id=>[id,{}]));
 let resolve,reject,requests=[];
 const context={current:session,$:id=>nodes[id],t:s=>s,notice:message=>context.message=message,renderDashboard:()=>context.renderInactivityFailControl(),api:(...args)=>{requests.push(args);return new Promise((a,b)=>{resolve=a;reject=b;});}};
 vm.createContext(context);const start=source.indexOf('const inactivityFailPending =');const end=source.indexOf("$('session-fail-toggle').onchange",start);assert.ok(start>=0&&end>start,'live FAIL control exists');vm.runInContext(source.slice(start,end),context);
 return {context,nodes,requests,resolve:value=>resolve(value),reject:error=>reject(error)};
}
const session=(id='one',overrides={})=>({id,mode:'test',phase:'running',security:{enabled:true,inactivityFail:true},...overrides});
test('live FAIL switch reflects policy and is restricted to monitored active tests',()=>{
 const h=harness(session());h.context.renderInactivityFailControl();assert.equal(h.nodes['session-fail-toggle'].checked,true);assert.equal(h.nodes['session-fail-toggle'].disabled,false);
 for(const phase of ['waiting','running','paused']){h.context.current=session('one',{phase});h.context.renderInactivityFailControl();assert.equal(h.nodes['session-fail-control'].hidden,false);}
 h.context.current=session('one',{security:{enabled:false,inactivityFail:false}});h.context.renderInactivityFailControl();assert.equal(h.nodes['session-fail-toggle'].disabled,true);assert.equal(h.nodes['session-fail-toggle'].checked,false);
 for(const value of [session('one',{mode:'calculator'}),session('one',{phase:'ended'}),null]){h.context.current=value;h.context.renderInactivityFailControl();assert.equal(h.nodes['session-fail-control'].hidden,true);assert.equal(h.nodes['session-fail-toggle'].disabled,true);}
});
test('toggle submits once, preserves other session state, and does not unlock failures',async()=>{
 const h=harness(session());h.nodes['session-fail-toggle'].checked=false;const done=h.context.changeInactivityFail();await h.context.changeInactivityFail();assert.equal(h.requests.length,1);assert.equal(h.nodes['session-fail-toggle'].disabled,true);assert.equal(h.requests[0][0],'/sessions/one/inactivity-fail');assert.equal(h.requests[0][2].enabled,false);
 h.context.current.phase='paused';h.context.current.students=[{failed:true}];h.resolve(session('one',{security:{enabled:true,inactivityFail:false}}));await done;assert.equal(h.context.current.phase,'paused');assert.equal(h.context.current.students[0].failed,true);assert.equal(h.nodes['session-fail-toggle'].checked,false);assert.equal(h.nodes['session-fail-toggle'].disabled,false);
});
test('late responses never overwrite a newly selected session, and failure rolls back',async()=>{
 const h=harness(session());h.nodes['session-fail-toggle'].checked=false;const done=h.context.changeInactivityFail();h.context.current=session('two');h.resolve(session('one',{security:{enabled:true,inactivityFail:false}}));await done;assert.equal(h.context.current.id,'two');assert.equal(h.context.current.security.inactivityFail,true);
 h.nodes['session-fail-toggle'].checked=false;const failed=h.context.changeInactivityFail();h.reject(new Error('Network unavailable'));await failed;assert.equal(h.nodes['session-fail-toggle'].checked,true);assert.equal(h.nodes['session-fail-toggle'].disabled,false);assert.equal(h.context.message,'Network unavailable');
});
test('older HTTP policy cannot overwrite a newer socket policy for the same session',async()=>{
 const h=harness(session('one',{inactivityFailVersion:0}));h.nodes['session-fail-toggle'].checked=false;const done=h.context.changeInactivityFail();
 h.context.current={...h.context.current,inactivityFailVersion:2,security:{enabled:true,inactivityFail:true}};
 h.resolve(session('one',{inactivityFailVersion:1,security:{enabled:true,inactivityFail:false}}));await done;
 assert.equal(h.context.current.inactivityFailVersion,2);assert.equal(h.context.current.security.inactivityFail,true);assert.equal(h.nodes['session-fail-toggle'].checked,true);
});

test('out-of-order socket policy preserves newer policy while merging other live fields',()=>{
 const h=harness(session('one',{inactivityFailVersion:2}));
 const merged=h.context.mergeSessionPolicy(h.context.current,session('one',{phase:'paused',inactivityFailVersion:1,security:{enabled:true,inactivityFail:false}}));
 assert.equal(merged.phase,'paused');assert.equal(merged.inactivityFailVersion,2);assert.equal(merged.security.inactivityFail,true);
 const equal=h.context.mergeSessionPolicy(merged,{inactivityFailVersion:2,security:{enabled:true,inactivityFail:true}});assert.equal(equal.inactivityFailVersion,2);
 const newer=h.context.mergeSessionPolicy(equal,{inactivityFailVersion:3,security:{enabled:true,inactivityFail:false}});assert.equal(newer.inactivityFailVersion,3);assert.equal(newer.security.inactivityFail,false);
});
test('non-toggle HTTP session updates preserve newer policy and cannot switch current session',()=>{
 const h=harness(session('one',{inactivityFailVersion:2}));h.context.historySession=null;h.context.sessionList=[h.context.current];h.context.renderOtherSessionPanels=()=>{};h.context.renderResults=()=>{};
 vm.runInContext(source.match(/function updateSession\(updated\)\{[^\n]+/)[0],h.context);
 h.context.updateSession(session('one',{phase:'paused',inactivityFailVersion:1,security:{enabled:true,inactivityFail:false}}));
 assert.equal(h.context.current.phase,'paused');assert.equal(h.context.current.inactivityFailVersion,2);assert.equal(h.context.current.security.inactivityFail,true);
 h.context.current=session('two');h.context.updateSession(session('one',{phase:'running'}));assert.equal(h.context.current.id,'two');
});
