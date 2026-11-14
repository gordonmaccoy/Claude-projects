const test=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events');
const {PDFDocument,StandardFonts}=require('pdf-lib'),{zipSync,strToU8}=require('fflate');
const {createApp}=require('../server'),{parseTest}=require('../documents');
const {fromSource}=require('../public/game-draft'),{requestInit}=require('../public/game-client');
const source='Review game\n1. What is 2 + 2?\nA. 4\nB. 5\nAnswer: A\n2. Where is Seoul?\nA. South Korea\nB. Japan';
async function pdfFixture(){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 doc.addPage().drawText(source,{x:40,y:700,font,size:12,lineHeight:18});
 return doc.save();
}
function wordFixture(){
 const paragraphs=source.split('\n').map(line=>'<w:p><w:r><w:t>'+line+'</w:t></w:r></w:p>').join('');
 return zipSync({
 '[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
 '_rels/.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
 'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs+'</w:body></w:document>'),
 });
}
test('Game import reuses authenticated quiz PDF, Word and paste parsing to create unsaved drafts',async t=>{
 const calls=[];
 const runtime=createApp({
  store:{accountState:async()=> 'active',saveGame:()=>{throw Error('Import must not save a game');}},
  verifyUser:async token=>token==='fixture-game-owner'?{id:'owner',email:'owner@example.test'}:null,
  sweepInterval:0,aiConfigured:true,
  importWithAI:async input=>{calls.push(input);return parseTest(input.source,input.filename);},
 });
 runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');t.after(()=>runtime.close());
 const base='http://127.0.0.1:'+runtime.server.address().port+'/api';
 const owner={Authorization:'Bearer fixture-game-owner'};
 const post=(route,data,headers=owner)=>fetch(base+route,requestInit(data,headers,'POST'));
 assert.equal((await post('/import',{source},{})).status,401);
 assert.equal((await post('/import-ai',{source,reviewSupplied:true})).status,400);
 assert.equal(calls.length,0);
 const pdf=new FormData();pdf.append('file',new Blob([await pdfFixture()],{type:'application/pdf'}),'Review.pdf');pdf.append('reviewSupplied','true');pdf.append('consent','true');
 const word=new FormData();word.append('file',new Blob([wordFixture()],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),'Review.docx');
 for(const [route,data] of [['/import-ai',pdf],['/import',word],['/import',{source}]]){
  const response=await post(route,data);
  assert.equal(response.status,200);
  const {test:parsed}=await response.json();
  const result=fromSource(parsed,{title:'My game',folderId:'demo-folder',compatibleOnly:true});
  assert.equal(result.draft.title,'My game');
  assert.equal(result.draft.folderId,'demo-folder');
  const [first,second]=result.draft.questions;
  assert.equal(first.correctOptionId,first.options[0].id);
  assert.equal(second.correctOptionId,'');
  assert.equal(result.unresolved,1);
  assert.equal(Object.hasOwn(result.draft,'id'),false);
 }
 assert.equal(calls.length,1);
 assert.equal(calls[0].reviewSupplied,true);
 assert.equal(calls[0].filename,'Review.pdf');
});
