const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {PDFDocument}=require('pdf-lib');

async function quizPdf(test) {
  const pdf=await PDFDocument.create();
  pdf.setTitle(test.title);
  const width=612,height=792,margin=44,scale=2;
  let canvas,context,y;
  function startPage(){
    canvas=createCanvas(width*scale,height*scale);
    context=canvas.getContext('2d');context.scale(scale,scale);
    context.fillStyle='white';context.fillRect(0,0,width,height);
    context.fillStyle='#082d5b';context.font='bold 14px sans-serif';
    context.fillText('Examio',margin,margin);
    y=margin+25;
  }
  async function savePage(){
    const page=pdf.addPage([width,height]);
    const image=await pdf.embedJpg(canvas.toBuffer('image/jpeg',86));
    page.drawImage(image,{x:0,y:0,width,height});
  }
  async function reserve(size){
    if(y+size<=height-margin)return;
    await savePage();startPage();
  }
  async function line(text,{size=12,bold=false,indent=0}={}){
    const font=(bold?'bold ':'')+size+'px sans-serif';
    const available=width-margin*2-indent;
    context.font=font;
    const rows=[];
    let current='';
    for(const word of String(text).split(/\s+/)){
      const next=current?current+' '+word:word;
      if(context.measureText(next).width<=available){current=next;continue;}
      if(current)rows.push(current);
      current='';
      for(const char of word){
        if(context.measureText(current+char).width>available){rows.push(current);current='';}
        current+=char;
      }
    }
    if(current)rows.push(current);
    for(const row of rows){
      await reserve(size*1.4);
      context.font=font;context.fillStyle='#102b42';context.fillText(row,margin+indent,y+size);
      y+=size*1.4;
    }
  }
  async function picture(source,indent=0){
    if(!source)return;
    const image=await loadImage(Buffer.from(source.split(',')[1],'base64'));
    const ratio=Math.min(1,(width-margin*2-indent)/image.width,230/image.height);
    const w=image.width*ratio,h=image.height*ratio;
    await reserve(h+8);
    context.drawImage(image,margin+indent,y+4,w,h);y+=h+8;
  }
  startPage();
  await line(test.title,{size:22,bold:true});y+=14;
  for(const [index,q] of test.questions.entries()){
    await reserve(42);
    await line((index+1)+'. '+q.text+' ('+(q.points??1)+' pt)',{bold:true});
    await picture(q.image);
    if(q.type==='blank'){
      await line('Answer: __________________________________________',{indent:14});
    }else{
      for(const [choiceIndex,option] of q.options.entries()){
        await line(String.fromCharCode(65+choiceIndex)+'. '+option.text,{indent:14});
        await picture(option.image,28);
      }
    }
    y+=13;
  }
  await savePage();
  return Buffer.from(await pdf.save());
}
module.exports={quizPdf};
