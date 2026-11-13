const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../public/professor.js'),'utf8');
class Element {constructor(tag='div'){this.tagName=tag;this.children=[];this.value='';this.textContent='';this.disabled=false;this.hidden=false;this.open=false;this.attrs={};} append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(k,v){this.attrs[k]=v;}focus(){this.focused=true;}showModal(){this.open=true;}close(){this.open=false;this.onclose?.();}reportValidity(){return !!this.value;} }
function setup(handler=async()=>({incoming:[],outgoing:[]})){
 const nodes=new Map(),document={hidden:false,createElement:tag=>new Element(tag),getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);}},calls=[],notices=[];
 const context={document,crypto:{randomUUID:()=> 'request-id'},setInterval:()=>1,clearInterval(){},console};
 const start=source.indexOf('function createQuizSharingUI('),end=source.indexOf('// End quiz sharing controller');assert.ok(start>=0&&end>start,'sharing controller exists');vm.runInNewContext(source.slice(start,end),context);
 const ui=context.createQuizSharingUI({api:async(...args)=>{calls.push(args);return handler(...args);},getFolders:()=>[{id:'folder',name:'My class'}],isSignedIn:()=>true,notify:m=>notices.push(m),onImported:async()=>{},});return {ui,nodes,document,calls,notices};
}
test('share submits a stable request ID and generic receipt without leaking a guessed recipient',async()=>{
 const {ui,nodes,calls,notices}=setup(async()=>({ok:true,message:'If this account can receive quizzes, a request has been sent.'}));ui.openShare({id:'quiz',title:'Quiz'});nodes.get('share-email').value='teacher@example.com';await nodes.get('share-form').onsubmit({preventDefault(){}});assert.equal(calls[0][0],'/tests/quiz/share');assert.equal(calls[0][2].email,'teacher@example.com');assert.equal(calls[0][2].requestId,'request-id');assert.match(notices[0],/^If this account/);assert.equal(nodes.get('share-dialog').open,false);
});
test('incoming card offers folder selection and imports only after acceptance',async()=>{
 const {ui,nodes,calls}=setup(async route=>route==='/shares'?{incoming:[{id:'s1',title:'<img onerror=x>',senderEmail:'a@example.com',questionCount:2}],outgoing:[]}:{id:'copy'});await ui.refresh();assert.equal(nodes.get('shares-open').textContent,'Shared with me (1)');const entry=nodes.get('shares-incoming').children[0];assert.equal(entry.children[0].textContent,'<img onerror=x>');const select=entry.children.find(e=>e.tagName==='label').children[0];select.value='folder';const actions=entry.children.find(e=>e.className==='actions');await actions.children[0].onclick();assert.equal(calls[1][0],'/shares/s1/accept');assert.equal(calls[1][2].folderId,'folder');
});
test('reset discards stale incoming response and clears private UI',async()=>{
 let release;const {ui,nodes}=setup(()=>new Promise(resolve=>release=resolve));const pending=ui.refresh();ui.reset();release({incoming:[{id:'s',title:'Private',senderEmail:'a',questionCount:1}],outgoing:[]});await pending;assert.equal(nodes.get('shares-incoming').children.length,0);assert.equal(nodes.get('shares-open').hidden,true);
});
test('share network failure preserves the request ID for safe retry and disables double submission',async()=>{
 let release;const {ui,nodes,calls}=setup(()=>new Promise((resolve,reject)=>release=()=>reject(new Error('Offline'))));ui.openShare({id:'q',title:'Quiz'});nodes.get('share-email').value='a@example.com';const first=nodes.get('share-form').onsubmit({preventDefault(){}});await nodes.get('share-form').onsubmit({preventDefault(){}});assert.equal(calls.length,1);assert.equal(nodes.get('share-submit').disabled,true);release();await first;assert.equal(nodes.get('share-submit').disabled,false);assert.equal(nodes.get('share-dialog').open,true);assert.match(nodes.get('share-error').textContent,/Offline/);const retry=nodes.get('share-form').onsubmit({preventDefault(){}});assert.equal(calls[1][2].requestId,calls[0][2].requestId);release();await retry;
});
