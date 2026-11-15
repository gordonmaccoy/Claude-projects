const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createStore}=require('../store');
const {createApp}=require('../server');
async function setup(t){const db=new PGlite();let q=Promise.resolve();const pool={async connect(){const prev=q;let release;q=new Promise(r=>release=r);await prev;return {query:(...a)=>db.query(...a),release};},async query(...a){const c=await this.connect();try{return await c.query(...a);}finally{c.release();}}};const store=createStore(pool);await store.init();const runtime=createApp({store,verifyUser:async token=>['owner','other'].includes(token)?{id:token,email:token+'@example.com'}:null,sweepInterval:0});await new Promise(r=>runtime.server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+runtime.server.address().port;t.after(async()=>{await runtime.close();await db.close();});const call=async(url,body,token='owner',method=body?'POST':'GET')=>{const r=await fetch(root+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={raw:text};}return {status:r.status,body:data,cacheControl:r.headers.get("cache-control")};};return {store,call,db};}
const quiz={title:'Live review',questions:[{id:'q1',type:'mc',text:'Which?',durationSeconds:20,options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]};
test('game APIs isolate owners and never expose keys to player before reveal',async t=>{const {call}=await setup(t);const created=await call('/api/games',quiz);assert.equal(created.status,200);const game=created.body;assert.equal((await call('/api/games/'+game.id,null,'other')).status,404);assert.equal((await call('/api/games',null,null)).status,401);const started=await call('/api/game-sessions',{gameId:game.id});assert.equal(started.status,200);const s=started.body;assert.ok(s.displayToken);assert.ok(s.joinUrl);assert.equal((await call('/api/game-sessions/'+s.id,null,'other')).status,404);const token='x'.repeat(40);const joined=await call('/game-api/'+s.id+'/join',{nickname:'Ada',resumeToken:token},null);assert.equal(joined.status,200);assert.ok(joined.body.playerId);assert.equal(JSON.stringify(joined.body).includes('correctOptionId'),false);assert.equal((await call('/game-api/'+s.id+'/state',{playerId:joined.body.playerId,resumeToken:'y'.repeat(40)},null)).status,403);const again=await call('/game-api/'+s.id+'/join',{nickname:'Ada',resumeToken:token},null);assert.equal(again.body.playerId,joined.body.playerId);await call('/api/game-sessions/'+s.id+'/close',{});assert.equal((await call('/game-api/'+s.id+'/state',{playerId:joined.body.playerId,resumeToken:token},null)).status,404);});
test('copy routes require explicit consent to omit unsupported test questions',async t=>{const {call,store}=await setup(t);await store.saveTest('owner',{id:'test1',title:'Mixed',questions:[quiz.questions[0],{id:'q2',type:'blank',text:'Fill',acceptedAnswers:['x'],points:1}]});assert.equal((await call('/api/games/from-test',{testId:'test1'})).status,400);const copy=await call('/api/games/from-test',{testId:'test1',compatibleOnly:true});assert.equal(copy.status,200);assert.equal(copy.body.questions.length,1);const back=await call('/api/games/'+copy.body.id+'/to-test',{});assert.equal(back.status,200);assert.notEqual(back.body.id,'test1');assert.equal(back.body.questions[0].points,1);assert.equal((await store.listSessions('owner')).length,0);});
test('complete game round, duplicate answers, device recovery and restart preserve scores',async t=>{
 const {call,store}=await setup(t);const saved=(await call('/api/games',quiz)).body,s=(await call('/api/game-sessions',{gameId:saved.id})).body;
 const first='a'.repeat(40),second='b'.repeat(40),newToken='c'.repeat(40);
 const p=(await call('/game-api/'+s.id+'/join',{nickname:'Ada',resumeToken:first},null)).body;
 const p2=(await call('/game-api/'+s.id+'/join',{nickname:'Ben',resumeToken:second},null)).body;
 const advanced=await call('/api/game-sessions/'+s.id+'/advance',{expectedPhase:'lobby',questionIndex:-1});assert.equal(advanced.body.phase,'intro');
 await store.mutateGame(s.id,d=>{d.introEndsAt=Date.now()-7000;});
 const ans=await call('/game-api/'+s.id+'/answer',{playerId:p.playerId,resumeToken:first,questionIndex:0,slot:0},null);assert.equal(ans.status,200);assert.equal(ans.body.points,undefined);assert.equal(ans.body.view.question.correctOptionId,undefined);assert.equal(ans.body.view.answer.points,undefined);
 const repeat=await call('/game-api/'+s.id+'/answer',{playerId:p.playerId,resumeToken:first,questionIndex:0,slot:1},null);assert.equal(repeat.status,200);
 const end=await call('/game-api/'+s.id+'/answer',{playerId:p2.playerId,resumeToken:second,questionIndex:0,slot:1},null);assert.equal(end.body.view.phase,'responses-closed');assert.equal(end.body.view.question,null);assert.deepEqual(end.body.view.answer,{slot:1});assert.equal(end.body.view.roundEndReason,'all-answered');
 const score=(await store.getGameSession(s.id)).players.find(x=>x.id===p.playerId).score;assert.ok(score>800&&score<1000);
 const code=(await call('/game-api/'+s.id+'/recovery',{nickname:'Ada',resumeToken:newToken},null)).body.code;
 assert.equal((await call('/api/game-sessions/'+s.id+'/recover',{code,playerId:p.playerId},'other')).status,404);
 assert.equal((await call('/api/game-sessions/'+s.id+'/recover',{code,playerId:p.playerId})).status,200);
 assert.equal((await call('/game-api/'+s.id+'/state',{playerId:p.playerId,resumeToken:first},null)).status,403);
 const restored=await call('/game-api/'+s.id+'/join',{nickname:'Ada',resumeToken:newToken},null);assert.equal(restored.body.view.score,undefined);assert.equal(restored.body.view.answer.points,undefined);assert.equal(restored.body.playerId,p.playerId);
 await store.mutateGame(s.id,d=>{d.revealAt=Date.now()-1;});
 const podium=await call('/api/game-sessions/'+s.id+'/advance',{expectedPhase:'reveal',questionIndex:0});assert.equal(podium.body.phase,'podium');assert.deepEqual(podium.body.leaderboard,[]);
 const pending=await call('/game-api/'+s.id+'/state',{playerId:p.playerId,resumeToken:newToken},null);assert.equal(pending.body.score,undefined);assert.equal(pending.body.rank,undefined);
 const duplicate=await call('/api/game-sessions/'+s.id+'/advance',{expectedPhase:'reveal',questionIndex:0});assert.equal(duplicate.body.phase,'podium');assert.deepEqual(duplicate.body.podiumSchedule,podium.body.podiumSchedule);
 await store.mutateGame(s.id,d=>{d.podiumSchedule=d.podiumSchedule.map(x=>({...x,at:Date.now()-1}));d.podiumCompleteAt=Date.now()-1;});
 const released=await call('/game-api/'+s.id+'/state',{playerId:p.playerId,resumeToken:newToken},null);assert.equal(released.body.score,score);assert.equal(released.body.rank,1);assert.equal((await store.listSessions('owner')).length,0);
});
test('passive player polling does not rewrite durable game snapshots or extend expiry',async t=>{const {call,store}=await setup(t);const g=(await call('/api/games',quiz)).body,s=(await call('/api/game-sessions',{gameId:g.id})).body;const token='z'.repeat(40);const p=(await call('/game-api/'+s.id+'/join',{nickname:'Zed',resumeToken:token},null)).body;const before=await store.getGameSession(s.id);let writes=0;const original=store.mutateGame;store.mutateGame=(...args)=>{writes++;return original(...args);};for(let i=0;i<5;i++){const state=await call('/game-api/'+s.id+'/state',{playerId:p.playerId,resumeToken:token},null);assert.equal(state.status,200);assert.equal(state.body.players,undefined);assert.equal(state.body.nickname,"Zed");}assert.equal(writes,0);assert.equal((await store.getGameSession(s.id)).expiresAt,before.expiresAt);});
test('twenty-player class accepts concurrent answers once without changing academic results',async t=>{const {call,store}=await setup(t);const g=(await call('/api/games',quiz)).body,s=(await call('/api/game-sessions',{gameId:g.id})).body;const players=await Promise.all(Array.from({length:20},async(_,i)=>{const resumeToken=String(i).padStart(40,'t');const response=await call('/game-api/'+s.id+'/join',{nickname:'Player '+i,resumeToken,avatarId:'avatar-'+String(i+1).padStart(2,'0')},null);assert.equal(response.status,200);return {playerId:response.body.playerId,resumeToken};}));await call('/api/game-sessions/'+s.id+'/advance',{expectedPhase:'lobby',questionIndex:-1});await store.mutateGame(s.id,d=>{d.introEndsAt=Date.now()-6000;});await Promise.all(players.map(async(p,i)=>{const answer={...p,questionIndex:0,slot:i%2};const replies=await Promise.all([call('/game-api/'+s.id+'/answer',answer,null),call('/game-api/'+s.id+'/answer',answer,null)]);assert.ok(replies.every(r=>r.status===200));}));const state=await store.getGameSession(s.id);assert.equal(state.phase,'responses-closed');assert.equal(state.players.filter(p=>p.score>0).length,10);assert.ok(state.players.every(p=>Object.keys(p.answers).length===1&&p.score<=1000));assert.equal((await store.listSessions('owner')).length,0);});
test('first authenticated library read seeds once, compatibility endpoint cannot restore deleted sample',async t=>{const {call}=await setup(t);assert.equal((await call('/api/games?language=ko',null,null)).status,401);const results=await Promise.all([call('/api/games?language=ko'),call('/api/games?language=ko')]);assert.equal(results[0].body.length,1);assert.equal(results[0].body[0].id,results[1].body[0].id);assert.equal(results[0].body[0].title,'샘플 게임: 쉬운 퀴즈');const id=results[0].body[0].id;await call('/api/games/'+id,null,'owner','DELETE');assert.deepEqual((await call('/api/games')).body,[]);assert.equal((await call('/api/games/sample',{language:'en'})).body,null);assert.equal((await call('/api/games',null,'other')).body[0].title,'Sample Game: Easy Quiz');});
test('classroom controls require current owner auth and return public state without control secrets',async t=>{const {call,store}=await setup(t);const saved=(await call('/api/games',quiz)).body,s=(await call('/api/game-sessions',{gameId:saved.id})).body;const url='/api/game-sessions/'+s.id+'/classroom-control';
 for(const token of [null,'other',s.displayToken]){assert.equal((await call(url,null,token)).status,token==='other'?404:401);assert.equal((await call(url,{displayToken:s.displayToken,expectedPhase:'lobby',questionIndex:-1},token)).status,token==='other'?404:401);}
 const before=await store.getGameSession(s.id);assert.deepEqual((await call(url)).body,{canAdvance:true});assert.deepEqual(await store.getGameSession(s.id),before);
 await call('/game-api/'+s.id+'/join',{nickname:'Test player',resumeToken:'r'.repeat(40)},null);
 const advance=await Promise.all([call(url,{expectedPhase:'lobby',questionIndex:-1}),call(url,{expectedPhase:'lobby',questionIndex:-1})]);for(const result of advance){assert.equal(result.status,200);assert.equal(result.body.phase,'intro');for(const key of ['displayToken','classroomControlKey','classroomControlUrl','recoveryRequests','joinUrl','displayUrl'])assert.equal(Object.hasOwn(result.body,key),false);assert.equal(result.body.question,null);}
 assert.equal((await store.getGameSession(s.id)).questionIndex,0);assert.equal((await call('/api/game-sessions/'+s.id+'/advance',{expectedPhase:'lobby',questionIndex:-1})).body.phase,'intro');
});

test('host receives separate classroom control URL while spectator URL stays read-only',async t=>{const {call,store}=await setup(t);const saved=(await call('/api/games',quiz)).body,s=(await call('/api/game-sessions',{gameId:saved.id})).body;assert.equal(s.displayUrl.split('#')[1].split('/').length,2);assert.equal(s.classroomControlUrl.split('#')[1].split('/').length,3);assert.ok(s.classroomControlUrl.endsWith('/'+s.classroomControlKey));const publicResult=await call('/game-api/'+s.id+'/display',{displayToken:s.displayToken},null);assert.equal(publicResult.body.classroomControlKey,undefined);assert.equal(publicResult.body.classroomControlUrl,undefined);await store.mutateGame(s.id,d=>{delete d.classroomControlKey;});const old=(await call('/api/game-sessions/'+s.id)).body;assert.equal(old.classroomControlUrl,undefined);assert.equal(old.classroomControlKey,undefined);assert.equal(old.displayUrl,s.displayUrl);});
test('game folder API assigns owned folders and never mixes Test Library folders',async t=>{const {call,store}=await setup(t);assert.equal((await call('/api/game-folders',null,null)).status,401);assert.equal((await call('/api/game-folders',{name:'No'},null)).status,401);const folder=await call('/api/game-folders',{name:'Review'});assert.equal(folder.status,200);assert.deepEqual((await call('/api/game-folders')).body,[folder.body]);assert.deepEqual((await call('/api/game-folders',null,'other')).body,[]);assert.equal((await call('/api/game-folders',{name:'review'})).status,409);const created=await call('/api/games',{...quiz,folderId:folder.body.id});assert.equal(created.body.folderId,folder.body.id);assert.equal((await call('/api/games',{...quiz,folderId:folder.body.id},'other')).status,404);assert.equal((await call('/api/games/'+created.body.id,{...quiz,folderId:null},'owner','PUT')).body.folderId,null);assert.equal((await call('/api/games/'+created.body.id,{...quiz,folderId:folder.body.id},'owner','PUT')).body.folderId,folder.body.id);
 const testFolder=await store.createFolder('owner','Academic');assert.equal((await call('/api/games',{...quiz,folderId:testFolder.id})).status,404);const sample=(await call('/api/games')).body.find(g=>g.title==='Sample Game: Easy Quiz');assert.equal(sample.folderId,null);await store.saveTest('owner',{...quiz,id:'folder-source',folderId:testFolder.id});const copied=await call('/api/games/from-test',{testId:'folder-source',folderId:folder.body.id});assert.equal(copied.body.folderId,null);
});

test('player routes expose only ordinal controller slots, including after reconnect',async t=>{
 const {call,store}=await setup(t);
 const source=structuredClone(quiz);const q=source.questions[0];
 q.id='private-question-id';q.text='private-prompt';q.options[0]={id:'private-choice-id',text:'private-choice-text'};q.correctOptionId=q.options[0].id;
 const saved=(await call('/api/games',source)).body;
 const s=(await call('/api/game-sessions',{gameId:saved.id})).body;
 const base='/game-api/'+s.id,teacher='/api/game-sessions/'+s.id;
 const resumeToken='p'.repeat(40),secondToken='w'.repeat(40);
 const first=await call(base+'/join',{nickname:'Phone owner',resumeToken},null);
 const second=await call(base+'/join',{nickname:'Private classmate',resumeToken:secondToken},null);
 const player={playerId:first.body.playerId,resumeToken};
 const intro=await call(teacher+'/advance',{expectedPhase:'lobby',questionIndex:-1});
 assert.equal(intro.body.question,null);
 await store.mutateGame(s.id,d=>{d.introEndsAt=Date.now()-100;});
 const prompt=await call(base+'/display',{displayToken:s.displayToken},null);
 assert.equal(prompt.body.question.text,'private-prompt');assert.equal(prompt.body.question.options,undefined);
 const reading=await call(base+'/state',player,null);assert.equal(reading.body.phase,'countdown');assert.equal(reading.body.question,null);
 assert.equal((await call(base+'/answer',{...player,questionIndex:0,slot:0},null)).status,400);
 await store.mutateGame(s.id,d=>{d.startsAt=Date.now()-1000;d.deadlineAt=d.startsAt+20000;});
 const open=await call(base+'/state',player,null);assert.deepEqual(open.body.question,{slotCount:2});
 assert.equal((await call(base+'/answer',{...player,questionId:q.id,optionId:q.correctOptionId},null)).status,400);
 const accepted=await call(base+'/answer',{...player,questionIndex:0,slot:0},null);
 assert.deepEqual(accepted.body.view.answer,{slot:0});assert.equal(accepted.body.points,undefined);
 const final=await call(base+'/answer',{playerId:second.body.playerId,resumeToken:secondToken,questionIndex:0,slot:1},null);
 assert.equal(final.body.view.roundEndReason,'all-answered');
 assert.equal(final.body.view.phase,'responses-closed');
 const closed=await call(base+'/display',{displayToken:s.displayToken},null);assert.equal(closed.body.question,null);
 await store.mutateGame(s.id,d=>{d.revealAt=Date.now()-1;});
 const resumed=await call(base+'/join',{nickname:'Phone owner',resumeToken},null);
 assert.equal(resumed.body.view.score,undefined);assert.equal(resumed.body.view.answer.correct,true);assert.equal(resumed.body.view.question,null);
 for(const state of [reading.body,open.body,accepted.body.view,resumed.body.view]){
  const payload=JSON.stringify(state);
  for(const secret of [q.id,q.text,q.correctOptionId,q.options[0].text,'Private classmate','correctOptionId'])assert.equal(payload.includes(secret),false);
 }
 const reveal=await call(base+'/display',{displayToken:s.displayToken},null);
 assert.deepEqual(reveal.body.question.counts,{'private-choice-id':1,b:1});
});

test('simultaneous polls and stale controls cannot restart or skip a synced intro or closure',async t=>{
 const {call,store}=await setup(t);
 const saved=(await call('/api/games',quiz)).body;
 const {id,displayToken}=(await call('/api/game-sessions',{gameId:saved.id})).body;
 const base='/game-api/'+id,teacher='/api/game-sessions/'+id;
 const resumeToken='k'.repeat(40);
 const {playerId}=(await call(base+'/join',{nickname:'Faye',resumeToken},null)).body;
 const player={playerId,resumeToken},display={displayToken};
 const started=(await call(teacher+'/advance',{expectedPhase:'lobby',questionIndex:-1})).body;
 assert.equal(started.phase,'intro');
 await store.mutateGame(id,d=>{d.introEndsAt=Date.now()-10;});
 const [countdown,phoneReading,staleStart]=await Promise.all([
  call(base+'/display',display,null),call(base+'/state',player,null),
  call(teacher+'/advance',{expectedPhase:'lobby',questionIndex:-1}),
 ]);
 assert.ok([countdown,phoneReading,staleStart].every(r=>r.status===200&&r.body.phase==='countdown'&&r.body.questionIndex===0));
 assert.equal(countdown.body.startsAt,phoneReading.body.startsAt);
 assert.equal(phoneReading.body.question,null);
 await store.mutateGame(id,d=>{d.startsAt=Date.now()-20000;d.deadlineAt=Date.now()-1;});
 const [closed,phoneClosed]=await Promise.all([call(base+'/display',display,null),call(base+'/state',player,null)]);
 assert.equal(closed.body.phase,'responses-closed');
 assert.equal(phoneClosed.body.phase,'responses-closed');
 assert.equal(closed.body.revealAt,phoneClosed.body.revealAt);
 assert.equal(closed.body.question,null);
 await store.mutateGame(id,d=>{d.revealAt=Date.now()-1;});
 const [poll,phonePoll,staleClosed]=await Promise.all([
  call(base+'/display',display,null),call(base+'/state',player,null),
  call(teacher+'/advance',{expectedPhase:'responses-closed',questionIndex:0}),
 ]);
 assert.ok([poll,phonePoll,staleClosed].every(r=>r.status===200&&r.body.phase==='reveal'));
 assert.deepEqual(poll.body.question.counts,{a:0,b:0});
 assert.equal(phonePoll.body.question,null);
});

test('session large-class option is per launch and leaves saved library unchanged',async t=>{const {call,store}=await setup(t);const saved=(await call('/api/games',{...quiz,largeClass:true})).body;for(const value of [undefined,false,true]){const result=await call('/api/game-sessions',{gameId:saved.id,...(value===undefined?{}:{largeClass:value})});assert.equal(result.status,200);assert.equal((await store.getGameSession(result.body.id)).game.largeClass,value===true);await call('/api/game-sessions/'+result.body.id+'/close',{});}assert.equal((await store.getGame('owner',saved.id)).largeClass,true);assert.equal((await call('/api/game-sessions',{gameId:saved.id,largeClass:'true'})).status,400);});

test('completed-game reports are private snapshots and selectable deletion cannot recreate them',async t=>{
 const {call,store}=await setup(t);
 const saved=(await call('/api/games',quiz)).body;
 const session=(await call('/api/game-sessions',{gameId:saved.id})).body;
 const reports='/api/game-reports', teacher='/api/game-sessions/'+session.id;
 const first='a'.repeat(40),second='b'.repeat(40),third='c'.repeat(40);
 const join=async(nickname,resumeToken)=>(await call('/game-api/'+session.id+'/join',{nickname,resumeToken},null)).body;
 const ada=await join('Ada',first),ben=await join('Ben',second);await join('Cal',third);
 assert.equal((await call(reports,null,null)).status,401);
 assert.deepEqual((await call(reports)).body,[]);
 await call(teacher+'/advance',{expectedPhase:'lobby',questionIndex:-1});
 await store.mutateGame(session.id,d=>{d.introEndsAt=Date.now()-7500;});
 await store.mutateGame(session.id,d=>{
  const g=require('../game');g.sweep(d,Date.now());
  const at=d.startsAt+100;
  g.answer(d,{playerId:ada.playerId,resumeToken:first,questionIndex:0,slot:0},at);
  g.answer(d,{playerId:ben.playerId,resumeToken:second,questionIndex:0,slot:0},at);
  d.deadlineAt=Date.now()-1;g.sweep(d,Date.now());d.revealAt=Date.now()-1;
 });
 await call('/api/games/'+saved.id,{...saved,title:'New title'},'owner','PUT');
 assert.deepEqual((await call(reports)).body,[]);
 const podium=await call(teacher+'/classroom-control',{expectedPhase:'reveal',questionIndex:0});
 assert.equal(podium.body.phase,'podium');
 const response=await call(reports), [meta]=response.body;
 assert.equal(response.status,200);assert.equal(response.cacheControl,'private, no-store');
 assert.deepEqual(Object.keys(meta).sort(),['completedAt','durationMs','id','participantCount','percentCorrect','questionCount','startedAt','title'].sort());
 assert.equal(meta.title,quiz.title);assert.equal(meta.participantCount,3);assert.equal(meta.questionCount,1);assert.equal(meta.percentCorrect,67);
 assert.ok(Number.isSafeInteger(meta.completedAt));assert.ok(Number.isSafeInteger(meta.startedAt));assert.ok(meta.durationMs>=0);
 const detail=reports+'/'+meta.id;
 assert.equal((await call(detail,null,'other')).status,404);
 assert.equal((await call(detail,null,null)).status,401);
 assert.deepEqual((await call(reports,null,'other')).body,[]);
 const {body:snapshot,cacheControl}=await call(detail);
 assert.equal(cacheControl,'private, no-store');
 assert.deepEqual(snapshot.participants,[{name:'Ada',rank:1,score:1000,percentCorrect:100,unanswered:0},{name:'Ben',rank:1,score:1000,percentCorrect:100,unanswered:0},{name:'Cal',rank:3,score:0,percentCorrect:0,unanswered:1}]);
 assert.deepEqual(snapshot.questions,[{prompt:'Which?',percentCorrect:67}]);
 assert.deepEqual(Object.keys(snapshot).sort(),[...Object.keys(meta),'participants','questions'].sort());
 assert.deepEqual((await call(reports+'/delete',{ids:[meta.id]},'other')).body,{deleted:0});
 await call(teacher+'/advance',{expectedPhase:'reveal',questionIndex:0});
 assert.equal((await call(reports)).body.length,1);
 for(const bad of [[],[null],['bad'],{}])assert.equal((await call(reports+'/delete',{ids:bad})).status,400);
 assert.deepEqual((await call(reports+'/delete',{ids:[meta.id,meta.id]})).body,{deleted:1});
 await call(teacher+'/advance',{expectedPhase:'reveal',questionIndex:0});
 assert.equal((await call(detail)).status,404);
 assert.deepEqual((await call(reports)).body,[]);
});

test('reports survive cleared classrooms, but abandoned games do not become reports',async t=>{
 const {call,store,db}=await setup(t);const saved=(await call('/api/games',quiz)).body;
 const complete=async({finish,requireNames})=>{
  const session=(await call('/api/game-sessions',{gameId:saved.id,requireNames})).body,teacher='/api/game-sessions/'+session.id;
  await call('/game-api/'+session.id+'/join',{nickname:'Test Name',avatarId:'avatar-01',resumeToken:'t'.repeat(40)},null);
  await call(teacher+'/advance',{expectedPhase:'lobby',questionIndex:-1});
  if(finish){
   await store.mutateGame(session.id,d=>{d.phase='reveal';d.roundEndedAt=Date.now();});
   assert.equal((await call(teacher+'/advance',{expectedPhase:'reveal',questionIndex:0})).body.phase,'podium');
  }
  await call(teacher+'/close',{});
  return session.id;
 };
 await complete({finish:false,requireNames:true});
 assert.deepEqual((await call('/api/game-reports')).body,[]);
 const clearedSession=await complete({finish:true,requireNames:false});
 const [meta]=(await call('/api/game-reports')).body;
 const {body:report}=await call('/api/game-reports/'+meta.id);
 const avatar=require('../public/game-avatars/manifest.json').find(x=>x.id==='avatar-01');
 assert.equal(report.participants[0].name,avatar.name);
 assert.equal(await store.getGameSession(clearedSession),null);
 assert.equal((await store.listSessions('owner')).length,0);
 await store.beginDeletion('owner');
 assert.equal(await store.getGameReport('owner',meta.id),null);
 await store.completeDeletion('owner',async()=>{});
 assert.deepEqual(await store.listGameReports('owner'),[]);
 assert.deepEqual((await db.query('SELECT id FROM onscreen_v2_game_reports WHERE owner_id=$1',['owner'])).rows,[]);
});
