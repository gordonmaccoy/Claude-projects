const {test}=require('node:test');const assert=require('node:assert/strict');
const {PDFDocument,StandardFonts}=require('pdf-lib');const {zipSync,strToU8}=require('fflate');
const {extractDocument,parseTest}=require('../documents');const {createGenerator}=require('../generation');
const source='Economics Quiz\n1. What is 2 + 2?\nA. 4\nB. 5\nAnswer: A\n\n2. Capital of Korea: ___\nAnswer: Seoul | Seoul City';
test('existing-test parser organizes MC and blanks and flags missing answer keys',()=>{
  const imported=parseTest(source,'upload.pdf');assert.equal(imported.test.questions.length,2);
  assert.equal(imported.test.questions[0].correctOptionId,imported.test.questions[0].options[0].id);
  assert.deepEqual(imported.test.questions[1].acceptedAnswers,['Seoul','Seoul City']);assert.equal(imported.warnings.length,0);
  assert.ok(parseTest('Quiz\n1. Q?\nA. One\nB. Two').warnings.length);
});
test('extracts real PDF and DOCX text; refuses invalid/legacy/oversized documents',async()=>{
  const pdf=await PDFDocument.create();const page=pdf.addPage();const font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText(source,{x:40,y:700,font,size:12,lineHeight:18});
  assert.match(await extractDocument({originalname:'quiz.pdf',buffer:Buffer.from(await pdf.save())}),/What is 2/);
  const xml=source.split('\n').map(line=>`<w:p><w:r><w:t>${line.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</w:t></w:r></w:p>`).join('');
  const docx=zipSync({'[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),'_rels/.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),'word/document.xml':strToU8(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${xml}</w:body></w:document>`)});
  assert.match(await extractDocument({originalname:'quiz.docx',buffer:Buffer.from(docx)}),/Capital of Korea/);
  await assert.rejects(extractDocument({originalname:'old.doc',buffer:Buffer.from('old')}),/PDF or DOCX/);
  await assert.rejects(extractDocument({originalname:'bad.pdf',buffer:Buffer.from('not a PDF')}));
  await assert.rejects(extractDocument({originalname:'huge.pdf',buffer:Buffer.alloc(6*1024*1024)}),/5 MB/);
});
test('AI generation validates source/count and remote structured questions, requires evidence and never sends API key to client',async()=>{
  let request;
  const generator=createGenerator({key:'test-private-key',model:'configured-model',fetch:async(url,options)=>{
    request=JSON.parse(options.body);assert.equal(url,'https://api.openai.com/v1/responses');
    return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({title:'Generated quiz',questions:[{type:'blank',text:'The capital is ___.',options:[],correctIndex:0,acceptedAnswers:['Seoul'],caseSensitive:false,evidence:'Seoul is the capital.'}]})}]}]})};
  }});
  const r=await generator({source:'Seoul is the capital.',count:1,types:'blank',difficulty:'easy'});
  assert.equal(r.test.questions[0].type,'blank');assert.equal(request.store,false);assert.equal(request.text.format.type,'json_schema');assert.equal(JSON.stringify(r).includes('test-private-key'),false);
  await assert.rejects(generator({source:'',count:1,types:'blank'}));
  await assert.rejects(createGenerator({})({source:'Seoul is the capital.',count:1}),/configuration/);
});
