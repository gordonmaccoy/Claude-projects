const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=file=>fs.readFileSync(require.resolve('../public/'+file),'utf8');

test('class projector offers the room name and a QR button, without a separate PIN line',()=>{
  const html=read('game-display.html');
  assert.match(html,/<button[^>]*id="join-qr-button"[^>]*aria-haspopup="dialog"/);
  assert.match(html,/<dialog[^>]*id="join-qr-dialog"/);
  assert.match(html,/id="room-name"/);
  assert.doesNotMatch(html,/id="pin(?:-row)?"|Game PIN/);
  assert.match(read('game-client.js'),/Waiting for game to start/);
});

test('projector footer has a distinct speaker disclosure and an accessible vertical volume control',()=>{
  const html=read('game-display.html'),css=read('game-classroom-lobby.css');
  assert.match(html,/<button[^>]*id="sound-speaker"[^>]*aria-controls="sound-panel"[^>]*aria-expanded="false"/);
  assert.match(html,/<div[^>]*id="sound-panel"[^>]*hidden/);
  assert.match(html,/<label[^>]*for="game-volume">Volume<\/label>/);
  assert.match(html,/<button[^>]*id="game-audio-toggle"/);
  assert.match(css,/#game-volume\s*{[^}]*writing-mode:vertical-lr[^}]*direction:rtl/);
  assert.match(css,/#classroom-advance\s*{[^}]*grid-column:2/);
});

class FakeNode {
  constructor(){this.events={};this.attrs={};this.hidden=true;this.open=false;this.clicks=0;this.focuses=0;}
  addEventListener(event,fn){(this.events[event]??=[]).push(fn);}
  fire(event,details={}){for(const fn of this.events[event]||[])fn({target:this,...details});}
  click(){this.clicks++;this.fire('click');}
  focus(){this.focuses++;}
  contains(node){return this===node;}
  setAttribute(name,val){this.attrs[name]=val;}
  getAttribute(name){return this.attrs[name]??null;}
  set src(val){this.attrs.src=val;}
  get src(){return this.attrs.src;}
  showModal(){this.open=true;}
  close(){this.open=false;this.fire('close');}
}
function setup(autoEnable=()=>true){
  const {create}=require('../public/game-lobby-controls');
  const nodes=Object.fromEntries(['qrButton','qrImage','qrDialog','enlargedQr','closeQr','speaker','soundPanel','audioToggle','document'].map(id=>[id,new FakeNode()]));
  return {...nodes,ui:create({...nodes,autoEnable})};
}
test('lobby QR is enlarged in a modal and closes when leaving the lobby',()=>{
  const n=setup(), url='/game-api/abc/qr';
  n.ui.setQr(url);
  assert.equal(n.qrButton.hidden,false);
  assert.equal(n.qrImage.src,url);
  n.qrButton.click();
  assert.equal(n.qrDialog.open,true);
  assert.equal(n.enlargedQr.src,url);
  n.closeQr.click();
  assert.equal(n.qrDialog.open,false);
  n.qrButton.click();
  n.ui.setQr(null);
  assert.equal(n.qrButton.hidden,true);
  assert.equal(n.qrDialog.open,false);
});
test('speaker opens an anchored panel and first open unlocks audio only once',()=>{
  const n=setup();
  n.speaker.click();
  assert.equal(n.soundPanel.hidden,false);
  assert.equal(n.speaker.getAttribute('aria-expanded'),'true');
  assert.equal(n.audioToggle.clicks,1);
  n.document.fire('keydown',{key:'Escape'});
  assert.equal(n.soundPanel.hidden,true);
  assert.equal(n.speaker.getAttribute('aria-expanded'),'false');
  assert.equal(n.speaker.focuses,1);
  n.speaker.click();
  assert.equal(n.audioToggle.clicks,1);
  n.document.fire('pointerdown',{target:n.soundPanel});
  assert.equal(n.soundPanel.hidden,false);
  n.document.fire('pointerdown');
  assert.equal(n.soundPanel.hidden,true);
});
test('opening sound controls never bypasses a saved mute',()=>{
  const n=setup(()=>false);
  n.speaker.click();
  assert.equal(n.soundPanel.hidden,false);
  assert.equal(n.audioToggle.clicks,0);
  n.ui.closeSound();
  assert.equal(n.soundPanel.hidden,true);
});

test('projector uses the public Examio address only for public rooms',()=>{
 const {joinAddress}=require('../public/game-lobby-controls');
 const publicJoin={label:'www.examio.io',href:'https://www.examio.io/'};
 assert.deepEqual(joinAddress({hostname:'examio.io'}),publicJoin);
 assert.deepEqual(joinAddress({hostname:'www.examio.io'}),publicJoin);
 assert.deepEqual(joinAddress({hostname:'claude-projects-development.up.railway.app'}),{label:'Examio Development',href:'/'});
 assert.deepEqual(joinAddress({hostname:'localhost',host:'localhost:9876'}),{label:'localhost:9876',href:'/'});
 assert.match(read('game-display.js'),/joinAddress\(location\)/);
});

test('selected player avatar has a high-contrast ring and a visible non-color selection marker',()=>{
 const css=read('game-picker.css');
 assert.match(css,/\[aria-pressed="true"\]\s*\{[^}]*border-color:#70f4ff[^}]*box-shadow:/);
 assert.match(css,/\[aria-pressed="true"\]::after\s*\{[^}]*content:'✓'/);
});

test('projector homepage brand and blue entry link are scoped independently of white header links',()=>{
 const html=read('game-display.html'),css=read('game-classroom-lobby.css'),js=read('game-display.js');
 assert.match(html,/<a class="brand" href="\/">/);assert.match(css,/\.game-display #join-link\{color:#82c3ff;/);
 assert.ok(js.includes("lobby.roomName.replace(/^game\\s*:\\s*/i,'').trim()"));
});
