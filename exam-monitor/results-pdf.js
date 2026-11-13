const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath(require('node:path').join(__dirname,'assets/fonts/NotoSansKR.ttf'),'Examio Korean');
const {PDFDocument}=require('pdf-lib');
const {privateView,detailedResults}=require('./exam');
async function resultsPdf(session,detail=false){
 const pdf=await PDFDocument.create(),view=privateView(session);pdf.setTitle(view.title+' - '+(detail?'Detailed Grades':'Summary Grades'));pdf.setAuthor('Examio');
 const W=595,H=842,M=42,S=2;let canvas,ctx,y,page=0;
 function start(){canvas=createCanvas(W*S,H*S);ctx=canvas.getContext('2d');ctx.scale(S,S);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#082d5b';ctx.font='bold 18px "Examio Korean"';ctx.fillText('Examio',M,40);ctx.font='10px "Examio Korean"';ctx.fillText(detail?'DETAILED GRADES':'SUMMARY GRADES',M,59);y=80;page++;}
 async function save(){ctx.fillStyle='#64748b';ctx.font='9px "Examio Korean"';ctx.fillText('Examio | '+session.id,M,H-24);ctx.fillText(String(page),W-M-15,H-24);const jpg=await pdf.embedJpg(canvas.toBuffer('image/jpeg',92));pdf.addPage([W,H]).drawImage(jpg,{x:0,y:0,width:W,height:H});}
 async function space(h){if(y+h>H-M){await save();start();}}
 function wrap(text,width,size,bold){ctx.font=(bold?'bold ':'')+size+'px "Examio Korean"';const lines=[];for(const part of String(text??'').split('\n')){let line='';for(const char of part){if(ctx.measureText(line+char).width>width&&line){lines.push(line);line='';}line+=char;}lines.push(line);}return lines;}
 async function text(value,{size=11,bold=false,color='#19334d'}={}){for(const line of wrap(value,W-M*2,size,bold)){await space(size*1.5);ctx.font=(bold?'bold ':'')+size+'px "Examio Korean"';ctx.fillStyle=color;ctx.fillText(line,M,y+size);y+=size*1.5;}}
 async function row(values,header=false){const widths=[98,210,95,108],lines=values.map((v,i)=>wrap(v,widths[i]-12,10,header)),height=Math.max(...lines.map(a=>a.length))*15+12;await space(height);ctx.fillStyle=header?'#e4edf7':page%2?'#f4f7fb':'#f9fafb';ctx.fillRect(M,y,W-M*2,height);let x=M;for(let i=0;i<values.length;i++){ctx.font=(header?'bold ':'')+'10px "Examio Korean"';ctx.fillStyle='#19334d';lines[i].forEach((line,j)=>ctx.fillText(line,x+6,y+15+j*15));x+=widths[i];}y+=height+2;}
 start();await text(view.title,{size:21,bold:true});y+=10;
 const students=[...view.students].sort((a,b)=>a.number.localeCompare(b.number,'en',{numeric:true}));await text(students.length+' students | '+students.filter(s=>s.result).length+' graded',{color:'#64748b'});y+=12;
 await row(['Student number','Name','Score','Percentage'],true);
 for(const s of students)await row([s.number,s.name,s.score===null?'Pending':s.score+' / '+s.total,s.result?s.result.percentage.toFixed(1)+'%':'-']);
 if(detail){y+=20;await text('Questions and answer key',{size:16,bold:true});for(const [i,q]of session.test.questions.entries()){y+=8;const key='Correct answer: '+(q.type==='blank'?q.acceptedAnswers.join(' / '):q.options.find(o=>o.id===q.correctOptionId)?.text||'');const heading=(i+1)+'. '+q.text;const blockHeight=(wrap(heading,W-M*2,11,true).length+wrap(key,W-M*2,11,false).length)*16.5;if(blockHeight<H-M-80)await space(blockHeight);else await space(50);await text(heading,{bold:true});await text(key);}
 for(const student of detailedResults(session)){y+=18;await space(50);await text(student.number+' | '+student.name,{size:15,bold:true});for(const answer of student.answers){await text('Q'+answer.number+': '+(answer.answer||'(unanswered)')+' ['+answer.status+']',{color:answer.status==='incorrect'?'#a82935':'#19334d'});}}}
 await save();return Buffer.from(await pdf.save());
}
module.exports={resultsPdf};
