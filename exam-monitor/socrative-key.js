const {createCanvas}=require('@napi-rs/canvas');

const clean=text=>text.replace(/\0/g,'r').trim();

async function readSocrativeKey(document) {
  const first=await document.getPage(1);
  const firstItems=(await first.getTextContent()).items.filter(item=>item.str?.trim());
  if(firstItems[0]?.str.trim()!=='Answer Key' ||
    !/^[A-Za-z]+ \d{1,2}, \d{4}$/.test(firstItems[1]?.str.trim()||'')) return null;

  const title=clean(firstItems[2]?.str||'');
  const questions=[];
  let current;
  for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++) {
    const page=pageNumber===1?first:await document.getPage(pageNumber);
    const items=pageNumber===1?firstItems.slice(3):(await page.getTextContent()).items.filter(item=>item.str?.trim());
    const viewport=page.getViewport({scale:1.5});
    if(viewport.width*viewport.height>4_000_000) throw Error('Socrative answer key pages are too large.');
    const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
    const context=canvas.getContext('2d');
    await page.render({canvas,canvasContext:context,viewport}).promise;
    const rows=[];
    for(const item of items.sort((a,b)=>b.transform[5]-a.transform[5])) {
      const y=item.transform[5];
      if(!rows.length||Math.abs(rows.at(-1).y-y)>1.1) rows.push({y,items:[]});
      rows.at(-1).items.push(item);
    }
    for(const row of rows) {
      const ordered=row.items.sort((a,b)=>a.transform[4]-b.transform[4]);
      const [label,...rest]=ordered;
      const text=clean(rest.map(item=>item.str).join(' '));
      const number=label.str.trim().match(/^(\d+)\.$/);
      const letter=label.str.trim();
      if(number&&text) {
        if(Number(number[1])!==questions.length+1) throw Error('Socrative questions could not be matched in order.');
        current={text,options:[]};
        questions.push(current);
      } else if(current&&/^[A-E]$/.test(letter)&&text) {
        if(letter.charCodeAt(0)!==65+current.options.length) throw Error('Socrative answer choices could not be matched in order.');
        const [x,y]=viewport.convertToViewportPoint(label.transform[4],label.transform[5]);
        const pixels=context.getImageData(Math.max(0,Math.floor(x-23)),Math.max(0,Math.floor(y-14)),23,16).data;
        let green=0;
        for(let i=0;i<pixels.length;i+=4) {
          if(pixels[i+1]>pixels[i]+35&&pixels[i+1]>pixels[i+2]+30) green++;
        }
        current.options.push({letter,text,correct:green>=3});
      } else if(current) {
        const continuation=clean(ordered.map(item=>item.str).join(' '));
        if(current.options.length) current.options.at(-1).text+=' '+continuation;
        else current.text+=' '+continuation;
      }
    }
    canvas.width=1;
    canvas.height=1;
  }
  if(!title||!questions.length||questions.some(q=>q.options.length<2||q.options.filter(o=>o.correct).length!==1)) {
    throw Error('This Socrative answer key has a question without exactly one readable marked choice. Review the PDF before importing.');
  }
  return [title,...questions.flatMap((q,i)=>[
    (i+1)+'. '+q.text,
    ...q.options.map(o=>(o.correct?'*':'')+o.letter+') '+o.text)
  ])].join('\n');
}
module.exports={readSocrativeKey};
