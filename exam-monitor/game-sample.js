const {randomUUID}=require('node:crypto');
const {createStarterTest}=require('./onboarding');
const {fromTest}=require('./game');

function createSampleGame(language){
 const ko=language==='ko';
 const sample=createStarterTest(language);
 sample.title=ko?'샘플 게임: 쉬운 퀴즈':'Sample Game: Easy Quiz';
 const extra=(text,choices,correct)=>{
  const options=choices.map(text=>({id:randomUUID(),text}));
  return {id:randomUUID(),type:'mc',text,options,correctOptionId:options[correct].id};
 };
 sample.questions.push(
  ko?extra('붉은 행성으로 알려진 행성은 무엇인가요?',['금성','목성','화성'],2):extra('Which planet is known as the Red Planet?',['Venus','Jupiter','Mars'],2),
  ko?extra('일주일은 며칠인가요?',['7','5','10'],0):extra('How many days are in a week?',['7','5','10'],0)
 );
 return fromTest(sample);
}

function isSampleTitle(title){return typeof title==='string'&&['sample game: easy quiz','샘플 게임: 쉬운 퀴즈'].includes(title.trim().toLowerCase());}
module.exports={createSampleGame,isSampleTitle};
