(function(root){
 'use strict';
 function create(frame,Observer=root.ResizeObserver){
  let active=false,observer,main,immersive=false,previousOverflow;
  function disconnect(){observer?.disconnect();observer=null;main=null;}
  function update(){
   if(!active||!main||immersive)return;
   const height=Math.ceil(main.getBoundingClientRect().height);
   if(height>0)frame.style.height=height+'px';
  }
  function expand(open){
   if(immersive===open)return;immersive=open;
   if(open){previousOverflow=root.document.body.style.overflow;root.document.body.style.overflow='hidden';Object.assign(frame.style,{position:'fixed',inset:'0',width:'100vw',height:'100dvh',zIndex:'10000',background:'#0b2540'});}
   else{root.document.body.style.overflow=previousOverflow||'';for(const key of ['position','inset','width','zIndex','background'])frame.style[key]='';update();}
  }
  root.addEventListener?.('message',event=>{if(event.origin!==root.location?.origin||event.source!==frame.contentWindow||event.data?.type!=='examio-game-editor')return;expand(active&&event.data.open===true);});
  frame.addEventListener('load',()=>{
   expand(false);disconnect();
   if(frame.getAttribute('src')!=='/game-library.html?embedded=1')return;
   try{main=frame.contentDocument?.querySelector('main');}catch{return;}
   if(!main)return;
   if(Observer){observer=new Observer(update);observer.observe(main);}
   update();
  });
  return {
   setActive(next){active=next;if(!active){expand(false);return;}
    if(frame.getAttribute('src')!=='/game-library.html?embedded=1')frame.setAttribute('src','/game-library.html?embedded=1');
    else update();
   },
   reset(){expand(false);active=false;disconnect();frame.setAttribute('src','about:blank');frame.style.height='';}
  };
 }
 const api={create};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.ExamioGameWorkspace=api;
})(globalThis);
