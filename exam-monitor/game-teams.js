const {randomUUID,randomInt}=require('node:crypto');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const enabled=s=>s.gameMode==='team';
function settings(input={},capacity=30){
 if(input.gameMode===undefined||input.gameMode==='classic')return {};
 if(input.gameMode!=='team')fail('Choose Classic or Team Race.');
 const teamAssignment=input.teamAssignment??'choose',teamSize=input.teamSize??4,teamCount=input.teamCount??2;
 if(!['choose','random'].includes(teamAssignment))fail('Choose how players join teams.');
 if(!Number.isInteger(teamSize)||teamSize<2||teamSize>6)fail('Teams must allow 2–6 players.');
 if(teamAssignment==='random'&&(!Number.isInteger(teamCount)||teamCount<2||teamCount>Math.floor(capacity/2)))fail('Choose 2–'+Math.floor(capacity/2)+' teams.');
 return {gameMode:'team',teamAssignment,teamSize,...(teamAssignment==='random'?{teamCount}:{}),teams:teamAssignment==='random'?Array.from({length:teamCount},(_,i)=>({id:randomUUID(),name:'Team '+(i+1),captainId:null})):[]};
}
const members=(s,id)=>s.players.filter(p=>p.teamId===id);
function name(s,value,except){if(typeof value!=='string'||!value.trim()||value.trim().length>30||/[\x00-\x1f]/.test(value))fail('Use a team name of 1–30 characters.');const result=value.trim();if(s.teams.some(t=>t.id!==except&&t.name.toLocaleLowerCase()===result.toLocaleLowerCase()))fail('That team name already exists.');return result;}
function assign(s,player,input){
 if(!enabled(s))return;
 let team;
 if(s.teamAssignment==='random'){
  const available=s.teams.filter(t=>members(s,t.id).length<s.teamSize);if(!available.length)fail('All teams are full. Ask your professor.');
  const minimum=Math.min(...available.map(t=>members(s,t.id).length)),choices=available.filter(t=>members(s,t.id).length===minimum);team=choices[randomInt(choices.length)];
 }else if(input.teamId){team=s.teams.find(t=>t.id===input.teamId);if(!team)fail('Choose an existing team or create one.');if(members(s,team.id).length>=s.teamSize)fail('That team is full.');}
 else{const title=name(s,input.teamName);team={id:randomUUID(),name:title,captainId:player.id};s.teams.push(team);}
 if(!team.captainId)team.captainId=player.id;player.teamId=team.id;
}
function ready(s){if(!enabled(s))return;const playing=s.teams.filter(t=>members(s,t.id).length);if(playing.length<2)fail('Team Race needs at least two teams.');if(playing.some(t=>members(s,t.id).length<2))fail('Each team needs at least 2 players before starting.');}
function rename(s,player,value){if(!enabled(s))fail('This is not a team game.');if(s.phase!=='lobby')fail('This game has already started.');const team=s.teams.find(t=>t.id===player.teamId);if(!team||team.captainId!==player.id)fail('Only the first team member (captain) can name this team.',403);team.name=name(s,value,team.id);}
function list(s){return enabled(s)?s.teams.map(t=>({id:t.id,name:t.name,memberCount:members(s,t.id).length,capacity:s.teamSize,members:members(s,t.id).map(p=>({id:p.id,nickname:p.nickname,avatarId:p.avatarId}))})):[];}
function standings(s,players){
 const rows=s.teams.map(team=>{const group=players.filter(p=>p.teamId===team.id);if(!group.length)return null;const average=key=>group.reduce((n,p)=>n+(p[key]||0),0)/group.length;return {id:team.id,nickname:team.name,score:average('score'),...(group.some(p=>p.previousScore!==undefined)?{previousScore:average('previousScore')}:{}),members:group.map(p=>({id:p.id,nickname:p.nickname,avatarId:p.avatarId})),connected:group.some(p=>p.connected)};}).filter(Boolean);
 const rank=key=>{let prior=null,place=0;return [...rows].sort((a,b)=>b[key]-a[key]||a.nickname.localeCompare(b.nickname)).map((p,i)=>{if(p[key]!==prior)place=i+1;prior=p[key];return {...p,rank:place};});};
 const previous=rows.some(p=>p.previousScore!==undefined)?new Map(rank('previousScore').map(p=>[p.id,p.rank])):null;
 return {rows,leaderboard:rank('score').map(p=>previous?{...p,previousRank:previous.get(p.id)}:p)};
}
module.exports={enabled,settings,assign,ready,rename,list,standings};
