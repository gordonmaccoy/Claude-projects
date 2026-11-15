const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAnswerCompleter,createAIImporter}=require('../answer-key');
const success=value=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})});
const mc=(id,key='a')=>({id,type:'mc',text:'What is 2 + 2?',points:1,options:[{id:'a',text:'4'},{id:'b',text:'5'}],correctOptionId:key});
function provider(answer,requests=[]){return {key:'synthetic',model:'synthetic',fetch:async(url,opts)=>{const body=JSON.parse(opts.body);requests.push(body);return success(answer(JSON.parse(body.input),body));}};}
test('opt-in review checks supplied answers independently, preserves disagreements and fills missing',async()=>{
 const requests=[],input={title:'Review',questions:[mc('agree'),mc('disagree','b'),mc('missing',''),{...mc('conflict',''),answerKeyConflict:true}]};
 const solve=createAnswerCompleter(provider(({questions})=>({answers:questions.map(q=>({questionId:q.id,correctOptionId:'a',acceptedAnswers:[],uncertain:false,explanation:'Two plus two is four.'}))}),requests));
 const result=await solve(input,{reviewSupplied:true});
 assert.equal(result.test.questions[1].correctOptionId,'b');assert.equal(result.test.questions[2].correctOptionId,'a');assert.equal(result.test.questions[3].correctOptionId,'');
 assert.deepEqual(JSON.parse(requests[0].input).questions.map(q=>q.id),['agree','disagree','missing']);assert.ok(JSON.parse(requests[0].input).questions.every(q=>!Object.hasOwn(q,'correctOptionId')));
 assert.ok(result.warnings.some(w=>/Question 2:.*supplied.*preserved.*4/i.test(w)));assert.ok(result.warnings.some(w=>/conflicting/i.test(w)));assert.ok(!result.test.questions[1].answerKeyConflict);
 assert.equal(input.questions[2].correctOptionId,'');
});
test('review uncertainty preserves supplied MC and blank keys and leaves missing keys unresolved',async()=>{
 const input={title:'Review',questions:[mc('given'),mc('missing',''),{id:'blank',type:'blank',text:'The capital is ___.',points:1,acceptedAnswers:['Paris'],caseSensitive:false}]};
 const solve=createAnswerCompleter(provider(({questions})=>({answers:questions.map(q=>({questionId:q.id,correctOptionId:q.type==='mc'?'b':null,acceptedAnswers:q.type==='blank'?['Rome']:[],uncertain:true,explanation:'Context is missing.'}))})));
 const result=await solve(input,{reviewSupplied:true});assert.equal(result.test.questions[0].correctOptionId,'a');assert.equal(result.test.questions[1].correctOptionId,'');assert.deepEqual(result.test.questions[2].acceptedAnswers,['Paris']);assert.ok(result.warnings.some(w=>/Question 1:.*preserv.*uncertain/i.test(w)));assert.ok(result.warnings.some(w=>/Question 3:.*preserv.*uncertain/i.test(w)));
});
test('review agreement does not warn of a disagreement; default and non-boolean flags skip supplied keys',async()=>{
 const requests=[],solve=createAnswerCompleter(provider(({questions})=>({answers:questions.map(q=>({questionId:q.id,correctOptionId:'a',acceptedAnswers:[],uncertain:false,explanation:'Addition.'}))}),requests));
 const input={title:'Review',questions:[mc('given')]};await solve(input);await solve(input,{reviewSupplied:'true'});assert.equal(requests.length,0);
 const result=await solve(input,{reviewSupplied:true});assert.equal(requests.length,1);assert.equal(result.test.questions[0].correctOptionId,'a');assert.ok(!result.warnings.some(w=>/different|disagree|uncertain/i.test(w)));
});
test('recognized import forwards opt-in review, preserving source supplied answer',async()=>{
 const requests=[],importer=createAIImporter(provider(({questions})=>({answers:questions.map(q=>({questionId:q.id,correctOptionId:q.options[0].id,acceptedAnswers:[],uncertain:false,explanation:'Addition.'}))}),requests));
 const result=await importer({source:'1. What is 2 + 2?\nA. 4\nB. 5\nAnswer: B',reviewSupplied:true});assert.equal(requests.length,1);assert.equal(result.test.questions[0].correctOptionId,result.test.questions[0].options[1].id);assert.ok(result.warnings.some(w=>/different.*4/i.test(w)));
});
test('fallback review independently infers once and preserves recognized source key with readable candidate',async()=>{
 const requests=[],importer=createAIImporter(provider(()=>({isTest:true,title:'Review',questions:[{type:'mc',text:'What is 2 + 2?',points:1,options:['4','5'],correctIndex:0,acceptedAnswers:[],uncertain:false,explanation:'Addition.'},{type:'mc',text:'What is 3 + 3?',points:1,options:['6','7'],correctIndex:0,acceptedAnswers:[],uncertain:false,explanation:'Addition.'}]}),requests));
 const result=await importer({source:'1. What is 2 + 2?\nA. 4\nB. 5\nAnswer: B\n\nWhat is 3 + 3?\n6\n7',reviewSupplied:true});assert.equal(requests.length,1);assert.match(requests[0].instructions,/independent/i);assert.equal(result.test.questions[0].correctOptionId,result.test.questions[0].options[1].id);assert.ok(result.warnings.some(w=>/different.*4/i.test(w)));
});
test('review keeps authored explanations and never assigns contradictory or uncertain rationale to preserved keys',async()=>{
 const questions=[{...mc('authored','b'),answerExplanation:'Teacher rationale.'},mc('disagree','b'),mc('uncertain','a'),{...mc('missing',''),answerExplanation:'Teacher hint.'},mc('fill','')];
 const solve=createAnswerCompleter(provider(({questions})=>({answers:questions.map(q=>({questionId:q.id,correctOptionId:'a',acceptedAnswers:[],uncertain:q.id==='uncertain',explanation:'AI addition rationale.'}))})));
 const result=await solve({title:'Review',questions},{reviewSupplied:true});assert.equal(result.test.questions[0].answerExplanation,'Teacher rationale.');assert.ok(!result.test.questions[1].answerExplanation);assert.ok(!result.test.questions[2].answerExplanation);assert.equal(result.test.questions[3].answerExplanation,'Teacher hint.');assert.equal(result.test.questions[4].answerExplanation,'AI addition rationale.');
});
test('fallback supplied disagreement remains teacher-only, not a contradictory student explanation',async()=>{
 const importer=createAIImporter(provider(()=>({isTest:true,title:'Review',questions:[{type:'mc',text:'What is 2 + 2?',points:1,options:['4','5'],correctIndex:0,acceptedAnswers:[],uncertain:false,explanation:'AI says four.'},{type:'mc',text:'What is 3 + 3?',points:1,options:['6','7'],correctIndex:0,acceptedAnswers:[],uncertain:false,explanation:'AI says six.'}]})));
 const result=await importer({source:'1. What is 2 + 2?\nA. 4\nB. 5\nAnswer: B\n\nWhat is 3 + 3?\n6\n7',reviewSupplied:true});assert.ok(!result.test.questions[0].answerExplanation);assert.equal(result.test.questions[1].answerExplanation,'AI says six.');assert.ok(result.warnings.some(w=>w.includes('AI says four.')));
});
test('blank review preserves case rules and authored keys on disagreement, accepting semantic agreement',async()=>{
 const q=(id,answers)=>({id,type:'blank',text:'A capital is ___.',points:1,acceptedAnswers:answers,caseSensitive:false});
 const solve=createAnswerCompleter(provider(({questions})=>({answers:questions.map(q=>({questionId:q.id,correctOptionId:null,acceptedAnswers:q.id==='agree'?['paris']:['Rome'],uncertain:false,explanation:'Geography.'}))})));
 const result=await solve({title:'Review',questions:[q('agree',['Paris']),q('different',['Paris']),q('missing',[])]},{reviewSupplied:true});assert.deepEqual(result.test.questions[0].acceptedAnswers,['Paris']);assert.deepEqual(result.test.questions[1].acceptedAnswers,['Paris']);assert.deepEqual(result.test.questions[2].acceptedAnswers,['Rome']);assert.ok(!result.warnings.some(w=>/Question 1:/.test(w)));assert.ok(result.warnings.some(w=>/Question 2:.*different.*Rome/.test(w)));assert.ok(!result.test.questions[1].answerExplanation);
});
test('fallback uncertainty and conflicting source markers remain unresolved or source-preserved without review rationale in game',async()=>{
 for(const conflict of [false,true]){
 const importer=createAIImporter(provider(()=>({isTest:true,title:'Review',questions:[{type:'mc',text:'What is 2 + 2?',points:1,options:['4','5'],correctIndex:null,acceptedAnswers:[],uncertain:true,explanation:'Not enough context.'},{type:'mc',text:'What is 3 + 3?',points:1,options:['6','7'],correctIndex:null,acceptedAnswers:[],uncertain:true,explanation:'Cannot be certain.'}]})));
 const result=await importer({source:'1. What is 2 + 2?\nA. 4'+(conflict?' *':'')+'\nB. 5\nAnswer: B\n\nWhat is 3 + 3?\n6\n7',reviewSupplied:true});const first=result.test.questions[0];assert.equal(first.correctOptionId,conflict?'':first.options[1].id);assert.ok(!first.answerExplanation);assert.equal(result.test.questions[1].correctOptionId,'');assert.ok(!result.test.questions[1].answerExplanation);assert.ok(result.warnings.some(w=>conflict?/conflicting/.test(w):/supplied.*preserved.*uncertain.*context/.test(w)));
 }
});
test('opt-in skips unseen media questions and sends only text-only questions to provider',async()=>{
 const requests=[],solve=createAnswerCompleter(provider(({questions})=>({answers:questions.map(q=>({questionId:q.id,correctOptionId:'a',acceptedAnswers:[],uncertain:false,explanation:'Arithmetic.'}))}),requests));
 const image='data:image/png;base64,aGVsbG8=';const input={title:'Media',questions:[{...mc('image',''),image},{...mc('choices','b'),options:[{id:'a',text:'4',image},{id:'b',text:'5'}]},{...mc('video',''),media:{type:'video',url:'https://example.com/private-video'}},{...mc('marker',''),mediaPresent:true},mc('text','')]};
 const result=await solve(input,{reviewSupplied:true});assert.deepEqual(JSON.parse(requests[0].input).questions.map(q=>q.id),['text']);assert.ok(!requests[0].input.includes('data:image'));assert.ok(!requests[0].input.includes('private-video'));assert.equal(result.test.questions[0].correctOptionId,'');assert.equal(result.test.questions[1].correctOptionId,'b');assert.equal(result.test.questions[2].correctOptionId,'');assert.equal(result.test.questions[3].correctOptionId,'');assert.equal(result.test.questions[4].correctOptionId,'a');assert.equal(result.warnings.filter(w=>/review manually because AI did not see the media/i.test(w)).length,4);
 const allMedia=await solve({title:'Media',questions:input.questions.slice(0,3)},{reviewSupplied:true});assert.equal(requests.length,1);assert.equal(allMedia.warnings.filter(w=>/media/i.test(w)).length,3);
});
