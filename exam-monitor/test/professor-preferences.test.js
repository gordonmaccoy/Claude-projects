const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function storage(){const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
test('remember-me keeps tokens only in the selected storage and preserves OAuth verifier',()=>{
 const localStorage=storage(),sessionStorage=storage(),window={};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/session-preferences.js'),'utf8'),{window,localStorage,sessionStorage,URL});
 const preferences=window.createExamioSessionPreferences('https://project.supabase.co');
 preferences.storage.setItem('sb-project-auth-token','session');
 preferences.storage.setItem('sb-project-auth-token-code-verifier','verifier');
 assert.equal(localStorage.getItem('sb-project-auth-token'),null);
 assert.equal(sessionStorage.getItem('sb-project-auth-token'),'session');
 assert.equal(localStorage.getItem('sb-project-auth-token-code-verifier'),'verifier');
 assert.equal(sessionStorage.getItem('sb-project-auth-token-code-verifier'),null);
 preferences.setRemember(true);
 assert.equal(localStorage.getItem('sb-project-auth-token'),'session');
 assert.equal(localStorage.getItem('sb-project-auth-token-code-verifier'),'verifier');
 assert.equal(sessionStorage.getItem('sb-project-auth-token'),null);
 preferences.setRemember(false);
 assert.equal(localStorage.getItem('sb-project-auth-token'),null);
 assert.equal(preferences.storage.getItem('sb-project-auth-token'),'session');
 preferences.storage.removeItem('sb-project-auth-token');
 assert.equal(preferences.storage.getItem('sb-project-auth-token'),null);
});
test('blocked browser storage still permits a temporary in-memory session',()=>{
 const window={};const blocked={getItem(){throw Error('Storage denied');},setItem(){throw Error('Storage denied');},removeItem(){throw Error('Storage denied');}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/session-preferences.js'),'utf8'),{window,localStorage:blocked,sessionStorage:blocked,URL});
 const preferences=window.createExamioSessionPreferences('https://project.supabase.co');
 preferences.storage.setItem('sb-project-auth-token','temporary');assert.equal(preferences.storage.getItem('sb-project-auth-token'),'temporary');
});
test('existing persistent sessions migrate to session storage without signing the user out',()=>{
 const localStorage=storage(),sessionStorage=storage(),window={};localStorage.setItem('sb-project-auth-token','existing');
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/session-preferences.js'),'utf8'),{window,localStorage,sessionStorage,URL});
 const preferences=window.createExamioSessionPreferences('https://project.supabase.co');
 assert.equal(preferences.storage.getItem('sb-project-auth-token'),'existing');
 assert.equal(localStorage.getItem('sb-project-auth-token'),null);
 assert.equal(sessionStorage.getItem('sb-project-auth-token'),'existing');
});
