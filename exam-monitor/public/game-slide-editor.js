(function(root){
 'use strict';
 function duplicate(question){
  const copy=structuredClone(question),correct=copy.options.findIndex(o=>o.id===copy.correctOptionId);
  copy.id=crypto.randomUUID();copy.options.forEach(o=>o.id=crypto.randomUUID());
  copy.correctOptionId=copy.options[correct]?.id||'';return copy;
 }
 function mediaError(media){
  if(!['image','audio','video','youtube'].includes(media.type)||typeof media.url!=='string')return 'Choose a supported media type and URL.';
  const value=media.url.trim();
  if(media.type==='image'&&value.startsWith('data:'))return value.length<=180000&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?'':'Invalid embedded media image.';
  let url;try{url=new URL(value);if(value.length>2048||url.protocol!=='https:'||url.username||url.password)throw Error();}catch{return 'Enter a public HTTPS media URL (up to 2,048 characters).';}
  if(media.type==='youtube'){let id;if(['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname))id=url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.startsWith('/embed/')?url.pathname.slice(7):null;else if(url.hostname==='youtu.be')id=url.pathname.slice(1);if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))return 'Enter a valid YouTube video URL.';}
  return '';
 }
 function validate(questions){
  for(let index=0;index<questions.length;index++){
   const q=questions[index];let message='';
   if(!q.text?.trim())message='Enter the question.';
   else if(q.text.length>1000)message='Keep the question within 1,000 characters.';
   else if(q.options.length<2||q.options.length>5)message='Use 2–5 answer choices.';
   else if(q.options.some(o=>!o.text?.trim()||o.text.length>500))message='Enter each answer (up to 500 characters).';
   else if(q.answerKeyConflict||!q.options.some(o=>o.id===q.correctOptionId))message='Choose a correct answer';
   else if(!Number.isInteger(q.durationSeconds??20)||(q.durationSeconds??20)<5||(q.durationSeconds??20)>240)message='Set the timer between 5 and 240 seconds.';
   else if((q.answerExplanation||'').length>1000)message='Keep the explanation within 1,000 characters.';
   else if(q.media)message=mediaError(q.media);
   if(message)return {index,message};
  }
  return null;
 }
 function mount({getDraft,newQuestion,status}){
  const $=id=>document.getElementById(id),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const btn=(text,fn,cls)=>{const b=make('button',text,cls);b.type='button';b.onclick=fn;return b;};
  const label=(text,input)=>{const l=make('label',text);l.append(input);return l;};
  let selected=0,dragged=null;const pendingImages=new Map();
  const questions=()=>getDraft()?.questions||[];
  function rail(){
   $('slide-list').replaceChildren();questions().forEach((q,i)=>{
    const b=btn('',()=>select(i),'slide-thumb');b.setAttribute('aria-label','Question '+(i+1)+': '+(q.text||'Untitled question'));b.setAttribute('aria-current',String(i===selected));b.draggable=true;
    b.append(make('span',String(i+1).padStart(2,'0'),'slide-number'),make('strong',q.text||'Untitled question'));
    const mini=make('span',undefined,'slide-mini-answers');q.options.forEach(o=>mini.append(make('i',o.id===q.correctOptionId?'✓':'',o.id===q.correctOptionId?'is-correct':'')));b.append(mini,make('small',(q.durationSeconds||20)+' sec'+(!q.correctOptionId?' · Answer needed':'')));
    b.ondragstart=e=>{dragged=i;e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move';};
    b.ondragover=e=>{if(dragged!==null)e.preventDefault();};b.ondrop=e=>{e.preventDefault();if(dragged!==null)move(dragged,i);dragged=null;};b.ondragend=()=>dragged=null;
    $('slide-list').append(b);
   });$('slide-count').textContent=questions().length+' questions';
  }
  function move(from,to){const list=questions();if(to<0||to>=list.length||from===to)return;const [q]=list.splice(from,1);list.splice(to,0,q);selected=to;render();}
  function select(index){selected=Math.max(0,Math.min(index,questions().length-1));render();}
  function render(){
   $('editor-error').textContent='';const list=questions();if(!list.length)return;selected=Math.min(selected,list.length-1);rail();
   const q=list[selected],card=make('section',undefined,'question-card slide-canvas'),props=$('slide-properties');props.replaceChildren();$('questions').replaceChildren(card);
   const heading=make('div',undefined,'slide-canvas-heading');heading.append(make('span','QUESTION '+(selected+1),'eyebrow'),make('span','Multiple choice','slide-type'));card.append(heading);
   if(q.answerKeyConflict||!q.correctOptionId)card.append(make('p',q.answerKeyConflict?'Answer needs review. Check the question and choose the correct answer.':'Choose a correct answer before saving.','answer-review-warning'));
   const text=make('textarea');text.value=q.text;text.maxLength=1000;text.rows=2;text.placeholder='Type your question here';text.setAttribute('aria-label','Question');text.oninput=()=>{q.text=text.value;rail();};card.append(text);
   const mediaArea=make('div',undefined,'slide-image-area');
   if(q.image){const img=GameClient.picture(q.image);if(img)mediaArea.append(img);mediaArea.append(btn('Remove image',()=>{pendingImages.delete(q);delete q.image;render();}));}
   else mediaArea.append(make('span','▧','slide-image-icon'),make('strong','Bring your question to life'),make('small','Add an image, or keep it text-only.'));
   const upload=make('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.setAttribute('aria-label','Upload question image');upload.className='slide-file';
   upload.onchange=()=>{const file=upload.files?.[0];if(!file)return;if(file.size>130000||!['image/png','image/jpeg','image/webp'].includes(file.type)){status('Use a PNG, JPEG or WebP image up to 130 KB.',true);return;}
    const draft=getDraft(),reader=new FileReader();pendingImages.set(q,reader);
    reader.onload=()=>{if(pendingImages.get(q)!==reader)return;pendingImages.delete(q);if(getDraft()!==draft||!questions().includes(q))return;q.image=String(reader.result);render();};
    reader.onerror=()=>{if(pendingImages.get(q)!==reader)return;pendingImages.delete(q);status('Unable to load image.',true);};reader.readAsDataURL(file);
   };
   mediaArea.append(label(q.image?'Replace image':'Upload image',upload));card.append(mediaArea);
   const answerHeading=make('div',undefined,'slide-answer-heading');answerHeading.append(make('strong','Answers'),make('small','Select the circle beside the correct answer.'));card.append(answerHeading);
   const answers=make('div',undefined,'slide-answers');
   q.options.forEach((o,i)=>{
    const row=make('div',undefined,'option-edit slide-answer');row.dataset.choice=i;row.classList.toggle('is-correct',o.id===q.correctOptionId);
    const correct=make('input');correct.type='radio';correct.name='correct-'+q.id;correct.checked=o.id===q.correctOptionId;correct.setAttribute('aria-label','Correct answer '+String.fromCharCode(65+i));correct.onchange=()=>{q.correctOptionId=o.id;q.answerKeyConflict=false;card.querySelector('.answer-review-warning')?.remove();answers.querySelectorAll('.slide-answer').forEach((n,j)=>n.classList.toggle('is-correct',q.options[j].id===q.correctOptionId));rail();};
    const input=make('textarea');input.rows=2;input.maxLength=500;input.value=o.text;input.placeholder='Answer '+String.fromCharCode(65+i);input.setAttribute('aria-label','Answer '+String.fromCharCode(65+i));input.oninput=()=>o.text=input.value;
    const remove=btn('×',()=>{q.options.splice(i,1);if(q.correctOptionId===o.id)q.correctOptionId='';render();},'slide-remove-answer');remove.disabled=q.options.length<=2;remove.setAttribute('aria-label','Remove answer '+String.fromCharCode(65+i));const content=make('div',undefined,'slide-answer-content');content.append(input);const optionImage=GameClient.picture(o.image,'Answer '+String.fromCharCode(65+i)+' image');if(optionImage)content.append(optionImage);row.append(correct,content,remove);answers.append(row);
   });card.append(answers);if(q.options.length<5)card.append(btn('+ Add choice',()=>{q.options.push({id:crypto.randomUUID(),text:''});render();},'slide-add-choice'));
   props.append(make('h2','Question settings'));const timer=make('input');timer.type='number';timer.min=5;timer.max=240;timer.step=1;timer.value=q.durationSeconds??20;timer.oninput=()=>{q.durationSeconds=Number(timer.value);rail();};props.append(label('Seconds to answer',timer));
   const explanation=make('textarea');explanation.rows=4;explanation.maxLength=1000;explanation.value=q.answerExplanation||'';explanation.placeholder='Explain the correct answer';explanation.oninput=()=>q.answerExplanation=explanation.value;props.append(label('Explanation after reveal',explanation));
   const details=make('details');details.open=Boolean(q.media);details.append(make('summary','Media before question'));
   const type=make('select');for(const [v,t] of [['','None'],['image','Image'],['audio','Audio'],['video','Video'],['youtube','YouTube video']]){const o=make('option',t);o.value=v;type.append(o);}type.value=q.media?.type||'';
   const url=make('input');url.type='url';url.placeholder='https://…';url.value=q.media?.url||'';url.disabled=!type.value;
   function update(){url.disabled=!type.value;if(type.value)q.media={type:type.value,url:url.value.trim()};else delete q.media;}
   type.onchange=update;url.oninput=update;details.append(label('Media type',type),label('Public HTTPS media URL',url),make('small','Plays before the timer. The teacher controls playback. External providers receive playback requests.'));props.append(details);
   const tools=make('div',undefined,'slide-question-tools');const up=btn('↑ Move up',()=>move(selected,selected-1)),down=btn('↓ Move down',()=>move(selected,selected+1));up.disabled=selected===0;down.disabled=selected===list.length-1;
   const copy=btn('Duplicate question',()=>{if(list.length>=100){status('A game can contain up to 100 questions.',true);return;}list.splice(selected+1,0,duplicate(q));select(selected+1);});
   const remove=btn('Delete question',()=>{if(!confirm('Delete this question?'))return;pendingImages.delete(q);list.splice(selected,1);select(Math.min(selected,list.length-1));},'danger');remove.disabled=list.length===1;tools.append(up,down,copy,remove);props.append(tools);
  }
  function add(){if(questions().length>=100){status('A game can contain up to 100 questions.',true);return;}questions().push(newQuestion());select(questions().length-1);}
  function preview(){
   const snapshot=structuredClone(questions());if(!snapshot.length)return;let index=selected,reveal=false;const dialog=$('game-preview'),stage=$('preview-stage');
   function draw(){stage.replaceChildren();const q=snapshot[index];$('preview-position').textContent='Question '+(index+1)+' of '+snapshot.length;stage.append(make('small',(q.durationSeconds??20)+' seconds'),make('h2',q.text||'Untitled question'));const img=GameClient.picture(q.image);if(img)stage.append(img);
    if(q.media)stage.append(make('p','Includes '+q.media.type+' before this question.','preview-media-note'));
    const answers=make('div',undefined,'slide-answers');q.options.forEach((o,i)=>{const a=make('div',String.fromCharCode(65+i)+'. '+(o.text||'Empty answer'),'slide-answer preview-answer');a.dataset.choice=i;if(reveal&&o.id===q.correctOptionId){a.classList.add('is-correct');a.prepend(make('strong','✓ '));}const optionImage=GameClient.picture(o.image,'Answer '+String.fromCharCode(65+i)+' image');if(optionImage)a.append(optionImage);answers.append(a);});stage.append(answers);if(reveal&&q.answerExplanation)stage.append(make('p',q.answerExplanation));$('preview-back').disabled=index===0;$('preview-next').disabled=index===snapshot.length-1;$('preview-reveal').textContent=reveal?'Hide answer':'Show answer';
   }
   $('preview-back').onclick=()=>{index--;reveal=false;draw();};$('preview-next').onclick=()=>{index++;reveal=false;draw();};$('preview-reveal').onclick=()=>{reveal=!reveal;draw();};$('preview-close').onclick=()=>dialog.close();draw();dialog.showModal();
  }
  return {render,select,add,preview,isLoading:()=>pendingImages.size>0,reset(){selected=0;pendingImages.clear();}};
 }
 const api={duplicate,validate,mount};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GameSlideEditor=api;
})(globalThis);
