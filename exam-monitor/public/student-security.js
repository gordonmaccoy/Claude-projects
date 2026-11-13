// Browser deterrents are scoped to a running activity and the server's effective policy.
window.examioStudentSecurity=function({document,window,root,button,status,report,t=value=>value}) {
 let active=false,testActive=false,policy={},focused=true,fullscreen=Boolean(document.fullscreenElement);
 const enabled=key=>active&&policy.enabled===true&&policy[key]===true;
 const inside=node=>Boolean(node&&root.contains(node.nodeType===1?node:node.parentElement));
 function selectionInside(){
  const selection=window.getSelection();
  if(!selection||selection.isCollapsed)return false;
  for(let i=0;i<selection.rangeCount;i++)if(selection.getRangeAt(i).intersectsNode(root))return true;
  return false;
 }
 for(const name of ['copy','cut','paste'])document.addEventListener(name,event=>{
  if(testActive&&enabled('copyPaste')&&(inside(event.target)||(name!=='paste'&&selectionInside())))event.preventDefault();
 });
 for(const name of ['contextmenu','dragstart'])root.addEventListener(name,event=>{
  const element=event.target?.nodeType===1?event.target:event.target?.parentElement;
  const questionText=Boolean(element?.closest('.tq-text, .tq-opt-text, .tq-opt-letter'));
  if(testActive&&(enabled('copyPaste')||(enabled('textSelection')&&questionText)))event.preventDefault();
 });
 function focusChange(next){
  if(focused===next)return;
  focused=next;
  if(enabled('focusVisibility'))report(next?'focus-returned':'focus-lost');
 }
 window.addEventListener('blur',()=>focusChange(false));
 window.addEventListener('focus',()=>focusChange(true));
 function renderFullscreen(){
  button.hidden=!enabled('fullscreen')||Boolean(document.fullscreenElement);
  button.disabled=!document.documentElement.requestFullscreen||document.fullscreenEnabled===false;
  button.textContent=t('Enter fullscreen');
  if(!button.hidden&&button.disabled)status.textContent=t('Fullscreen is unavailable in this browser. You can continue.');
 }
 document.addEventListener('fullscreenchange',()=>{
  const next=Boolean(document.fullscreenElement);
  if(next!==fullscreen){status.textContent='';fullscreen=next;if(enabled('fullscreen'))report(next?'fullscreen-entered':'fullscreen-exit');}
  renderFullscreen();
 });
 button.addEventListener('click',async()=>{
  if(!enabled('fullscreen'))return;
  status.textContent='';
  try{await document.documentElement.requestFullscreen();status.textContent='';}
  catch{status.textContent=t('Fullscreen could not be opened. You can continue or try again.');}
 });
 return {update(view){
  const wasFocus=enabled('focusVisibility'),wasFullscreen=enabled('fullscreen');
  active=view?.phase==='running'&&!view.failed&&!view.result&&!view.completed&&!view.terminal;
  testActive=active&&view.mode==='test';policy=view?.security||{};
  root.classList.toggle('test-copy-guard',testActive&&enabled('textSelection'));
  // Reset baselines without reporting changes caused by inactive screens or policy changes.
  if(enabled('focusVisibility')&&!wasFocus){focused=typeof document.hasFocus==='function'?document.hasFocus():true;if(!focused)report('focus-lost');}
  if(enabled('fullscreen')&&!wasFullscreen){fullscreen=Boolean(document.fullscreenElement);if(fullscreen)report('fullscreen-entered');}
  if(wasFullscreen!==enabled('fullscreen'))status.textContent='';
  renderFullscreen();
 }};
};
