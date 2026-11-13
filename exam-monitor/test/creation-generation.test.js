const test=require('node:test');const assert=require('node:assert/strict');const {createGenerator}=require('../generation');
test('topic-only generation needs no invented source evidence and supports true/false',async()=>{
 let sent;const generate=createGenerator({key:'x',model:'x',fetch:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({title:'Plants',questions:[{type:'mc',text:'Plants use sunlight.',options:['True','False'],correctIndex:0,acceptedAnswers:[],caseSensitive:false,passage:0}]})}]}]})};}});
 const result=await generate({prompt:'Photosynthesis basics',count:1,types:'truefalse'});assert.equal(result.test.questions[0].options.length,2);assert.equal(result.test.questions[0].evidence,'');assert.match(sent.instructions,/True\/False/);
});
