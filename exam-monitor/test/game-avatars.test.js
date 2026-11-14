const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
test('36 approved avatar assets are distinct, packaged locally and use manifest names',()=>{
 const avatars=require('../public/game-avatars');
 const manifest=require('../public/game-avatars/manifest.json');
 assert.equal(avatars.ids.length,36);assert.deepEqual(avatars.ids,manifest.map(a=>a.id));
 assert.deepEqual(avatars.names,manifest.map(a=>a.name));
 const hashes=[];
 for(const entry of manifest){
  assert.equal(avatars.still(entry.id),entry.image);
  assert.match(entry.image,/^\/game-avatars\/avatar-\d{2}\.webp$/);
  const bytes=fs.readFileSync(path.join(__dirname,'../public',entry.image));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  hashes.push(crypto.createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(new Set(hashes).size,36);
 for(const bad of ['<script>','../../secret',null,'__proto__'])assert.equal(avatars.image(bad),avatars.image('avatar-01'));
});
test('all avatar files are served from the same public paths used by game screens',async()=>{
 const avatars=require('../public/game-avatars');
 const app=require('express')();app.use(require('express').static(path.join(__dirname,'../public')));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{for(const id of avatars.ids){
  for(const [asset,mime] of [[avatars.still(id),'image/webp'],[avatars.image(id,{reducedMotion:false}),'image/gif']]){
   const response=await fetch('http://127.0.0.1:'+server.address().port+asset);
   assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),mime);
   assert.ok((await response.arrayBuffer()).byteLength>1000);
  }
 }}finally{await new Promise(resolve=>server.close(resolve));}
});

function gifInfo(bytes){
 assert.equal(bytes.toString('ascii',0,6),'GIF89a');
 let i=13,frames=0,period=0;
 const blocks=()=>{while(bytes[i])i+=bytes[i]+1;i++;};
 if(bytes[10]&128)i+=3*(2**((bytes[10]&7)+1));
 while(i<bytes.length){
  const marker=bytes[i++];
  if(marker===0x3b)break;
  if(marker===0x21){const label=bytes[i++];if(label===0xf9)period+=bytes.readUInt16LE(i+2)*10;blocks();continue;}
  assert.equal(marker,0x2c);const packed=bytes[i+8];i+=9;
  if(packed&128)i+=3*(2**((packed&7)+1));
  i++;blocks();frames++;
 }
 return {frames,period};
}
test('each avatar has a unique lightweight seamless-loop asset',()=>{
 const avatars=require('../public/game-avatars'),hashes=new Set();
 let size=0;
 for(const id of avatars.ids){
  const url=avatars.image(id,{reducedMotion:false});assert.equal(url,'/game-avatars/'+id+'.gif');
  const bytes=fs.readFileSync(path.join(__dirname,'../public',url));
  const {frames,period}=gifInfo(bytes);
  assert.ok(frames>=12);assert.ok(period>=2000&&period<=4000);
  assert.ok(bytes.includes(Buffer.from('NETSCAPE2.0\x03\x01\x00\x00')),'loops forever');
  hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));size+=bytes.length;
  assert.ok(bytes.length<160_000,id+' exceeds the per-avatar payload budget');
 }
 assert.equal(hashes.size,36);assert.ok(size<4_500_000,'all animated assets under 4.5 MB');
});
test('avatar rendering respects system reduced motion and safe fallback',()=>{
 const vm=require('node:vm'),src=fs.readFileSync(path.join(__dirname,'../public/game-avatars.js'),'utf8');
 let reduced=true;const window={matchMedia:q=>({matches:q==='(prefers-reduced-motion: reduce)'&&reduced})};
 vm.runInNewContext(src,{window});
 assert.equal(window.GameAvatars.image('avatar-05'),window.GameAvatars.still('avatar-05'));
 reduced=false;
 assert.equal(window.GameAvatars.image('avatar-05'),'/game-avatars/avatar-05.gif');
 assert.equal(window.GameAvatars.image('../wrong'),'/game-avatars/avatar-01.gif');
});
test('the classroom art is bundled locally without external dependencies',()=>{
 const art=fs.readFileSync(path.join(__dirname,'../public/game-classroom-backdrop.svg'),'utf8');
 assert.match(art,/viewBox="0 0 1600 900"/);
 assert.doesNotMatch(art,/<script|<image|<foreignObject|href=|https?:\/\/(?!www\.w3\.org)/i);
});
