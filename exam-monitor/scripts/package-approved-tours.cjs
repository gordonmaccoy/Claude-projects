// Package the approved landscape masters without re-encoding their motion or audio.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);
const ff=path.resolve('.tmp/motion-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const catalog=JSON.parse(fs.readFileSync('public/tour/videos.js','utf8').replace(/^window.examioVideoTours=/,'').replace(/;\s*$/,''));
const sources={launch:['launch-tour-v3/Examio-Launch-Tour-Landscape-v3.mp4','launch-tour-v2'],create:['create-tour-v2/Examio-Create-Quiz-Tour-Landscape-v2.mp4','create-tour-v2'],monitoring:['monitoring-tour-v2/Examio-Monitoring-Tour-Landscape-v2.mp4','monitoring-tour-v2'],results:['results-tour-v3/Examio-Results-Tour-Landscape-v3.mp4','results-tour-v2'],games:['game-tour-v2/Examio-Game-Zone-Tour-Landscape-v2.mp4','game-tour-v2']};
function poster(source,target,at=2){execFileSync(ff,['-y','-ss',String(at),'-i',source,'-frames:v','1','-update','1',target],{stdio:'ignore'});}
for(const tour of catalog){const [master,scenes]=sources[tour.id];fs.copyFileSync('output/'+master,'public/tour/videos/'+tour.id+'.mp4');poster('output/'+master,'public/tour/videos/'+tour.id+'.jpg');tour.src='/tour/videos/'+tour.id+'.mp4?v=20261119';tour.poster='/tour/videos/'+tour.id+'.jpg?v=20261119';tour.steps=[...new Set(read('output/'+scenes+'/raw/scenes.json').map(s=>s.caption))];}
fs.writeFileSync('public/tour/videos.js','window.examioVideoTours='+JSON.stringify(catalog,null,2)+';\n');
fs.mkdirSync('output/reference',{recursive:true});if(!fs.existsSync('output/reference/original-walkthrough.mp4'))fs.copyFileSync('public/landing/examio-walkthrough.mp4','output/reference/original-walkthrough.mp4');
fs.copyFileSync('output/landing-tour-v4/Examio-How-It-Works-Landscape-v4.mp4','public/landing/examio-walkthrough.mp4');
poster('public/landing/examio-walkthrough.mp4','public/landing/examio-walkthrough-poster.png',3.5);
fs.mkdirSync('public/landing/games',{recursive:true});
for(const [name,scene,frame] of [['teams','09-team',28],['podium','10-winner',80],['editor','11-editor',24],['themes','12-themes',26],['report','13-report',33],['lobby','05-start',0]]){fs.copyFileSync(`output/game-tour-v2/raw/${scene}/${String(frame).padStart(5,'0')}.jpg`,`public/landing/games/${name}.jpg`);}
const scenes=read('output/landing-tour-v4/prepared-scenes.json');
const ko=['한 수업. 서로 연결된 세 화면.','간편 실행으로 직접 만든 시험을 시작하세요.','QR 코드나 방 이름으로 참여하세요. 앱 설치가 필요 없습니다.','학생이 정보를 입력하고 참여합니다.','모두 준비됐나요? 시험을 시작하세요.','학생은 답하고, 교수자는 진행 상황을 실시간으로 확인합니다.','실시간 활동을 공개하거나 비공개로 유지하세요.','선택 사항: 시험 화면을 5초 넘게 숨기면 응시가 잠깁니다.','답안을 제출하고 최종 점수와 정답을 확인하세요.','세션을 종료해도 결과는 저장됩니다.','모든 답안을 검토하고 원하는 방식으로 결과를 내보내세요.','서로 연결된 교실.'];
const grouped=[];for(const s of scenes){if(grouped.at(-1)?.caption===s.caption)grouped.at(-1).end=s.end;else grouped.push({...s});}
const stamp=n=>new Date(n*1000).toISOString().slice(11,23);
for(const lang of ['en','ko'])fs.writeFileSync(`public/landing/examio-walkthrough.${lang}.vtt`,'WEBVTT\n\n'+grouped.map((s,i)=>`${stamp(s.start)} --> ${stamp(s.end)}\n${lang==='ko'?ko[i]:s.caption}\n`).join('\n'));
console.log('Packaged six approved landscape videos, posters, game screenshots and synchronized captions.');
