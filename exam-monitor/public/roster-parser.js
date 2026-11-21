(function(root){
 function parseRoster(text){
  if(typeof text!=='string'||text.length>500000)throw Error('Roster is too large. Use up to 1,000 students.');
  text=text.replace(/^\uFEFF/,'').trim();if(!text)return [];
  const delimiter=text.includes('\t')?'\t':text.includes(',')?',':null;
  const rows=[];let row=[],value='',quoted=false;
  for(let i=0;i<=text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===delimiter||c==='\n'||c===undefined)){row.push(value.trim());value='';if(c!==delimiter){if(row.some(Boolean))rows.push(row);row=[];}}else if(c!=='\r')value+=c;}
  if(quoted)throw Error('A quoted field is unfinished. Check the roster.');
  const first=rows[0]||[],nameHeader=/^(student\s*)?name$|^이름$/i,numberHeader=/^(student\s*)?(number|id|no\.?|#)$|^학번$/i;
  let nameIndex=0,numberIndex=1;
  if(first.some(v=>nameHeader.test(v))){nameIndex=first.findIndex(v=>nameHeader.test(v));numberIndex=first.findIndex(v=>numberHeader.test(v));rows.shift();}
  else if(first.length===2&&/^\d+$/.test(first[0])&&!/^\d+$/.test(first[1])){nameIndex=1;numberIndex=0;}
  if(rows.length>1000)throw Error('Use up to 1,000 students.');
  const students=rows.map((r,i)=>{if(r.length>2)throw Error('Row '+(i+1)+': use only name and student number columns.');const name=r[nameIndex]||'',number=r[numberIndex]||'';if(!name||name.length>120||number.length>64)throw Error('Row '+(i+1)+': check the name and student number.');return {name,number};});
  const numbers=students.map(s=>s.number).filter(Boolean);if(new Set(numbers).size!==numbers.length)throw Error('Student numbers must be unique.');return students;
 }
 if(typeof module==='object')module.exports={parseRoster};else root.examioParseRoster=parseRoster;
})(typeof window==='object'?window:globalThis);
