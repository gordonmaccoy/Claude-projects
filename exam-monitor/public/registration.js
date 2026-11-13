(function(){
'use strict';
window.createExamioRegistration=function({auth,api,onComplete}){
 const $=id=>document.getElementById(id),t=text=>window.examioLanguage?.t(text)||text;
 const root=$('registration'),signup=new URLSearchParams(location.search).has('signup');
 let step=1,session=null,busy=false,pendingEmail='',saving=null;
 const message=text=>{$('reg-message').textContent=t(text||'');};
 function show(){root.hidden=false;$('login').hidden=true;$('workspace').hidden=true;}
 function page(number){step=number;show();$('registration-wizard').hidden=false;$('registration-verify').hidden=true;root.querySelectorAll('[data-registration-step]').forEach(el=>el.hidden=Number(el.dataset.registrationStep)!==step);root.querySelectorAll('[data-registration-indicator]').forEach(el=>{el.setAttribute('aria-current',Number(el.dataset.registrationIndicator)===step?'step':'false');el.classList.toggle('complete',Number(el.dataset.registrationIndicator)<step);});$('reg-previous').hidden=step===1;$('reg-next').hidden=step===3;$('reg-finish').hidden=step!==3;message('');$('registration-title').focus();}
 function input(id){return $(id).value.trim();}
 function profile(){return {firstName:input('reg-first-name'),lastName:input('reg-last-name'),institution:input('reg-institution'),organizationType:input('reg-organization'),role:input('reg-role'),phone:input('reg-phone'),termsAccepted:$('reg-terms').checked};}
 function validStep(){
  for(const el of root.querySelector(`[data-registration-step="${step}"]`).querySelectorAll('input,select')){if(!el.disabled&&!el.checkValidity()){el.reportValidity();return false;}}
  if(step===1&&!session){if(input('reg-email').toLowerCase()!==input('reg-email-confirm').toLowerCase()){message('Email addresses must match.');$('reg-email-confirm').focus();return false;}if($('reg-password').value!==$('reg-password-confirm').value){message('Passwords must match.');$('reg-password-confirm').focus();return false;}}
  return true;
 }
 async function run(fn){if(busy)return;busy=true;message('');root.setAttribute('aria-busy','true');root.querySelectorAll('button').forEach(el=>el.disabled=true);try{await fn();}catch(error){message(error.message||'Unable to complete this request. Please try again.');}finally{busy=false;root.removeAttribute('aria-busy');root.querySelectorAll('button').forEach(el=>el.disabled=false);$('reg-resend').disabled=Date.now()<resendAt;}}
 function verification(email){pendingEmail=email;show();$('registration-wizard').hidden=true;$('registration-verify').hidden=false;$('reg-verification-email').textContent=email;$('reg-code').value='';$('reg-code').focus();}
 async function save(data){if(!saving)saving=api('/registration','POST',data).finally(()=>{saving=null;});await saving;history.replaceState(null,'','/professor.html');pendingEmail='';root.hidden=true;onComplete();}
 async function resume(next){
  session=next;if(!session)return false;
  if(busy)return true;
  const settings=await api('/settings'),existing=settings.profile||{};
  if(existing.registrationComplete||existing.firstName||settings.registrationRequired===false){root.hidden=true;return false;}
  const registration=session.user?.user_metadata?.examio_registration;
  if(registration?.termsAccepted===true){await save(registration);return true;}
  const meta=session.user?.user_metadata||{};
  $('reg-first-name').value=meta.given_name||meta.full_name?.split(' ')[0]||'';$('reg-last-name').value=meta.family_name||'';
  $('reg-email').value=session.user?.email||'';$('reg-credentials').hidden=true;$('reg-google').hidden=true;
  $('reg-credentials').querySelectorAll('input').forEach(el=>el.disabled=true);page(1);return true;
 }
 let resendAt=0;
 function cooldown(){resendAt=Date.now()+60000;$('reg-resend').disabled=true;setTimeout(()=>{if(!busy)$('reg-resend').disabled=false;},60000);}
 $('reg-next').onclick=()=>{if(validStep())page(step+1);};$('reg-previous').onclick=()=>page(step-1);
 $('registration-form').onsubmit=event=>{event.preventDefault();if(!validStep())return;if(step!==3){page(step+1);return;}run(async()=>{
  const data=profile();if(session)return save(data);
  const email=input('reg-email').toLowerCase();
  const response=await auth.auth.signUp({email,password:$('reg-password').value,options:{emailRedirectTo:location.origin+'/professor.html',data:{examio_registration:data}}});
  if(response.error)throw response.error;
  $('reg-password').value='';$('reg-password-confirm').value='';
  if(response.data?.session){session=response.data.session;return save(data);}
  verification(email);cooldown();
 });};
 $('reg-verify-form').onsubmit=event=>{event.preventDefault();run(async()=>{
  if(session)return save(session.user?.user_metadata?.examio_registration||profile());
  const response=await auth.auth.verifyOtp({email:pendingEmail,token:input('reg-code'),type:'email'});if(response.error)throw response.error;
  if(!response.data?.session)throw Error('Verification could not be confirmed. Please try again.');
  session=response.data.session;await save(session.user?.user_metadata?.examio_registration||profile());
 });};
 $('reg-resend').onclick=()=>{if(Date.now()<resendAt)return;run(async()=>{const {error}=await auth.auth.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:location.origin+'/professor.html'}});if(error)throw error;cooldown();message('A new verification email has been sent. Check your spam folder too.');});};
 $('reg-google').onclick=()=>run(async()=>{const {error}=await auth.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/professor.html?signup=1'}});if(error)throw error;});
 if(signup)page(1);
 return {resume,reset(){session=null;root.hidden=true;$('reg-password').value='';$('reg-password-confirm').value='';$('reg-code').value='';}};
};
})();
