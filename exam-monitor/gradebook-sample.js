const {randomUUID}=require('node:crypto');
function sampleGradebook(owner){
 const names=['Alex Morgan','Minji Kim','Daniel Park','Sofia Rivera','Liam Chen','Emma Wilson','Noah Patel','Hana Lee','Ethan Brown','Yuna Choi'];
 const students=names.map((name,i)=>({id:randomUUID(),name,number:String(99000001+i)}));
 const categories=[
  {id:'daily-quizzes',name:'Quizzes',weight:25,sections:[{id:'daily',name:'Daily Quizzes',weight:15},{id:'major',name:'Major Quizzes',weight:10}],importSectionId:'daily'},
  {id:'attendance',name:'Attendance',weight:25},
  {id:'participation',name:'Participation',weight:25},
  {id:'homework',name:'Homework',weight:25,sections:[{id:'practice',name:'Practice',weight:10},{id:'projects',name:'Projects',weight:15}],importSectionId:'practice'}
 ];
 const assignments=[['daily-quizzes','daily','Week 1 Quiz'],['daily-quizzes','daily','Week 2 Quiz'],['daily-quizzes','major','Unit Quiz'],['attendance',null,'Week 1 Attendance'],['attendance',null,'Week 2 Attendance'],['participation',null,'Class Discussion'],['homework','practice','Practice Assignment'],['homework','projects','Mini Project']];
 const assessments=assignments.map(([categoryId,sectionId,title],index)=>{
  const scores=students.map((_,i)=>[8,9,7,10,6,0,9,8,10,7][(i+index)%10]);
  const scoringColumns=['Part 1','Part 2'].map((name,i)=>({id:randomUUID(),name,maximum:5,scores:students.map((st,j)=>({studentId:st.id,score:i?Math.max(0,scores[j]-5):Math.min(5,scores[j])}))}));
  return {sessionId:'manual-'+randomUUID(),title,categoryId,...(sectionId?{sectionId}:{}),manual:true,total:10,included:true,importedAt:new Date().toISOString(),scoringColumns,grades:students.map((st,j)=>({studentId:st.id,score:scores[j],total:10,percentage:scores[j]*10,status:'Submitted'})),skipped:[]};
 });
 return {id:'sample-'+owner,name:'Sample Gradebook',sample:true,sampleVersion:3,sortBy:'number',numberSortDefaultVersion:1,students,categories,quizCategoryId:'daily-quizzes',assessments,columns:['name','number']};
}
module.exports={sampleGradebook};
