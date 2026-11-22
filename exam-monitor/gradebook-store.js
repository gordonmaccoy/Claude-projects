const {randomUUID}=require('node:crypto');
const {problem}=require('./account-store');
const names=['Alex Morgan','Minji Kim','Daniel Park','Sofia Rivera','Liam Chen','Emma Wilson','Noah Patel','Hana Lee','Ethan Brown','Yuna Choi','Olivia Martin','Lucas Silva','Mia Nguyen','Leo Thompson','Sara Ahmed'];
function createGradebookStore(pool,accounts){
 return {async init(){
  await pool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_gradebooks(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,data JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query('ALTER TABLE onscreen_v2_gradebooks ADD COLUMN IF NOT EXISTS sort_index INTEGER NOT NULL DEFAULT 0');
  await pool.query('CREATE INDEX IF NOT EXISTS onscreen_v2_gradebooks_owner ON onscreen_v2_gradebooks(owner_id)');
  await pool.query('ALTER TABLE onscreen_v2_gradebooks ENABLE ROW LEVEL SECURITY');
 },methods:{
  async listGradebooks(owner){return accounts.withOwner(owner,async()=>{
   const sample={id:'sample-'+owner,name:'Sample Gradebook',sample:true,students:names.map((name,index)=>({name,number:String(20261001+index)}))};
   await pool.query('INSERT INTO onscreen_v2_gradebooks(id,owner_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[sample.id,owner,JSON.stringify(sample)]);
   return (await pool.query("SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND data->>'deletedAt' IS NULL ORDER BY sort_index,created_at,id",[owner])).rows.map(row=>row.data);
  });},
  async createGradebook(owner,input){
   if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>120||Object.keys(input).some(key=>!['name','students'].includes(key)))throw problem('Enter a gradebook name (maximum 120 characters).',400);
   const students=input.students??[];
   if(!Array.isArray(students)||students.length>1000||students.some(s=>!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>120||typeof s.number!=='string'||s.number.length>64||Object.keys(s).some(k=>!['name','number'].includes(k))))throw problem('Use up to 1,000 students with a name and student number.',400);
   const numbers=students.map(s=>s.number.trim()).filter(Boolean);if(new Set(numbers).size!==numbers.length)throw problem('Student numbers must be unique.',400);
   return accounts.withOwner(owner,async()=>{const book={id:randomUUID(),name:input.name.trim(),sample:false,students:students.map(s=>({name:s.name.trim(),number:s.number.trim()})),columns:['name','number'],sortBy:'name'};await pool.query('INSERT INTO onscreen_v2_gradebooks(id,owner_id,data,sort_index) SELECT $1,$2,$3,COALESCE(MAX(sort_index),-1)+1 FROM onscreen_v2_gradebooks WHERE owner_id=$2',[book.id,owner,JSON.stringify(book)]);return book;});
  },
  async orderGradebooks(owner,ids){if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'))throw problem('Invalid gradebook order.',400);return accounts.withOwner(owner,async()=>{const existing=(await pool.query("SELECT id FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND data->>'deletedAt' IS NULL",[owner])).rows.map(r=>r.id);if(ids.length!==existing.length||ids.some(id=>!existing.includes(id)))throw problem('Gradebooks changed. Refresh and try again.',409);for(const [index,id]of ids.entries())await pool.query('UPDATE onscreen_v2_gradebooks SET sort_index=$3 WHERE owner_id=$1 AND id=$2',[owner,id,index]);return {ok:true};});},
  async sendResultsToGradebook(owner,id,sessionId){
   if(typeof sessionId!=='string'||!sessionId||sessionId.length>100)throw problem('Select valid quiz results.',400);
   return accounts.withOwner(owner,async()=>{
    const row=(await pool.query('SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND id=$2',[owner,id])).rows[0];
    if(!row||row.data.deletedAt)throw problem('Gradebook not found.',404);
    const session=(await pool.query("SELECT data FROM onscreen_v2_sessions WHERE owner_id=$1 AND id=$2 AND data->>'deletedAt' IS NULL",[owner,sessionId])).rows[0]?.data;
    if(!session||session.mode!=='test')throw problem('Quiz results not found.',404);
    const book=row.data;book.students=book.students.map(student=>({...student,id:student.id||randomUUID()}));
    const result=buildGradebookResult(book,session);book.revision=(book.revision||0)+1;
    book.assessments=book.assessments||[];
    const index=book.assessments.findIndex(item=>item.sessionId===sessionId);
    if(index<0&&book.assessments.length>=200)throw problem('This gradebook already contains 200 quizzes.',400);
    if(index<0)book.assessments.push(result);else book.assessments[index]=result;
    await pool.query('UPDATE onscreen_v2_gradebooks SET data=$3 WHERE owner_id=$1 AND id=$2',[owner,id,JSON.stringify(book)]);
    return {book,matched:result.matched,skipped:result.skipped.length};
   });
  },

  async getGradebook(owner,id){return accounts.withOwner(owner,async()=>{const row=(await pool.query('SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND id=$2',[owner,id])).rows[0];if(!row||row.data.deletedAt)throw problem('Gradebook not found.',404);return row.data;});},
  async changeGradebook(owner,id,input){return accounts.withOwner(owner,async()=>{const row=(await pool.query('SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND id=$2',[owner,id])).rows[0];if(!row||row.data.deletedAt)throw problem('Gradebook not found.',404);const book=row.data;
   if(input.action==='duplicate'){const copy={...book,id:randomUUID(),name:(book.name+' (copy)').slice(0,120),sample:false};await pool.query('INSERT INTO onscreen_v2_gradebooks(id,owner_id,data,sort_index) SELECT $1,$2,$3,COALESCE(MAX(sort_index),-1)+1 FROM onscreen_v2_gradebooks WHERE owner_id=$2',[copy.id,owner,JSON.stringify(copy)]);return copy;}
   if(input.action==='delete'){book.deletedAt=new Date().toISOString();}
   else if(input.action==='paste-grades'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Refresh and paste again.',409);
    const assessment=book.assessments?.find(a=>a.sessionId===input.sessionId);if(!assessment||!Array.isArray(input.grades)||!input.grades.length||input.grades.length>1000)throw problem('Invalid grade column.',400);
    const total=require('./public/gradebook-math').total(assessment),seen=new Set();for(const g of input.grades){if(!g||seen.has(g.studentId)||!book.students.some(st=>st.id===g.studentId)||(g.score!=='excused'&&(!Number.isFinite(g.score)||g.score<0||g.score>total)))throw problem('Check student rows and score limits. Nothing was changed.',400);seen.add(g.studentId);}
    const updates=input.grades.map(g=>({studentId:g.studentId,total,score:g.score==='excused'?null:g.score,percentage:g.score==='excused'?null:Math.round(g.score/total*10000)/100,excused:g.score==='excused',status:g.score==='excused'?'Excused':'Submitted'}));assessment.grades=assessment.grades.filter(g=>!seen.has(g.studentId)).concat(updates);book.revision=(book.revision||0)+1;
   }
   else if(input.action==='grade'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Refresh and try again.',409);
    const assessment=book.assessments?.find(a=>a.sessionId===input.sessionId),student=book.students.find(st=>st.id===input.studentId);if(!assessment||!student)throw problem('Grade not found.',404);
    const total=require('./public/gradebook-math').total(assessment),excused=input.score==='excused';if(!excused&&(!Number.isFinite(input.score)||input.score<0||input.score>total))throw problem('Enter a score between zero and the quiz total.',400);
    const grade={studentId:student.id,total,score:excused?null:input.score,percentage:excused?null:Math.round(input.score/total*10000)/100,excused,status:excused?'Excused':'Submitted'};assessment.grades=assessment.grades.filter(g=>g.studentId!==student.id);assessment.grades.push(grade);book.revision=(book.revision||0)+1;
   }
   else if(input.action==='roster'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Reopen the roster and try again.',409);
    if(!Array.isArray(input.students)||input.students.length>1000)throw problem('Use up to 1,000 students.',400);
    const numbers=new Set();for(const st of input.students){if(!st||typeof st.name!=='string'||!st.name.trim()||st.name.length>120||typeof st.number!=='string'||st.number.length>64||(st.number.trim()&&numbers.has(st.number.trim())))throw problem('Use valid names and unique student numbers.',400);if(st.number.trim())numbers.add(st.number.trim());}
    const normalize=v=>v.normalize('NFKC').trim().toLowerCase();
    book.students=input.students.map(st=>{const name=st.name.trim(),number=st.number.trim();const matches=book.students.filter(old=>number?old.number===number:!old.number&&normalize(old.name)===normalize(name));const unique=number||input.students.filter(other=>!other.number.trim()&&normalize(other.name)===normalize(name)).length===1;return {name,number,id:unique&&matches.length===1?(matches[0].id||randomUUID()):randomUUID()};});
    const keep=new Set(book.students.map(st=>st.id));book.assessments=(book.assessments||[]).map(a=>({...a,grades:a.grades.filter(g=>keep.has(g.studentId))}));book.revision=(book.revision||0)+1;
   }
   else if(input.action==='edit'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Reopen Edit and try again.',409);
    if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120||!Array.isArray(input.students)||input.students.length>1000||!Array.isArray(input.assessments)||input.assessments.length>(book.assessments||[]).length||new Set(input.assessments.map(a=>a?.sessionId)).size!==input.assessments.length)throw problem('Invalid gradebook changes.',400);
    const ids=new Set(),numbers=new Set();for(const student of input.students){if(!Number.isInteger(student.index)||!book.students[student.index]||ids.has(student.index)||typeof student.name!=='string'||!student.name.trim()||student.name.length>120||typeof student.number!=='string'||student.number.length>64||(student.number.trim()&&numbers.has(student.number.trim())))throw problem('Use unique student numbers and valid names.',400);ids.add(student.index);numbers.add(student.number.trim());}
    const students=input.students.map(st=>({...book.students[st.index],name:st.name.trim(),number:st.number.trim()}));
    const assessments=input.assessments.map(patch=>{const a=(book.assessments||[]).find(a=>a.sessionId===patch?.sessionId);if(!a||typeof patch.title!=='string'||!patch.title.trim()||patch.title.length>200||!Array.isArray(patch.scores)||patch.scores.length!==students.length)throw problem('Invalid quiz changes.',400);const grades=students.map((st,j)=>{const old=a.grades.find(g=>g.studentId===st.id),value=patch.scores[j];if(value===null)return {...old,studentId:st.id,score:null,percentage:null,status:old?.excused?'Excused':'Not submitted'};const total=old?.total??a.grades.find(g=>Number.isFinite(g.total))?.total;if(!Number.isFinite(value)||!Number.isFinite(total)||value<0||value>total)throw problem('Scores must be between zero and the quiz total.',400);return {...old,excused:false,studentId:st.id,score:value,total,percentage:Math.round(value/total*10000)/100,status:'Submitted'};});return {...a,title:patch.title.trim(),grades};});book.name=input.name.trim();book.students=students;book.assessments=assessments;book.revision=(book.revision||0)+1;
   }else throw problem('Invalid gradebook action.',400);
   await pool.query('UPDATE onscreen_v2_gradebooks SET data=$3 WHERE owner_id=$1 AND id=$2',[owner,id,JSON.stringify(book)]);return book;
  });},
  async gradebookPreferences(owner,id,input){if(!input||Object.keys(input).some(k=>!['columns','sortBy','showNames','gradeDisplay'].includes(k))||(input.showNames!==undefined&&typeof input.showNames!=='boolean')||(input.gradeDisplay!==undefined&&!['scores','percentage'].includes(input.gradeDisplay))||(input.sortBy!==undefined&&!['name','number'].includes(input.sortBy))||(input.columns!==undefined&&(!Array.isArray(input.columns)||input.columns.length!==2||new Set(input.columns).size!==2||input.columns.some(k=>!['name','number'].includes(k)))))throw problem('Invalid gradebook display options.',400);return accounts.withOwner(owner,async()=>{const row=(await pool.query('SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND id=$2',[owner,id])).rows[0];if(!row||row.data.deletedAt)throw problem('Gradebook not found.',404);const data={...row.data,...input};await pool.query('UPDATE onscreen_v2_gradebooks SET data=$3 WHERE owner_id=$1 AND id=$2',[owner,id,JSON.stringify(data)]);return data;});}
 }};
}
function buildGradebookResult(book,session){
 const normalize=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
 const source=require('./exam').privateView(session).students,grades=[],skipped=[],claimed=new Set();
 const key=student=>session.requireStudentNumber===false?normalize(student.name):String(student.number||'').trim();
 const counts=new Map();for(const student of source)counts.set(key(student),(counts.get(key(student))||0)+1);
 for(const student of source){const value=key(student),matches=value?book.students.filter(target=>key(target)===value):[];
  if(matches.length!==1||counts.get(value)!==1||claimed.has(matches[0]?.id)){skipped.push({name:student.name,number:session.requireStudentNumber===false?'':student.number,reason:matches.length>1||counts.get(value)>1?'Ambiguous match':'Not in gradebook'});continue;}
  const target=matches[0];claimed.add(target.id);const result=student.result;const absent=!student.name?.trim()||!result;const pending=!absent&&result.pending;
  grades.push({studentId:target.id,score:pending?null:!absent&&Number.isFinite(result.score)?result.score:0,total:result?.total??student.total,percentage:pending?null:!absent&&Number.isFinite(result.percentage)?result.percentage:0,status:!result?'Not submitted':result.pending?'Grading…':'Submitted'});
 }
 const total=require('./exam').totalPoints(session.test);for(const st of book.students)if(!claimed.has(st.id))grades.push({studentId:st.id,score:0,total,percentage:0,status:'Missing'});
 return {total,matched:claimed.size,sessionId:session.id,title:session.resultTitle||session.test.title,importedAt:new Date().toISOString(),grades,skipped};
}
module.exports={createGradebookStore,buildGradebookResult};
