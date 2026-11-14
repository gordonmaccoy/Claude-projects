const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createStarterTest}=require('../onboarding');
const {createSampleGame}=require('../game-sample');
const {validateGame}=require('../game');

function content(q){
 return [q.text,q.options.map(o=>o.text),q.options.find(o=>o.id===q.correctOptionId).text];
}
test('sample contains the two built-in Test Library questions and two easy extras',()=>{
 for(const language of ['en','ko']){
  const game=createSampleGame(language);
  assert.equal(game.questions.length,4);
  assert.deepEqual(game.questions.slice(0,2).map(content),createStarterTest(language).questions.map(content));
  assert.deepEqual(game.questions.slice(2).map(q=>q.options.find(o=>o.id===q.correctOptionId).text),language==='ko'?['화성','7']:['Mars','7']);
  assert.ok(game.questions.every(q=>q.type==='mc'&&q.durationSeconds===20));
  assert.deepEqual(validateGame(game),game);
 }
});

test('sample import saves a four-question copy to the requesting professor’s library',async t=>{
 const express=require('express');
 const {createGameController}=require('../game-routes');
 const saved=[];
 const app=express();
 app.use(express.json());
 app.use((req,_res,next)=>{req.user={id:'professor-A'};next();});
 const controller=createGameController({store:{async saveGame(owner,game){saved.push({owner,game});return game;}},origin:()=>''});
 app.use('/api',controller.api);
 const server=app.listen(0,'127.0.0.1');
 await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/games/sample',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'en'})});
 assert.equal(response.status,200);
 const game=await response.json();
 assert.equal(game.questions.length,4);
 assert.deepEqual(saved,[{owner:'professor-A',game}]);
});
