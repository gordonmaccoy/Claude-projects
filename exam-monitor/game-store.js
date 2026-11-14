const {randomUUID,randomInt}=require('node:crypto');
const game=require('./game');
const {createSampleGame,isSampleTitle}=require('./game-sample');
const problem=(message,status=404)=>Object.assign(new Error(message),{status});
function createGameStore(pool,accounts){
 const live="expires_at>$2 AND NOT EXISTS(SELECT 1 FROM onscreen_v2_accounts a WHERE a.owner_id=s.owner_id AND a.state<>'active')";
 const methods={
  async ensureSampleGame(ownerId,language){return accounts.withOwner(ownerId,async()=>{
   const marker=(await pool.query('SELECT game_sample_initialized FROM onscreen_v2_accounts WHERE owner_id=$1',[ownerId])).rows[0];
   const existing=(await methods.listGames(ownerId)).find(g=>isSampleTitle(g.title));
   if(marker.game_sample_initialized)return existing||null;
   const sample=existing||await methods.saveGame(ownerId,createSampleGame(language));
   await pool.query('UPDATE onscreen_v2_accounts SET game_sample_initialized=TRUE WHERE owner_id=$1',[ownerId]);
   return sample;
  });},
  async listGames(ownerId){return (await pool.query("SELECT g.data FROM onscreen_v2_games g WHERE owner_id=$1 AND NOT EXISTS(SELECT 1 FROM onscreen_v2_accounts a WHERE a.owner_id=g.owner_id AND a.state<>'active') ORDER BY updated_at DESC",[ownerId])).rows.map(r=>r.data);},
  async getGame(ownerId,id){return (await pool.query("SELECT g.data FROM onscreen_v2_games g WHERE owner_id=$1 AND id=$2 AND NOT EXISTS(SELECT 1 FROM onscreen_v2_accounts a WHERE a.owner_id=g.owner_id AND a.state<>'active')",[ownerId,id])).rows[0]?.data||null;},
  async saveGame(ownerId,input,updateOnly=false){return accounts.withOwner(ownerId,async()=>{
   const clean=game.validateGame(input),id=input.id||randomUUID();if(typeof id!=='string'||id.length>100)throw problem('Invalid game identifier.',400);
   const data={...clean,id};let result;
   if(updateOnly)result=await pool.query('UPDATE onscreen_v2_games SET data=$3,updated_at=NOW() WHERE owner_id=$1 AND id=$2 RETURNING id',[ownerId,id,JSON.stringify(data)]);
   else result=await pool.query('INSERT INTO onscreen_v2_games(id,owner_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW() WHERE onscreen_v2_games.owner_id=EXCLUDED.owner_id RETURNING id',[id,ownerId,JSON.stringify(data)]);
   if(!result.rows.length)throw problem('Game not found.');return data;
  });},
  async deleteGame(ownerId,id){return accounts.withOwner(ownerId,async()=>!!(await pool.query('DELETE FROM onscreen_v2_games WHERE owner_id=$1 AND id=$2 RETURNING id',[ownerId,id])).rows.length);},
  async createGameSession(s){return accounts.withOwner(s.ownerId,async()=>{
   const active=Number((await pool.query('SELECT COUNT(*) AS count FROM onscreen_v2_game_sessions WHERE owner_id=$1 AND expires_at>$2',[s.ownerId,Date.now()])).rows[0].count);if(active>=3)throw problem('Close an existing game before launching another.',409);
   // Pin uniqueness is enforced by the database, never by a race-prone preflight.
   for(let i=0;i<20;i++){const result=await pool.query('INSERT INTO onscreen_v2_game_sessions(id,owner_id,pin,data,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id',[s.id,s.ownerId,s.pin,JSON.stringify(s),s.expiresAt]);if(result.rows.length)return s;s.pin=String(randomInt(100000,1000000));}
   throw problem('Unable to reserve a game PIN. Try again.',409);
  });},
  async getGameSession(id,now=Date.now()){return (await pool.query(`SELECT data FROM onscreen_v2_game_sessions s WHERE id=$1 AND ${live}`,[id,now])).rows[0]?.data||null;},
  async findGamePin(pin,now=Date.now()){return (await pool.query(`SELECT data FROM onscreen_v2_game_sessions s WHERE pin=$1 AND ${live}`,[pin,now])).rows[0]?.data||null;},
  async listGameSessions(ownerId,now=Date.now()){return (await pool.query(`SELECT data FROM onscreen_v2_game_sessions s WHERE owner_id=$1 AND ${live} ORDER BY created_at DESC`,[ownerId,now])).rows.map(r=>r.data);},
  async activeGameSessions(now=Date.now()){return (await pool.query("SELECT data FROM onscreen_v2_game_sessions s WHERE expires_at>$1 AND NOT EXISTS(SELECT 1 FROM onscreen_v2_accounts a WHERE a.owner_id=s.owner_id AND a.state<>'active')",[now])).rows.map(r=>r.data);},
  async mutateGame(id,fn){
   const owner=(await pool.query('SELECT owner_id FROM onscreen_v2_game_sessions WHERE id=$1',[id])).rows[0]?.owner_id;if(!owner)throw problem('Game not found or expired.');
   return accounts.withOwner(owner,async()=>{const row=(await pool.query('SELECT data,expires_at FROM onscreen_v2_game_sessions WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row||Number(row.expires_at)<=Date.now())throw problem('Game not found or expired.',410);const session=row.data,result=await fn(session);await pool.query('UPDATE onscreen_v2_game_sessions SET data=$2,expires_at=$3 WHERE id=$1',[id,JSON.stringify(session),session.expiresAt]);return {session,result};});
  },
  async closeGame(ownerId,id){return accounts.withOwner(ownerId,async()=>!!(await pool.query('DELETE FROM onscreen_v2_game_sessions WHERE owner_id=$1 AND id=$2 RETURNING id',[ownerId,id])).rows.length);},
  async purgeExpiredGames(now=Date.now()){await pool.query("DELETE FROM onscreen_v2_game_sessions WHERE expires_at<=$1 OR data->>'phase'='closed'",[now]);}
 };
 return {methods,async init(){await pool.query('ALTER TABLE onscreen_v2_accounts ADD COLUMN IF NOT EXISTS game_sample_initialized BOOLEAN NOT NULL DEFAULT FALSE');await pool.query('CREATE TABLE IF NOT EXISTS onscreen_v2_games(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES onscreen_v2_accounts(owner_id),data JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');await pool.query('CREATE INDEX IF NOT EXISTS onscreen_v2_games_owner ON onscreen_v2_games(owner_id)');await pool.query('CREATE TABLE IF NOT EXISTS onscreen_v2_game_sessions(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES onscreen_v2_accounts(owner_id),pin TEXT UNIQUE NOT NULL,data JSONB NOT NULL,expires_at BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');await pool.query('CREATE INDEX IF NOT EXISTS onscreen_v2_game_sessions_owner ON onscreen_v2_game_sessions(owner_id)');await pool.query('CREATE INDEX IF NOT EXISTS onscreen_v2_game_sessions_expiry ON onscreen_v2_game_sessions(expires_at)');}};
}
module.exports={createGameStore};
