(async () => {
  const {$, status, json, render} = GameClient;
  const [id, displayToken] = location.hash.slice(1).split('/').map(decodeURIComponent);
  if (!id || !displayToken) {
    status('Open the classroom display from the game host page.', true);
    return;
  }

  const trackCue = GameShow.createTracker();
  const audio = GameAudio.create({button: $('game-audio-toggle'), slider: $('game-volume')});
  const celebration = $('celebration');
  let celebrationTimer, stopped = false;
  function clearCelebration() {
    clearTimeout(celebrationTimer);
    celebration.hidden = true;
  }
  function showLeader(player) {
    clearCelebration();
    celebration.dataset.cue = 'lead';
    celebration.querySelector('.celebration-name').textContent = player.nickname;
    celebration.querySelector('.player-avatar').src = GameAvatars.image(player.avatarId);
    celebration.hidden = false;
    celebrationTimer = setTimeout(clearCelebration, 3400);
  }

  async function poll() {
    try {
      const view = await json('/game-api/'+encodeURIComponent(id)+'/display', {displayToken});
      $('game-audio-controls').hidden = view.phase === 'closed';
      $('join-details').hidden = view.phase !== 'lobby';
      if (view.phase === 'lobby') {
        $('pin').textContent = view.pin;
        $('join-link').textContent = location.host+'/game-player.html';
        if (!$('qr').getAttribute('src')) $('qr').src = '/game-api/'+encodeURIComponent(id)+'/qr';
      }
      render(view);
      if (view.phase !== 'leaderboard') clearCelebration();
      const event = trackCue(view);
      if (event?.cue === 'lead') showLeader(event.player);
      audio.update(view, event?.cue);
      status('');
    } catch (e) {
      $('join-details').hidden = true;
      status(e.status === 404 ? 'This game has ended or expired.' : e.message, true);
      if ([403,404,410].includes(e.status)) {
        stopped = true;
        audio.stop();
        clearCelebration();
        $('game-audio-controls').hidden = true;
        render({id,phase:'closed'});
      }
    } finally {
      if (!stopped) setTimeout(poll,1000);
    }
  }
  addEventListener('pagehide', event => {
    if (event.persisted) audio.update({id,phase:'closed'});
    else audio.stop();
  });
  await poll();
})();
