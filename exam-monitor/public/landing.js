(() => {
  window.examioLanguage.setup();
  if (window.examioLanguage.current === 'ko') {
    const captions = document.querySelector('track[srclang="ko"]');
    if (captions) captions.track.mode = 'showing';
  }
  const carousel = document.querySelector('#preview-carousel');
  if (!carousel) return;

  const interactionRegion = document.querySelector('#preview-stage') || carousel;
  const cards = [...carousel.querySelectorAll('.preview-card')];
  const previous = document.querySelector('[data-carousel-action="previous"]');
  const next = document.querySelector('[data-carousel-action="next"]');
  const pause = document.querySelector('[data-carousel-action="pause"]');
  const status = document.querySelector('#carousel-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const positions = ['center', 'left', 'right'];
  const {t}=window.examioLanguage;
  const labels = { student: t('Student test'), classroom: t('Classroom display'), professor: t('Professor dashboard') };
  let timer = null;
  let manuallyPaused = false;
  let pointerInside = false;
  let focusInside = false;
  let explicitMotion = false;

  const setPosition = step => {
    for (const card of cards) {
      const index = positions.indexOf(card.dataset.position);
      if (index >= 0) card.dataset.position = positions[(index + step + positions.length) % positions.length];
    }
    const active = cards.find(card => card.dataset.position === 'center');
    if (active && status) status.textContent = t('{screen} preview is in the center.',{screen:labels[active.dataset.screen] || 'Product'});
  };

  const syncTimer = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    const motionBlocked = reducedMotion.matches && !explicitMotion;
    const shouldPause = manuallyPaused || pointerInside || focusInside || document.hidden || motionBlocked;
    if (!shouldPause) timer = window.setInterval(() => setPosition(1), 3000);
    if (pause) {
      const isPaused = manuallyPaused || motionBlocked;
      pause.textContent = t(manuallyPaused ? 'Resume' : motionBlocked ? 'Play' : 'Pause');
      pause.setAttribute('aria-label', t(manuallyPaused ? 'Resume preview rotation' : motionBlocked ? 'Play preview rotation' : 'Pause preview rotation'));
      pause.setAttribute('aria-pressed', String(manuallyPaused));
    }
  };

  previous?.addEventListener('click', () => setPosition(-1));
  next?.addEventListener('click', () => setPosition(1));
  pause?.addEventListener('click', () => {
    if (manuallyPaused || (reducedMotion.matches && !explicitMotion)) {
      manuallyPaused = false;
      if (reducedMotion.matches) explicitMotion = true;
    } else {
      manuallyPaused = true;
      explicitMotion = false;
    }
    syncTimer();
  });
  interactionRegion.addEventListener('pointerenter', () => { pointerInside = true; syncTimer(); });
  interactionRegion.addEventListener('pointerleave', () => { pointerInside = false; syncTimer(); });
  interactionRegion.addEventListener('focusin', () => { focusInside = true; syncTimer(); });
  interactionRegion.addEventListener('focusout', event => {
    if (!interactionRegion.contains(event.relatedTarget)) { focusInside = false; syncTimer(); }
  });
  document.addEventListener('visibilitychange', syncTimer);
  reducedMotion.addEventListener?.('change', () => { explicitMotion = false; syncTimer(); });
  syncTimer();
})();
