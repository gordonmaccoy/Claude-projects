// Some quiz exporters write every stem first, then all choices, rather than
// visual reading order. Recover only an unambiguous single-column MC layout.
async function readPositionedChoiceTest(document, title='Uploaded test') {
 const questions=[];let current, labelX, previous;
 for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++) {
  const page=await document.getPage(pageNumber);
  const items=(await page.getTextContent()).items.filter(item=>item.str?.trim());
  const rows=[];
  for(const item of items.sort((a,b)=>b.transform[5]-a.transform[5])) {
   const y=item.transform[5];
   if(!rows.length||Math.abs(rows.at(-1).y-y)>1.1)rows.push({y,items:[]});
   rows.at(-1).items.push(item);
  }
  for(const row of rows) {
   const ordered=row.items.sort((a,b)=>a.transform[4]-b.transform[4]);
   const [label,...rest]=ordered, marker=label.str.trim();
   const text=rest.map(item=>item.str).join(' ').trim();
   if(/^(?:Name|Date|Score)$/i.test(ordered.map(item=>item.str).join(' ').trim()))continue;
   if(/^(?:answer|correct\s+answer|answer\s+key|answers)\s*[:=]/i.test(ordered.map(item=>item.str).join(' ').trim()))return null;
   const number=marker.match(/^(\d+)\.$/);
   if(number&&text) {
    if(Number(number[1])!==questions.length+1 || (labelX!==undefined&&Math.abs(label.transform[4]-labelX)>12))return null;
    if(current&&current.options.length<2)return null;
    labelX=label.transform[4];current={text,options:[]};questions.push(current);
   } else if(current&&/^[A-E]$/.test(marker)&&text) {
    if(Math.abs(label.transform[4]-labelX)>12||marker.charCodeAt(0)!==65+current.options.length)return null;
    current.options.push({letter:marker,text});
   } else if(current) {
    // Do not silently assign another column, footer or unfamiliar label to an answer.
    if(!previous||previous.page!==pageNumber||Math.abs(label.transform[4]-previous.x)>12||previous.y-row.y<=0||previous.y-row.y>previous.height*1.8)return null;
    const continuation=ordered.map(item=>item.str).join(' ').trim();
    if(current.options.length)current.options.at(-1).text+=' '+continuation;
    else current.text+=' '+continuation;
   }
   if(current){const textItem=rest.length&&(number||/^[A-E]$/.test(marker))?rest[0]:label;previous={page:pageNumber,x:textItem.transform[4],y:row.y,height:Math.max(8,textItem.height||Math.abs(textItem.transform[3])||11)};}
  }
 }
 if(!questions.length||questions.some(q=>q.options.length<2||q.options.length>5))return null;
 return ['Title: '+String(title).replace(/[\r\n]+/g,' ').trim(),...questions.flatMap((q,i)=>[(i+1)+'. '+q.text,...q.options.map(o=>o.letter+') '+o.text)])].join('\n').replace(/\0/g,'\uFFFD');
}
module.exports={readPositionedChoiceTest};
