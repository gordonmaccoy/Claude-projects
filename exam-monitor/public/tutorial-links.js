(() => {
  'use strict';
  const videos = {
    create: ['bKF0W2XEQso', 'Create your first quiz video tutorial'],
    results: ['kFL3qrujLxQ', 'Quiz results video tutorial'],
    games: ['7Ig0TopMwnk', 'Launch your first game video tutorial'],
    signup: ['oSKQeSRrffY', 'First-Time Sign-In Tutorial'],
    calculator: ['Z4LchHDBZBs', 'First Time Class Calculator Tutorial'],
    launch: ['xUPe_R1VbOQ', 'First Time Quiz Launch Tutorial Video'],
  };
  let dialog, player, heading, previousFocus;
  function createDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'tutorial-video-dialog';
    dialog.setAttribute('aria-labelledby', 'tutorial-video-title');
    const header = document.createElement('div');
    header.className = 'tutorial-video-header';
    heading = document.createElement('h2');
    heading.id = 'tutorial-video-title';
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = 'Close';
    close.setAttribute('aria-label', 'Close tutorial video');
    close.onclick = () => dialog.close();
    player = document.createElement('div');
    player.className = 'tutorial-video-player';
    header.append(heading, close); dialog.append(header, player);
    dialog.addEventListener('close', () => {
      player.replaceChildren();
      if (previousFocus?.isConnected) previousFocus.focus();
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    document.body.append(dialog);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-tutorial]');
    const video = videos[link?.dataset.tutorial];
    if (!video || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!dialog) createDialog();
    previousFocus = link;
    heading.textContent = video[1];
    const frame = document.createElement('iframe');
    frame.title = video[1];
    frame.src = `https://www.youtube-nocookie.com/embed/${video[0]}?autoplay=1&rel=0`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    player.replaceChildren(frame);
    dialog.showModal();
  });
})();
