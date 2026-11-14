(function(root) {
  // A visible score is authoritative only at the leaderboard, not during timed play.
  function createTracker() {
    let session, lastBoard=-1, leader, podiumShown, lastIndex=-1;
    const soleLeader=rows=>{
      const first=rows.filter(row=>row.rank===1&&row.score>0);
      return first.length===1?first[0]:null;
    };
    return function(view) {
      const rows=view.leaderboard||[];
      const index=Number.isInteger(view.questionIndex)?view.questionIndex:-1;
      if(session!==view.id){
        session=view.id;lastIndex=index;lastBoard=view.phase==='leaderboard'?index:-1;
        leader=soleLeader(rows)?.id;podiumShown=view.phase==='podium';
        return null;
      }
      if(index<lastIndex)return null;
      lastIndex=index;
      if(view.phase==='podium'&&!podiumShown&&rows.length){
        podiumShown=true;return {cue:'podium'};
      }
      if(view.phase!=='leaderboard'||index<=lastBoard||podiumShown)return null;
      lastBoard=index;
      const prior=rows.some(row=>Number.isInteger(row.previousRank))
        ? soleLeader(rows.map(row=>({id:row.id,rank:row.previousRank,score:row.previousScore})))?.id
        : leader;
      const first=soleLeader(rows);
      leader=first?.id;
      return leader&&leader!==prior?{cue:'lead',player:first}:null;
    };
  }
  const api = { createTracker };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) root.GameShow = api;
})(typeof window === 'undefined' ? globalThis : window);
