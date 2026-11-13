const express=require('express');
const QRCode=require('qrcode');
const game=require('./game');
function createGameController({store,origin}){
 const api=express.Router(),publicApi=express.Router();
 const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(e=>[400,403,404,409,410,429].includes(e.status)?res.status(e.status).json({error:e.message}):next(e));
 const queues=new Map(),heartbeats=new Map();
 const enqueue=(id,fn)=>{const previous=queues.get(id)||Promise.resolve();const task=previous.catch(()=>{}).then(fn);queues.set(id,task);task.finally(()=>{if(queues.get(id)===task)queues.delete(id);}).catch(()=>{});return task;};
 const sessionWrap=fn=>wrap((req,res)=>{req.gameReceivedAt=Date.now();return enqueue(req.params.id,()=>fn(req,res));});
 const beat=(id,playerId,now)=>{heartbeats.set(id+':'+playerId,now);};
 const overlay=s=>{const now=Date.now();for(const [key,time] of heartbeats)if(now-time>30000)heartbeats.delete(key);for(const p of s.players)p.lastSeenAt=Math.max(p.lastSeenAt||0,heartbeats.get(s.id+':'+p.id)||0);return s;};
 async function current(id,now=Date.now()){let s=await store.getGameSession(id);if(!s)missing();const phase=s.phase;game.sweep(s,now);if(s.phase!==phase){s=(await store.mutateGame(id,d=>game.sweep(d,now))).session;}return overlay(s);}
 const missing=()=>{throw Object.assign(new Error('Game not found or expired.'),{status:404});};
 const owned=async(req)=>{const s=await store.getGameSession(req.params.id);if(!s||s.ownerId!==req.user.id)missing();return s;};
 const saved=async(req)=>{const g=await store.getGame(req.user.id,req.params.id);if(!g)missing();return g;};
 const host=async(s,req)=>({...game.hostView(s),joinUrl:origin(req)+'/game-player.html?session='+encodeURIComponent(s.id),displayUrl:origin(req)+'/game-display.html#'+encodeURIComponent(s.id)+'/'+s.displayToken});
 // Bounded, expiring counters deter PIN guessing and public write flooding.
 publicApi.use(createPublicLimiter());
 api.get('/games',wrap(async(req,res)=>res.json(await store.listGames(req.user.id))));
 api.post('/games',wrap(async(req,res)=>res.json(await store.saveGame(req.user.id,game.validateGame(req.body)))));
 api.post('/games/from-test',wrap(async(req,res)=>{const source=await store.getTest(req.user.id,req.body?.testId);if(!source)missing();res.json(await store.saveGame(req.user.id,game.fromTest(source,{compatibleOnly:req.body?.compatibleOnly===true})));}));
 api.get('/games/:id',wrap(async(req,res)=>res.json(await saved(req))));
 api.put('/games/:id',wrap(async(req,res)=>{await saved(req);res.json(await store.saveGame(req.user.id,{...game.validateGame(req.body),id:req.params.id},true));}));
 api.delete('/games/:id',wrap(async(req,res)=>{await saved(req);await store.deleteGame(req.user.id,req.params.id);res.json({ok:true});}));
 api.post('/games/:id/to-test',wrap(async(req,res)=>res.json(await store.saveTest(req.user.id,game.toTest(await saved(req))))));
 api.get('/game-sessions',wrap(async(req,res)=>res.json(await Promise.all((await store.listGameSessions(req.user.id)).map(s=>host(s,req))))));
 api.post('/game-sessions',wrap(async(req,res)=>{const g=await store.getGame(req.user.id,req.body?.gameId);if(!g)missing();if((await store.listGameSessions(req.user.id)).length>=3)throw Object.assign(new Error('Close an existing game before launching another.'),{status:409});let s;for(let attempt=0;attempt<5;attempt++){try{s=await store.createGameSession(game.newSession(req.user.id,g,Date.now()));break;}catch(e){if(e.code!=='23505'||attempt===4)throw e;}}res.json(await host(s,req));}));
 api.get('/game-sessions/:id',sessionWrap(async(req,res)=>{await owned(req);const session=await current(req.params.id,req.gameReceivedAt);res.json(await host(session,req));}));
 api.post('/game-sessions/:id/advance',sessionWrap(async(req,res)=>{await owned(req);const {session}=await store.mutateGame(req.params.id,s=>{game.sweep(s,Date.now());if(req.body?.expectedPhase!==s.phase||req.body?.questionIndex!==s.questionIndex)return;game.advance(s,Date.now());});res.json(await host(session,req));}));
 api.post('/game-sessions/:id/recover',sessionWrap(async(req,res)=>{await owned(req);const {session}=await store.mutateGame(req.params.id,s=>game.approveRecovery(s,req.body?.code,req.body?.playerId,Date.now()));res.json(await host(session,req));}));
 api.post('/game-sessions/:id/close',sessionWrap(async(req,res)=>{await owned(req);await store.closeGame(req.user.id,req.params.id);res.json({ok:true});}));
 publicApi.post('/resolve',wrap(async(req,res)=>{const pin=String(req.body?.pin||'').trim();if(!/^\d{6}$/.test(pin))missing();const s=await store.findGamePin(pin);if(!s)missing();res.json({sessionId:s.id});}));
 publicApi.post('/:id/join',sessionWrap(async(req,res)=>{const {session,result}=await store.mutateGame(req.params.id,s=>{game.sweep(s,Date.now());return game.join(s,req.body||{},Date.now());});res.json({...result,view:game.playerView(session,result.playerId)});}));
 publicApi.post('/:id/state',sessionWrap(async(req,res)=>{const session=await current(req.params.id,req.gameReceivedAt);game.authenticatePlayer(session,req.body?.playerId,req.body?.resumeToken);beat(session.id,req.body.playerId,req.gameReceivedAt);res.json(game.playerView(overlay(session),req.body.playerId));}));
 publicApi.post('/:id/answer',sessionWrap(async(req,res)=>{const receivedAt=req.gameReceivedAt;const {session,result}=await store.mutateGame(req.params.id,s=>game.answer(s,req.body||{},receivedAt));res.json({accepted:result.accepted,view:game.playerView(session,req.body.playerId)});}));
 publicApi.post('/:id/recovery',sessionWrap(async(req,res)=>{const {result}=await store.mutateGame(req.params.id,s=>game.requestRecovery(s,req.body||{},Date.now()));res.json(result);}));
 publicApi.post('/:id/display',sessionWrap(async(req,res)=>{const s=await store.getGameSession(req.params.id);if(!s)missing();if(typeof req.body?.displayToken!=='string'||req.body.displayToken!==s.displayToken)throw Object.assign(new Error('Display access denied.'),{status:403});const session=await current(s.id,req.gameReceivedAt);res.json(game.publicView(session));}));
 publicApi.get('/:id/qr',wrap(async(req,res)=>{const s=await store.getGameSession(req.params.id);if(!s)missing();res.type('image/png').send(await QRCode.toBuffer(origin(req)+'/game-player.html?session='+encodeURIComponent(s.id)));}));
 return {api,publicApi,async tick(){await store.purgeExpiredGames(Date.now());for(const s of await store.activeGameSessions()){try{await enqueue(s.id,()=>current(s.id,Date.now()));}catch(e){if(e.status!==404)throw e;}}}};
}
function createPublicLimiter(){
 const counters=new Map();
 return (req,res,next)=>{
  const now=Date.now();for(const [key,value] of counters)if(value.until<=now)counters.delete(key);
  const token=req.body?.resumeToken||req.body?.displayToken;
  const valid=typeof token==='string'&&token.length>=32&&token.length<=128;
  const session=req.path.split('/')[1]||'';
  const polling=req.path.endsWith('/state')||req.path.endsWith('/display');
  if(polling&&!valid)return res.status(403).json({error:'Game connection not recognized.'});
  const actor=valid?require('node:crypto').createHash('sha256').update(token).digest('hex'):null;
  // Do not treat a campus NAT or Railway proxy as a single player.
  // Per-token limits protect authenticated/resuming activity; coarse endpoint
  // limits remain high enough for large shared-IP classrooms.
  const budgets=actor?[[session+':'+actor+':'+(polling?'read':'write'),polling?180:120]]:[];
  if(!polling)budgets.push(['ip:'+req.socket.remoteAddress+':'+(req.path==='/resolve'?'resolve':'write'),req.path==='/resolve'?1200:10000]);
  for(const [key,max] of budgets){let value=counters.get(key);if(!value){if(counters.size>=20000)return res.status(429).json({error:'Please wait before retrying.'});value={count:0,until:now+60000};counters.set(key,value);}if(++value.count>max)return res.status(429).json({error:'Too many attempts. Please wait a minute.'});}
  next();
 };
}
module.exports={createGameController,createPublicLimiter};
