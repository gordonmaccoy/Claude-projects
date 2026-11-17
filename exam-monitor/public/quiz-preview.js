(function(){
window.createExamioQuizPreview=function(test,t=value=>value){
 const root=document.createElement('section');root.className='quiz-preview-content';root.hidden=true;root.setAttribute('aria-label',t('Quiz preview'));
 function image(parent,src,alt){if(!src)return;const img=document.createElement('img');img.className='quiz-preview-image';img.src=src;img.alt=alt;img.loading='lazy';parent.append(img);}
 for(const [index,q]of test.questions.entries()){
  const question=document.createElement('article');question.className='quiz-preview-question';const title=document.createElement('h4');title.textContent=t('Question')+' '+(index+1)+'. '+q.text;question.append(title);image(question,q.image,t('Question image'));
  if(q.type==='blank'||q.type==='short'){
   const answer=document.createElement('p');answer.className='quiz-preview-correct';const key=document.createElement('strong');key.textContent=t(q.type==='short'?'Model answer':'Correct answer')+': ';answer.append(key,document.createTextNode(q.type==='short'?q.modelAnswer:(q.acceptedAnswers||[]).join(' / ')));question.append(answer);
  }else{
   const options=document.createElement('ul');options.className='quiz-preview-options';for(const [i,option]of (q.options||[]).entries()){const line=document.createElement('li');if(option.id===q.correctOptionId)line.className='quiz-preview-correct';line.textContent=(option.id===q.correctOptionId?'✓ ':'')+String.fromCharCode(65+i)+'. '+option.text;image(line,option.image,t('Question image'));options.append(line);}question.append(options);
  }
  root.append(question);
 }
 return root;
};
})();
