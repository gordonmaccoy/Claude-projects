const { zipSync, strToU8 } = require('fflate');
const { privateView,detailedResults } = require('./exam');
const xml = value => String(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function workbook(session,detail=false) {
  const students = privateView(session).students.sort((a, b) => a.number.localeCompare(b.number, 'en', { numeric: true }) || a.number.localeCompare(b.number));
  const rows = detail ? [['student number','student name','question number','question','student answer','correct answer'],...detailedResults(session).sort((a,b)=>a.number.localeCompare(b.number,'en',{numeric:true})).flatMap(s=>s.incorrect.map(q=>[s.number,s.name,q.number,q.question,q.answer||'Unanswered',q.correct]))] : [['student number', 'student name', 'absolute score', 'percentage'],
    ...students.map(s => [s.number, s.name, s.score, s.score === null ? null : Math.round(s.score / (s.total || 1) * 10000) / 100])];
  const sheet = rows.map((row, i) => `<row r="${i + 1}">${row.map((v, j) => {
    const ref = `${String.fromCharCode(65+j)}${i + 1}`;
    return v === null ? `<c r="${ref}"/>` : typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Results" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="2" width="26" customWidth="1"/><col min="3" max="4" width="20" customWidth="1"/></cols><sheetData>${sheet}</sheetData><autoFilter ref="A1:${detail?'F':'D'}${rows.length}"/></worksheet>`,
  };
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([p, content]) => [p, strToU8(content)]))));
}
function exportFilename(session,detail=false) {
 const title=privateView(session).title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').trim().slice(0,120)||'OnScreen results';
 return (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(title)?'_'+title:title)+(detail?' - Detailed Results':'')+'.xlsx';
}
module.exports = { workbook,exportFilename };
