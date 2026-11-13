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
})();
