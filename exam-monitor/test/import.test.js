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
    return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({title:'Generated quiz',questions:[{type:'blank',text:'The capital is ___.',options:[],correctIndex:0,acceptedAnswers:['Seoul'],caseSensitive:false,passage:1}]})}]}]})};
  }});
  const r=await generator({source:'Seoul is the capital.',count:1,types:'blank',difficulty:'easy'});
  assert.equal(r.test.questions[0].type,'blank');assert.equal(r.test.questions[0].evidence,'Seoul is the capital.');assert.equal(request.store,false);assert.equal(request.text.format.type,'json_schema');assert.equal(JSON.stringify(r).includes('test-private-key'),false);
  await assert.rejects(generator({source:'',count:1,types:'blank'}));
  await assert.rejects(createGenerator({})({source:'Seoul is the capital.',count:1}),/configuration/);
});

test('imports common pasted/Word numbering and unnumbered question blocks, never an empty editor',()=>{
 for(const text of ['1)What is two plus two?\n(a) 4\n(b) 5\nCorrect answer: a) 4','Question 1: What is two plus two?\nA: 4\nB: 5\nAnswer: 4','What is two plus two?\nA. 4\nB. 5\nAnswer: A']){const r=parseTest(text);assert.equal(r.test.questions.length,1);assert.match(r.test.questions[0].text,/two plus two/);assert.equal(r.test.questions[0].options.length,2);assert.equal(r.test.questions[0].correctOptionId,r.test.questions[0].options[0].id);assert.notEqual(r.test.title,r.test.questions[0].text);}
 const r=parseTest('1. First? A) Yes B) No\nAnswer: A\n2. Second?\nA. True\nB. False\nAnswer: B');assert.equal(r.test.questions.length,2);assert.equal(r.test.questions[0].options.length,2);assert.throws(()=>parseTest('This is plain lecture text without test questions.'),/questions|format/i);
});

test('imports the professor supplied10-question auxiliary sample without labels or guessed keys',()=>{const text=require('fs').readFileSync(require('path').join(__dirname,'fixtures/auxiliary-test.txt'),'utf8');const r=parseTest(text);assert.equal(r.test.questions.length,10);assert.equal(r.test.questions.filter(q=>q.type==='blank').length,4);assert.deepEqual(r.test.questions[0].acceptedAnswers,['am']);assert.match(r.test.questions[9].text,/blue surfboard/);for(const q of r.test.questions.slice(4)){assert.equal(q.type,'mc');assert.equal(q.options.length,3);assert.equal(q.correctOptionId,'');}assert.equal(r.warnings.length,6);});

test('the supplied sentence format survives real PDF and DOCX extraction',async()=>{const text=require('fs').readFileSync(require('path').join(__dirname,'fixtures/auxiliary-test.txt'),'utf8');const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText(text.replace(/[’]/g,"'"),{x:30,y:800,font,size:10,lineHeight:11});const extracted=await extractDocument({originalname:'auxiliary.pdf',buffer:Buffer.from(await pdf.save())});const pdfPreview=parseTest(extracted,'auxiliary.pdf');assert.equal(pdfPreview.test.questions.length,10);assert.equal(pdfPreview.test.questions[9].options.length,3);
 const xml=text.split('\n').map(line=>'<w:p><w:r><w:t>'+line.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</w:t></w:r></w:p>').join('');const docx=zipSync({'[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),'_rels/.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+xml+'</w:body></w:document>')});assert.equal(parseTest(await extractDocument({originalname:'auxiliary.docx',buffer:Buffer.from(docx)})).test.questions.length,10);});

test('contradictory answer markers require review in numbered and sentence formats',()=>{for(const text of ['Complete the sentence:\nI ____ happy.\nA. am *\nB. is *\nAnswer: A','Complete the sentence:\nI ____ happy.\nA. am *\nB. is\nAnswer: B','1. I ____ happy.\nA. am *\nB. is\nAnswer: B']){const r=parseTest(text);assert.equal(r.test.questions[0].correctOptionId,'');assert.ok(r.warnings.length);}});
