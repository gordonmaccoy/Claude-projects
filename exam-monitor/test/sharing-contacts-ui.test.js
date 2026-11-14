const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element{constructor(tag='div'){this.tagName=tag;this.children=[];this.value='';this.hidden=false;this.textContent='';}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}focus(){}reportValidity(){return true;}}
function setup(api){const nodes=new Map();const document={createElement:t=>new Element(t),getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);}};document.getElementById('share-email');const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../public/sharing-contacts.js'),'utf8'),{window,document});const ui=window.createSharingContacts({api,document});return {ui,nodes};}
test('contacts search/select without sending, edit, add and remove through owner-scoped routes',async()=>{
 const calls=[];let contacts=[{id:'m',name:'Mike',email:'mike@example.com'},{id:'s',name:'Sue',email:'sue@example.com'}];const {ui,nodes}=setup(async(route,method,body)=>{calls.push([route,method,body]);if(!method)return contacts;if(method==='POST')return {id:body.id||'new',...body};return {ok:true};});await ui.open();
 nodes.get('contacts-search').value='MIKE';nodes.get('contacts-search').oninput();assert.equal(nodes.get('contacts-list').children.length,1);nodes.get('contacts-list').children[0].children[0].onclick();assert.equal(nodes.get('share-email').value,'mike@example.com');assert.equal(calls.length,1,'selection never sends a quiz');
 nodes.get('contacts-list').children[0].children[1].onclick();nodes.get('contact-name').value='Michael';await nodes.get('contact-save').onclick();assert.equal(calls[1][2].id,'m');assert.equal(calls[1][2].name,'Michael');assert.equal(nodes.get('contact-email').disabled,true);
 nodes.get('contacts-search').value='';nodes.get('contacts-search').oninput();nodes.get('contact-add').onclick();nodes.get('contact-name').value='New colleague';nodes.get('contact-email').value='new@example.com';await nodes.get('contact-save').onclick();assert.equal(nodes.get('share-email').value,'new@example.com');assert.equal(nodes.get('contacts-list').children.length,3);
 await nodes.get('contacts-list').children[0].children[2].onclick();assert.equal(calls.at(-1)[1],'DELETE');assert.equal(nodes.get('contacts-list').children.length,2);
});
test('late contacts responses after logout or dialog close cannot expose old contacts',async()=>{
 let finish;const {ui,nodes}=setup(()=>new Promise(resolve=>finish=resolve));const loading=ui.open();ui.reset();finish([{id:'private',name:'Private',email:'private@example.com'}]);await loading;assert.equal(nodes.get('contacts-list').children.length,1);assert.ok(!nodes.get('contacts-list').children[0].textContent.includes('Private'));assert.equal(nodes.get('contact-email').disabled,true);
});
test('failed contact loading leaves manual email entry available',async()=>{
 const {ui,nodes}=setup(async()=>{throw Error('Offline');});await ui.open();assert.match(nodes.get('contacts-status').textContent,/still enter an email/);assert.notEqual(nodes.get('share-email').disabled,true);
});
test('contact mutations wait for the initial list so a late load cannot erase a new row',async()=>{
 let finish;const {ui,nodes}=setup(()=>new Promise(resolve=>finish=resolve));const pending=ui.open();assert.equal(nodes.get('contact-add').disabled,true);finish([]);await pending;assert.equal(nodes.get('contact-add').disabled,false);
});
