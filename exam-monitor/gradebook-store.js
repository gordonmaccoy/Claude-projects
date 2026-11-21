const {randomUUID}=require('node:crypto');
const {problem}=require('./account-store');
const names=['Alex Morgan','Minji Kim','Daniel Park','Sofia Rivera','Liam Chen','Emma Wilson','Noah Patel','Hana Lee','Ethan Brown','Yuna Choi','Olivia Martin','Lucas Silva','Mia Nguyen','Leo Thompson','Sara Ahmed'];
function createGradebookStore(pool,accounts){
 return {async init(){
  await pool.query("CREATE TABLE IF NOT EXISTS onscreen_v2_gradebooks(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,data JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query('CREATE INDEX IF NOT EXISTS onscreen_v2_gradebooks_owner ON onscreen_v2_gradebooks(owner_id)');
  await pool.query('ALTER TABLE onscreen_v2_gradebooks ENABLE ROW LEVEL SECURITY');
 },methods:{
  async listGradebooks(owner){return accounts.withOwner(owner,async()=>{
   const sample={id:'sample-'+owner,name:'Sample Gradebook',sample:true,students:names.map((name,index)=>({name,number:String(20261001+index)}))};
   await pool.query('INSERT INTO onscreen_v2_gradebooks(id,owner_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[sample.id,owner,JSON.stringify(sample)]);
   return (await pool.query('SELECT data FROM onscreen_v2_gradebooks WHERE owner_id=$1 ORDER BY created_at,id',[owner])).rows.map(row=>row.data);
  });},
  async createGradebook(owner,input){
   if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>120||Object.keys(input).some(key=>key!=='name'))throw problem('Enter a gradebook name (maximum 120 characters).',400);
   return accounts.withOwner(owner,async()=>{const book={id:randomUUID(),name:input.name.trim(),sample:false,students:[]};await pool.query('INSERT INTO onscreen_v2_gradebooks(id,owner_id,data) VALUES($1,$2,$3)',[book.id,owner,JSON.stringify(book)]);return book;});
  }
 }};
}
module.exports={createGradebookStore};
