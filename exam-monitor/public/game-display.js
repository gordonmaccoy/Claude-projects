(async () => {
  const {$, status, json, render} = GameClient;
  const [id, displayToken, controlParam] = location.hash.slice(1).split('/').map(decodeURIComponent);
  if (!id || !displayToken) {
    status('Open the classroom display from the game host page.', true);
    return;
  }

  // A copied spectator URL cannot acquire control. A teacher-opened tab keeps
  // its separate, per-game control key only until this browser tab is closed.
  const keyStorage = 'examio-classroom-control:'+id;
  let controlKey = controlParam;
  if (controlParam) {
    history.replaceState(null,'',location.pathname+location.search+'#'+encodeURIComponent(id)+'/'+encodeURIComponent(displayToken));
    try { sessionStorage.setItem(keyStorage,controlParam); } catch {}
  } else {
    try { controlKey = sessionStorage.getItem(keyStorage); } catch {}
  }
  const controls = GameClassroomControl.openChannel(id,controlKey);
  const client = controls ? crypto.randomUUID() : null;
  const advance = $('classroom-advance');
  let authorizedUntil = 0, request, requestTimer, view, version = 0;
  function updateControl() {
    const label = GameClassroomControl.actionLabel(view);
    advance.hidden = !label || Date.now() >= authorizedUntil;
    advance.disabled = Boolean(request);
    if (label) advance.textContent = label;
  }
  function stopControl() {
    controls?.close();
    authorizedUntil = 0;
    clearTimeout(requestTimer);
    try { sessionStorage.removeItem(keyStorage); } catch {}
    updateControl();
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
  function applyView(next) {
    view = next;
    $('game-audio-controls').hidden = view.phase === 'closed';
    $('join-details').hidden = view.phase !== 'lobby';
    if (view.phase === 'lobby') {
      $('pin').textContent = view.pin;
      $('join-link').textContent = location.host+'/game-player.html';
      if (!$('qr').getAttribute('src')) $('qr').src = '/game-api/'+encodeURIComponent(id)+'/qr';
    }
    render(view);
    updateControl();
    if (view.phase !== 'leaderboard') clearCelebration();
    const event = trackCue(view);
    if (event?.cue === 'lead') showLeader(event.player);
    audio.update(view, event?.cue);
  }
  if (controls) {
    controls.onmessage = ({data}) => {
      if (stopped || data?.client !== client) return;
      if (data.kind === 'authorized') {
        authorizedUntil = Date.now()+3600;
        updateControl();
      } else if (data.kind === 'reply' && request && data.request === request) {
        clearTimeout(requestTimer);
        request = null;
        if (data.view?.id === id) {
          version++;
          applyView(data.view);
        } else if (data.error) status(data.error,true);
        updateControl();
      }
    };
    advance.onclick = () => {
      if (advance.hidden || request || !view) return;
      request = crypto.randomUUID();
      updateControl();
      if (!GameClassroomControl.send(controls,{kind:'advance',client,request,phase:view.phase,questionIndex:view.questionIndex})) {
        request=null;authorizedUntil=0;updateControl();return;
      }
      requestTimer = setTimeout(() => {
        request=null;
        authorizedUntil=0;
        updateControl();
        status('Classroom control timed out. Keep the host tab open and try again.',true);
      },4500);
    };
  }

  async function poll() {
    const at = version;
    try {
      GameClassroomControl.send(controls,{kind:'hello',client});
      updateControl();
      const next = await json('/game-api/'+encodeURIComponent(id)+'/display', {displayToken});
      if (at === version) applyView(next);
      status('');
    } catch (e) {
      $('join-details').hidden = true;
      status(e.status === 404 ? 'This game has ended or expired.' : e.message, true);
      if ([403,404,410].includes(e.status)) {
        stopped = true;
        stopControl();
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
    else { controls?.close(); audio.stop(); }
  });
  await poll();
})();
