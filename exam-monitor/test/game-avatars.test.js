const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
test('36 approved avatar assets are distinct, packaged locally and use manifest names',()=>{
 const avatars=require('../public/game-avatars');
 const manifest=require('../public/game-avatars/manifest.json');
 assert.equal(avatars.ids.length,36);assert.deepEqual(avatars.ids,manifest.map(a=>a.id));
 assert.deepEqual(avatars.names,manifest.map(a=>a.name));
 const hashes=[];
 for(const entry of manifest){
  assert.equal(avatars.image(entry.id),entry.image);
  assert.match(entry.image,/^\/game-avatars\/avatar-\d{2}\.webp$/);
  const bytes=fs.readFileSync(path.join(__dirname,'../public',entry.image));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  hashes.push(crypto.createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(new Set(hashes).size,36);
 for(const bad of ['<script>','../../secret',null,'__proto__'])assert.equal(avatars.image(bad),avatars.image('avatar-01'));
});
test('all avatar files are served from the same public paths used by game screens',async()=>{
 const app=require('express')();app.use(require('express').static(path.join(__dirname,'../public')));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{for(const entry of require('../public/game-avatars/manifest.json')){
  const response=await fetch('http://127.0.0.1:'+server.address().port+entry.image);
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^image\/webp/);
  assert.ok((await response.arrayBuffer()).byteLength>1000);
 }}finally{await new Promise(resolve=>server.close(resolve));}
});
