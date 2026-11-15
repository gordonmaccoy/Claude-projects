const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
test('50 approved avatar assets are distinct, packaged locally and use manifest names',()=>{
 const avatars=require('../public/game-avatars');
 const manifest=require('../public/game-avatars/manifest.json');
 assert.equal(avatars.ids.length,50);assert.deepEqual(avatars.ids,manifest.map(a=>a.id));
 assert.deepEqual(avatars.names,manifest.map(a=>a.name));
 const hashes=[];
 for(const entry of manifest){
  assert.equal(avatars.still(entry.id),entry.image);
  assert.match(entry.image,/^\/game-avatars\/avatar-\d{2}\.webp$/);
  const bytes=fs.readFileSync(path.join(__dirname,'../public',entry.image));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  hashes.push(crypto.createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(new Set(hashes).size,50);
 for(const bad of ['<script>','../../secret',null,'__proto__'])assert.equal(avatars.image(bad),avatars.image('avatar-01'));
});
test('all avatar files are served from the same public paths used by game screens',async()=>{
 const avatars=require('../public/game-avatars');
 const app=require('express')();app.use(require('express').static(path.join(__dirname,'../public')));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{for(const id of avatars.ids){
  for(const [asset,mime] of [[avatars.still(id),'image/webp'],[avatars.image(id,{reducedMotion:false}),'image/gif'],[avatars.thumbnail(id),'image/webp'],[avatars.feature(id,{reducedMotion:false}),'image/webp']]){
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
 assert.equal(hashes.size,50);assert.ok(size<6_500_000,'all animated assets under 6.5 MB');
});
test('avatar rendering respects system reduced motion and safe fallback',()=>{
 const vm=require('node:vm'),src=fs.readFileSync(path.join(__dirname,'../public/game-avatars.js'),'utf8');
 let reduced=true;const window={matchMedia:q=>({matches:q==='(prefers-reduced-motion: reduce)'&&reduced})};
 vm.runInNewContext(src,{window});
 assert.equal(window.GameAvatars.image('avatar-05'),window.GameAvatars.still('avatar-05'));
 assert.equal(window.GameAvatars.feature('avatar-05'),window.GameAvatars.still('avatar-05'));
 reduced=false;
 assert.equal(window.GameAvatars.image('avatar-05'),'/game-avatars/avatar-05.gif');
 assert.equal(window.GameAvatars.feature('avatar-05'),'/game-avatars/avatar-05-feature.webp');
 assert.equal(window.GameAvatars.feature('../wrong'),window.GameAvatars.feature('avatar-01'));
 assert.equal(window.GameAvatars.thumbnail('../wrong'),window.GameAvatars.thumbnail('avatar-01'));
 assert.equal(window.GameAvatars.image('../wrong'),'/game-avatars/avatar-01.gif');
});
test('the classroom art is bundled locally without external dependencies',()=>{
 const art=fs.readFileSync(path.join(__dirname,'../public/game-classroom-backdrop.svg'),'utf8');
 assert.match(art,/viewBox="0 0 1600 900"/);
 assert.doesNotMatch(art,/<script|<image|<foreignObject|href=|https?:\/\/(?!www\.w3\.org)/i);
});

function webpChunks(bytes){
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 const groups=new Map();
 for(let i=12;i+8<=bytes.length;){
  const name=bytes.toString('ascii',i,i+4),size=bytes.readUInt32LE(i+4);
  assert.ok(size<=bytes.length-i-8,'valid WebP chunk size');
  const data=bytes.subarray(i+8,i+8+size);
  if(!groups.has(name))groups.set(name,[]);
  groups.get(name).push(data);i+=8+size+(size%2);
 }
 return groups;
}
test('all picker tiles are compact and all large avatar assets are sharp, bounded and animated',async()=>{
 const avatars=require('../public/game-avatars'),{loadImage}=require('@napi-rs/canvas');
 const thumbHashes=new Set(),featureHashes=new Set();
 for(const id of avatars.ids){
  const thumb=fs.readFileSync(path.join(__dirname,'../public',avatars.thumbnail(id)));
  const feature=fs.readFileSync(path.join(__dirname,'../public',avatars.feature(id,{reducedMotion:false})));
  assert.ok(thumb.length<=8500,id+' oversized thumbnail');
  const thumbImage=await loadImage(thumb);
  assert.deepEqual([thumbImage.width,thumbImage.height],[80,80]);
  const chunks=webpChunks(feature),[extended]=chunks.get('VP8X')||[],[animation]=chunks.get('ANIM')||[];
  assert.ok(extended&&animation,id+' not animated WebP');
  assert.equal(extended.readUIntLE(4,3)+1,512);assert.equal(extended.readUIntLE(7,3)+1,512);
  assert.equal(animation.readUInt16LE(4),0,'loops forever');
  const frames=chunks.get('ANMF')||[];
  assert.ok(frames.length>=4,id+' missing blink sequence');
  const duration=frames.reduce((time,frame)=>time+frame.readUIntLE(12,3),0);
  assert.ok(duration>=2000&&duration<=4000,id+' invalid loop duration');
  assert.ok(feature.length<=85_000,id+' oversized feature');
  thumbHashes.add(crypto.createHash('sha256').update(thumb).digest('hex'));
  featureHashes.add(crypto.createHash('sha256').update(feature).digest('hex'));
 }
 assert.equal(thumbHashes.size,50);assert.equal(featureHashes.size,50);
});
