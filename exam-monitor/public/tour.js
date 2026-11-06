window.createOnScreenTour=function(api){
 const byId=id=>document.getElementById(id);
 const dialog=byId('tour-dialog'),next=byId('tour-next'),back=byId('tour-back'),skip=byId('tour-skip'),replay=byId('take-tour'),error=byId('tour-error');
 const steps=[
  ['Welcome to OnScreen','Try a classroom in a few minutes. New accounts include a two-question Practice Test: you can edit it, launch it, or delete it whenever you like. Each professor has a separate copy.'],
  ['Your test library','Library keeps reusable tests in class folders. Create questions manually, upload an existing PDF or Word test, or generate questions with AI. Review the proposed answers, set points, and save. AI options explain when material is sent and usage charges apply.'],
  ['Launch and join','In Launch, choose a test and set its time limit, score visibility, and answer shuffle. Students scan the classroom QR code and enter their student number and name. Let everyone join, then select Start test to open the questions and start the timer.'],
  ['Two screens, different views','Project only the classroom display: it shows the QR code, student names, and status—never student numbers or scores. Keep your professor dashboard private to see progress and scores. After a test starts, more than five seconds away locks the student with FAIL. Review the situation, then Unlock & continue or Submit Fail score. Submitted tests stop inactivity monitoring.'],
  ['Keep results organized','End the session to move it out of Tests In Session. In Results, review scores and grading decisions, rename results for each class section, download Excel, or delete unneeded results. You can replay this guide anytime with Take tour.']
 ];
 let index=0,seen=false,busy=false,epoch=0,previousFocus=null;
 function render(){byId('tour-step').textContent=`Step ${index+1} of ${steps.length}`;byId('tour-heading').textContent=steps[index][0];byId('tour-body').textContent=steps[index][1];back.disabled=index===0||busy;next.disabled=skip.disabled=busy;next.textContent=index===steps.length-1?'Get started':'Next';if(!busy)byId('tour-heading').focus();}
 function open(){if(dialog.open)return;previousFocus=document.activeElement;index=0;error.textContent='';dialog.showModal();render();}
 async function finish(){
  if(busy)return;busy=true;const version=epoch;error.textContent='';render();
  try{await api('/onboarding/dismiss','POST',{});if(version!==epoch)return;dialog.close();if(previousFocus?.isConnected&&!previousFocus.closest('[hidden]'))previousFocus.focus();else replay.focus();}
  catch(e){if(version===epoch)error.textContent=e.message||'Could not save your tour preference. Please try again.';}
  finally{if(version===epoch){busy=false;if(dialog.open)render();}}
 }
 back.onclick=()=>{if(!busy&&index>0){index--;render();}};
 next.onclick=()=>{if(busy)return;if(index===steps.length-1)finish();else{index++;render();}};
 skip.onclick=finish;replay.onclick=open;
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
 return {offer(state){if(!seen&&!state.tourDismissed){seen=true;open();}},reset(){epoch++;seen=false;busy=false;previousFocus=null;if(dialog.open)dialog.close();}};
};
