const {fork}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const MAX_BYTES=5*1024*1024,MAX_TEXT=60000;
async function extractDocument(file) {
  if(!file?.buffer || !file.buffer.length) throw new Error('Choose a PDF or DOCX file.');
  if(file.buffer.length>MAX_BYTES) throw new Error('The maximum upload size is 5 MB.');
  const ext=String(file.originalname||'').toLowerCase().split('.').pop();
  if(!['pdf','docx'].includes(ext)) throw new Error('Upload a PDF or DOCX file. Save older Word .doc files as DOCX first.');
  if(ext==='pdf' && file.buffer.subarray(0,5).toString()!=='%PDF-') throw new Error('This is not a valid PDF file.');
  if(ext==='docx' && file.buffer.subarray(0,2).toString()!=='PK') throw new Error('This is not a valid DOCX file.');
  return new Promise((resolve,reject)=>{
    let child,done=false,retried=false;
    const finish=(error,text)=>{if(done)return;done=true;clearTimeout(timer);child?.kill();error?reject(error):resolve(text);};
    const timer=setTimeout(()=>finish(new Error('Document processing took too long. Try a smaller, text-based file.')),15000);
    function start(){
      // Native PDF failures must be isolated from the server process.
      child=fork(__filename,['--extract-document'],{execArgv:['--max-old-space-size=128'],serialization:'advanced',stdio:['ignore','ignore','ignore','ipc']});
      const current=child;
      current.on('message',r=>{if(r?.error)finish(new Error(r.error));else if(typeof r?.text==='string'&&r.text.length<=MAX_TEXT)finish(null,r.text);else finish(new Error('The document could not be processed.'));});
      current.on('error',()=>finish(new Error('The document could not be processed. Try a smaller PDF or DOCX.')));
      current.on('exit',(code,signal)=>{
        if(done)return;
        if(!retried&&(signal||code===3221225477||code<0)){retried=true;start();}
        else finish(new Error('The document could not be processed. Try a smaller PDF or DOCX.'));
      });
      current.send({buffer:file.buffer,ext},error=>{if(error&&current===child)finish(new Error('The document could not be processed.'));});
    }
    start();
  });
}
if(process.argv[2]==='--extract-document'&&process.send) process.once('message',workerData=>(async()=>{
  const buffer=Buffer.from(workerData.buffer);let text;
  if(workerData.ext==='pdf') {
    const {PDFParse}=require('pdf-parse');const parser=new PDFParse({data:buffer});
    try { const result=await parser.getText(); if(result.total>100)throw new Error('Use a document of at most 100 pages.');text=result.text; if (/^Answer Key\b/.test(text.trim())) text=await require('./socrative-key').readSocrativeKey(await parser.load()) || text; } finally { await parser.destroy(); }
  } else {
    const {unzipSync}=require('fflate');let total=0,found=false;
    unzipSync(buffer,{filter:f=>{total+=f.originalSize;if(total>20*1024*1024)throw new Error('The expanded document is too large.');if(f.name==='word/document.xml')found=true;return false;}});
    if(!found)throw new Error('The file does not contain a Word document.');
    text=(await require('mammoth').extractRawText({buffer})).value;
  }
  if(!text?.trim())throw new Error('No readable text was found. Scanned/image-only files need OCR before upload.');
  if(text.length>MAX_TEXT)throw new Error('Use source material under 60,000 characters. Split longer documents into sections.');
  process.send({text:text.trim()},()=>process.disconnect());
})().catch(e=>process.send({error:e.message || 'Unable to read this document.'},()=>process.disconnect())));
function parseTest(text,filename='Uploaded test') {
 if(typeof text!=='string'||!text.trim()||text.length>MAX_TEXT)throw new Error('Provide readable test text under 60,000 characters.');
 const template=parseSentenceBlocks(text,filename);if(template)return template;
 const warnings=[],questions=[],keys={};let current=null,title='',inKey=false;
 const normalize=s=>s.trim().replace(/\s+/g,' ').toLowerCase();
 const optionPattern=/^(?:[•●-]\s*)?(\*?)\(?([A-E])(?:\)|\.|:)\s*(.+)$/i;
 const questionPattern=/^(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[).:\-]\s*(.+)$/i;
 // PDF/Word often place options on one line or omit automatic numbering.
 const lines=text.replace(/\r\n?/g,'\n').replace(/[\u2028\u2029]/g,'\n')
   .replace(/([?])\s+(?=\(?A[).:]\s)/g,'$1\n')
   .replace(/\s+(?=\(?[B-E][).:]\s)/g,'\n').split('\n').map(s=>s.trim());
 const keyAt=lines.findIndex(s=>/^(?:answer\s*key|answers)\s*:?/i.test(s));
 if(keyAt>=0){const keyText=lines.slice(keyAt).join('\n').replace(/^(?:answer\s*key|answers)\s*:?/i,'');for(const m of keyText.matchAll(/(?:^|\n|[,;]\s*)(\d{1,3})\s*[).:\-]\s*([^\n,;]+)/g))keys[m[1]]=m[2].trim();}
 function finish(){if(!current)return;const q=current;const supplied=q.answer||keys[q.number]||'';delete q.answer;delete q.number;
   if(q.options.length){q.type='mc';const letter=supplied.match(/^\(?([A-E])\)?(?:[).:\s]|$)/i)?.[1]?.toUpperCase();const matched=q.options.find(o=>o.letter===letter)||q.options.find(o=>normalize(o.text)===normalize(supplied));const marks=q.options.filter(o=>o.marked);const conflict=marks.length>1||(marks.length===1&&supplied&&matched?.id!==marks[0].id);q.correctOptionId=conflict?'':marks.length===1?marks[0].id:matched?.id||'';q.answerKeyConflict=!!conflict;
     for(const o of q.options){delete o.letter;delete o.marked;}if(!q.correctOptionId)warnings.push('Question '+(questions.length+1)+': select the correct answer from the supplied key.');
   }else{q.type='blank';q.acceptedAnswers=supplied.split('|').map(s=>s.trim()).filter(Boolean);q.caseSensitive=false;delete q.options;if(!q.acceptedAnswers.length)warnings.push('Question '+(questions.length+1)+': enter accepted answers.');}
   questions.push(q);current=null;
 }
 function begin(value,number=String(questions.length+1)){finish();const point=value.match(/[([]\s*(\d+(?:\.\d{1,2})?)\s*(?:points?|pts?|marks?)\s*[)\]]/i);current={id:'q_'+randomUUID(),text:value,points:point?Number(point[1]):1,options:[],number,answer:''};}
 for(let i=0;i<lines.length;i++){
   const line=lines[i];if(!line||/^--\s*\d+\s*of\s*\d+\s*--$/i.test(line))continue;
   if(i===keyAt){inKey=true;}if(inKey)continue;
   const numbered=line.match(questionPattern);if(numbered){begin(numbered[2],numbered[1]);continue;}
   const answer=line.match(/^(?:answer|correct\s*answer)\s*[:=]\s*(.+)$/i);if(answer){if(current)current.answer=answer[1];continue;}
   const option=line.match(optionPattern);if(option&&current){const letter=option[2].toUpperCase();if(current.options.some(o=>o.letter===letter))throw new Error('Repeated option '+letter+'. Separate each question on its own line.');let value=option[3];const marked=!!option[1]||/\s*(?:\*|[✓✔]|\(correct\))$/i.test(value);value=value.replace(/\s*(?:\*|[✓✔]|\(correct\))$/i,'');current.options.push({id:current.id+'_'+letter.toLowerCase(),text:value,letter,marked});continue;}
   const next=lines.slice(i+1).find(Boolean)||'';
   const startsPrompt=optionPattern.test(next)||/^(?:answer|correct\s*answer)\s*[:=]/i.test(next)||/[?]|_{2,}/.test(line);
   if(startsPrompt && (!current||current.options.length||current.answer)){begin(line);continue;}
   if(!current){if(!title && !/[?]/.test(line))title=line.replace(/^(?:test\s*title|title)\s*:\s*/i,'');}
   else if(current.options.length)current.options.at(-1).text+=' '+line;
   else current.text+=' '+line;
 }
 finish();
 if(!questions.length)throw new Error('No test questions were recognized. Use numbered questions (1. or Question 1:) or a question followed by A) / B) options. Your source has been kept so you can correct the format.');
 if(questions.length>100)throw new Error('A test can contain at most100 questions.');
 return {test:{title:(title||filename.replace(/\.[^.]+$/,'')||'Uploaded test').slice(0,80),questions},warnings};
}
// Course exports use Question2. on its own line, then an instruction, a stem
// containing a blank, and one accepted answer or multiple unlabelled choices.
function parseSentenceBlocks(text,filename){
 if(!/^\s*Complete the sentences?\b/im.test(text))return null;
 const chunks=text.replace(/\r/g,'').split(/^\s*(?:Question|Q)\s*\d+\s*[.):]?\s*$/im).map(s=>s.trim()).filter(Boolean);
 if(chunks.length>100)throw new Error('A test can contain at most100 questions.');
 const questions=[],warnings=[];
 for(const chunk of chunks){
  const lines=chunk.split('\n').map(s=>s.trim()).filter(s=>s&&!/^--\s*\d+\s*of\s*\d+\s*--$/i.test(s)),instruction=lines.findIndex(s=>/^Complete the sentences?\b/i.test(s));
  if(instruction<0)return null;
  const stem=lines.findIndex((s,i)=>i>instruction&&/_{2,}/.test(s));if(stem<0)return null;
  const text=lines.slice(instruction,stem+1).join(' '),values=lines.slice(stem+1);if(!values.length)throw new Error('A sentence question has no answer or choices. Add its answers on separate lines.');
  const id='q_'+randomUUID();
  if(values.length===1){questions.push({id,type:'blank',points:1,text,acceptedAnswers:values[0].replace(/^(?:answer|correct answer)\s*:\s*/i,'').split('|').map(s=>s.trim()).filter(Boolean),caseSensitive:false});continue;}
  const answerLine=values.find(v=>/^(?:answer|correct answer)\s*:/i.test(v));
  const options=values.filter(v=>v!==answerLine).map((v,i)=>{const marked=/\s*(?:\*|[✓✔]|\(correct\))$/i.test(v);return {id:id+'_'+i,text:v.replace(/^[A-E][).:]\s*/i,'').replace(/\s*(?:\*|[✓✔]|\(correct\))$/i,''),marked};});
  if(options.length>5)throw new Error('Sentence question '+(questions.length+1)+' has more than5 choices. Put each complete choice on one line.');
  const key=answerLine?.replace(/^(?:answer|correct answer)\s*:\s*/i,'').trim();const marked=options.filter(o=>o.marked);const match=key?options.find(o=>o.text.toLowerCase()===key.toLowerCase())||(/^[A-E][).:]?$/i.test(key)?options[key.toUpperCase().charCodeAt(0)-65]:null):null;
  const conflict=marked.length>1||(marked.length===1&&key&&match?.id!==marked[0].id);const correctOptionId=conflict?'':marked.length===1?marked[0].id:match?.id||'';for(const o of options)delete o.marked;
  if(!correctOptionId)warnings.push('Question '+(questions.length+1)+': choices imported; select the correct answer (none was marked in the source).');
  questions.push({id,type:'mc',points:1,text,options,correctOptionId,answerKeyConflict:!!conflict});
 }
 return {test:{title:filename.replace(/\.[^.]+$/,'').slice(0,80)||'Uploaded test',questions},warnings};
}
module.exports={extractDocument,parseTest,MAX_BYTES,MAX_TEXT};
