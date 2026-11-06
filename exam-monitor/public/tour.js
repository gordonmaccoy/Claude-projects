window.createOnScreenTour=function(api){
 const byId=id=>document.getElementById(id);
 const dialog=byId('tour-dialog'),next=byId('tour-next'),back=byId('tour-back'),skip=byId('tour-skip'),replay=byId('take-tour'),error=byId('tour-error');
 const image=byId('tour-image'),stage=byId('tour-stage'),target=byId('tour-target'),action=byId('tour-action');
 const scenes=[
  {title:'Launch a practice test',screen:'Professor · laptop',frames:[['launch','Click Launch test ↗.','Launch test ↗']]},
  {title:'Choose your settings',screen:'Professor · laptop',frames:[['settings','Click Launch test. The class display opens in a separate window.','Launch test']]},
  {title:'Put this window on the projector',screen:'Classroom · public display',frames:[['classroom','Click the QR code to enlarge it.','Enlarge QR'],['classroom-expanded','Students scan your live QR. This example code is only a demo.']],next:'See student view'},
  {title:'Students join on a phone or tablet',screen:'Student · phone / tablet',phone:true,frames:[['student-join','Students enter their number and name. Click Join.','Join']]},
  {title:'Keep this screen on your laptop',screen:'Professor · private dashboard',frames:[['professor-start','When everyone has joined, click Start test.','Start test']]},
  {title:'Try the student test',screen:'Student · phone / tablet',phone:true,frames:[['student-question','Keep this page visible—over 5 seconds away means FAIL. Click 4.','4'],['student-submit','Click Submit test.','Submit test'],['student-confirm','Students confirm before submitting. Click Submit.','Submit']]},
  {title:'Students see a submission receipt',screen:'Student · phone / tablet',phone:true,frames:[['student-receipt','Monitoring stops after submission. Scores appear if Show final score is enabled.']],next:'See professor view'},
  {title:'Scores and progress stay private',screen:'Professor · private dashboard',frames:[['professor-scores','Only you see numbers, progress and scores. Click End session.','End session'],['results','The session is now in Results. Click Download Excel.','Download Excel'],['results','That’s it. Your real tests and results are ready when you are.']]}
 ];
 let index=0,phase=0,seen=false,busy=false,epoch=0,previousFocus=null,renderId=0;
 function render(){
  const scene=scenes[index],frame=scene.frames[phase],id=++renderId;
  byId('tour-step').textContent=(index+1)+' of '+scenes.length;byId('tour-screen').textContent=scene.screen;
  byId('tour-heading').textContent=scene.title;byId('tour-body').textContent=frame[1];stage.classList.toggle('phone',!!scene.phone);
  back.disabled=(index===0&&phase===0)||busy;skip.disabled=busy;next.disabled=busy;next.hidden=!!frame[2];next.textContent=index===scenes.length-1?'Get started':scene.next||'Next';
  action.hidden=!frame[2];action.textContent=frame[2]||'';action.disabled=busy;target.hidden=true;target.disabled=busy;
  target.setAttribute('aria-label','Demo: '+(frame[2]||''));image.alt=scene.screen+' — '+scene.title+' (example screenshot)';
  const bounds=window.onScreenTourFrames?.[frame[0]];
  function loaded(){if(id!==renderId)return;stage.classList.remove('unavailable');if(bounds&&frame[2]){target.style.left=bounds.x+'%';target.style.top=bounds.y+'%';target.style.width=bounds.w+'%';target.style.height=bounds.h+'%';target.hidden=false;}}
  image.onload=loaded;image.onerror=()=>{if(id!==renderId)return;stage.classList.add('unavailable');target.hidden=true;};
  image.src='/tour/'+frame[0]+'.png';if(image.complete&&image.naturalWidth)loaded();
  if(!busy)byId('tour-heading').focus();
 }
 function open(){if(dialog.open)return;previousFocus=document.activeElement;index=phase=0;error.textContent='';dialog.showModal();render();}
 async function finish(){
  if(busy)return;busy=true;const version=epoch;error.textContent='';render();
  try{await api('/onboarding/dismiss','POST',{});if(version!==epoch)return;dialog.close();if(previousFocus?.isConnected&&!previousFocus.closest('[hidden]'))previousFocus.focus();else replay.focus();}
  catch(e){if(version===epoch)error.textContent=e.message||'Could not save your tour preference. Please try again.';}
  finally{if(version===epoch){busy=false;if(dialog.open)render();}}
 }
 function activate(){if(busy)return;if(phase<scenes[index].frames.length-1)phase++;else{index++;phase=0;}render();}
 target.onclick=action.onclick=activate;
 back.onclick=()=>{if(busy)return;if(phase>0)phase--;else if(index>0){index--;phase=0;}render();};
 next.onclick=()=>{if(busy||scenes[index].frames[phase][2])return;if(index===scenes.length-1)finish();else{index++;phase=0;render();}};
 skip.onclick=finish;replay.onclick=open;
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
 return {offer(state){if(!seen&&!state.tourDismissed){seen=true;open();}},reset(){epoch++;renderId++;seen=false;busy=false;previousFocus=null;if(dialog.open)dialog.close();}};
};
