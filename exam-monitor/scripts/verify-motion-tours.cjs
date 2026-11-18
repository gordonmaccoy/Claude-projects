const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const tours=require('./motion-tours/scenes.json');
const encoder=process.env.FFMPEG_PATH||path.resolve('.tmp/motion-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe');
for(const format of ['landscape','vertical'])for(const tour of tours){
 const file=path.resolve('output/motion-tours',format,tour.id+'.mp4');const metadata=JSON.parse(fs.readFileSync(file.replace('.mp4','.json')));
 const r=spawnSync(encoder,['-hide_banner','-i',file,'-map','0:v:0','-f','null','-'],{encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});
 assert.equal(r.status,0,r.stderr);assert.match(r.stderr,/Video: h264/);assert.match(r.stderr,/yuv420p/);assert.match(r.stderr,new RegExp(metadata.width+'x'+metadata.height));assert.match(r.stderr,/30 fps/);assert.ok(!r.stderr.includes('Audio:'),'Caption-only output has no audio stream');
 const expected=metadata.duration;const duration=r.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);assert.ok(duration);const actual=Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]);assert.ok(Math.abs(actual-expected)<.1,'Duration matches captions');
 console.log('PASS',format,tour.id,actual+'s',metadata.width+'x'+metadata.height,'all frames decoded');
}
