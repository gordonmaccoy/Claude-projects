const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath(require('node:path').join(__dirname,'assets/fonts/NotoSansKR.ttf'),'Examio Korean');
const {PDFDocument}=require('pdf-lib');
const {privateView,detailedResults}=require('./exam');
async function resultsPdf(session,detail=false){
 const pdf=await PDFDocument.create(),view=privateView(session);pdf.setTitle(view.title+' - '+(detail?'Detailed Grades':'Summary Grades'));pdf.setAuthor('Examio');
 // Dense exams use A3 landscape so all 50 question labels remain legible in one matrix.
 const dense=detail&&(session.test?.questions.length||0)>25;
 const W=detail?(dense?1191:842):595,H=detail?(dense?842:595):842,M=detail?28:42,S=2;let canvas,ctx,y,page=0;
 function start(){canvas=createCanvas(W*S,H*S);ctx=canvas.getContext('2d');ctx.scale(S,S);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#082d5b';ctx.font='bold 18px "Examio Korean"';ctx.fillText('Examio',M,40);ctx.font='10px "Examio Korean"';ctx.fillText(detail?'DETAILED GRADES':'SUMMARY GRADES',M,59);y=80;page++;}
 async function save(){ctx.fillStyle='#64748b';ctx.font='9px "Examio Korean"';ctx.fillText('Examio | '+session.id,M,H-24);ctx.fillText(String(page),W-M-15,H-24);const jpg=await pdf.embedJpg(canvas.toBuffer('image/jpeg',92));pdf.addPage([W,H]).drawImage(jpg,{x:0,y:0,width:W,height:H});}
 async function space(h){if(y+h>H-M){await save();start();}}
 function wrap(text,width,size,bold){ctx.font=(bold?'bold ':'')+size+'px "Examio Korean"';const lines=[];for(const part of String(text??'').split('\n')){let line='';for(const char of part){if(ctx.measureText(line+char).width>width&&line){lines.push(line);line='';}line+=char;}lines.push(line);}return lines;}
 async function text(value,{size=11,bold=false,color='#19334d'}={}){for(const line of wrap(value,W-M*2,size,bold)){await space(size*1.5);ctx.font=(bold?'bold ':'')+size+'px "Examio Korean"';ctx.fillStyle=color;ctx.fillText(line,M,y+size);y+=size*1.5;}}
 async function row(values,header=false){const widths=[98,210,95,108],lines=values.map((v,i)=>wrap(v,widths[i]-12,10,header)),height=Math.max(...lines.map(a=>a.length))*15+12;await space(height);ctx.fillStyle=header?'#e4edf7':page%2?'#f4f7fb':'#f9fafb';ctx.fillRect(M,y,W-M*2,height);let x=M;for(let i=0;i<values.length;i++){ctx.font=(header?'bold ':'')+'10px "Examio Korean"';ctx.fillStyle='#19334d';lines[i].forEach((line,j)=>ctx.fillText(line,x+6,y+15+j*15));x+=widths[i];}y+=height+2;}
 start();await text(view.title,{size:21,bold:true});y+=10;
 const students=[...view.students].sort((a,b)=>a.number.localeCompare(b.number,'en',{numeric:true}));await text(students.length+' students | '+students.filter(s=>s.result).length+' graded',{color:'#64748b'});y+=12;
 if(!detail){
 await row(['Student number','Name','Score','Percentage'],true);
 for(const s of students)await row([s.number,s.name,s.score===null?'Pending':s.score+' / '+s.total,s.result?s.result.percentage.toFixed(1)+'%':'-']);
 }else{
 const questions=session.test.questions,details=new Map(detailedResults(session).map((s,i)=>[session.students[i].id,s]));
 const graded=students.filter(s=>s.result),percentages=graded.map(s=>s.result.percentage);
 const mean=percentages.length?percentages.reduce((a,b)=>a+b,0)/percentages.length:null;
 const fixed=[66,88,62,42],questionWidth=(W-M*2-fixed.reduce((a,b)=>a+b,0))/Math.max(questions.length,1);
 const widths=[...fixed,...questions.map(()=>questionWidth)],font=Math.max(5,Math.min(8,questionWidth/3.4));
 function cell(value,x,width,fill,size=font,bold=false){
 ctx.fillStyle=fill;ctx.fillRect(x,y,width,22);ctx.strokeStyle='#d4dde7';ctx.lineWidth=.4;ctx.strokeRect(x,y,width,22);
 const padding=width<25?1:3;
 ctx.save();ctx.beginPath();ctx.rect(x+padding,y+1,width-padding*2,20);ctx.clip();
 // Canvas resolves the bundled variable font's normal face to very thin strokes.
 // Its synthetic semibold face keeps compact Korean and numeric cells legible.
 ctx.fillStyle='#19334d';ctx.font='600 '+size+'px "Examio Korean"';
 let label=String(value??'');while(ctx.measureText(label).width>width-padding*2&&label.length>1)label=label.slice(0,-2)+'…';
 ctx.fillText(label,x+padding,y+14);ctx.restore();
 }
 function matrixRow(values,colors=[],header=false){let x=M;values.forEach((value,i)=>{cell(value,x,widths[i],colors[i]||(header?'#e4edf7':'#ffffff'),i<4?8:font,header);x+=widths[i];});y+=22;}
 async function matrixHeader(){
 await text('Class statistics | Average '+(mean===null?'-':mean.toFixed(1)+'%')+' | Highest '+(percentages.length?Math.max(...percentages).toFixed(1)+'%':'-')+' | Lowest '+(percentages.length?Math.min(...percentages).toFixed(1)+'%':'-'),{size:10});
 await text('Green = correct | Red = incorrect | Gray = unanswered before submission. Long responses are abbreviated.',{size:8,color:'#64748b'});y+=6;
 matrixRow(['Student no.','Name','State / score','%',...questions.map((_,i)=>'Q'+(i+1))],[],true);
 }
 await matrixHeader();
 for(const s of students){
 if(y+44>H-M-12){await save();start();await text(view.title,{size:15,bold:true});await matrixHeader();}
 const answers=details.get(s.id).answers;
 matrixRow([s.number,s.name,s.result?s.score+'/'+s.total:(s.failed?'Failed':'Pending'),s.result?s.result.percentage.toFixed(1):'-',...answers.map(a=>a.letter||a.answer||'-')],['','','','',...answers.map(a=>a.status==='correct'?'#dcf3e2':a.status==='incorrect'?'#fde1e3':'#f1f5f9')]);
 }
 if(y+44>H-M-12){await save();start();await matrixHeader();}
 matrixRow(['Question avg.','','','',...questions.map((_,i)=>{const count=graded.filter(s=>details.get(s.id).answers[i].status==='correct').length;return graded.length?(count/graded.length*100).toFixed(0)+'%':'-';})],[],true);
 await text('Question averages use submitted students. Values are percent correct.',{size:8,color:'#64748b'});
 await save();start();await text('Questions and answer key',{size:16,bold:true});
 for(const [i,q]of questions.entries()){y+=8;const key='Correct answer: '+(q.type==='blank'?q.acceptedAnswers.join(' / '):q.options.find(o=>o.id===q.correctOptionId)?.text||'');const heading=(i+1)+'. '+q.text;const blockHeight=(wrap(heading,W-M*2,11,true).length+wrap(key,W-M*2,11,false).length)*16.5;if(blockHeight<H-M-80)await space(blockHeight);else await space(50);await text(heading,{bold:true});await text(key);}
 }
 await save();return Buffer.from(await pdf.save());
}
module.exports={resultsPdf};
