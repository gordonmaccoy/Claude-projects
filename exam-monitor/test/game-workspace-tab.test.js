const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=name=>fs.readFileSync(require.resolve('../public/'+name),'utf8');
test('professor Game Library is a dashboard tab, not a navigation link',()=>{
 const html=read('professor.html');
 assert.match(html,/<button[^>]*data-tab="games"[^>]*>Game Library<\/button>/);
 assert.match(html,/<section id="games" class="tab" hidden[^>]*>\s*<iframe id="game-workspace-frame" title="Game Library"/);
 assert.doesNotMatch(html,/<a[^>]*href="\/game-library\.html"[^>]*>Game Library<\/a>/);
 const js=read('professor.js');
 assert.match(js,/gameWorkspace\.setActive\(name==='games'\)/);
 assert.match(js,/function clearPrivateWorkspace\(\) \{\s*gameWorkspace\.reset\(\)/);
 assert.match(read('game-library.html'),/<header><a class="brand" href="\/"[^>]*>/);
});
test('Game Library loads only upon activation, preserves state across tabs and clears on signout',()=>{
 const {create}=require('../public/game-workspace-tab');
 let load,observed,disconnected=0;
 const frame={style:{},dataset:{},getAttribute(){return this.src??null;},setAttribute(key,value){this[key]=value;},removeAttribute(key){delete this[key];},addEventListener(event,fn){if(event==='load')load=fn;}};
 const main={getBoundingClientRect(){return {height:701.25};}};
 let isContent=false;
 frame.contentDocument={querySelector(){return isContent?main:null;}};
 class Observer{observe(node){observed=node;}disconnect(){disconnected++;}}
 const pane=create(frame,Observer);
 assert.equal(frame.getAttribute('src'),null);
 pane.setActive(true);
 assert.equal(frame.src,'/game-library.html?embedded=1');
 isContent=true;load();
 assert.equal(observed,main);assert.equal(frame.style.height,'702px');
 pane.setActive(false);pane.setActive(true);
 assert.equal(frame.src,'/game-library.html?embedded=1');
 pane.reset();
 assert.ok(disconnected);assert.equal(frame.src,'about:blank');assert.equal(frame.style.height,'');
 pane.setActive(false);assert.equal(frame.src,'about:blank');
 pane.setActive(true);assert.equal(frame.src,'/game-library.html?embedded=1');
});
