const { zipSync, strToU8 } = require('fflate');
const { privateView,detailedResults } = require('./exam');
const xml = value => String(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const column = index => {
  let name='';
  for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;
  return name;
};
const average=values=>values.length?values.reduce((total,value)=>total+value,0)/values.length:null;
function detailedSheet(session,students) {
  const questions=session.test.questions;
  const answers=detailedResults(session).map(student=>student.answers);
  const byNumber=new Map(session.students.map((student,index)=>[student.number,answers[index]]));
  const submitted=students.filter(student=>student.result);
  const rows=[{values:['Student number','Name','Score',...questions.map((_,index)=>'Question '+(index+1))],style:3}];
  for(const student of students){
    const cells=byNumber.get(student.number);
    rows.push({values:[student.number,student.name,student.result?student.result.percentage/100:null,...cells.map(cell=>cell.answer||(cell.status==='incorrect'?'Unanswered':null))],
      styles:[0,0,4,...cells.map(cell=>cell.status==='correct'?1:cell.status==='incorrect'?2:6)],
      height:wrappedHeight(cells.map(cell=>cell.answer))});
  }
  rows.push({values:['Class average',null,average(submitted.map(student=>student.result.percentage/100)),...questions.map((_,index)=>average(submitted.map(student=>Number(byNumber.get(student.number)[index].status==='correct'))))],
    styles:[3,3,...Array(questions.length+1).fill(5)]});
  rows.push({values:['Question',null,null,...questions.map(question=>question.text)],style:6,height:wrappedHeight(questions.map(question=>question.text))});
  const keys=questions.map(question=>question.type==='blank'?question.acceptedAnswers.join(' / '):question.options.find(option=>option.id===question.correctOptionId)?.text||'');
  rows.push({values:['Correct Answer',null,null,...keys],styles:[3,3,3,...questions.map(()=>1)],height:wrappedHeight(keys)});
  const footer=students.length+2;
  return {rows,lastColumn:column(questions.length+2),filterEnd:students.length+1,
    merges:['A'+footer+':B'+footer,'A'+(footer+1)+':C'+(footer+1),'A'+(footer+2)+':C'+(footer+2)]};
}
function wrappedHeight(values) {
  return Math.min(409,Math.max(20,...values.map(value=>18*Math.max(1,Math.ceil(String(value||'').length/32))+5)));
}
function workbook(session,detail=false) {
  const students=privateView(session).students.sort((a,b)=>a.number.localeCompare(b.number,'en',{numeric:true})||a.number.localeCompare(b.number));
  const grid=detail?detailedSheet(session,students):null;
  const rows=grid?.rows||[
    {values:['student number','student name','absolute score','percentage']},
    ...students.map(s=>({values:[s.number,s.name,s.score,s.score===null?null:Math.round(s.score/(s.total||1)*10000)/100]}))
  ];
  const sheet=rows.map(({values,style,styles,height},i)=>`<row r="${i+1}"${height?' ht="'+height+'" customHeight="1"':''}>${values.map((value,j)=>{
    const ref=column(j)+(i+1);
    const cellStyle=styles?.[j]??style??0;
    const attrs=cellStyle?' s="'+cellStyle+'"':'';
    return value===null?`<c r="${ref}"${attrs}/>`:typeof value==='number'?`<c r="${ref}"${attrs}><v>${value}</v></c>`:`<c r="${ref}"${attrs} t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const columns=detail?`<col min="1" max="1" width="19" customWidth="1"/><col min="2" max="2" width="26" customWidth="1"/><col min="3" max="3" width="13" customWidth="1"/><col min="4" max="${session.test.questions.length+3}" width="32" customWidth="1"/>`:'<col min="1" max="2" width="26" customWidth="1"/><col min="3" max="4" width="20" customWidth="1"/>';
  const merges=grid?`<mergeCells count="${grid.merges.length}">${grid.merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join('')}</mergeCells>`:'';
  const views=detail?'<sheetViews><sheetView workbookViewId="0"><pane xSplit="3" ySplit="1" topLeftCell="D2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>':'';
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Results" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC7E8CF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFAD0D0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${views}<cols>${columns}</cols><sheetData>${sheet}</sheetData><autoFilter ref="A1:${grid?.lastColumn||'D'}${grid?.filterEnd||rows.length}"/>${merges}</worksheet>`,
  };
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([p, content]) => [p, strToU8(content)]))));
}
function exportFilename(session,detail=false) {
 const title=privateView(session).title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').trim().slice(0,120)||'OnScreen results';
 return (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(title)?'_'+title:title)+(detail?' - Detailed Results':'')+'.xlsx';
}
module.exports = { workbook,exportFilename };
