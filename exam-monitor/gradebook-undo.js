const {isDeepStrictEqual}=require('node:util');
const {problem}=require('./account-store');
module.exports=function(store,pool,accounts){
 const rows=async owner=>(await pool.query('SELECT id,data,sort_index FROM onscreen_v2_gradebooks WHERE owner_id=$1 ORDER BY id',[owner])).rows;
 const normalized=row=>row?({id:row.id,sort_index:row.sort_index,data:{...row.data,revision:0}}):null;
 for(const name of ['createGradebook','orderGradebooks','sendResultsToGradebook','changeGradebook','gradebookPreferences']){const action=store.methods[name];store.methods[name]=(owner,...args)=>accounts.withOwner(owner,async()=>{
  const before=await rows(owner),result=await action(owner,...args),after=await rows(owner),changes=[];
  for(const id of new Set([...before,...after].map(r=>r.id))){const previous=before.find(r=>r.id===id)||null,next=after.find(r=>r.id===id)||null;if(!isDeepStrictEqual(normalized(previous),normalized(next)))changes.push({id,before:previous,after:next});}
  if(changes.length){await pool.query('INSERT INTO onscreen_v2_gradebook_history(owner_id,changes) VALUES($1,$2)',[owner,JSON.stringify(changes)]);await pool.query('DELETE FROM onscreen_v2_gradebook_history WHERE owner_id=$1 AND id NOT IN (SELECT id FROM onscreen_v2_gradebook_history WHERE owner_id=$1 ORDER BY id DESC LIMIT 20)',[owner]);}
  return result;
 });}
 store.methods.gradebookUndoStatus=owner=>accounts.withOwner(owner,async()=>({canUndo:!!(await pool.query('SELECT id FROM onscreen_v2_gradebook_history WHERE owner_id=$1 LIMIT 1',[owner])).rows.length}));
 store.methods.undoGradebook=owner=>accounts.withOwner(owner,async()=>{
  const entry=(await pool.query('SELECT id,changes FROM onscreen_v2_gradebook_history WHERE owner_id=$1 ORDER BY id DESC LIMIT 1',[owner])).rows[0];if(!entry)throw problem('No gradebook changes to undo.',400);
  const current=await rows(owner);for(const change of entry.changes)if(!isDeepStrictEqual(normalized(current.find(r=>r.id===change.id)||null),normalized(change.after)))throw problem('This gradebook changed elsewhere. Refresh before undoing.',409);
  for(const change of entry.changes){if(!change.before){await pool.query('DELETE FROM onscreen_v2_gradebooks WHERE owner_id=$1 AND id=$2',[owner,change.id]);continue;}const data={...change.before.data,revision:Math.max(change.before.data.revision||0,current.find(r=>r.id===change.id)?.data.revision||0)+1};await pool.query('UPDATE onscreen_v2_gradebooks SET data=$3,sort_index=$4 WHERE owner_id=$1 AND id=$2',[owner,change.id,JSON.stringify(data),change.before.sort_index]);}
  await pool.query('DELETE FROM onscreen_v2_gradebook_history WHERE owner_id=$1 AND id=$2',[owner,entry.id]);return {ok:true};
 });
};
