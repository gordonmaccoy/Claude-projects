(function(root){
 const round=n=>Math.round(n*100)/100;
 const total=a=>a.total??a.grades.find(g=>Number.isFinite(g.total))?.total??0;
 function grade(a,id){const g=a.grades.find(g=>g.studentId===id);return g||{studentId:id,score:0,total:total(a),percentage:0,status:'Missing'};}
 function summary(assessments,id){let score=0,possible=0,pending=false;for(const a of assessments){if(a.included===false)continue;const g=grade(a,id);if(g.excused)continue;if(g.status==='Grading…'){pending=true;continue;}score+=g.score??0;possible+=g.total??total(a);}return {score:round(score),total:round(possible),percentage:possible?round(score/possible*100):null,pending};}
 function average(a,students){const grades=students.map(s=>grade(a,s.id)).filter(g=>!g.excused&&Number.isFinite(g.score)&&g.score>0);if(!grades.length)return null;const mean=key=>round(grades.reduce((n,g)=>n+(g[key]??0),0)/grades.length);return {score:mean('score'),total:mean('total'),percentage:mean('percentage')};}
 const categories=book=>book.categories||[{id:'daily-quizzes',name:'Daily Quizzes',weight:100}];
 const categoryAssessments=(book,id)=>(book.assessments||[]).filter(a=>(a.categoryId||'daily-quizzes')===id);
 function categorySummary(book,category,id){
  const items=categoryAssessments(book,category.id);
  if(!category.sections?.length)return summary(items,id);
  const sections=category.sections.map(section=>({...section,...summary(items.filter(a=>a.sectionId===section.id),id)}));
  const available=sections.filter(g=>g.weight>0&&!g.pending&&g.percentage!=null);
  const availableWeight=round(available.reduce((n,g)=>n+g.weight,0));
  const score=round(available.reduce((n,g)=>n+g.percentage*g.weight/100,0));
  return {score,total:availableWeight,availableWeight,percentage:availableWeight?round(score/availableWeight*100):null,pending:false,incomplete:sections.some(g=>g.weight>0&&(g.pending||g.percentage==null)),sections,contribution:score};
 }
 function weighted(book,id){const values=categories(book).map(c=>{const g=categorySummary(book,c,id);return {...c,...g,contribution:g.percentage==null?null:g.contribution??round(g.percentage*c.weight/100)};});const incomplete=values.some(g=>g.weight>0&&(g.incomplete||g.pending||g.percentage==null));const available=values.filter(g=>g.weight>0&&!g.pending&&g.percentage!=null),availableWeight=round(available.reduce((n,g)=>n+(g.availableWeight??g.weight),0)),earned=round(available.reduce((n,g)=>n+g.contribution,0));return {categories:values,incomplete,total:incomplete?null:earned,earned,availableWeight,currentPercentage:availableWeight?round(earned/availableWeight*100):null};}
 function importLocations(book){
  if(Array.isArray(book.importLocations))return book.importLocations;
  if(book.quizCategoryId==='')return [];
  const categoryId=book.quizCategoryId||'daily-quizzes',category=categories(book).find(c=>c.id===categoryId);
  return category?[{categoryId,...(category.sections?.length?{sectionId:category.importSectionId||category.sections[0].id}:{})}]:[];
 }
 const letterLabels=['A+','A0','B+','B0','C+','C0','D+','D0','F'];
 function defaultRubric(){return {thresholds:[95,90,85,80,75,70,65,60],curved:false,maxCurve:false,aCap:30,bCap:70};}
 function letterGrades(book){
  const rubric=book.rubric||defaultRubric(),result=new Map(),ranked=book.students.map(st=>({id:st.id,...weighted(book,st.id)})).filter(g=>g.currentPercentage!=null).sort((a,b)=>b.currentPercentage-a.currentPercentage);
  const aLimit=Math.floor(ranked.length*rubric.aCap/100),bLimit=Math.floor(ranked.length*rubric.bCap/100);
  for(let i=0;i<ranked.length;){let end=i+1;while(end<ranked.length&&ranked[end].currentPercentage===ranked[i].currentPercentage)end++;
   for(let j=i;j<end;j++){const g=ranked[j];let band=rubric.thresholds.findIndex(n=>g.currentPercentage>=n);if(band<0)band=8;const original=band;
    if(rubric.curved){if(rubric.maxCurve){if(end<=aLimit)band=Math.min(band,1);else if(end<=bLimit)band=Math.max(2,Math.min(band,3));else band=Math.max(band,4);}else{if(end>aLimit)band=Math.max(band,2);if(end>bLimit)band=Math.max(band,4);}}
    result.set(g.id,{letter:letterLabels[band],original:letterLabels[original],adjusted:band!==original,provisional:g.incomplete});
   }i=end;
  }return result;
 }
 const api={letterGrades,letterLabels,defaultRubric,importLocations,categorySummary,grade,total,summary,average,categories,categoryAssessments,weighted};if(typeof module==='object')module.exports=api;else root.examioGradebookMath=api;
})(typeof window==='object'?window:globalThis);
