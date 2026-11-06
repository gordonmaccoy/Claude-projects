const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
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
    const worker=new Worker(__filename,{workerData:{buffer:file.buffer,ext},resourceLimits:{maxOldGenerationSizeMb:128}});
    let done=false;
    const finish=(error,text)=>{if(done)return;done=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(text);};
    const timer=setTimeout(()=>finish(new Error('Document processing took too long. Try a smaller, text-based file.')),15000);
    worker.on('message',r=>r.error?finish(new Error(r.error)):finish(null,r.text));
    worker.on('error',()=>finish(new Error('The document could not be processed. Try a smaller PDF or DOCX.')));
    worker.on('exit',code=>{if(!done)finish(new Error('The document could not be processed.'));});
  });
}
if(!isMainThread) (async()=>{
  const buffer=Buffer.from(workerData.buffer);let text;
  if(workerData.ext==='pdf') {
    const {PDFParse}=require('pdf-parse');const parser=new PDFParse({data:buffer});
    try { const result=await parser.getText(); if(result.total>100)throw new Error('Use a document of at most 100 pages.');text=result.text; } finally { await parser.destroy(); }
  } else {
    const {unzipSync}=require('fflate');let total=0,found=false;
    unzipSync(buffer,{filter:f=>{total+=f.originalSize;if(total>20*1024*1024)throw new Error('The expanded document is too large.');if(f.name==='word/document.xml')found=true;return false;}});
    if(!found)throw new Error('The file does not contain a Word document.');
    text=(await require('mammoth').extractRawText({buffer})).value;
  }
  if(!text?.trim())throw new Error('No readable text was found. Scanned/image-only files need OCR before upload.');
  if(text.length>MAX_TEXT)throw new Error('Use source material under 60,000 characters. Split longer documents into sections.');
  parentPort.postMessage({text:text.trim()});
})().catch(e=>parentPort.postMessage({error:e.message || 'Unable to read this document.'}));
function parseTest(text,filename='Uploaded test') {
  if(typeof text!=='string' || !text.trim() || text.length>MAX_TEXT)throw new Error('Provide readable test text under 60,000 characters.');
  const warnings=[],questions=[],key={};let current=null,title='',inKey=false;
  function finalize(){if(!current)return;const q=current;delete q.number;delete q.answer;
    if(q.options.length){q.type='mc';const letter=(currentAnswer||key[currentNumber]||'').trim().toUpperCase();const option=q.options.find(o=>o.letter===letter);q.correctOptionId=q.marked || option?.id || '';delete q.marked;for(const o of q.options)delete o.letter;if(!q.correctOptionId)warnings.push(`Question ${questions.length+1}: choose the correct answer.`);}
    else {q.type='blank';q.acceptedAnswers=(currentAnswer||key[currentNumber]||'').split('|').map(s=>s.trim()).filter(Boolean);q.caseSensitive=false;delete q.options;if(!q.acceptedAnswers.length)warnings.push(`Question ${questions.length+1}: add the accepted answer.`);}
    questions.push(q);current=null;
  }
  let currentAnswer='',currentNumber='';
  // Parse a separate answer-key block before interpreting numbered questions.
  const keyBlock=text.split(/(?:answer\s*key|answers)\s*:/i)[1];
  if(keyBlock) for(const match of keyBlock.matchAll(/(?:^|\n|[,;]\s*)(\d{1,3})\s*[).:\-]\s*([^\n,;]+)/g))key[match[1]]=match[2].trim();
  for(const raw of text.replace(/\r/g,'').split('\n')) {
    const line=raw.trim();if(!line || /^--\s*\d+\s*of\s*\d+\s*--$/i.test(line))continue;
    if(/^(?:answer\s*key|answers)\s*:/i.test(line)){inKey=true;continue;}if(inKey)continue;
    const q=line.match(/^(?:Q(?:uestion)?\s*)?(\d{1,3})[.)]\s+(.+)$/i);
    if(q){finalize();currentNumber=q[1];currentAnswer='';current={id:'q_'+randomUUID(),text:q[2],options:[]};continue;}
    const answer=line.match(/^(?:answer|correct\s*answer)\s*:\s*(.+)$/i);
    if(answer&&current){currentAnswer=answer[1];continue;}
    const option=line.match(/^(\*?)([A-E])[).]\s+(.+)$/i);
    if(option&&current){const id=current.id+'_'+option[2].toLowerCase();let value=option[3];const marked=!!option[1]||/\s*(?:\*|\(correct\))$/i.test(value);value=value.replace(/\s*(?:\*|\(correct\))$/i,'');current.options.push({id,text:value,letter:option[2].toUpperCase()});if(marked)current.marked=id;continue;}
    if(!current && !title)title=line;
    else if(current){const last=current.options.at(-1);if(last)last.text+=' '+line;else current.text+=' '+line;}
  }
  finalize();
  if(questions.length>100)throw new Error('A test can contain at most 100 questions.');
  if(!questions.length)warnings.push('No numbered questions found. Check the import format or add questions in the builder.');
  return {test:{title:(title||filename.replace(/\.[^.]+$/,'')).slice(0,80),questions},warnings};
}
module.exports={extractDocument,parseTest,MAX_BYTES,MAX_TEXT};
