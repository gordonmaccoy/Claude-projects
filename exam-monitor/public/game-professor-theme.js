(() => {
 'use strict';
 const key='exam-monitor-theme',toggle=document.getElementById('game-theme-toggle');
 if(!toggle)return;
 function apply(value){
  const blue=value==='dark';
  document.documentElement.dataset.theme=blue?'dark':'light';
  toggle.setAttribute('aria-pressed',String(blue));
  toggle.textContent=blue?'Theme: Blue':'Theme: White';
 }
 try{apply(localStorage.getItem(key));}catch{apply('light');}
 toggle.onclick=()=>{
  const value=document.documentElement.dataset.theme==='dark'?'light':'dark';
  apply(value);try{localStorage.setItem(key,value);}catch{}
 };
 addEventListener('storage',event=>{if(event.key===key)apply(event.newValue);});
})();
