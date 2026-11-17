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

test('Google provider tokens stay in memory and are never persisted with Remember me',()=>{const localStorage=storage(),sessionStorage=storage(),window={};vm.runInNewContext(fs.readFileSync(require.resolve('../public/session-preferences.js'),'utf8'),{window,localStorage,sessionStorage,URL});const prefs=window.createExamioSessionPreferences('https://project.supabase.co');const key='sb-project-auth-token';prefs.setRemember(true);prefs.storage.setItem(key,JSON.stringify({access_token:'app-session',provider_token:'google-access',provider_refresh_token:'google-refresh',user:{id:'owner'}}));assert.equal(prefs.getGoogleProviderToken('owner'),'google-access');assert.equal(prefs.getGoogleProviderToken('other'),null);const saved=JSON.parse(localStorage.getItem(key));assert.equal(saved.access_token,'app-session');assert.equal(saved.provider_token,undefined);assert.equal(saved.provider_refresh_token,undefined);prefs.storage.removeItem(key);assert.equal(prefs.getGoogleProviderToken('owner'),null);});
test('signout invalidates copied tab sessions and blocks late refresh writes',()=>{const localStorage=storage(),a=storage(),window={};const script=fs.readFileSync(require.resolve('../public/session-preferences.js'),'utf8');function prefs(sessionStorage){const w={};vm.runInNewContext(script,{window:w,localStorage,sessionStorage,URL});return w.createExamioSessionPreferences('https://project.supabase.co');}const first=prefs(a);first.storage.setItem('sb-project-auth-token','session');const b=storage();for(let i=0;i<a.length;i++){const k=a.key(i);b.setItem(k,a.getItem(k));}const second=prefs(b);assert.equal(second.storage.getItem('sb-project-auth-token'),'session');first.clearSession();assert.equal(second.storage.getItem('sb-project-auth-token'),null);second.storage.setItem('sb-project-auth-token','late-refresh');assert.equal(second.storage.getItem('sb-project-auth-token'),null);const restored=prefs(b);assert.equal(restored.storage.getItem('sb-project-auth-token'),null);second.beginSignIn();second.storage.setItem('sb-project-auth-token','new-login');assert.equal(second.storage.getItem('sb-project-auth-token'),'new-login');});
test('normal close clears a non-remembered login; reload and deliberate navigation preserve it',()=>{const localStorage=storage(),sessionStorage=storage(),listeners={},navigation={},window={addEventListener:(name,fn)=>listeners[name]=fn,navigation:{addEventListener:(name,fn)=>navigation[name]=fn},location:{origin:'https://examio.io'}};vm.runInNewContext(fs.readFileSync(require.resolve('../public/session-preferences.js'),'utf8'),{window,localStorage,sessionStorage,URL});const p=window.createExamioSessionPreferences('https://project.supabase.co');p.storage.setItem('sb-project-auth-token','session');listeners.pagehide({persisted:false});assert.equal(p.storage.getItem('sb-project-auth-token'),null);p.beginSignIn();p.storage.setItem('sb-project-auth-token','session');navigation.navigate({destination:{url:'https://examio.io/professor.html',sameDocument:false},signal:{addEventListener(){}}});listeners.pagehide({persisted:false});assert.equal(p.storage.getItem('sb-project-auth-token'),'session');p.setRemember(true);p.storage.setItem('sb-project-auth-token','remembered');navigation.navigateerror();listeners.pagehide({persisted:false});assert.equal(p.storage.getItem('sb-project-auth-token'),'remembered');});
test('a tab invalidated by logout cannot silently retain its old Remember me choice',()=>{const localStorage=storage(),a=storage(),b=storage(),script=fs.readFileSync(require.resolve('../public/session-preferences.js'),'utf8');function make(sessionStorage){const window={};vm.runInNewContext(script,{window,localStorage,sessionStorage,URL});return window.createExamioSessionPreferences('https://project.supabase.co');}const first=make(a);first.setRemember(true);first.storage.setItem('sb-project-auth-token','old');const second=make(b);assert.equal(second.remember,true);first.clearSession();assert.equal(second.blocked,true);assert.equal(second.remember,false);second.beginSignIn();second.storage.setItem('sb-project-auth-token','fresh');assert.equal(localStorage.getItem('sb-project-auth-token'),null);assert.equal(b.getItem('sb-project-auth-token'),'fresh');});

test('a stale SDK signout cannot delete a newer remembered session',()=>{const localStorage=storage(),a=storage(),b=storage(),script=fs.readFileSync(require.resolve('../public/session-preferences.js'),'utf8');function make(sessionStorage){const window={};vm.runInNewContext(script,{window,localStorage,sessionStorage,URL});return window.createExamioSessionPreferences('https://project.supabase.co');}const first=make(a),stale=make(b);first.storage.setItem('sb-project-auth-token','old');first.clearSession();const fresh=make(a);fresh.beginSignIn();fresh.setRemember(true);fresh.storage.setItem('sb-project-auth-token','new-owner');assert.equal(stale.blocked,true);stale.storage.removeItem('sb-project-auth-token');assert.equal(localStorage.getItem('sb-project-auth-token'),'new-owner');});
