(function(root) {
  const isId = v => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
  function actionLabel(view) {
    if (!view) return null;
    switch (view.phase) {
      case 'lobby': return 'Start Game';
      case 'media': return 'Start Question';
      case 'reveal': return 'Show Leaderboard';
      case 'leaderboard': return view.questionIndex + 1 >= view.questionCount ? 'Show Podium' : 'Next Question';
      default: return null;
    }
  }
  function channelName(id, key) {
    return 'examio-game-classroom-control:' + JSON.stringify([id,key]);
  }
  function openChannel(id,key) {
    if (!key || typeof root.BroadcastChannel !== 'function') return null;
    try { return new root.BroadcastChannel(channelName(id,key)); }
    catch { return null; } // The normal projector and host still work in restricted browsers.
  }
  function send(channel,message) {
    if (!channel) return false;
    try { channel.postMessage(message); return true; }
    catch { return false; }
  }
  function relay({current,advance,now=Date.now}) {
    const connected = new Map();
    let busy = false;
    return async (msg) => {
      const view = current();
      if (!view || !isId(msg?.client)) return null;
      const time = now(), client = msg.client;
      for (const [id,until] of connected) if (until <= time) connected.delete(id);
      if (msg.kind === 'hello') {
        if (connected.size >= 16 && !connected.has(client)) return null;
        connected.set(client,time+5000);
        return {kind:'authorized',client};
      }
      if (msg.kind !== 'advance' || !connected.has(client) || !isId(msg.request)) return null;
      const reply = {kind:'reply',client,request:msg.request};
      if (busy || !actionLabel(view) || msg.phase !== view.phase || msg.questionIndex !== view.questionIndex) {
        return {...reply,stale:true};
      }
      busy = true;
      try {
        return {...reply,view:await advance({expectedPhase:view.phase,questionIndex:view.questionIndex})};
      } catch {
        return {...reply,error:'Could not advance. Check the host controls and try again.'};
      } finally {
        busy = false;
      }
    };
  }
  const api={actionLabel,channelName,openChannel,send,relay};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  if (root.document) root.GameClassroomControl=api;
})(typeof window === 'undefined' ? globalThis : window);
