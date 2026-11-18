// Offline composition; generated media contains only disposable demo UI captures.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
const tours=require('./motion-tours/scenes.json');
const out=path.resolve('output/motion-tours'),captures=path.join(out,'captures');
const manifest=JSON.parse(fs.readFileSync(path.join(captures,'manifest.json')));
const ffmpeg=process.env.FFMPEG_PATH||path.resolve('.tmp/motion-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe');
GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeui.ttf','Tour');GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeuib.ttf','Tour Bold');
const args=process.argv.slice(2),format=args[args.indexOf('--format')+1]||'landscape',chosen=args.includes('--tour')?args[args.indexOf('--tour')+1]:null;
const vertical=format==='vertical',W=vertical?1080:1920,H=vertical?1920:1080,FPS=30;
function wrap(ctx,text,maxWidth){const lines=[];let line='';for(const word of text.split(' ')){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;}
function round(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
function text(ctx,value,x,y,size,color,maxWidth,bold=false){ctx.font=`${size}px "${bold?'Tour Bold':'Tour'}"`;ctx.fillStyle=color;const lines=wrap(ctx,value,maxWidth);lines.forEach((line,i)=>ctx.fillText(line,x,y+i*size*1.3));return lines.length*size*1.3;}
const ease=x=>x*x*(3-2*x);
async function render(tour){
 const dir=path.join(out,format);fs.mkdirSync(dir,{recursive:true});const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
 const selected=vertical?tour.short.map(i=>tour.scenes[i]):tour.scenes;const scenes=selected.map(s=>({name:s[0],caption:s[1],seconds:vertical?3.5:s[2]}));
 const images=new Map();for(const s of scenes){assertCapture(s.name);images.set(s.name,await loadImage(path.join(captures,s.name+'.png')));}
 const logo=await loadImage(path.resolve('public/landing/examio-mark.svg'));
 const video=path.join(dir,tour.id+'.mp4'),log=fs.openSync(path.join(dir,tour.id+'.encoder.log'),'w');
 const encoder=spawn(ffmpeg,['-y','-f','rawvideo','-pixel_format','rgba','-video_size',W+'x'+H,'-framerate',String(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','23','-threads','4','-pix_fmt','yuv420p','-movflags','+faststart',video],{stdio:['pipe','ignore',log],windowsHide:true});
 let encodeError;encoder.stdin.on('error',e=>encodeError=e);const finished=once(encoder,'close');
 const total=scenes.reduce((a,s)=>a+s.seconds,0)+5;let elapsed=0;const transcript=[];
 function base(){const gradient=ctx.createLinearGradient(0,0,W,H);gradient.addColorStop(0,'#082d5b');gradient.addColorStop(1,'#061b32');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);ctx.globalAlpha=.12;ctx.fillStyle='#00bdd4';ctx.beginPath();ctx.arc(W*.95,H*.1,W*.35,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.drawImage(logo,vertical?72:88,vertical?100:48,vertical?64:50,vertical?64:50);text(ctx,'Examio',vertical?153:153,vertical?148:88,vertical?46:38,'#ffffff',500,true);text(ctx,'WATCH • LEARN • TRY',vertical?72:1400,vertical?200:82,vertical?21:18,'#8fc9ef',450);}
 async function frame(){if(encodeError)throw encodeError;const bytes=canvas.data();if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain');}
 for(let i=0;i<scenes.length;i++){
  const s=scenes[i],img=images.get(s.name);transcript.push({start:elapsed,end:elapsed+s.seconds,text:s.caption});
  for(let f=0;f<s.seconds*FPS;f++){
   base();const t=f/(s.seconds*FPS-1);const fade=Math.min(1,f/9);ctx.globalAlpha=fade;
   text(ctx,tour.title,vertical?72:88,vertical?288:166,vertical?52:46,'#ffffff',vertical?930:1500,true);
   const x=vertical?64:88,y=vertical?405:210,bw=vertical?952:1744,bh=vertical?930:650;
   ctx.save();ctx.beginPath();ctx.roundRect(x+10,y+10,bw-20,bh-20,14);ctx.clip();
   let sx=0,sy=0,sw=img.width,sh=img.height;
   // Focus long forms on one readable section; no simulated application UI.
   if(['launch-library','launch-quick'].includes(s.name)){sw=Math.min(sw,720);}
   if(s.name==='create-save'){sx=310;sw=Math.min(img.width-sx,560);}
   if(s.name==='monitor-log'){sx=img.width*.60;sw=img.width-sx;}
   if(s.name.startsWith('results-')&&s.name!=='results-export'){sy=75;sh=img.height-sy;}
   if(s.name==='launch-settings'){sh=Math.min(sh,700);}
   if(s.name==='monitor-options'){sh=Math.min(sh,vertical?650:420);}
   // Portrait results focus on readable metric/answer cells rather than a full desktop table.
   if(vertical&&s.name==='results-summary'){sx=600;sy=240;sw=580;sh=540;}
   if(vertical&&['results-live','results-detailed'].includes(s.name)){sx=1150;sy=410;sw=Math.min(img.width-sx,585);sh=520;}
   const scale=Math.min((bw-44)/sw,(bh-44)/sh)*(1+ease(t)*.025),dw=sw*scale,dh=sh*scale,dx=x+(bw-dw)/2,dy=y+(bh-dh)/2;
   round(ctx,dx-12,dy-12,dw+24,dh+24,18,'#ffffff');ctx.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);
   const click=manifest[s.name]?.click||({'launch-library':{x:.078,y:.71},'launch-quick':{x:.194,y:.71},'game-library':{x:.38,y:.78},'student-submit':{x:.25,y:.76},'game-avatar':{x:.7,y:.87}})[s.name];
   if(click&&t>.12){const arrival=ease(Math.min(1,(t-.12)/.30)),cx=dx+(click.x*img.width-sx)*scale+(1-arrival)*90,cy=dy+(click.y*img.height-sy)*scale+(1-arrival)*65;ctx.save();ctx.translate(cx,cy);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,27);ctx.lineTo(7,20);ctx.lineTo(15,33);ctx.lineTo(21,29);ctx.lineTo(13,16);ctx.lineTo(24,15);ctx.closePath();ctx.fillStyle='#082d5b';ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.fill();ctx.stroke();ctx.restore();}
   if(click&&click.x>=0&&click.x<=1&&click.y>=0&&click.y<=1&&t>.32&&t<.84){const cx=dx+(click.x*img.width-sx)*scale,cy=dy+(click.y*img.height-sy)*scale;ctx.strokeStyle='#087bea';ctx.lineWidth=5;ctx.globalAlpha=fade*(1-Math.abs(t-.58)/.26);ctx.beginPath();ctx.arc(cx,cy,18+30*(t-.32),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=fade;}
   ctx.restore();
   round(ctx,vertical?72:88,vertical?1420:903,5,vertical?140:76,3,'#26c6da');
   text(ctx,s.caption,vertical?102:112,vertical?1464:942,vertical?43:37,'#ffffff',vertical?860:1680,true);
   ctx.globalAlpha=1;text(ctx,`${String(i+1).padStart(2,'0')} / ${String(scenes.length).padStart(2,'0')}`,vertical?72:88,vertical?1740:1030,22,'#8fc9ef',260);
   text(ctx,'Sample classroom • Fictional students',vertical?72:1350,vertical?1780:1030,vertical?20:18,'#8ca9c3',500);
   ctx.fillStyle='#21c3cf';ctx.fillRect(0,H-7,W*(elapsed+f/FPS)/total,7);
   if(f===Math.floor(s.seconds*FPS*.55))fs.writeFileSync(path.join(dir,`${tour.id}-${i+1}.jpg`),canvas.toBuffer('image/jpeg',85));
   await frame();
  }
  elapsed+=s.seconds;
 }
 for(let f=0;f<5*FPS;f++){base();text(ctx,'Your next class.',vertical?72:170,vertical?750:470,vertical?78:92,'#fff',W-144,true);text(ctx,'Ready in Examio.',vertical?72:170,vertical?865:590,vertical?78:92,'#68deea',W-144,true);text(ctx,'examio.io',vertical?72:175,vertical?1080:730,vertical?42:40,'#fff',800);await frame();}
 encoder.stdin.end();const [code]=await finished;fs.closeSync(log);if(code!==0)throw Error('Encoder failed: '+video);
 fs.writeFileSync(path.join(dir,tour.id+'.json'),JSON.stringify({title:tour.title,duration:total,width:W,height:H,transcript},null,2));
 console.log(format,tour.id,total+'s',Math.round(fs.statSync(video).size/1024/1024*10)/10+'MB');
}
function assertCapture(name){if(!manifest[name])throw Error('Missing capture: '+name);}
(async()=>{for(const tour of tours.filter(t=>!chosen||t.id===chosen))await render(tour);})().catch(e=>{console.error(e);process.exitCode=1;});
