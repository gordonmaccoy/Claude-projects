/* Convert an imported/saved test into an independent, reviewable game draft. */
(function(root){
 'use strict';
 function fromSource(source,{title,folderId=null,compatibleOnly=false}={}){
  const test=source?.test??source;
  if(!test||!Array.isArray(test.questions)||!test.questions.length)throw new Error('The source has no questions to copy.');
  const name=title===undefined?(test.title??''):title;
  if(typeof name!=='string'||name.length>80)throw new Error('Use a game title of at most 80 characters.');
  if(folderId!==null&&(typeof folderId!=='string'||!folderId||folderId.length>100))throw new Error('Choose a valid game folder.');
  let omitted=0,unresolved=0,imageBytes=0;
  function image(value,where){
   if(value==null||value==='')return {};
   if(typeof value!=='string'||value.length>180000||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw new Error(where+': use an embedded PNG, JPEG or WebP image up to the supported size.');
   imageBytes+=value.length;if(imageBytes>600000)throw new Error('The combined question and answer images are too large for a game.');
   return {image:value};
  }
  const questions=[];
  for(const [index,q] of test.questions.entries()){
   const where='Question '+(index+1);
   if(!q||typeof q!=='object'||Array.isArray(q))throw new Error(where+' is malformed. Review the source before copying.');
   const compatible=q.type==='mc'||(q.type===undefined&&Array.isArray(q.options));
   if(!compatible){omitted++;continue;}
   if(!Array.isArray(q.options)||q.options.length<2||q.options.length>5)throw new Error(where+' needs 2–5 answer choices.');
   if(typeof q.text!=='string'||!q.text.trim()||q.text.length>1000)throw new Error(where+' needs question text of 1–1000 characters.');
   if(q.answerExplanation!=null&&(typeof q.answerExplanation!=='string'||q.answerExplanation.length>1000))throw new Error(where+' has an invalid or overly long explanation.');
   const options=q.options.map((o,i)=>{
    if(!o||typeof o!=='object'||Array.isArray(o)||typeof o.text!=='string'||!o.text.trim()||o.text.length>500)throw new Error(where+', answer '+(i+1)+' needs text of 1–500 characters.');
    return {id:root.crypto.randomUUID(),text:o.text,...image(o.image,where+', answer '+(i+1))};
   });
   const matches=typeof q.correctOptionId==='string'&&q.correctOptionId?q.options.map((o,i)=>o.id===q.correctOptionId?i:-1).filter(i=>i>=0):[];
   const correctOptionId=q.answerKeyConflict!==true&&matches.length===1?options[matches[0]].id:'';
   if(!correctOptionId)unresolved++;
   questions.push({id:root.crypto.randomUUID(),type:'mc',text:q.text,options,correctOptionId,durationSeconds:20,answerExplanation:q.answerExplanation??'',...(q.answerKeyConflict===true?{answerKeyConflict:true}:{}),...image(q.image,where)});
  }
  if(omitted&&!compatibleOnly)throw new Error('The source contains '+omitted+' non-multiple-choice question(s). Choose compatible-only copying to leave them out.');
  if(!questions.length)throw new Error('There are no multiple-choice questions to copy.');
  if(questions.length>100)throw new Error('A game can contain at most 100 multiple-choice questions.');
  return {draft:{title:name,folderId,questions},omitted,unresolved};
 }
 function applyAnswerReview(draft,reviewedTest){
  const reviewed=reviewedTest?.test??reviewedTest;
  const invalid=()=>{throw new Error('Answer review does not match the draft question or choice identities. Retry the review.');};
  if(!draft||!Array.isArray(draft.questions)||!reviewed||!Array.isArray(reviewed.questions)||reviewed.questions.length!==draft.questions.length)invalid();
  function index(rows){const map=new Map();for(const row of rows){if(!row||typeof row.id!=='string'||!row.id||map.has(row.id))invalid();map.set(row.id,row);}return map;}
  index(draft.questions);const reviewedById=index(reviewed.questions);
  let unresolved=0,conflicts=0;
  const questions=draft.questions.map(q=>{
   const r=reviewedById.get(q.id);if(!r||!Array.isArray(q.options)||!Array.isArray(r.options)||r.options.length!==q.options.length)invalid();
   const choices=index(q.options),reviewChoices=index(r.options);for(const id of choices.keys())if(!reviewChoices.has(id))invalid();
   const supplied=typeof q.correctOptionId==='string'&&choices.has(q.correctOptionId)?q.correctOptionId:'';
   const proposed=r.correctOptionId??'';if(typeof proposed!=='string'||(proposed&&!choices.has(proposed)))invalid();
   if(r.answerExplanation!==undefined&&(typeof r.answerExplanation!=='string'||r.answerExplanation.length>1000))throw new Error('Answer review returned an invalid explanation. Retry the review.');
   const conflict=q.answerKeyConflict===true||r.answerKeyConflict===true||Boolean(supplied&&proposed&&supplied!==proposed);
   const key=supplied||(!conflict?proposed:'');
   const explanation=!conflict&&key&&r.answerExplanation!==undefined?{answerExplanation:r.answerExplanation}:{};
   if(!key)unresolved++;if(conflict)conflicts++;
   return {...q,options:q.options.map(o=>({...o})),...(q.media?{media:{...q.media}}:{}),correctOptionId:key,...explanation,...(conflict?{answerKeyConflict:true}:{})};
  });
  return {draft:{...draft,questions},unresolved,conflicts};
 }
 const api={fromSource,applyAnswerReview};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.GameDraft=api;
})(typeof window==='undefined'?globalThis:window);
