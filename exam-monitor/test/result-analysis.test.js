const test=require('node:test'),assert=require('node:assert/strict');
test('class statistics count every joined student and average finalized percentages only',()=>{
 const {statistics}=require('../public/result-analysis');
 assert.deepEqual(statistics([{result:{percentage:80}},{result:{percentage:0}},{result:null}]),{students:3,completion:66.67,average:40});
 assert.deepEqual(statistics([]),{students:0,completion:0,average:null});
});
test('question averages count unanswered submitted attempts and exclude drafts',()=>{
 const {questionStatistics}=require('../public/result-analysis');
 const students=[{submitted:true,answers:[{status:'correct',answer:'Same',optionId:'b'}]},{submitted:true,answers:[{status:'incorrect',answer:'',optionId:null}]},{submitted:false,answers:[{status:'incorrect',answer:'Same',optionId:'a'}]}];
 assert.deepEqual(questionStatistics(students,0),{submitted:2,correct:1,average:50,answered:2,options:{b:1,a:1},blanks:{Same:2}});
});
