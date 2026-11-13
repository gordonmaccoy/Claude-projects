(()=>{
 const t=text=>window.examioLanguage?.t(text)||text;
 for(const menu of document.querySelectorAll('.features-menu')){
  document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false;});
  menu.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus();event.preventDefault();}});
  menu.addEventListener('focusout',event=>{if(event.relatedTarget&&!menu.contains(event.relatedTarget))menu.open=false;});
 }
 for(const switcher of document.querySelectorAll('.fp-view-switcher')){
  for(const button of switcher.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{
   for(const choice of switcher.querySelectorAll('[data-view]'))choice.setAttribute('aria-pressed',String(choice===button));
   for(const panel of switcher.querySelectorAll('[data-view-panel]'))panel.hidden=panel.dataset.viewPanel!==button.dataset.view;
  });
 }
 for(const figure of document.querySelectorAll('[data-animation]')){
  const image=figure.querySelector('img'),button=figure.querySelector('[data-motion-toggle]'),canvas=document.createElement('canvas');let paused=false;
  canvas.hidden=true;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',image.alt);image.after(canvas);button.hidden=false;button.setAttribute('aria-pressed','false');
  function pause(value){
   if(value&&(!image.complete||!image.naturalWidth))return;
   if(value){canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);}
   paused=value;canvas.hidden=!value;image.hidden=value;button.textContent=t(value?'Play animation':'Pause animation');button.setAttribute('aria-pressed',String(value));
  }
  button.addEventListener('click',()=>pause(!paused));
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function respectMotion(){if(reduced.matches){if(image.complete&&image.naturalWidth)pause(true);else image.addEventListener('load',()=>pause(true),{once:true});}}
  respectMotion();reduced.addEventListener('change',respectMotion);
 }
 const screenshots=document.querySelectorAll('[data-screenshot]');
 if(screenshots.length){
  const dialog=document.createElement('dialog'),image=document.createElement('img'),close=document.createElement('button');let trigger;
  dialog.className='fp-lightbox';dialog.setAttribute('aria-label',t('Screenshot preview'));close.type='button';close.textContent='×';close.setAttribute('aria-label',t('Close screenshot'));dialog.append(close,image);document.body.append(dialog);
  for(const button of screenshots){button.setAttribute('aria-label',t('Enlarge screenshot')+': '+button.querySelector('img').alt);button.addEventListener('click',()=>{const source=button.querySelector('img');trigger=button;image.src=source.src;image.alt=source.alt;dialog.showModal();});}
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>trigger?.focus());dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
 }
})();
