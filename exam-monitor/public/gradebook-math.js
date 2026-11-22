(function(root){
 const round=n=>Math.round(n*100)/100;
 const total=a=>a.total??a.grades.find(g=>Number.isFinite(g.total))?.total??0;
 function grade(a,id){const g=a.grades.find(g=>g.studentId===id);return g||{studentId:id,score:0,total:total(a),percentage:0,status:'Missing'};}
 function summary(assessments,id){let score=0,possible=0,pending=false;for(const a of assessments){const g=grade(a,id);if(g.excused)continue;if(g.status==='Grading…'){pending=true;continue;}score+=g.score??0;possible+=g.total??total(a);}return {score:round(score),total:round(possible),percentage:possible?round(score/possible*100):null,pending};}
 function average(a,students){const grades=students.map(s=>grade(a,s.id)).filter(g=>!g.excused&&Number.isFinite(g.score)&&g.score>0);if(!grades.length)return null;const mean=key=>round(grades.reduce((n,g)=>n+(g[key]??0),0)/grades.length);return {score:mean('score'),total:mean('total'),percentage:mean('percentage')};}
 const api={grade,total,summary,average};if(typeof module==='object')module.exports=api;else root.examioGradebookMath=api;
})(typeof window==='object'?window:globalThis);
