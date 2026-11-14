const {randomUUID,randomBytes,randomInt,createHash,timingSafeEqual}=require('node:crypto');
const {validateTest}=require('./exam');
const TTL=24*60*60*1000;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const hash=value=>createHash('sha256').update(value).digest('hex');
function tokenValid(token){return typeof token==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(token);}
function validateMedia(media){
 if(media==null)return null;
 if(!media||typeof media!=='object'||!['image','audio','video','youtube'].includes(media.type)||typeof media.url!=='string')fail('Choose a supported media type and URL.');
 const {type}=media,url=media.url.trim();
 if(type==='image'&&url.startsWith('data:')){if(url.length>180000||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url))fail('Invalid media image.');return {type,url};}
 let parsed;try{parsed=new URL(url);}catch{fail('Enter a valid HTTPS media URL.');}
 if(url.length>2048||parsed.protocol!=='https:'||parsed.username||parsed.password)fail('Media requires an HTTPS URL without credentials.');
 if(type==='youtube'){let id;if(['youtube.com','www.youtube.com','m.youtube.com'].includes(parsed.hostname)){id=parsed.pathname==='/watch'?parsed.searchParams.get('v'):parsed.pathname.startsWith('/embed/')?parsed.pathname.slice(7):null;}else if(parsed.hostname==='youtu.be')id=parsed.pathname.slice(1);if(!id||!/^[A-Za-z0-9_-]{11}$/.test(id))fail('Enter a valid YouTube video URL.');return {type,url:'https://www.youtube.com/watch?v='+id};}
 return {type,url:parsed.href};
}
function validateGame(input){
 if(!input||!Array.isArray(input.questions)||input.questions.some(q=>!q||q.type&&q.type!=='mc'))fail('Games support multiple-choice questions only.');
 if(input.questions.some(q=>['__proto__','prototype','constructor'].includes(q.id)))fail('Reserved question identifier.');
 const candidate={title:input.title,questions:input.questions.map(q=>({...q,id:q.id||randomUUID(),type:'mc',points:1}))};
 const clean=validateTest(candidate);if(!clean)fail('Check the title, questions, choices, images and correct answers.');
 clean.questions=clean.questions.map((q,i)=>{const durationSeconds=input.questions[i].durationSeconds??20;if(!Number.isInteger(durationSeconds)||durationSeconds<5||durationSeconds>240)fail('Each question timer must be 5–240 seconds.');const {points,evidence,answerKeyConflict,...rest}=q;const media=validateMedia(input.questions[i].media);return {...rest,durationSeconds,...(media?{media}:{})};});
 const imageBytes=clean.questions.reduce((sum,q)=>sum+(q.image?.length||0)+q.options.reduce((n,o)=>n+(o.image?.length||0),0)+(q.media?.url.startsWith('data:')?q.media.url.length:0),0);if(imageBytes>600000)fail('Total game media images are too large.');
 return clean;
}
function fromTest(test,{compatibleOnly=false}={}){
 if(!test||!Array.isArray(test.questions))fail('Test not found.');
 const incompatible=test.questions.filter(q=>q.type&&q.type!=='mc');if(incompatible.length&&!compatibleOnly)fail('This test contains non-multiple-choice questions. Confirm copying compatible questions only.');
 return validateGame({title:test.title,questions:test.questions.filter(q=>!q.type||q.type==='mc').map(q=>{const ids=new Map(q.options.map(o=>[o.id,randomUUID()]));return {...q,id:randomUUID(),type:'mc',options:q.options.map(o=>({...o,id:ids.get(o.id)})),correctOptionId:ids.get(q.correctOptionId),durationSeconds:20};})});
}
function toTest(game){const source=validateGame(game);return {id:randomUUID(),title:source.title,folderId:null,questions:source.questions.map(q=>{const ids=new Map(q.options.map(o=>[o.id,randomUUID()]));const {durationSeconds,media,...rest}=q;return {...rest,id:randomUUID(),points:1,options:q.options.map(o=>({...o,id:ids.get(o.id)})),correctOptionId:ids.get(q.correctOptionId)};})};}
function newSession(ownerId,game,now=Date.now()){
 return {id:randomUUID(),ownerId,pin:String(randomInt(100000,1000000)),displayToken:randomBytes(24).toString('base64url'),game:validateGame(game),phase:'lobby',questionIndex:-1,players:[],participants:[],recoveryRequests:[],createdAt:now,updatedAt:now,expiresAt:now+TTL,startsAt:null,deadlineAt:null};
}
function active(s,now=Date.now()){if(s.phase==='closed'||s.expiresAt<=now)fail('Game has ended or expired.',410);}
function changed(s,now){s.updatedAt=Math.max(s.updatedAt,now);s.expiresAt=Math.max(s.expiresAt,now+TTL);}
function answerFor(player,questionId){return player&&Object.hasOwn(player.answers,questionId)?player.answers[questionId]:null;}
function authenticatePlayer(s,playerId,resumeToken){if(!tokenValid(resumeToken))fail('Player connection not recognized.',403);const p=s.players.find(p=>p.id===playerId);if(!p||!timingSafeEqual(Buffer.from(p.tokenHash,'hex'),Buffer.from(hash(resumeToken),'hex')))fail('Player connection not recognized.',403);return p;}
function join(s,{nickname,resumeToken,avatarId='avatar-01'},now=Date.now()){
 active(s,now);if(!tokenValid(resumeToken))fail('A secure resume token is required.');
 const known=s.players.find(p=>p.tokenHash===hash(resumeToken));if(known){known.lastSeenAt=now;return {playerId:known.id,resumeToken};}
 if(typeof avatarId!=='string'||!/^avatar-(?:0[1-9]|[12][0-9]|3[0-6])$/.test(avatarId))fail('Choose an available avatar character.');
 if(typeof nickname!=='string'||!nickname.trim()||nickname.trim().length>30||/[\x00-\x1f]/.test(nickname))fail('Use a nickname of 1–30 characters.');
 nickname=nickname.trim();if(s.players.some(p=>p.nickname.toLocaleLowerCase()===nickname.toLocaleLowerCase()))fail('That nickname is taken. Use recovery if this is your player.');
 if(s.phase!=='lobby')fail('This game has started. Existing players can reconnect.');if(s.players.length>=200)fail('This game is full.');
 const player={id:randomUUID(),nickname,avatarId,tokenHash:hash(resumeToken),score:0,answers:{},lastSeenAt:now};s.players.push(player);changed(s,now);return {playerId:player.id,resumeToken};
}
function touch(s,playerId,resumeToken,now=Date.now()){active(s,now);const p=authenticatePlayer(s,playerId,resumeToken);p.lastSeenAt=now;return p;}
function countdown(s,now){s.phase='countdown';s.startsAt=now+3000;s.deadlineAt=s.startsAt+s.game.questions[s.questionIndex].durationSeconds*1000;s.participants=s.players.map(p=>p.id);}
function beginQuestion(s,now){s.questionIndex++;if(s.game.questions[s.questionIndex].media){s.phase='media';s.startsAt=null;s.deadlineAt=null;s.participants=[];}else countdown(s,now);}
function advance(s,now=Date.now()){
 active(s,now);sweep(s,now);
 if(s.phase==='lobby'){if(!s.players.length)fail('Wait for at least one player.');beginQuestion(s,now);}
 else if(s.phase==='media')countdown(s,now);
 else if(s.phase==='reveal')s.phase='leaderboard';
 else if(s.phase==='leaderboard'){if(s.questionIndex+1>=s.game.questions.length){s.phase='podium';s.startsAt=null;s.deadlineAt=null;}else beginQuestion(s,now);}
 else fail('Wait for the current question to finish.');changed(s,now);
}
function sweep(s,now=Date.now()){
 if(s.expiresAt<=now){s.phase='closed';return;}
 if(s.phase==='countdown'&&now>=s.startsAt)s.phase='question';
 if(s.phase==='question'){const q=s.game.questions[s.questionIndex];if(now>=s.deadlineAt||(s.participants.length>0&&s.participants.every(id=>answerFor(s.players.find(p=>p.id===id),q.id)))){s.phase='reveal';changed(s,now);}}
 s.recoveryRequests=s.recoveryRequests.filter(r=>now-r.createdAt<5*60*1000);
}
function points(elapsedMs,durationMs){return elapsedMs<500?1000:Math.round(1000*(1-elapsedMs/durationMs/2));}
function answer(s,{playerId,resumeToken,questionId,optionId},now=Date.now()){
 active(s,now);const p=authenticatePlayer(s,playerId,resumeToken);const previous=answerFor(p,questionId);if(previous)return {accepted:true,points:previous.points};
 sweep(s,now);const q=s.game.questions[s.questionIndex];if(!['question','reveal'].includes(s.phase)||now<s.startsAt||now>=s.deadlineAt)fail('This question is not open for answers.');if(!q||questionId!==q.id||!s.participants.includes(playerId))fail('That question is not available.');if(!q.options.some(o=>o.id===optionId))fail('Choose an answer shown on this question.');
 const correct=optionId===q.correctOptionId,earned=correct?points(now-s.startsAt,q.durationSeconds*1000):0;p.answers[q.id]={optionId,points:earned,correct,answeredAt:now};p.score+=earned;p.lastSeenAt=Math.max(p.lastSeenAt,now);changed(s,now);sweep(s,now);return {accepted:true,points:earned};
}
function requestRecovery(s,{nickname,resumeToken},now=Date.now()){
 active(s,now);if(!tokenValid(resumeToken))fail('A secure resume token is required.');if(typeof nickname!=='string'||!s.players.some(p=>p.nickname===nickname.trim()))fail('Player not found.',404);
 s.recoveryRequests=s.recoveryRequests.filter(r=>now-r.createdAt<5*60*1000);
 const old=s.recoveryRequests.find(r=>r.tokenHash===hash(resumeToken));if(old)return {code:old.code};
 if(s.recoveryRequests.length>=20)fail('Too many recovery requests. Ask your teacher.',429);
 const code=randomBytes(5).toString('hex').toUpperCase();s.recoveryRequests.push({code,nickname:nickname.trim(),tokenHash:hash(resumeToken),createdAt:now});return {code};
}
function approveRecovery(s,code,playerId,now=Date.now()){
 active(s,now);const r=s.recoveryRequests.find(r=>r.code===code&&now-r.createdAt<5*60*1000),p=s.players.find(p=>p.id===playerId);if(!r||!p||r.nickname!==p.nickname)fail('Recovery request not available.',404);
 if(s.players.some(other=>other.id!==p.id&&other.tokenHash===r.tokenHash))fail('This device is already another player.');
 p.tokenHash=r.tokenHash;p.lastSeenAt=now;s.recoveryRequests=s.recoveryRequests.filter(x=>x.code!==code);changed(s,now);return {playerId:p.id};
}
function publicView(s,now=Date.now()){
 const pending=['countdown','question'].includes(s.phase),current=s.game.questions[s.questionIndex];
 const rows=s.players.map(p=>({id:p.id,nickname:p.nickname,avatarId:p.avatarId||'avatar-01',score:p.score-(pending&&current?answerFor(p,current.id)?.points||0:0),connected:now-p.lastSeenAt<15000}));let lastScore=null,rank=0;const leaderboard=[...rows].sort((a,b)=>b.score-a.score||a.nickname.localeCompare(b.nickname)).map((p,i)=>{if(p.score!==lastScore)rank=i+1;lastScore=p.score;return {...p,rank};});
 const reveal=['reveal','leaderboard'].includes(s.phase),q=s.game.questions[s.questionIndex];let question=null;
 if(q&&['countdown','question','reveal','leaderboard'].includes(s.phase)){question={id:q.id,text:q.text,options:q.options.map(o=>({...o})),durationSeconds:q.durationSeconds,...(q.image?{image:q.image}:{})};if(reveal){question.correctOptionId=q.correctOptionId;question.answerExplanation=q.answerExplanation||'';question.counts=Object.fromEntries(q.options.map(o=>[o.id,s.players.filter(p=>answerFor(p,q.id)?.optionId===o.id).length]));}}
 return {id:s.id,pin:s.pin,title:s.game.title,phase:s.phase,questionIndex:s.questionIndex,questionCount:s.game.questions.length,startsAt:s.startsAt,deadlineAt:s.deadlineAt,serverNow:now,players:rows,leaderboard,question,media:s.phase==='media'&&q?.media?{...q.media}:null};
}
function playerView(s,playerId,now=Date.now()){const v=publicView(s,now),p=s.players.find(p=>p.id===playerId);if(!p)fail('Player not found.',404);const q=s.game.questions[s.questionIndex],a=q&&answerFor(p,q.id),reveal=['reveal','leaderboard','podium'].includes(s.phase);const {players,leaderboard,media,pin,title,...own}=v;const {counts,...question}=own.question||{};return {...own,question:own.question?question:null,rank:leaderboard.find(row=>row.id===p.id).rank,playerId:p.id,nickname:p.nickname,avatarId:p.avatarId||'avatar-01',score:v.players.find(row=>row.id===p.id).score,answered:!!a,answer:a?{optionId:a.optionId,...(reveal?{points:a.points,correct:a.correct}:{})}:null};}
function hostView(s,now=Date.now()){return {...publicView(s,now),displayToken:s.displayToken,recoveryRequests:s.recoveryRequests.filter(r=>now-r.createdAt<5*60*1000).map(({code,nickname,createdAt})=>({code,nickname,createdAt}))};}
module.exports={TTL,validateGame,fromTest,toTest,newSession,join,touch,authenticatePlayer,advance,sweep,answer,requestRecovery,approveRecovery,publicView,playerView,hostView,points};
