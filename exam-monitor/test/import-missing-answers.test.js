const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAIImporter}=require('../answer-key');
const {extractDocument}=require('../documents');
const {PDFDocument,StandardFonts}=require('pdf-lib');
const {zipSync,strToU8}=require('fflate');
const success=value=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})});

test('an unmarked pasted quiz gets a dedicated answer pass after organization leaves keys missing',async()=>{
 const calls=[];
 const importQuiz=createAIImporter({key:'test',model:'test',fetch:async(url,request)=>{
  const body=JSON.parse(request.body);calls.push(body.text.format.name);
  if(body.text.format.name==='organized_existing_test')return success({isTest:true,title:'Unmarked quiz',questions:[{type:'mc',text:'What is 2 + 2?',points:2,options:['4','5'],correctIndex:null,acceptedAnswers:[],uncertain:true,explanation:'No answer marked.'},{type:'blank',text:'The capital of France is ____.',points:1,options:[],correctIndex:null,acceptedAnswers:[],uncertain:true,explanation:'No answer supplied.'}]});
  const input=JSON.parse(body.input);return success({answers:input.questions.map(q=>({questionId:q.id,correctOptionId:q.type==='blank'?null:q.options[0].id,acceptedAnswers:q.type==='blank'?['Paris']:[],uncertain:false,explanation:'Solved using subject knowledge.'}))});
 }});
 const result=await importQuiz({source:'What is 2 + 2?\n4\n5\nThe capital of France is ____.'});
 assert.deepEqual(calls,['organized_existing_test','test_answer_key']);
 assert.equal(result.test.questions[0].correctOptionId,result.test.questions[0].options[0].id);
 assert.equal(result.test.questions[0].points,2);
 assert.deepEqual(result.test.questions[1].acceptedAnswers,['Paris']);
 assert.ok(!result.warnings.some(w=>/No answer marked|No answer supplied/.test(w)));
 assert.ok(require('../exam').validateTest(result.test),'the completed quiz can be saved');
});

test('unmarked PDF, Word and pasted choices get answers and produce saveable quizzes',async()=>{
 const source='Math Quiz\n1. What is 2 + 2?\nA. 4\nB. 5';
 const pdf=await PDFDocument.create(),page=pdf.addPage(),font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText(source,{x:40,y:700,font,size:12,lineHeight:18});
 const docx=zipSync({'[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),'_rels/.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+source.split('\n').map(s=>'<w:p><w:r><w:t>'+s+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>')});
 for(const input of [source,await extractDocument({originalname:'unmarked.pdf',buffer:Buffer.from(await pdf.save())}),await extractDocument({originalname:'unmarked.docx',buffer:Buffer.from(docx)})]){
  let calls=0;const importer=createAIImporter({key:'test',model:'test',fetch:async(url,request)=>{calls++;const body=JSON.parse(request.body);assert.equal(body.text.format.name,'test_answer_key');const q=JSON.parse(body.input).questions[0];return success({answers:[{questionId:q.id,correctOptionId:q.options[0].id,acceptedAnswers:[],uncertain:false,explanation:'Addition.'}]});}});
  const result=await importer({source:input});assert.equal(calls,1);assert.ok(require('../exam').validateTest(result.test));assert.equal(result.test.questions[0].correctOptionId,result.test.questions[0].options[0].id);
 }
});

test('the automatic fallback solving pass stays bounded and leaves genuinely ambiguous questions for review',async()=>{
 let calls=0;const importer=createAIImporter({key:'test',model:'test',fetch:async(url,request)=>{calls++;const body=JSON.parse(request.body);if(body.text.format.name==='organized_existing_test')return success({isTest:true,title:'Context missing',questions:[{type:'blank',text:'What did the speaker say?',points:1,options:[],correctIndex:null,acceptedAnswers:[],uncertain:true,explanation:'Audio is missing.'}]});const q=JSON.parse(body.input).questions[0];return success({answers:[{questionId:q.id,correctOptionId:null,acceptedAnswers:[],uncertain:true,explanation:'The audio is required.'}]});}});
 const result=await importer({source:'What did the speaker say?'});assert.equal(calls,2);assert.deepEqual(result.test.questions[0].acceptedAnswers,[]);assert.ok(result.warnings.some(w=>/professor review/.test(w)));
});
