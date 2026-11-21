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
   return (await pool.query('SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 ORDER BY sort_index,created_at,id',[owner])).rows.map(row=>row.data);
  });},
  async createGradebook(owner,input){
   if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>120||Object.keys(input).some(key=>!['name','students'].includes(key)))throw problem('Enter a gradebook name (maximum 120 characters).',400);
   const students=input.students??[];
   if(!Array.isArray(students)||students.length>1000||students.some(s=>!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>120||typeof s.number!=='string'||s.number.length>64||Object.keys(s).some(k=>!['name','number'].includes(k))))throw problem('Use up to 1,000 students with a name and student number.',400);
   const numbers=students.map(s=>s.number.trim()).filter(Boolean);if(new Set(numbers).size!==numbers.length)throw problem('Student numbers must be unique.',400);
   return accounts.withOwner(owner,async()=>{const book={id:randomUUID(),name:input.name.trim(),sample:false,students:students.map(s=>({name:s.name.trim(),number:s.number.trim()})),columns:['name','number'],sortBy:'name'};await pool.query('INSERT INTO onscreen_v2_gradebooks(id,owner_id,data,sort_index) SELECT $1,$2,$3,COALESCE(MAX(sort_index),-1)+1 FROM onscreen_v2_gradebooks WHERE owner_id=$2',[book.id,owner,JSON.stringify(book)]);return book;});
  },
  async orderGradebooks(owner,ids){if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'))throw problem('Invalid gradebook order.',400);return accounts.withOwner(owner,async()=>{const existing=(await pool.query('SELECT id FROM onscreen_v2_gradebooks WHERE owner_id=$1',[owner])).rows.map(r=>r.id);if(ids.length!==existing.length||ids.some(id=>!existing.includes(id)))throw problem('Gradebooks changed. Refresh and try again.',409);for(const [index,id]of ids.entries())await pool.query('UPDATE onscreen_v2_gradebooks SET sort_index=$3 WHERE owner_id=$1 AND id=$2',[owner,id,index]);return {ok:true};});},
  async gradebookPreferences(owner,id,input){if(!input||Object.keys(input).some(k=>!['columns','sortBy'].includes(k))||(input.sortBy!==undefined&&!['name','number'].includes(input.sortBy))||(input.columns!==undefined&&(!Array.isArray(input.columns)||input.columns.length!==2||new Set(input.columns).size!==2||input.columns.some(k=>!['name','number'].includes(k)))))throw problem('Invalid gradebook display options.',400);return accounts.withOwner(owner,async()=>{const row=(await pool.query('SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND id=$2',[owner,id])).rows[0];if(!row)throw problem('Gradebook not found.',404);const data={...row.data,...input};await pool.query('UPDATE onscreen_v2_gradebooks SET data=$3 WHERE owner_id=$1 AND id=$2',[owner,id,JSON.stringify(data)]);return data;});}
 }};
}
module.exports={createGradebookStore};
