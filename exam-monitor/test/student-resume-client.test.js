const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../public/student.js'),'utf8');
function setup(responses,storage=new Map()){
 const timers=new Map(),calls=[],button={disabled:false},notice={textContent:''},errors=[];
 let counter=0;
 const context={memoryToken:null,resumeKey:'onscreen-resume-ABC',draftKey:'draft',testAnswers:{},sessionId:'ABC',joined:false,connectionVersion:0,reconnectTimer:null,resumeRetryDelay:1500,resumePending:false,
  localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},crypto:require('node:crypto').webcrypto,
  socket:{connected:true},els:{form:{querySelector:()=>button},joinError:{hidden:true},meName:{}},connectionNotice:notice,t:x=>x,message(){},setConnected(){},showJoinError:x=>errors.push(x),showView:v=>{context.view=v;},visibility:async()=>{},
  setTimeout(fn,delay){timers.set(++counter,{fn,delay});return counter;},clearTimeout:id=>timers.delete(id),
  emit:async(event,data)=>{calls.push({event,data});return typeof responses[0]==='function'?responses.shift()():responses.shift();}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function savedToken()'),source.indexOf('async function initializeStudentLanguage()')),context);
 return {context,calls,timers,button,notice,errors,storage,join:input=>context.join(input),retry:async()=>{const [id,timer]=timers.entries().next().value;timers.delete(id);await timer.fn();}};
}
const token='a'.repeat(48),success={ok:true,resumeToken:token,view:{name:'Kim',draft:{q:'a'},phase:'paused'}};
test('reopened page retries timed-out saved capability and restores server view without identity enrollment',async()=>{
 const h=setup([{ok:false,timedOut:true,error:'timeout'},success],new Map([['onscreen-resume-ABC',token]]));
 await h.join({resumeToken:h.context.savedToken()});
 assert.equal(h.timers.size,1);assert.equal(h.button.disabled,true);assert.match(h.notice.textContent,/reconnect/i);
 await h.retry();assert.equal(h.context.joined,true);assert.equal(h.view,undefined);assert.equal(h.context.view.phase,'paused');assert.equal(h.context.view.draft.q,'a');
 assert.equal(h.calls.length,2);assert.deepEqual(Object.keys(h.calls[1].data).sort(),['resumeToken','sessionId']);assert.equal(h.timers.size,0);assert.equal(h.button.disabled,false);
});
test('pending resume visibly blocks duplicate enrollment; explicit rejection enables form without retry',async()=>{
 let finish;const h=setup([()=>new Promise(resolve=>{finish=resolve;})]);
 const pending=h.join({resumeToken:token});assert.equal(h.button.disabled,true);assert.match(h.notice.textContent,/resum/i);
 finish({ok:false,error:'Invalid resume token'});await pending;
 assert.equal(h.button.disabled,false);assert.equal(h.timers.size,0);assert.deepEqual(h.errors,['Invalid resume token']);
});
test('lost initial enrollment acknowledgement retries only the capability saved before request',async()=>{
 const h=setup([{ok:false,timedOut:true,error:'timeout'},success]);
 await h.join({name:'Kim',number:'001'});const saved=h.storage.get('onscreen-resume-ABC');assert.equal(saved,h.calls[0].data.resumeToken);assert.equal(saved.length,48);
 assert.equal(h.timers.size,1);await h.retry();assert.equal(h.calls[1].data.resumeToken,saved);assert.equal(h.calls[1].data.number,undefined);
});
test('retry backoff caps at ten seconds and stale responses cannot schedule reconnect work',async()=>{
 const h=setup(Array.from({length:7},()=>({ok:false,timedOut:true,error:'timeout'})));
 await h.join({resumeToken:token});for(let i=0;i<5;i++){assert.equal(h.timers.size,1);assert.ok([...h.timers.values()][0].delay<=10000);await h.retry();}
 const stale=setup([async()=>{stale.context.connectionVersion++;return {ok:false,timedOut:true};}]);await stale.join({resumeToken:token});assert.equal(stale.timers.size,0);
});
test('disconnected timeout leaves reconnection to socket without an extra retry timer',async()=>{
 const h=setup([{ok:false,timedOut:true,error:'timeout'}]);h.context.socket.connected=false;await h.join({resumeToken:token});assert.equal(h.timers.size,0);
});
test('manual submit cannot compete with saved-token resume or queue enrollment offline',async()=>{
 const h=setup([]);h.context.$=()=>({value:'001'});h.context.els.nameInput={value:'Kim'};
 vm.runInContext(source.slice(source.indexOf('els.form.onsubmit='),source.indexOf('function showView(')),h.context);
 h.context.socket.connected=false;await h.context.els.form.onsubmit({preventDefault(){}});assert.equal(h.calls.length,0);
 h.context.socket.connected=true;h.context.sessionId='';await h.context.els.form.onsubmit({preventDefault(){}});assert.equal(h.calls.length,0);
 h.context.sessionId='ABC';h.context.resumePending=true;await h.context.els.form.onsubmit({preventDefault(){}});assert.equal(h.calls.length,0);
});
