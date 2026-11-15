(function(root){
 'use strict';
 function create(frame,Observer=root.ResizeObserver){
  let active=false,observer,main;
  function disconnect(){observer?.disconnect();observer=null;main=null;}
  function update(){
   if(!active||!main)return;
   const height=Math.ceil(main.getBoundingClientRect().height);
   if(height>0)frame.style.height=height+'px';
  }
  frame.addEventListener('load',()=>{
   disconnect();
   if(frame.getAttribute('src')!=='/game-library.html?embedded=1')return;
   try{main=frame.contentDocument?.querySelector('main');}catch{return;}
   if(!main)return;
   if(Observer){observer=new Observer(update);observer.observe(main);}
   update();
  });
  return {
   setActive(next){active=next;if(!active)return;
    if(frame.getAttribute('src')!=='/game-library.html?embedded=1')frame.setAttribute('src','/game-library.html?embedded=1');
    else update();
   },
   reset(){active=false;disconnect();frame.setAttribute('src','about:blank');frame.style.height='';}
  };
 }
 const api={create};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.ExamioGameWorkspace=api;
})(globalThis);
