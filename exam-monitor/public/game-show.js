(function(root) {
  // A visible score is authoritative only at the leaderboard, not during timed play.
  function createTracker() {
    let session, lastBoard, leader, podiumShown;
    return function(view) {
      if (session !== view.id) {
        session = view.id;
        lastBoard = leader = undefined;
        podiumShown = false;
      }
      const rows = view.leaderboard || [];
      if (view.phase === 'podium' && !podiumShown && rows.length > 0) {
        podiumShown = true;
        return { cue: 'podium' };
      }
      if (view.phase !== 'leaderboard' || lastBoard === view.questionIndex) return null;
      lastBoard = view.questionIndex;
      const first = rows.filter(row => row.rank === 1 && row.score > 0);
      const previous = leader;
      leader = first.length === 1 ? first[0].id : undefined;
      return leader && leader !== previous ? { cue: 'lead', player: first[0] } : null;
    };
  }
  const api = { createTracker };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) root.GameShow = api;
})(typeof window === 'undefined' ? globalThis : window);
