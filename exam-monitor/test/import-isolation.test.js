const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
test('a crashed extraction subprocess returns a safe error without killing the server',()=>{
 const script=`const assert=require('node:assert/strict');const cp=require('node:child_process');const fork=cp.fork;cp.fork=(...args)=>{const child=fork(...args);child.send=()=>child.kill();return child;};const {extractDocument}=require('./documents');(async()=>{await assert.rejects(extractDocument({originalname:'test.pdf',buffer:Buffer.from('%PDF-1.7\\ninvalid')}),/could not be processed/);console.log('parent survived');})().catch(e=>{console.error(e);process.exitCode=1});`;
 const result=spawnSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'..'),encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/parent survived/);
});

test('repeated real PDF extraction keeps the parent alive and preserves source text',async()=>{
 const {PDFDocument,StandardFonts}=require('pdf-lib');const {extractDocument}=require('../documents');
 const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText('1. What is two plus two?\nA. Four\nB. Five\nAnswer: A',{font,size:12});
 const buffer=Buffer.from(await pdf.save());
 for(let i=0;i<6;i++)assert.match(await extractDocument({originalname:'repeat.pdf',buffer}),/What is two plus two/);
});
