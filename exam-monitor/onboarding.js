const {randomUUID}=require('node:crypto');

function createStarterTest(){
 const question=(text,choices,correct)=>{const id=randomUUID();const options=choices.map(text=>({id:randomUUID(),text}));return {id,type:'mc',text,points:1,options,correctOptionId:options[correct].id};};
 return {id:randomUUID(),title:'Practice Test',folderId:null,questions:[question('What is the capital of South Korea?',['Seoul','Beijing','Tokyo'],0),question('What is 2 + 2?',['3','4','5'],1)]};
}
module.exports={createStarterTest};
