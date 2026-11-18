(function(root){
 'use strict';
 const themes=['default','summer','korea','tropical-beach','winter','cyberpunk','christmas','autumn','clean-professional','retro-arcade','deep-ocean','desert-sunset','forest-cabin','art-deco','space-mission-control','spring-garden','sports-arena','fireworks','shades-of-blue','shades-of-pink','shades-of-green','shades-of-purple'];
 const theme=value=>themes.includes(value)?value:'default';
 const clamp=(v,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:fallback));
 function defaults(q){const hasImage=Boolean(q.image),count=q.options?.length||4,rows=Math.max(2,Math.ceil(count/2)),top=hasImage?64:40,height=hasImage?30:50;const boxes={prompt:{x:4,y:5,w:92,h:hasImage?16:24,fontSize:40},image:{x:27,y:23,w:46,h:36,fontSize:24}};
  (q.options||[]).forEach((o,i)=>boxes['answer:'+o.id]={x:4+(i%2)*47,y:top+Math.floor(i/2)*(height/rows+2),w:45,h:height/rows-2,fontSize:30});return boxes;
 }
 function normalize(value,q){const boxes=defaults(q);for(const key of Object.keys(boxes)){const b=value?.boxes?.[key];if(!b||typeof b!=='object')continue;const w=clamp(b.w,8,100,boxes[key].w),h=clamp(b.h,5,100,boxes[key].h);boxes[key]={x:clamp(b.x,0,100-w,boxes[key].x),y:clamp(b.y,0,100-h,boxes[key].y),w,h,fontSize:clamp(b.fontSize,12,96,boxes[key].fontSize)};}return {boxes};}
 function sanitize(value,q){const normalized=normalize(value,q),boxes={};for(const key of Object.keys(value?.boxes||{}))if(Object.hasOwn(normalized.boxes,key))boxes[key]=normalized.boxes[key];return {boxes};}
 function fitText(surface){
  if(!surface.isConnected||!surface.clientWidth)return;
  for(const node of surface.querySelectorAll('.game-slide-box:not(.presentation-image)')){
   const content=node.querySelector('textarea,.question-text,.presentation-answer-text');if(!content)continue;
   const target=Number(node.dataset.fontSize)||30;let size=target;node.style.fontSize=(size/12.8)+'cqw';
   for(let i=0;i<45;i++){const style=getComputedStyle(node),availableHeight=node.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom),availableWidth=content.clientWidth;if(content.scrollHeight<=availableHeight+1&&content.scrollWidth<=availableWidth+1)break;size*=.92;node.style.fontSize=(size/12.8)+'cqw';}
  }
 }
 function themeStyle(node,id){id=theme(id);node.dataset.gameTheme=id;node.style.setProperty('--game-theme-image',id==='default'?"url('/game-classroom-backdrop.svg')":"url('/game-themes/"+id+".png')");}
 function applyBox(node,b){node.style.left=b.x+'%';node.style.top=b.y+'%';node.style.width=b.w+'%';node.style.height=b.h+'%';node.dataset.fontSize=b.fontSize;node.style.fontSize=(b.fontSize/12.8)+'cqw';requestAnimationFrame(()=>{const surface=node.closest('.game-slide-surface');if(surface)fitText(surface);});}
 function create({question:q,theme:themeId='default',mode='question',onText,onCorrect,onSelect,onLayout}){
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const surface=el('div',undefined,'game-slide-surface');themeStyle(surface,themeId);const layout=normalize(q.presentation,q),editing=mode==='edit';surface.dataset.mode=mode;
  function box(key,cls){const n=el('div',undefined,'game-slide-box '+cls);n.dataset.box=key;applyBox(n,layout.boxes[key]);surface.append(n);
   if(editing){n.addEventListener('pointerdown',()=>{surface.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));n.classList.add('selected');onSelect?.(key);});
    const drag=el('button','✥','slide-box-drag');drag.type='button';drag.setAttribute('aria-label','Move '+(key==='prompt'?'question':key==='image'?'image':'answer'));const resize=el('button','↘','slide-box-resize');resize.type='button';resize.setAttribute('aria-label','Resize '+(key==='prompt'?'question':key==='image'?'image':'answer'));n.append(drag,resize);
    for(const [handle,resizing] of [[drag,false],[resize,true]]){handle.onpointerdown=e=>{e.preventDefault();handle.setPointerCapture(e.pointerId);Object.assign(layout.boxes,normalize(q.presentation,q).boxes);const start={...layout.boxes[key]},rect=surface.getBoundingClientRect(),x=e.clientX,y=e.clientY;
      handle.onpointermove=event=>{const dx=(event.clientX-x)/rect.width*100,dy=(event.clientY-y)/rect.height*100;layout.boxes[key]=resizing?{...start,w:clamp(start.w+dx,8,100-start.x,start.w),h:clamp(start.h+dy,5,100-start.y,start.h)}:{...start,x:clamp(start.x+dx,0,100-start.w,start.x),y:clamp(start.y+dy,0,100-start.h,start.y)};applyBox(n,layout.boxes[key]);onLayout?.(structuredClone(layout));};
      const finish=()=>{handle.onpointermove=null;handle.onpointerup=null;handle.onpointercancel=null;};handle.onpointerup=finish;handle.onpointercancel=finish;
     };
     handle.onkeydown=e=>{const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!direction)return;e.preventDefault();onSelect?.(key);Object.assign(layout.boxes,normalize(q.presentation,q).boxes);const b=layout.boxes[key],step=e.shiftKey?5:1;const candidate=resizing?{...b,w:b.w+direction[0]*step,h:b.h+direction[1]*step}:{...b,x:b.x+direction[0]*step,y:b.y+direction[1]*step};layout.boxes[key]=normalize({boxes:{[key]:candidate}},q).boxes[key];applyBox(n,layout.boxes[key]);onLayout?.(structuredClone(layout));};
    }
   }return n;
  }
  const prompt=box('prompt','presentation-prompt');if(editing){const input=el('textarea');input.value=q.text;input.placeholder='Type your question';input.maxLength=1000;input.setAttribute('aria-label','Question');input.oninput=()=>{onText?.('prompt',input.value);fitText(surface);};prompt.append(input);}else prompt.append(el('h2',q.text||'Untitled question','question-text'));
  if(q.image){const image=box('image','presentation-image'),img=document.createElement('img');img.src=q.image;img.alt='Question image';image.append(img);}
  if(mode!=='countdown')q.options.forEach((o,i)=>{const choice=box('answer:'+o.id,'presentation-answer option-edit preview-answer choice choice-'+i);choice.dataset.choice=i;choice.append(el('span',['▲','◆','●','■','★'][i],'choice-symbol'));
   if(editing){const input=el('textarea');input.value=o.text;input.placeholder='Answer '+String.fromCharCode(65+i);input.maxLength=500;input.setAttribute('aria-label','Answer '+String.fromCharCode(65+i));input.oninput=()=>{onText?.('answer:'+o.id,input.value);fitText(surface);};choice.append(input);const radio=el('input');radio.type='radio';radio.name='slide-correct-'+q.id;radio.checked=o.id===q.correctOptionId;radio.setAttribute('aria-label','Correct answer '+String.fromCharCode(65+i));radio.onchange=()=>{surface.querySelectorAll('.is-correct').forEach(n=>n.classList.remove('is-correct'));choice.classList.add('is-correct');onCorrect?.(o.id);};choice.append(radio);if(radio.checked)choice.classList.add('is-correct');}
   else choice.append(el('span',o.text||'Empty answer','presentation-answer-text'));
   if(o.image){const img=el('img');img.src=o.image;img.alt='Answer '+String.fromCharCode(65+i)+' image';choice.append(img);}
   if(mode==='reveal'){if(o.id===q.correctOptionId){choice.classList.add('is-correct');choice.append(el('strong','✓','presentation-correct'));}if(q.counts){const total=Object.values(q.counts).reduce((a,b)=>a+b,0),count=q.counts[o.id]||0;choice.append(el('small',count+' · '+(total?Math.round(count/total*100):0)+'%','presentation-votes'));}}
  });const observer=new ResizeObserver(()=>fitText(surface));observer.observe(surface);surface.presentationObserver=observer;requestAnimationFrame(()=>fitText(surface));return surface;
 }
 const api={themes,theme,defaults,normalize,sanitize,themeStyle,applyBox,fitText,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GamePresentation=api;
})(globalThis);
