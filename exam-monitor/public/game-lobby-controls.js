(function(root){
  'use strict';
  function create({qrButton,qrImage,qrDialog,enlargedQr,closeQr,speaker,soundPanel,audioToggle,autoEnable,document}){
    let firstOpen=true;
    function closeSound(restoreFocus=false){
      if(soundPanel.hidden)return;
      soundPanel.hidden=true;
      speaker.setAttribute('aria-expanded','false');
      if(restoreFocus&&!speaker.closest?.('[hidden]'))speaker.focus();
    }
    function setQr(src){
      qrButton.hidden=!src;
      if(!src){
        if(qrDialog.open)qrDialog.close();
        return;
      }
      if(qrImage.getAttribute('src')!==src)qrImage.src=src;
    }
    qrButton.addEventListener('click',()=>{
      const src=qrImage.getAttribute('src');
      if(!src||qrButton.hidden||qrDialog.open)return;
      closeSound();
      enlargedQr.src=src;
      qrDialog.showModal();
    });
    closeQr.addEventListener('click',()=>qrDialog.close());
    qrDialog.addEventListener('click',event=>{if(event.target===qrDialog)qrDialog.close();});
    speaker.addEventListener('click',()=>{
      if(!soundPanel.hidden){closeSound();return;}
      soundPanel.hidden=false;
      speaker.setAttribute('aria-expanded','true');
      if(firstOpen){
        firstOpen=false;
        // Run in the original user gesture so the browser can unlock Web Audio.
        if(autoEnable())audioToggle.click();
      }
    });
    document.addEventListener('pointerdown',event=>{
      if(!speaker.contains(event.target)&&!soundPanel.contains(event.target))closeSound();
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!qrDialog.open)closeSound(true);
    });
    return {setQr,closeSound};
  }
  const api={create};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GameLobbyControls=api;
})(globalThis);
