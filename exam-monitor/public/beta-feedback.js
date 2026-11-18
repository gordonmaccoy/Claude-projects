(()=>{'use strict';
 window.createExamioBetaFeedback=({api})=>{
  const $=id=>document.getElementById(id),form=$('beta-form'),button=$('beta-send'),status=$('beta-status');
  let owner=null,epoch=0,requestId=null,lastContent='';
  function reset(){owner=null;epoch++;requestId=null;lastContent='';form.reset();status.textContent='';button.disabled=false;}
  function setAccount(account){if(owner!==account.id){reset();owner=account.id;}}
  form.onsubmit=async event=>{
   event.preventDefault();if(!owner||button.disabled)return;
   const current=epoch,stage=$('beta-stage').value,ease=$('beta-ease').value,worked=$('beta-worked').value.trim(),improve=$('beta-improve').value.trim();
   if(!stage||!ease||!improve){status.textContent='Choose a stage and ease rating, and tell us what to improve.';return;}
   const body={category:$('beta-category').value,subject:'[Beta feedback] '+stage,message:`Stage: ${stage}\nEase: ${ease}\n\nWhat worked:\n${worked||'Not provided'}\n\nWhat to improve:\n${improve}`};
   const content=JSON.stringify(body);if(content!==lastContent){lastContent=content;requestId=crypto.randomUUID();}
   button.disabled=true;status.textContent='Sending…';
   try{await api('/contact','POST',{...body,requestId});if(current!==epoch)return;form.reset();requestId=null;lastContent='';status.textContent='Thank you! Your feedback has been sent to the Examio team.';}
   catch(error){if(current===epoch)status.textContent=error.message||'Unable to send. Your feedback is still here; please retry.';}
   finally{if(current===epoch)button.disabled=false;}
  };
  return {reset,setAccount};
 };
})();
