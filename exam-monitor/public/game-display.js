(async()=>{
 const {status,json,render}=GameClient;const [id,displayToken]=location.hash.slice(1).split('/').map(decodeURIComponent);if(!id||!displayToken){status('Open the classroom display from the game host page.',true);return;}
 let stopped=false;async function poll(){try{const view=await json('/game-api/'+encodeURIComponent(id)+'/display',{displayToken});render(view);status('');}catch(e){status(e.status===404?'This game has ended or expired.':e.message,true);if([403,404,410].includes(e.status))stopped=true;}finally{if(!stopped)setTimeout(poll,1000);}}await poll();
})();
