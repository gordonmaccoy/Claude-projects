(function(root){
 const time=n=>Number.isFinite(Number(n))?Number(n):0;
 function completedAt(s){if(time(s.endedAt))return time(s.endedAt);if(s.phase==='ended')return Math.max(time(s.createdAt),...(s.students||[]).map(st=>time(st.result?.submittedAt)));return time(s.createdAt);}
 function sort(rows,mode='newest',language='en'){const compare=new Intl.Collator(language,{numeric:true,sensitivity:'base'}).compare;return [...rows].sort((a,b)=>(mode==='name'?compare(a.title||'',b.title||''):0)||completedAt(b)-completedAt(a)||String(a.id).localeCompare(String(b.id)));}
 const api={completedAt,sort};if(typeof module==='object'&&module.exports)module.exports=api;else root.examioResultOrder=api;
})(typeof window==='object'?window:globalThis);
