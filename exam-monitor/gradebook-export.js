const {unzipSync,zipSync,strToU8}=require('fflate');
function gradebookWorkbook(book){
 const exam=require('./exam'),session=exam.newSession('export',{title:'Gradebook',questions:[{id:'q',text:'Q',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionId:'a'}]});
 const files=unzipSync(require('./export').workbook(session));const escape=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const columns=book.columns||['name','number'],assessments=book.assessments||[],students=[...book.students].sort((a,b)=>a[book.sortBy||'name'].localeCompare(b[book.sortBy||'name'],undefined,{numeric:book.sortBy==='number'}));
 const rows=[[book.name],[...columns.map(c=>c==='name'?'Student name':'Student number'),...assessments.flatMap(a=>[a.title+' — Score',a.title+' — Total',a.title+' — %'])],...students.map(s=>[...columns.map(c=>c==='name'&&book.showNames===false?'****':s[c]),...assessments.flatMap(a=>{const g=a.grades.find(g=>g.studentId===s.id);return [g?.score??'',g?.total??'',g?.percentage??''];})])];
 const col=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
 files['xl/worksheets/sheet1.xml']=strToU8('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" state="frozen"/></sheetView></sheetViews><sheetData>'+rows.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>'<c r="'+col(j)+(i+1)+'"'+(typeof v==='number'?'><v>'+v+'</v>':' t="inlineStr"><is><t>'+escape(v)+'</t></is>')+'</c>').join('')+'</row>').join('')+'</sheetData></worksheet>');return Buffer.from(zipSync(files));
}
module.exports={gradebookWorkbook};
