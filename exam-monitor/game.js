const {randomUUID,randomBytes,randomInt,createHash,timingSafeEqual}=require('node:crypto');
const {validateTest}=require('./exam');
const {generateRoomName}=require('./rooms');
const avatarNames=new Map(require('./public/game-avatars/manifest.json').map(({id,name})=>[id,name]));
const TTL=24*60*60*1000,READING_MS=5000,SCORE_LEAD_MS=1200,SCORE_DURATION_MS=1020;
const PODIUM_LEAD_MS=1900,PODIUM_SPACING_MS=3600,PODIUM_WINNER_HOLD_MS=4000;
const INTRO_MS=2200,RESPONSE_PAUSE_MS=3800;
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
 if(input?.largeClass!==undefined&&typeof input.largeClass!=='boolean')fail('Large class must be on or off.');
 if(!input||!Array.isArray(input.questions)||input.questions.some(q=>!q||q.type&&q.type!=='mc'))fail('Games support multiple-choice questions only.');
 if(input.questions.some(q=>['__proto__','prototype','constructor'].includes(q.id)))fail('Reserved question identifier.');
 const candidate={title:input.title,questions:input.questions.map(q=>({...q,id:q.id||randomUUID(),type:'mc',points:1}))};
 const clean=validateTest(candidate);if(!clean)fail('Check the title, questions, choices, images and correct answers.');
 clean.questions=clean.questions.map((q,i)=>{const durationSeconds=input.questions[i].durationSeconds??20;if(!Number.isInteger(durationSeconds)||durationSeconds<5||durationSeconds>240)fail('Each question timer must be 5–240 seconds.');const {points,evidence,answerKeyConflict,...rest}=q;const media=validateMedia(input.questions[i].media);return {...rest,durationSeconds,...(media?{media}:{})};});
 const imageBytes=clean.questions.reduce((sum,q)=>sum+(q.image?.length||0)+q.options.reduce((n,o)=>n+(o.image?.length||0),0)+(q.media?.url.startsWith('data:')?q.media.url.length:0),0);if(imageBytes>600000)fail('Total game media images are too large.');
 return {...clean,largeClass:input.largeClass===true};
}
function fromTest(test,{compatibleOnly=false}={}){
 if(!test||!Array.isArray(test.questions))fail('Test not found.');
 const incompatible=test.questions.filter(q=>q.type&&q.type!=='mc');if(incompatible.length&&!compatibleOnly)fail('This test contains non-multiple-choice questions. Confirm copying compatible questions only.');
 return validateGame({title:test.title,questions:test.questions.filter(q=>!q.type||q.type==='mc').map(q=>{const ids=new Map(q.options.map(o=>[o.id,randomUUID()]));return {...q,id:randomUUID(),type:'mc',options:q.options.map(o=>({...o,id:ids.get(o.id)})),correctOptionId:ids.get(q.correctOptionId),durationSeconds:20};})});
}
function toTest(game){const source=validateGame(game);return {id:randomUUID(),title:source.title,folderId:null,questions:source.questions.map(q=>{const ids=new Map(q.options.map(o=>[o.id,randomUUID()]));const {durationSeconds,media,...rest}=q;return {...rest,id:randomUUID(),points:1,options:q.options.map(o=>({...o,id:ids.get(o.id)})),correctOptionId:ids.get(q.correctOptionId)};})};}
function newGameRoomName(){return 'Game: '+generateRoomName().name;}
function newSession(ownerId,game,now=Date.now(),{requireNames=true,largeClass=false}={}){
 if(typeof largeClass!=='boolean')fail('Large class must be on or off.');
 if(typeof requireNames!=='boolean')fail('Require names must be on or off.');
 return {requireNames,id:randomUUID(),ownerId,roomName:newGameRoomName(),pin:String(randomInt(100000,1000000)),displayToken:randomBytes(24).toString('base64url'),classroomControlKey:randomBytes(24).toString('base64url'),game:validateGame({...game,largeClass}),phase:'lobby',questionIndex:-1,players:[],participants:[],recoveryRequests:[],createdAt:now,updatedAt:now,expiresAt:now+TTL,startsAt:null,deadlineAt:null,roundEndReason:null,roundEndedAt:null};
}
function active(s,now=Date.now()){if(s.phase==='closed'||s.expiresAt<=now)fail('Game has ended or expired.',410);}
function changed(s,now){s.updatedAt=Math.max(s.updatedAt,now);s.expiresAt=Math.max(s.expiresAt,now+TTL);}
function answerFor(player,questionId){return player&&Object.hasOwn(player.answers,questionId)?player.answers[questionId]:null;}
function authenticatePlayer(s,playerId,resumeToken){if(!tokenValid(resumeToken))fail('Player connection not recognized.',403);const p=s.players.find(p=>p.id===playerId);if(!p||!timingSafeEqual(Buffer.from(p.tokenHash,'hex'),Buffer.from(hash(resumeToken),'hex')))fail('Player connection not recognized.',403);return p;}
const avatarLimit=s=>s.game.largeClass===true?50:30;
const avatarAt=i=>'avatar-'+String(i).padStart(2,'0');
function lobbyView(s,now=Date.now()){
 active(s,now);
 return {largeClass:s.game.largeClass===true,requireNames:s.requireNames!==false,takenAvatarIds:[...new Set(s.players.map(p=>p.avatarId).filter(Boolean))],phase:s.phase};
}
function join(s,{nickname,resumeToken,avatarId},now=Date.now()){
 active(s,now);if(!tokenValid(resumeToken))fail('A secure resume token is required.');
 const known=s.players.find(p=>p.tokenHash===hash(resumeToken));if(known){known.lastSeenAt=now;return {playerId:known.id,resumeToken};}
 const requireNames=s.requireNames!==false;
 if(requireNames){
  if(typeof nickname!=='string'||!nickname.trim()||nickname.trim().length>30||/[\x00-\x1f]/.test(nickname))fail('Use a nickname of 1–30 characters.');
  nickname=nickname.trim();if(s.players.some(p=>p.nickname.toLocaleLowerCase()===nickname.toLocaleLowerCase()))fail('That nickname is taken. Use recovery if this is your player.');
 }
 if(s.phase!=='lobby')fail('This game has started. Existing players can reconnect.');
 const limit=avatarLimit(s),taken=new Set(s.players.map(p=>p.avatarId));
 const choices=Array.from({length:limit},(_,i)=>avatarAt(i+1));
 if(s.players.length>=limit||choices.every(id=>taken.has(id)))fail('This game is full. If you already joined, reconnect or recover your score.',409);
 // Older clients that omit a character receive the first free one. Explicit picks never auto-switch.
 if(requireNames&&avatarId===undefined)avatarId=choices.find(id=>!taken.has(id));
 if(!choices.includes(avatarId)||!avatarNames.has(avatarId))fail('Choose an available avatar character.');
 if(taken.has(avatarId))fail('That character was taken. Please choose another.',409);
 if(!requireNames)nickname=avatarNames.get(avatarId);
 const player={id:randomUUID(),nickname,avatarId,tokenHash:hash(resumeToken),score:0,answers:{},lastSeenAt:now};s.players.push(player);changed(s,now);return {playerId:player.id,resumeToken};
}
function touch(s,playerId,resumeToken,now=Date.now()){active(s,now);const p=authenticatePlayer(s,playerId,resumeToken);p.lastSeenAt=now;return p;}
function countdown(s,now){s.phase='countdown';s.startsAt=now+READING_MS;s.deadlineAt=s.startsAt+s.game.questions[s.questionIndex].durationSeconds*1000;s.participants=s.players.map(p=>p.id);}
function beginQuestion(s,now){
 s.questionIndex++;s.phase='intro';s.introEndsAt=now+INTRO_MS;
 s.scoreStartsAt=null;s.roundEndReason=null;s.roundEndedAt=null;s.revealAt=null;
 s.startsAt=null;s.deadlineAt=null;s.participants=[];
}
function finalRound(s){return s.questionIndex===s.game.questions.length-1;}
function finalPoll(s){return finalRound(s)&&['responses-closed','reveal'].includes(s.phase);}
function beginPodium(s,now){
 s.phase='podium';s.startsAt=null;s.deadlineAt=null;
 const placements=rankRows(s.players,'score').filter(row=>row.rank<=3);
 const ranks=[...new Set(placements.map(row=>row.rank))].sort((a,b)=>b-a);
 let at=now+(ranks[0]===1?3500:PODIUM_LEAD_MS);
 s.podiumSchedule=ranks.map((rank,i)=>{if(i)at+=rank===1?4500:PODIUM_SPACING_MS;return {rank,at};});
 s.podiumCompleteAt=(s.podiumSchedule.at(-1)?.at??now)+PODIUM_WINNER_HOLD_MS;
}
function advance(s,now=Date.now()){
 active(s,now);sweep(s,now);
 if(s.phase==='lobby'){if(!s.players.length)fail('Wait for at least one player.');beginQuestion(s,now);}
 else if(s.phase==='media')countdown(s,now);
 else if(s.phase==='reveal'){if(finalRound(s))beginPodium(s,now);else{s.phase='leaderboard';s.scoreStartsAt=now+SCORE_LEAD_MS;}}
 else if(s.phase==='leaderboard'){
  if(Number.isFinite(s.scoreStartsAt)&&now<s.scoreStartsAt+SCORE_DURATION_MS)fail('Wait for the score reveal to finish.');
  if(finalRound(s))beginPodium(s,now);else beginQuestion(s,now);
 }
 else fail('Wait for the current question to finish.');changed(s,now);
}
function sweep(s,now=Date.now()){
 if(s.expiresAt<=now){s.phase='closed';return;}
 if(s.phase==='intro'&&now>=s.introEndsAt){
  if(s.game.questions[s.questionIndex].media)s.phase='media';
  else countdown(s,s.introEndsAt);
 }
 if(s.phase==='countdown'&&now>=s.startsAt)s.phase='question';
 if(s.phase==='question'){
  const q=s.game.questions[s.questionIndex];
  const timedOut=now>=s.deadlineAt;
  const allAnswered=!timedOut&&s.participants.length>0&&s.participants.every(id=>answerFor(s.players.find(p=>p.id===id),q.id));
  if(timedOut||allAnswered){
   s.phase='responses-closed';s.roundEndReason=timedOut?'timeout':'all-answered';s.roundEndedAt=timedOut?s.deadlineAt:now;s.revealAt=s.roundEndedAt+RESPONSE_PAUSE_MS;changed(s,now);
  }
 }
 if(s.phase==='responses-closed'&&now>=s.revealAt)s.phase='reveal';
 s.recoveryRequests=s.recoveryRequests.filter(r=>now-r.createdAt<5*60*1000);
}
function points(elapsedMs,durationMs){return elapsedMs<500?1000:Math.round(1000*(1-elapsedMs/durationMs/2));}
function answer(s,{playerId,resumeToken,questionIndex,slot},now=Date.now()){
 active(s,now);const p=authenticatePlayer(s,playerId,resumeToken);
 const submitted=Number.isInteger(questionIndex)&&questionIndex>=0?s.game.questions[questionIndex]:null;
 if(!submitted)fail('That question is not available.');
 if(!Number.isInteger(slot)||slot<0||slot>=submitted.options.length)fail('Choose an answer shown on this question.');
 if(answerFor(p,submitted.id))return {accepted:true};
 sweep(s,now);
 // Preserve the request-receipt time for an answer queued just before the
 // deadline, even if an independent deadline sweep already moved to reveal.
 const canAnswer=s.phase==='question'||['responses-closed','reveal'].includes(s.phase)&&s.roundEndReason==='timeout';
 if(!canAnswer||now<s.startsAt||now>=s.deadlineAt)fail('This question is not open for answers.');
 if(questionIndex!==s.questionIndex||!s.participants.includes(playerId))fail('That question is not available.');
 const optionId=submitted.options[slot].id;
 const correct=optionId===submitted.correctOptionId;
 const earned=correct?points(now-s.startsAt,submitted.durationSeconds*1000):0;
 p.answers[submitted.id]={optionId,points:earned,correct,answeredAt:now};
 p.score+=earned;p.lastSeenAt=Math.max(p.lastSeenAt,now);changed(s,now);sweep(s,now);
 return {accepted:true};
}
function requestRecovery(s,{nickname,avatarId,resumeToken},now=Date.now()){
 active(s,now);if(!tokenValid(resumeToken))fail('A secure resume token is required.');
 const player=s.requireNames===false?s.players.find(p=>p.avatarId===avatarId):
  s.players.find(p=>typeof nickname==='string'&&p.nickname===nickname.trim());
 if(!player)fail('Player not found.',404);
 s.recoveryRequests=s.recoveryRequests.filter(r=>now-r.createdAt<5*60*1000);
 const old=s.recoveryRequests.find(r=>r.tokenHash===hash(resumeToken));if(old)return {code:old.code};
 if(s.recoveryRequests.length>=20)fail('Too many recovery requests. Ask your teacher.',429);
 const code=randomBytes(5).toString('hex').toUpperCase();s.recoveryRequests.push({code,nickname:player.nickname,tokenHash:hash(resumeToken),createdAt:now});return {code};
}
function approveRecovery(s,code,playerId,now=Date.now()){
 active(s,now);const r=s.recoveryRequests.find(r=>r.code===code&&now-r.createdAt<5*60*1000),p=s.players.find(p=>p.id===playerId);if(!r||!p||r.nickname!==p.nickname)fail('Recovery request not available.',404);
 if(s.players.some(other=>other.id!==p.id&&other.tokenHash===r.tokenHash))fail('This device is already another player.');
 p.tokenHash=r.tokenHash;p.lastSeenAt=now;s.recoveryRequests=s.recoveryRequests.filter(x=>x.code!==code);changed(s,now);return {playerId:p.id};
}
function rankRows(rows,key){
 let lastScore=null,rank=0;
 return [...rows].sort((a,b)=>b[key]-a[key]||a.nickname.localeCompare(b.nickname)).map((p,i)=>{
  if(p[key]!==lastScore)rank=i+1;
  lastScore=p[key];return {...p,rank};
 });
}
function scoringPending(s,now){
 return s.phase==='leaderboard'&&Number.isFinite(s.scoreStartsAt)&&now<s.scoreStartsAt;
}
function podiumRevealAt(s,rank){
 const schedule=s.podiumSchedule||[];
 return schedule.find(place=>place.rank===rank)?.at??s.podiumCompleteAt??schedule.at(-1)?.at??0;
}
function standings(s,now){
 const q=s.game.questions[s.questionIndex],pending=['countdown','question','responses-closed','reveal'].includes(s.phase)||scoringPending(s,now);
 const showPrevious=s.phase==='leaderboard'&&!pending;
 const rows=s.players.map(p=>{
  const earned=q?answerFor(p,q.id)?.points||0:0;
  return {id:p.id,nickname:p.nickname,avatarId:p.avatarId||'avatar-01',score:p.score-(pending?earned:0),connected:now-p.lastSeenAt<15000,...(showPrevious?{previousScore:p.score-earned}:{})};
 });
 const previousRanks=showPrevious?new Map(rankRows(rows,'previousScore').map(p=>[p.id,p.rank])):null;
 return {rows,leaderboard:rankRows(rows,'score').map(p=>previousRanks?{...p,previousRank:previousRanks.get(p.id)}:p)};
}
function roundView(s,now){
 return {id:s.id,phase:s.phase,finalRound:finalRound(s),questionIndex:s.questionIndex,questionCount:s.game.questions.length,startsAt:s.startsAt,deadlineAt:s.deadlineAt,serverNow:now,introEndsAt:s.phase==='intro'?s.introEndsAt:null,revealAt:s.revealAt??null,roundEndReason:s.roundEndReason??null,roundEndedAt:s.roundEndedAt??null,scoreStartsAt:s.phase==='leaderboard'?s.scoreStartsAt??null:null,
  scoreEndsAt:s.phase==='leaderboard'&&Number.isFinite(s.scoreStartsAt)?s.scoreStartsAt+SCORE_DURATION_MS:null};
}
function publicView(s,now=Date.now()){
 const {rows,leaderboard}=standings(s,now);
 const q=s.game.questions[s.questionIndex],revealing=['reveal','leaderboard'].includes(s.phase);
 let question=null;
 if(q&&['countdown','question','reveal','leaderboard'].includes(s.phase)){
  question={id:q.id,text:q.text,...(q.image?{image:q.image}:{})};
  if(s.phase!=='countdown')Object.assign(question,{options:q.options.map(o=>({...o})),durationSeconds:q.durationSeconds});
  if(revealing)Object.assign(question,{
   correctOptionId:q.correctOptionId,answerExplanation:q.answerExplanation||'',
   counts:Object.fromEntries(q.options.map(o=>[o.id,s.players.filter(p=>answerFor(p,q.id)?.optionId===o.id).length]))
  });
 }
 const podium=s.phase==='podium',schedule=s.podiumSchedule||[];
 const showingAll=!podium||now>=podiumRevealAt(s,4);
 const visible=showingAll?leaderboard:leaderboard.filter(p=>p.rank<=3&&now>=podiumRevealAt(s,p.rank));
 return {...roundView(s,now),...(podium?{podiumSchedule:schedule,podiumCompleteAt:podiumRevealAt(s,4)}:{}),pin:s.pin,roomName:s.roomName??null,title:s.game.title,
  players:finalPoll(s)?rows.map(({score,...p})=>p):showingAll?rows:visible,leaderboard:finalPoll(s)?[]:visible,question,media:s.phase==='media'&&q?.media?{...q.media}:null};
}
function playerView(s,playerId,now=Date.now()){
 const p=s.players.find(p=>p.id===playerId);if(!p)fail('Player not found.',404);
 const q=s.game.questions[s.questionIndex],a=q&&answerFor(p,q.id);
 const revealing=['reveal','leaderboard','podium'].includes(s.phase);
 const rank=standings(s,now).leaderboard.find(row=>row.id===playerId);
 const pointsVisible=(s.phase==='leaderboard'&&!scoringPending(s,now))||s.phase==='podium';
 const previous=s.phase==='leaderboard'&&pointsVisible?{previousScore:rank.previousScore,previousRank:rank.previousRank}:{};
 const rankRevealAt=s.phase==='podium'?podiumRevealAt(s,rank.rank):0;
 const scoreVisible=!finalPoll(s)&&now>=rankRevealAt;
 const rankField=scoreVisible?{rank:rank.rank,score:rank.score}:{};
 // Poll a public ceremony boundary, never encode this player's unrevealed place in a timestamp.
 const nextRankCheck=s.phase==='podium'&&!scoreVisible?((s.podiumSchedule||[]).find(place=>place.at>now)?.at??s.podiumCompleteAt):null;
 return {...roundView(s,now),question:q&&s.phase==='question'?{slotCount:q.options.length}:null,
  ...rankField,...(nextRankCheck?{rankRevealAt:nextRankCheck}:{}),playerId:p.id,nickname:p.nickname,avatarId:p.avatarId||'avatar-01',...previous,
  answered:!!a,answer:a?{slot:q.options.findIndex(o=>o.id===a.optionId),...(revealing?{correct:a.correct}:{}),...(pointsVisible&&scoreVisible?{points:a.points}:{})}:null};
}
function hostView(s,now=Date.now()){return {...publicView(s,now),displayToken:s.displayToken,...(s.classroomControlKey?{classroomControlKey:s.classroomControlKey}:{}),recoveryRequests:s.recoveryRequests.filter(r=>now-r.createdAt<5*60*1000).map(({code,nickname,createdAt})=>({code,nickname,createdAt}))};}
module.exports={TTL,validateGame,fromTest,toTest,newGameRoomName,newSession,lobbyView,join,touch,authenticatePlayer,advance,sweep,answer,requestRecovery,approveRecovery,publicView,playerView,hostView,points};
