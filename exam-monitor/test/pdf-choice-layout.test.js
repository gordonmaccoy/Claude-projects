const test=require('node:test'),assert=require('node:assert/strict');
const {PDFDocument,StandardFonts}=require('pdf-lib');
const {extractDocument,parseTest}=require('../documents');
async function makeLayout(){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 for(let pageIndex=0;pageIndex<2;pageIndex++){
  const page=pdf.addPage([600,800]);
  page.drawText('Name',{x:480,y:780,font,size:10});
  // This export writes all stems before options in its content stream.
  for(let i=0;i<5;i++){
   const n=pageIndex*5+i+1,y=740-i*140;
   page.drawText(n+'.',{x:40,y,font,size:11});
   page.drawText('Choose word '+n+': They ____.',{x:65,y,font,size:11});
  }
  for(let i=0;i<5;i++)for(let j=0;j<4;j++){
   const n=pageIndex*5+i+1,y=715-i*140-j*22;
   page.drawText('choice '+n+'-'+(j+1),{x:65,y,font,size:11});
   page.drawText(String.fromCharCode(65+j),{x:40,y,font,size:11});
  }
 }
 return {originalname:'Positioned quiz.pdf',buffer:Buffer.from(await pdf.save())};
}
test('PDF positional extraction preserves ten MC stems and all forty bare-label choices',async()=>{
 const text=await extractDocument(await makeLayout());
 const parsed=parseTest(text).test;
 assert.equal(parsed.questions.length,10);
 for(let i=0;i<10;i++){
  assert.equal(parsed.questions[i].type,'mc');
  assert.equal(parsed.questions[i].text,'Choose word '+(i+1)+': They ____.');
  assert.deepEqual(parsed.questions[i].options.map(o=>o.text),Array.from({length:4},(_,j)=>'choice '+(i+1)+'-'+(j+1)));
  assert.equal(parsed.questions[i].correctOptionId,'','No source answer key should be guessed');
 }
});
test('uncertain answer completion keeps positional PDF choices instead of converting to blanks',async()=>{
 const {createAIImporter}=require('../answer-key');
 const source=await extractDocument(await makeLayout());let request;
 const importer=createAIImporter({key:'fixture',model:'fixture',fetch:async(url,options)=>{
  request=JSON.parse(options.body);assert.equal(request.text.format.name,'test_answer_key');
  const questions=JSON.parse(request.input).questions;
  return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answers:questions.map(q=>({questionId:q.id,correctOptionId:null,acceptedAnswers:[],uncertain:true,explanation:'Review the answer.'}))})}]}]})};
 }});
 const result=await importer({source});
 assert.equal(result.test.questions.length,10);
 assert.ok(result.test.questions.every(q=>q.type==='mc'&&q.options.length===4&&q.correctOptionId===''));
});
test('unreadable PDF glyphs stay visible and are flagged instead of guessed',async()=>{
 const {readPositionedChoiceTest}=require('../pdf-choice-layout');
 const item=(str,x,y)=>({str,transform:[1,0,0,1,x,y]});
 const document={numPages:1,getPage:async()=>({getTextContent:async()=>({items:[item('1.',40,700),item('Which is co\0rect?',65,700),item('A',40,670),item('one',65,670),item('B',40,640),item('two',65,640)]})})};
 const source=await readPositionedChoiceTest(document,'Quiz');
 assert.ok(source.includes('co\uFFFDrect'));
 assert.ok(!source.includes('\0'));
 assert.match(parseTest(source).warnings.join(' '),/unreadable characters/);
 const importer=require('../answer-key').createAIImporter({key:'fixture',model:'fixture',fetch:async(url,opts)=>{
  const q=JSON.parse(JSON.parse(opts.body).input).questions[0];
  return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answers:[{questionId:q.id,correctOptionId:q.options[0].id,acceptedAnswers:[],uncertain:false,explanation:'Review.'}]})}]}]})};
 }});
 assert.match((await importer({source})).warnings.join(' '),/unreadable characters/);
});
test('ambiguous option sequence or multiple columns falls back without inventing associations',async()=>{
 const {readPositionedChoiceTest}=require('../pdf-choice-layout');
 const item=(str,x,y)=>({str,transform:[1,0,0,1,x,y]});
 for(const items of [
  [item('1.',40,700),item('Question?',65,700),item('B',40,670),item('one',65,670)],
  [item('1.',40,700),item('Question?',65,700),item('A',330,670),item('one',350,670)]
 ]){
  assert.equal(await readPositionedChoiceTest({numPages:1,getPage:async()=>({getTextContent:async()=>({items})})}),null);
 }
});
test('footer and supplied-answer rows are not silently appended to the last choice',async()=>{
 const {readPositionedChoiceTest}=require('../pdf-choice-layout');
 const item=(str,x,y)=>({str,height:11,transform:[1,0,0,1,x,y]});
 const base=[item('1.',40,700),item('Question?',65,700),item('A',40,670),item('one',65,670),item('B',40,640),item('two',65,640)];
 for(const extra of [item('Page 1',300,20),item('Answer: A',65,625),item('Another heading',65,100)]){
  assert.equal(await readPositionedChoiceTest({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[...base,extra]})})}),null);
 }
});
test('aligned, nearby continuation lines preserve wrapped choices',async()=>{
 const {readPositionedChoiceTest}=require('../pdf-choice-layout');
 const item=(str,x,y)=>({str,height:11,transform:[1,0,0,1,x,y]});
 const items=[item('1.',40,700),item('Question?',65,700),item('A',40,670),item('one',65,670),item('continued',65,656),item('B',40,630),item('two',65,630)];
 assert.match(await readPositionedChoiceTest({numPages:1,getPage:async()=>({getTextContent:async()=>({items})})}),/A\) one continued/);
});
test('filenames cannot become question or answer-key syntax',async()=>{
 const {readPositionedChoiceTest}=require('../pdf-choice-layout');
 const item=(str,x,y)=>({str,transform:[1,0,0,1,x,y]});
 const items=[item('1.',40,700),item('Question?',65,700),item('A',40,670),item('one',65,670),item('B',40,640),item('two',65,640)];
 for(const title of ['Answer Key','1. Quiz','Quiz\n2. extra']){
  const source=await readPositionedChoiceTest({numPages:1,getPage:async()=>({getTextContent:async()=>({items})})},title);
  assert.equal(parseTest(source).test.questions.length,1);
 }
});
