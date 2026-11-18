window.createOnScreenTour=function(api){
 'use strict';
 const dialog=document.getElementById('tour-dialog'),replay=document.getElementById('take-tour'),catalog=window.examioVideoTours||[];
 let seen=false,busy=false,epoch=0,previousFocus=null,selected=null;
 function el(tag,text,id){const node=document.createElement(tag);if(text)node.textContent=text;if(id)node.id=id;return node;}
 dialog.classList.add('motion-tour-dialog');dialog.replaceChildren();
 const header=el('div');header.className='motion-tour-header';header.append(el('p','EXAMIO · VIDEO TOURS'));
 const close=el('button','Close','tour-skip');close.type='button';close.setAttribute('aria-label','Close video tours');header.append(close);
 const nav=el('nav',null,'tour-picker');nav.setAttribute('aria-label','Choose a video tour');
 const title=el('h2',null,'tour-heading');title.tabIndex=-1;const body=el('p','Caption-only walkthroughs using fictional classroom data.','tour-body');
 const video=el('video',null,'tour-video');video.controls=true;video.playsInline=true;video.preload='none';video.setAttribute('aria-label','Examio video walkthrough');
 const mediaError=el('p','Video unavailable. Read the transcript below or try the download link.','tour-media-error');mediaError.hidden=true;mediaError.setAttribute('role','status');
 const download=el('a','Download video','tour-download');download.setAttribute('download','');
 const transcript=el('details',null,'tour-transcript');transcript.append(el('summary','Read the steps'));const list=el('ol');transcript.append(list);
 const error=el('p',null,'tour-error');error.setAttribute('role','alert');
 dialog.append(header,nav,title,body,video,mediaError,download,transcript,error);dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',body.id);
 function stop(){video.pause();}
 function select(id){const tour=catalog.find(t=>t.id===id)||catalog[0];if(!tour)return;stop();selected=tour.id;title.textContent=tour.title;video.poster=tour.poster;video.src=tour.src;video.load();mediaError.hidden=true;download.href=tour.src;download.download=tour.id+'.mp4';transcript.open=false;list.replaceChildren(...tour.steps.map(step=>el('li',step)));for(const button of nav.children)button.setAttribute('aria-pressed',String(button.dataset.tourId===selected));}
 for(const tour of catalog){const button=el('button',tour.label||tour.title);button.type='button';button.dataset.tourId=tour.id;button.onclick=()=>select(tour.id);nav.append(button);}
 video.addEventListener('error',()=>{mediaError.hidden=false;});
 function open(id){if(dialog.open)return;previousFocus=document.activeElement;error.textContent='';select(id||replay.dataset.tour||'launch');dialog.showModal();title.focus();}
 async function finish(){if(busy)return;stop();busy=true;close.disabled=true;const version=epoch;error.textContent='';try{await api('/onboarding/dismiss','POST',{});if(version!==epoch)return;dialog.close();const focus=previousFocus?.isConnected&&!previousFocus.closest('[hidden]')?previousFocus:replay;if(!focus.closest('[hidden]'))focus.focus();}catch(e){if(version===epoch)error.textContent=e.message||'Could not save your tour preference. Please try again.';}finally{if(version===epoch){busy=false;close.disabled=false;}}}
 close.onclick=finish;replay.onclick=()=>open();dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});dialog.addEventListener('close',stop);
 return {open,offer(state){if(!seen&&!state.tourDismissed){seen=true;open('launch');}},reset(){epoch++;stop();video.removeAttribute('src');video.load();seen=false;busy=false;close.disabled=false;previousFocus=null;if(dialog.open)dialog.close();}};
};
