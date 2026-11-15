(async () => {
  const {$, status, json, render, nextPollDelay} = GameClient;
  const [id, displayToken, controlParam] = location.hash.slice(1).split('/').map(decodeURIComponent);
  if (!id || !displayToken) {
    status('Open the classroom display from Games in progress.', true);
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
  const lobbyControls = GameLobbyControls.create({
    qrButton: $('join-qr-button'), qrImage: $('qr'), qrDialog: $('join-qr-dialog'),
    enlargedQr: $('join-qr-enlarged'), closeQr: $('join-qr-close'),
    speaker: $('sound-speaker'), soundPanel: $('sound-panel'), audioToggle: $('game-audio-toggle'),
    autoEnable: () => audio.canAutoEnable?.() === true, document,
  });
  const celebration = $('celebration');
  let celebrationTimer, leaderTimer, pollTimer, receivedAt, polling = false, stopped = false;
  function clearCelebration() {
    clearTimeout(celebrationTimer);
    clearTimeout(leaderTimer);
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
  function updateJoinDetails(lobby) {
    document.body.classList.toggle('game-projector-lobby',Boolean(lobby));
    $('join-details').hidden = !lobby;
    lobbyControls.setQr(lobby ? '/game-api/'+encodeURIComponent(id)+'/qr' : null);
    if (!lobby) return;
    const name=typeof lobby.roomName==='string'&&lobby.roomName.trim();
    $('room-name').textContent=name||'Join the game';
    const link=$('join-link'),join=GameLobbyControls.joinAddress(location);
    link.parentElement.hidden=!name;
    link.textContent=join.label;
    link.href=join.href;
    $('room-instructions').textContent=name?'Enter this room name to join.':'Scan the QR code to join.';
  }
  function applyView(next) {
    if (GameAudio.isStaleView(next, view)) return;
    const hasPreviousView = view?.id === next.id;
    view = next;
    receivedAt = Date.now();
    $('game-audio-controls').hidden = view.phase === 'closed';
    if (view.phase === 'closed') lobbyControls.closeSound();
    updateJoinDetails(view.phase === 'lobby' ? view : null);
    render(view);
    updateControl();
    if (view.phase !== 'leaderboard') clearCelebration();
    const event = trackCue(view);
    if (hasPreviousView && event?.cue === 'lead') {
      const round = view.questionIndex;
      const wait = Number.isFinite(view.scoreStartsAt)
        ? Math.max(0, view.scoreStartsAt + GameClient.SCORE_DURATION_MS - view.serverNow) : 0;
      leaderTimer = setTimeout(() => {
        if (view.phase === 'leaderboard' && view.questionIndex === round) showLeader(event.player);
      }, wait);
    }
    audio.update(view, hasPreviousView ? event?.cue : undefined);
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
          if (!polling) schedulePoll();
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

  function schedulePoll(failed = false) {
    clearTimeout(pollTimer);
    if (!stopped) pollTimer = setTimeout(poll, failed ? 1000 : nextPollDelay(view, receivedAt));
  }
  async function poll() {
    if (stopped || polling) return;
    polling = true;
    let failed = false;
    const at = version;
    try {
      GameClassroomControl.send(controls,{kind:'hello',client});
      updateControl();
      const next = await json('/game-api/'+encodeURIComponent(id)+'/display', {displayToken});
      if (at === version) applyView(next);
      status('');
    } catch (e) {
      failed = true;
      updateJoinDetails(null);
      status(e.status === 404 ? 'This game has ended or expired.' : e.message, true);
      if ([403,404,410].includes(e.status)) {
        stopped = true;
        stopControl();
        audio.stop();
        clearCelebration();
        $('game-audio-controls').hidden = true;
        lobbyControls.closeSound();
        render({id,phase:'closed'});
      }
    } finally {
      polling = false;
      schedulePoll(failed);
    }
  }
  addEventListener('pagehide', event => {
    if (event.persisted) audio.update({id,phase:'closed'});
    else { controls?.close(); audio.stop(); }
  });
  await poll();
})();
