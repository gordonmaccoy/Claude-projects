const {randomUUID}=require('node:crypto');
const {problem}=require('./account-store');
function createGradebookStore(pool,accounts){
 const store={async init(){
  await pool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_gradebooks(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,data JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query('ALTER TABLE onscreen_v2_gradebooks ADD COLUMN IF NOT EXISTS sort_index INTEGER NOT NULL DEFAULT 0');
  await pool.query('CREATE INDEX IF NOT EXISTS onscreen_v2_gradebooks_owner ON onscreen_v2_gradebooks(owner_id)');
  await pool.query('ALTER TABLE onscreen_v2_gradebooks ENABLE ROW LEVEL SECURITY');
  await pool.query('CREATE TABLE IF NOT EXISTS onscreen_v2_gradebook_history(id BIGSERIAL PRIMARY KEY,owner_id TEXT NOT NULL,changes JSONB NOT NULL)');
  await pool.query('CREATE INDEX IF NOT EXISTS gradebook_history_owner ON onscreen_v2_gradebook_history(owner_id,id)');
  await pool.query('ALTER TABLE onscreen_v2_gradebook_history ENABLE ROW LEVEL SECURITY');
  await pool.query("UPDATE onscreen_v2_gradebooks SET data=data || '{\"sortBy\":\"number\",\"numberSortDefaultVersion\":1}'::jsonb WHERE NOT (data ? 'numberSortDefaultVersion')");
 },methods:{
  async listGradebooks(owner){return accounts.withOwner(owner,async()=>{
   const sample=require('./gradebook-sample').sampleGradebook(owner);
   await pool.query('INSERT INTO onscreen_v2_gradebooks(id,owner_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[sample.id,owner,JSON.stringify(sample)]);
   return (await pool.query("SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND data->>'deletedAt' IS NULL AND data->>'archivedAt' IS NULL ORDER BY sort_index,created_at,id",[owner])).rows.map(row=>row.data);
  });},
  async createGradebook(owner,input){
   if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>120||Object.keys(input).some(key=>!['name','students'].includes(key)))throw problem('Enter a gradebook name (maximum 120 characters).',400);
   const students=input.students??[];
   if(!Array.isArray(students)||students.length>1000||students.some(s=>!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>120||typeof s.number!=='string'||s.number.length>64||Object.keys(s).some(k=>!['name','number'].includes(k))))throw problem('Use up to 1,000 students with a name and student number.',400);
   const numbers=students.map(s=>s.number.trim()).filter(Boolean);if(new Set(numbers).size!==numbers.length)throw problem('Student numbers must be unique.',400);
   return accounts.withOwner(owner,async()=>{const book={id:randomUUID(),name:input.name.trim(),sample:false,students:students.map(s=>({name:s.name.trim(),number:s.number.trim()})),columns:['name','number'],sortBy:'number',numberSortDefaultVersion:1};await pool.query('INSERT INTO onscreen_v2_gradebooks(id,owner_id,data,sort_index) SELECT $1,$2,$3,COALESCE(MAX(sort_index),-1)+1 FROM onscreen_v2_gradebooks WHERE owner_id=$2',[book.id,owner,JSON.stringify(book)]);return book;});
  },
  async orderGradebooks(owner,ids){if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'))throw problem('Invalid gradebook order.',400);return accounts.withOwner(owner,async()=>{const existing=(await pool.query("SELECT id FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND data->>'deletedAt' IS NULL AND data->>'archivedAt' IS NULL",[owner])).rows.map(r=>r.id);if(ids.length!==existing.length||ids.some(id=>!existing.includes(id)))throw problem('Gradebooks changed. Refresh and try again.',409);for(const [index,id]of ids.entries())await pool.query('UPDATE onscreen_v2_gradebooks SET sort_index=$3 WHERE owner_id=$1 AND id=$2',[owner,id,index]);return {ok:true};});},
  async sendResultsToGradebook(owner,id,sessionId,destination){
   if(typeof sessionId!=='string'||!sessionId||sessionId.length>100)throw problem('Select valid quiz results.',400);
   return accounts.withOwner(owner,async()=>{
    const row=(await pool.query('SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND id=$2',[owner,id])).rows[0];
    if(!row||row.data.deletedAt)throw problem('Gradebook not found.',404);
    if(row.data.archivedAt)throw problem('Unarchive this gradebook before editing.',409);
    const locations=require('./public/gradebook-math').importLocations(row.data);if(!locations.length)throw problem('Imported quizzes are disabled for this gradebook. Select a category in Gradebook Setup first.',400);
    const session=(await pool.query("SELECT data FROM onscreen_v2_sessions WHERE owner_id=$1 AND id=$2 AND data->>'deletedAt' IS NULL",[owner,sessionId])).rows[0]?.data;
    if(!session||session.mode!=='test')throw problem('Quiz results not found.',404);
    const book=row.data;book.students=book.students.map(student=>({...student,id:student.id||randomUUID()}));
    const result=buildGradebookResult(book,session);book.revision=(book.revision||0)+1;
    book.assessments=book.assessments||[];
    const index=book.assessments.findIndex(item=>item.sessionId===sessionId);
    if(index<0&&book.assessments.length>=200)throw problem('This gradebook already contains 200 quizzes.',400);
    let chosen=destination;if(chosen&&!locations.some(l=>l.categoryId===chosen.categoryId&&(l.sectionId||'')===(chosen.sectionId||'')))throw problem('Choose an enabled import location.',400);if(!chosen&&locations.length>1)throw problem('Choose where to save these quiz results.',400);chosen=chosen||locations[0];
    result.categoryId=destination||index<0?chosen.categoryId:(book.assessments[index].categoryId||book.quizCategoryId||'daily-quizzes');
    const category=book.categories?.find(c=>c.id===result.categoryId);
    if(category?.sections?.length)result.sectionId=destination||index<0?chosen.sectionId:book.assessments[index].sectionId;
    if(index<0)book.assessments.push(result);else{result.included=book.assessments[index].included;book.assessments[index]=result;}
    await pool.query('UPDATE onscreen_v2_gradebooks SET data=$3 WHERE owner_id=$1 AND id=$2',[owner,id,JSON.stringify(book)]);
    return {book,matched:result.matched,skipped:result.skipped.length};
   });
  },

  async archivedGradebooks(owner){return accounts.withOwner(owner,async()=>(await pool.query("SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND data->>'deletedAt' IS NULL AND data->>'archivedAt' IS NOT NULL ORDER BY (data->>'archivedAt')::numeric DESC",[owner])).rows.map(r=>r.data));},
  async getGradebook(owner,id){return accounts.withOwner(owner,async()=>{const row=(await pool.query('SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND id=$2',[owner,id])).rows[0];if(!row||row.data.deletedAt)throw problem('Gradebook not found.',404);return row.data;});},
  async changeGradebook(owner,id,input){return accounts.withOwner(owner,async()=>{const row=(await pool.query('SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND id=$2',[owner,id])).rows[0];if(!row||row.data.deletedAt)throw problem('Gradebook not found.',404);const book=row.data;
   if(book.archivedAt&&input.action!=='unarchive')throw problem('Unarchive this gradebook before editing.',409);
   if(input.action==='duplicate'||input.action==='duplicate-blank'){const blank=input.action==='duplicate-blank',copy={...book,id:randomUUID(),name:blank?book.name.slice(0,107)+' (blank copy)':(book.name+' (copy)').slice(0,120),sample:false};if(blank){copy.revision=0;copy.students=[];copy.assessments=(book.assessments||[]).map(a=>({sessionId:'manual-'+randomUUID(),title:a.title,categoryId:a.categoryId||'daily-quizzes',...(a.sectionId?{sectionId:a.sectionId}:{}),manual:true,total:require('./public/gradebook-math').total(a),included:a.included!==false,importedAt:new Date().toISOString(),grades:[],skipped:[],...(a.scoringColumns?{scoringColumns:a.scoringColumns.map(c=>({id:randomUUID(),name:c.name,maximum:c.maximum,scores:[]}))}:{})}));}await pool.query('INSERT INTO onscreen_v2_gradebooks(id,owner_id,data,sort_index) SELECT $1,$2,$3,COALESCE(MAX(sort_index),-1)+1 FROM onscreen_v2_gradebooks WHERE owner_id=$2',[copy.id,owner,JSON.stringify(copy)]);return copy;}
   if(input.action==='archive'){book.archivedAt=Date.now();book.revision=(book.revision||0)+1;}
   else if(input.action==='unarchive'){delete book.archivedAt;book.revision=(book.revision||0)+1;}
   else if(input.action==='delete'){book.deletedAt=new Date().toISOString();}
   else if(input.action==='setup'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Reopen setup and try again.',409);
    const categories=input.categories;
    if(!Array.isArray(categories)||!categories.length||categories.length>20||categories.some(c=>!c||typeof c.id!=='string'||!c.id||c.id.length>80||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||!Number.isFinite(c.weight)||c.weight<0||c.weight>100)||new Set(categories.map(c=>c.id)).size!==categories.length||new Set(categories.map(c=>c.name.trim().toLowerCase())).size!==categories.length||Math.abs(categories.reduce((n,c)=>n+c.weight,0)-100)>0.001)throw problem('Use unique category names and weights totaling 100%.',400);
    if(!Array.isArray(input.importLocations)&&input.quizCategoryId!==''&&!categories.some(c=>c.id===input.quizCategoryId))throw problem('Select a category for imported quizzes.',400);
    if((book.assessments||[]).some(a=>!categories.some(c=>c.id===(a.categoryId||book.quizCategoryId||'daily-quizzes'))))throw problem('Categories containing grades cannot be removed.',400);
    for(const c of categories){const old=book.categories?.find(v=>v.id===c.id);if(old?.sections?.length&&Math.abs(old.sections.reduce((n,v)=>n+v.weight,0)-c.weight)>0.001)throw problem('Update section weights before changing this category weight, or remove its sections first.',400);}
    book.categories=categories.map(c=>({...book.categories?.find(v=>v.id===c.id),id:c.id,name:c.name.trim(),weight:c.weight}));book.quizCategoryId=input.quizCategoryId;if(input.importLocations!==undefined){const locations=input.importLocations;if(!Array.isArray(locations)||locations.length>400||locations.some(l=>{const c=book.categories.find(c=>c.id===l?.categoryId);return !c||(c.sections?.length?!c.sections.some(s=>s.id===l.sectionId):!!l.sectionId);})||new Set(locations.map(l=>JSON.stringify([l.categoryId,l.sectionId||'']))).size!==locations.length)throw problem('Select valid quiz import locations.',400);book.importLocations=locations.map(l=>({categoryId:l.categoryId,...(l.sectionId?{sectionId:l.sectionId}:{})}));book.quizCategoryId=locations[0]?.categoryId||'';}else delete book.importLocations;book.revision=(book.revision||0)+1;
   }
   else if(input.action==='rubric'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Reopen Rubric.',409);
    const r=input.rubric;if(!r||!Array.isArray(r.thresholds)||r.thresholds.length!==8||r.thresholds.some((n,i)=>!Number.isFinite(n)||n<0||n>100||i>0&&n>=r.thresholds[i-1])||typeof r.curved!=='boolean'||typeof r.maxCurve!=='boolean'||![r.aCap,r.bCap].every(n=>Number.isFinite(n)&&n>=0&&n<=100)||r.aCap>r.bCap)throw problem('Use descending grade thresholds from 0–100. The B0–A+ cap must be at least the A0/A+ cap.',400);
    book.rubric={thresholds:r.thresholds,curved:r.curved,maxCurve:r.maxCurve,aCap:r.aCap,bCap:r.bCap};book.revision=(book.revision||0)+1;
   }
   else if(input.action==='sections'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Reopen Sections setup.',409);
    book.categories=book.categories||[{id:'daily-quizzes',name:'Daily Quizzes',weight:100}];
    const category=book.categories.find(c=>c.id===input.categoryId),sections=input.sections;
    if(!category||!Array.isArray(sections)||sections.length>20||sections.some(c=>!c||typeof c.id!=='string'||!c.id||c.id.length>80||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||!Number.isFinite(c.weight)||c.weight<0||c.weight>100)||new Set(sections.map(c=>c.id)).size!==sections.length||new Set(sections.map(c=>c.name.trim().toLowerCase())).size!==sections.length||sections.length&&Math.abs(sections.reduce((n,c)=>n+c.weight,0)-category.weight)>0.001)throw problem('Use unique section names with weights adding up to the category weight.',400);
    const items=(book.assessments||[]).filter(a=>(a.categoryId||'daily-quizzes')===category.id),assignments=input.assignments;
    if(!Array.isArray(assignments)||assignments.length!==items.length||new Set(assignments.map(a=>a?.sessionId)).size!==items.length||assignments.some(a=>!a||!items.some(v=>v.sessionId===a.sessionId)||sections.length&&!sections.some(v=>v.id===a.sectionId)))throw problem('Assign each grade column to a section.',400);
    if(sections.length&&!sections.some(c=>c.id===input.importSectionId))throw problem('Choose a section for new imported quizzes.',400);
    const oldLocations=require('./public/gradebook-math').importLocations(book),enabled=oldLocations.some(l=>l.categoryId===category.id);
    category.sections=sections.map(c=>({id:c.id,name:c.name.trim(),weight:c.weight}));category.importSectionId=sections.length?input.importSectionId:null;
    if(Array.isArray(book.importLocations)){const retained=oldLocations.filter(l=>l.categoryId!==category.id);if(enabled)retained.push({categoryId:category.id,...(sections.length?{sectionId:input.importSectionId}:{})});book.importLocations=retained;}
    for(const a of items){if(sections.length)a.sectionId=assignments.find(v=>v.sessionId===a.sessionId).sectionId;else delete a.sectionId;}
    book.revision=(book.revision||0)+1;
   }
   else if(input.action==='delete-assessment'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Refresh and try again.',409);
    if(!book.assessments?.some(a=>a.sessionId===input.sessionId))throw problem('Assignment column not found.',404);
    book.assessments=book.assessments.filter(a=>a.sessionId!==input.sessionId);book.revision=(book.revision||0)+1;
   }
   else if(input.action==='include-assessment'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Refresh and try again.',409);
    const assessment=book.assessments?.find(a=>a.sessionId===input.sessionId);if(!assessment||typeof input.included!=='boolean')throw problem('Select a valid assessment.',400);assessment.included=input.included;book.revision=(book.revision||0)+1;
   }
   else if(input.action==='order-assessments'){

    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Refresh and try again.',409);
    const all=book.assessments||[],manual=all.filter(a=>(a.categoryId||'daily-quizzes')===input.categoryId),ids=input.ids;
    if(!Array.isArray(ids)||ids.length!==manual.length||new Set(ids).size!==ids.length||ids.some(id=>!manual.some(a=>a.sessionId===id)))throw problem('Invalid column order.',400);
    if(input.moveSection){const category=book.categories?.find(c=>c.id===input.categoryId),assessment=manual.find(a=>a.sessionId===input.moveSection.sessionId);if(!assessment||!category?.sections?.some(s=>s.id===input.moveSection.sectionId))throw problem('Choose a valid section in this category.',400);assessment.sectionId=input.moveSection.sectionId;}
    let index=0;book.assessments=all.map(a=>{if(!manual.includes(a))return a;const id=ids[index++];return manual.find(item=>item.sessionId===id);});book.revision=(book.revision||0)+1;
   }
   else if(input.action==='detailed-scores'){

    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Reopen Scores and try again.',409);
    const a=book.assessments?.find(a=>a.sessionId===input.sessionId);if(!a?.manual)throw problem('Select a manually added assessment.',400);
    const columns=input.columns;if(!Array.isArray(columns)||!columns.length||columns.length>50||columns.some(c=>!c||typeof c.id!=='string'||!c.id||c.id.length>80||typeof c.name!=='string'||!c.name.trim()||c.name.length>100||!Number.isFinite(c.maximum)||c.maximum<=0||c.maximum>100000||!Array.isArray(c.scores)||c.scores.length>1000)||new Set(columns.map(c=>c.id)).size!==columns.length)throw problem('Enter grading column names and positive maximum points.',400);
    for(const c of columns){const seen=new Set();for(const g of c.scores){if(!g||seen.has(g.studentId)||!book.students.some(st=>st.id===g.studentId)||(g.score!==null&&(!Number.isFinite(g.score)||g.score<0||g.score>c.maximum)))throw problem('Check student scores and maximum points.',400);seen.add(g.studentId);}}
    const total=columns.reduce((n,c)=>n+c.maximum,0);if(total>100000)throw problem('Total maximum points cannot exceed 100,000.',400);
    a.scoringColumns=columns.map(c=>({id:c.id,name:c.name.trim(),maximum:c.maximum,scores:c.scores.map(g=>({studentId:g.studentId,score:g.score}))}));a.total=total;
    a.grades=book.students.map(st=>{const old=a.grades.find(g=>g.studentId===st.id),score=Math.round(columns.reduce((n,c)=>n+(c.scores.find(g=>g.studentId===st.id)?.score||0),0)*10000)/10000;return {studentId:st.id,total,score:old?.excused?null:score,percentage:old?.excused?null:Math.round(score/total*10000)/100,excused:!!old?.excused,status:old?.excused?'Excused':'Submitted'};});book.revision=(book.revision||0)+1;
   }
   else if(input.action==='add-assessment'){

    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Try again.',409);
    if(!(book.categories||[{id:'daily-quizzes'}]).some(c=>c.id===input.categoryId)||typeof input.title!=='string'||!input.title.trim()||input.title.length>200||!Number.isFinite(input.total)||input.total<=0||input.total>100000||(book.assessments||[]).length>=200)throw problem('Enter a title and a valid maximum score.',400);
    const category=book.categories?.find(c=>c.id===input.categoryId);if(category?.sections?.length&&!category.sections.some(c=>c.id===input.sectionId))throw problem('Choose a section for this grade column.',400);
    book.students=book.students.map(st=>({...st,id:st.id||randomUUID()}));book.assessments=book.assessments||[];
    book.assessments.push({sessionId:'manual-'+randomUUID(),categoryId:input.categoryId,...(category?.sections?.length?{sectionId:input.sectionId}:{}),title:input.title.trim(),total:input.total,importedAt:new Date().toISOString(),grades:[],skipped:[],manual:true});book.revision=(book.revision||0)+1;
   }
   else if(input.action==='paste-grades'){

    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Refresh and paste again.',409);
    const assessment=book.assessments?.find(a=>a.sessionId===input.sessionId);if(!assessment||!Array.isArray(input.grades)||!input.grades.length||input.grades.length>1000)throw problem('Invalid grade column.',400);
    if(assessment.scoringColumns?.length>1)throw problem('Use the Scores button to edit detailed grades.',400);const total=require('./public/gradebook-math').total(assessment),seen=new Set();for(const g of input.grades){if(!g||seen.has(g.studentId)||!book.students.some(st=>st.id===g.studentId)||(g.score!=='excused'&&(!Number.isFinite(g.score)||g.score<0||g.score>total)))throw problem('Check student rows and score limits. Nothing was changed.',400);seen.add(g.studentId);}
    const updates=input.grades.map(g=>({studentId:g.studentId,total,score:g.score==='excused'?null:g.score,percentage:g.score==='excused'?null:Math.round(g.score/total*10000)/100,excused:g.score==='excused',status:g.score==='excused'?'Excused':'Submitted'}));assessment.grades=assessment.grades.filter(g=>!seen.has(g.studentId)).concat(updates);if(assessment.scoringColumns?.length===1){const c=assessment.scoringColumns[0];for(const g of input.grades)if(g.score!=='excused'){c.scores=c.scores.filter(v=>v.studentId!==g.studentId);c.scores.push({studentId:g.studentId,score:g.score});}}book.revision=(book.revision||0)+1;
   }
   else if(input.action==='grade'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Refresh and try again.',409);
    const assessment=book.assessments?.find(a=>a.sessionId===input.sessionId),student=book.students.find(st=>st.id===input.studentId);if(!assessment||!student)throw problem('Grade not found.',404);
    if(assessment.scoringColumns?.length&&input.score!=='excused'){if(assessment.scoringColumns.length>1&&!assessment.grades.find(g=>g.studentId===student.id)?.excused)throw problem('Use the Scores button to edit detailed grades.',400);if(assessment.grades.find(g=>g.studentId===student.id)?.excused)input.score=assessment.scoringColumns.reduce((n,c)=>n+(c.scores.find(g=>g.studentId===student.id)?.score||0),0);}const total=require('./public/gradebook-math').total(assessment),excused=input.score==='excused';if(!excused&&(!Number.isFinite(input.score)||input.score<0||input.score>total))throw problem('Enter a score between zero and the quiz total.',400);
    const grade={studentId:student.id,total,score:excused?null:input.score,percentage:excused?null:Math.round(input.score/total*10000)/100,excused,status:excused?'Excused':'Submitted'};assessment.grades=assessment.grades.filter(g=>g.studentId!==student.id);assessment.grades.push(grade);if(assessment.scoringColumns?.length===1&&!excused){const c=assessment.scoringColumns[0];c.scores=c.scores.filter(g=>g.studentId!==student.id);c.scores.push({studentId:student.id,score:input.score});}book.revision=(book.revision||0)+1;
   }
   else if(input.action==='roster'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Reopen the roster and try again.',409);
    if(!Array.isArray(input.students)||input.students.length>1000)throw problem('Use up to 1,000 students.',400);
    const numbers=new Set();for(const st of input.students){if(!st||typeof st.name!=='string'||!st.name.trim()||st.name.length>120||typeof st.number!=='string'||st.number.length>64||(st.number.trim()&&numbers.has(st.number.trim())))throw problem('Use valid names and unique student numbers.',400);if(st.number.trim())numbers.add(st.number.trim());}
    const normalize=v=>v.normalize('NFKC').trim().toLowerCase();
    book.students=input.students.map(st=>{const name=st.name.trim(),number=st.number.trim();const matches=book.students.filter(old=>number?old.number===number:!old.number&&normalize(old.name)===normalize(name));const unique=number||input.students.filter(other=>!other.number.trim()&&normalize(other.name)===normalize(name)).length===1;return {name,number,id:unique&&matches.length===1?(matches[0].id||randomUUID()):randomUUID()};});
    const keep=new Set(book.students.map(st=>st.id));book.assessments=(book.assessments||[]).map(a=>({...a,grades:a.grades.filter(g=>keep.has(g.studentId))}));book.revision=(book.revision||0)+1;
   }
   else if(input.action==='edit-roster-details'){
    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Reopen Edit and try again.',409);
    if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120||!Array.isArray(input.students)||input.students.length>1000)throw problem('Check the gradebook name and student details.',400);
    const seen=new Set(),numbers=new Set();for(const st of input.students){if(!st||!Number.isInteger(st.index)||!book.students[st.index]||seen.has(st.index)||typeof st.name!=='string'||!st.name.trim()||st.name.length>120||typeof st.number!=='string'||st.number.length>64||(st.number.trim()&&numbers.has(st.number.trim())))throw problem('Use valid names and unique student numbers.',400);seen.add(st.index);if(st.number.trim())numbers.add(st.number.trim());}
    book.name=input.name.trim();book.students=input.students.map(st=>({...book.students[st.index],name:st.name.trim(),number:st.number.trim()}));const keep=new Set(book.students.map(st=>st.id));book.assessments=(book.assessments||[]).map(a=>({...a,grades:a.grades.filter(g=>keep.has(g.studentId)),...(a.scoringColumns?{scoringColumns:a.scoringColumns.map(c=>({...c,scores:c.scores.filter(g=>keep.has(g.studentId))}))}:{})}));book.revision=(book.revision||0)+1;
   }
   else if(input.action==='edit'){

    if((book.revision||0)!==input.revision)throw problem('This gradebook changed. Reopen Edit and try again.',409);
    if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120||!Array.isArray(input.students)||input.students.length>1000||!Array.isArray(input.assessments)||input.assessments.length>(book.assessments||[]).length||new Set(input.assessments.map(a=>a?.sessionId)).size!==input.assessments.length)throw problem('Invalid gradebook changes.',400);
    const ids=new Set(),numbers=new Set();for(const student of input.students){if(!Number.isInteger(student.index)||!book.students[student.index]||ids.has(student.index)||typeof student.name!=='string'||!student.name.trim()||student.name.length>120||typeof student.number!=='string'||student.number.length>64||(student.number.trim()&&numbers.has(student.number.trim())))throw problem('Use unique student numbers and valid names.',400);ids.add(student.index);numbers.add(student.number.trim());}
    const students=input.students.map(st=>({...book.students[st.index],name:st.name.trim(),number:st.number.trim()}));
    const assessments=input.assessments.map(patch=>{const a=(book.assessments||[]).find(a=>a.sessionId===patch?.sessionId);if(!a||typeof patch.title!=='string'||!patch.title.trim()||patch.title.length>200||!Array.isArray(patch.scores)||patch.scores.length!==students.length)throw problem('Invalid quiz changes.',400);const grades=students.map((st,j)=>{const old=a.grades.find(g=>g.studentId===st.id),value=patch.scores[j];if(value===null)return {...old,studentId:st.id,score:null,percentage:null,status:old?.excused?'Excused':'Not submitted'};const total=old?.total??require('./public/gradebook-math').total(a);if(!Number.isFinite(value)||!Number.isFinite(total)||value<0||value>total)throw problem('Scores must be between zero and the quiz total.',400);return {...old,excused:false,studentId:st.id,score:value,total,percentage:Math.round(value/total*10000)/100,status:'Submitted'};});return {...a,title:patch.title.trim(),grades:a.scoringColumns?.length?a.grades.filter(g=>students.some(st=>st.id===g.studentId)):grades};});book.name=input.name.trim();book.students=students;book.assessments=assessments;book.revision=(book.revision||0)+1;
   }else throw problem('Invalid gradebook action.',400);
   await pool.query('UPDATE onscreen_v2_gradebooks SET data=$3 WHERE owner_id=$1 AND id=$2',[owner,id,JSON.stringify(book)]);return book;
  });},
  async gradebookPreferences(owner,id,input){if(!input||Object.keys(input).some(k=>!['columns','sortBy','showNames','gradeDisplay'].includes(k))||(input.showNames!==undefined&&typeof input.showNames!=='boolean')||(input.gradeDisplay!==undefined&&!['scores','percentage'].includes(input.gradeDisplay))||(input.sortBy!==undefined&&!['name','number'].includes(input.sortBy))||(input.columns!==undefined&&(!Array.isArray(input.columns)||input.columns.length!==2||new Set(input.columns).size!==2||input.columns.some(k=>!['name','number'].includes(k)))))throw problem('Invalid gradebook display options.',400);return accounts.withOwner(owner,async()=>{const row=(await pool.query('SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND id=$2',[owner,id])).rows[0];if(!row||row.data.deletedAt)throw problem('Gradebook not found.',404);if(row.data.archivedAt)throw problem('Unarchive this gradebook before editing.',409);const data={...row.data,...input};await pool.query('UPDATE onscreen_v2_gradebooks SET data=$3 WHERE owner_id=$1 AND id=$2',[owner,id,JSON.stringify(data)]);return data;});}
 }};
 require('./gradebook-undo')(store,pool,accounts);return store;
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
