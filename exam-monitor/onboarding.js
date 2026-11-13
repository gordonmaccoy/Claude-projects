const {randomUUID}=require('node:crypto');

function createStarterTest(language){
 const question=(text,choices,correct)=>{const id=randomUUID();const options=choices.map(text=>({id:randomUUID(),text}));return {id,type:'mc',text,points:1,options,correctOptionId:options[correct].id};};
 const korean=language==='ko';
 return {id:randomUUID(),title:korean?'연습 시험':'Practice Test',folderId:null,questions:[
   korean?question('대한민국의 수도는 어디인가요?',['서울','베이징','도쿄'],0):question('What is the capital of South Korea?',['Seoul','Beijing','Tokyo'],0),
   question(korean?'2 + 2는 얼마인가요?':'What is 2 + 2?',['3','4','5'],1)
 ]};
}
module.exports={createStarterTest};
