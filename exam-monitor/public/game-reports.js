(function(root){
 'use strict';
 function mount({api,$=root.GameClient.$,el=root.GameClient.el,confirm=message=>root.confirm(message)}){
  const section=$('game-reports'),list=$('game-report-list'),status=$('game-report-status'),
   select=$('select-game-reports'),remove=$('delete-game-reports');
  const date=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'});
  const number=new Intl.NumberFormat(),selected=new Set(),cards=new Map();
  let rows=[],selecting=false,deleting=false,invalidated=false,revision=0;
  function tell(message='',error=false){status.textContent=message;status.dataset.error=error?'true':'false';}
  function clearIfPrivate(error){
   if(![401,403,423].includes(error.status))return false;
   clearPrivate();
   tell(error.status===423?'Game reports are unavailable because this account is inactive.':'Sign in to view your game reports.',true);
   return true;
  }
  function controls(){
   select.disabled=deleting||!rows.length;select.textContent=selecting?'Cancel selection':'Select';
   select.setAttribute('aria-pressed',String(selecting));
   remove.disabled=deleting||!selected.size;
   remove.textContent=selected.size?'Delete ('+selected.size+')':'Delete';
   for(const [id,{label,input}] of cards){
    label.hidden=!selecting;input.checked=selected.has(id);
    input.disabled=deleting||(!input.checked&&selected.size>=500);
   }
  }
  function duration(ms){
   const seconds=Math.max(0,Math.floor(Number(ms||0)/1000));
   return [Math.floor(seconds/3600)?Math.floor(seconds/3600)+' h':'',Math.floor(seconds%3600/60)?Math.floor(seconds%3600/60)+' min':'',seconds%60+' s'].filter(Boolean).join(' ');
  }
  function percent(value){return Number.isFinite(value)?number.format(value)+'%':'–';}
  function badge(value,large=false){
   const item=el('strong',percent(value),large?'report-accuracy report-accuracy-large':'report-accuracy');
   if(Number.isFinite(value)&&value>=0&&value<=100)item.style?.setProperty('--accuracy',value+'%');
   return item;
  }
  function table(label,headers,entries){
   const scroller=el('div',undefined,'report-table-scroll'),table=el('table',undefined,'report-table');
   scroller.setAttribute('role','region');scroller.setAttribute('aria-label',label);scroller.tabIndex=0;
   const head=el('thead'),line=el('tr'),body=el('tbody');
   for(const text of headers){const cell=el('th',text);cell.scope='col';line.append(cell);}
   head.append(line);
   for(const values of entries){
    const row=el('tr');
    for(const value of values){const cell=el('td');if(typeof value==='object')cell.append(value);else cell.textContent=value;row.append(cell);}
    body.append(row);
   }
   table.append(head,body);scroller.append(table);return scroller;
  }
  function summary(data){
   const layout=el('div',undefined,'report-summary'),outcome=el('div',undefined,'report-outcome');
   const score=el('div',undefined,'report-overall');score.append(badge(data.percentCorrect,true),el('span','Overall correct'));
   const caption=el('div',undefined,'report-takeaway');
   const hardest=(data.questions||[]).reduce((low,q,i)=>Number.isFinite(q.percentCorrect)&&(!low||q.percentCorrect<low.percent)?{percent:q.percentCorrect,i}:low,null);
   let takeaway='No participants joined this game.';
   if(data.participantCount&&hardest)takeaway=hardest.percent<100?'Question '+(hardest.i+1)+' was the toughest at '+percent(hardest.percent)+' correct.':'Every question was answered correctly by all eligible participants.';
   else if(data.participantCount)takeaway='See the question breakdown to review how players did.';
   caption.append(el('h4','Class outcome'),el('p',takeaway));outcome.append(score,caption);
   const counts=el('dl',undefined,'report-counts');
   for(const [key,value] of [['Participants',number.format(data.participantCount??0)],['Questions',number.format(data.questionCount??0)],['Duration',duration(data.durationMs)]]){
    const entry=el('div');entry.append(el('dt',key),el('dd',value));counts.append(entry);
   }
   layout.append(outcome,counts);return layout;
  }
  let serial=0;
  function detailTabs(body,data){
   const tabList=el('div',undefined,'report-tabs'),panel=el('div',undefined,'report-tab-panel');
   tabList.setAttribute('role','tablist');tabList.setAttribute('aria-label','Report details');
   panel.setAttribute('role','tabpanel');panel.tabIndex=0;panel.id='report-tab-panel-'+(++serial);
   const tabs=['Summary','Participants ('+data.participantCount+')','Questions ('+data.questionCount+')'].map((label,index)=>{
    const tab=el('button',label);tab.type='button';tab.id=panel.id+'-'+index;
    tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panel.id);return tab;
   });
   function activate(index,focus=false){
    tabs.forEach((tab,i)=>{tab.tabIndex=i===index?0:-1;tab.setAttribute('aria-selected',String(i===index));});
    panel.setAttribute('aria-labelledby',tabs[index].id);
    if(focus)tabs[index].focus();
    const participants=data.participants||[],questions=data.questions||[];
    panel.replaceChildren(index===0?summary(data):index===1?
     (participants.length?table('Participants',['Name','Rank','Correct','Unanswered','Final score'],participants.map(p=>[p.name,String(p.rank),badge(p.percentCorrect),number.format(p.unanswered),number.format(p.score)])):el('p','No participants.')):
     (questions.length?table('Questions',['Question','Correct'],questions.map((q,i)=>[(i+1)+'. '+q.prompt,badge(q.percentCorrect)])):el('p','No questions to show.')));
    if(index===0&&data.gameMode==='team'&&data.teams?.length)panel.append(el('h3','Team Race results'),table('Team standings',['Team','Rank','Members','Average points'],data.teams.map(t=>[t.name,String(t.rank),String(t.memberCount),number.format(Math.round(t.score))])));
   }
   tabs.forEach((tab,index)=>{
    tab.onclick=()=>activate(index);
    tab.addEventListener('keydown',event=>{
     const next={ArrowLeft:(index+2)%3,ArrowRight:(index+1)%3,Home:0,End:2}[event.key];
     if(next===undefined)return;
     event.preventDefault();activate(next,true);
    });
   });
   tabList.append(...tabs);body.replaceChildren(tabList,panel);activate(0);
  }
  function create(row){
   const card=el('article',undefined,'report-entry'),report=el('details',undefined,'report-disclosure');
   const label=el('label',undefined,'report-selection'),input=el('input');
   input.type='checkbox';input.setAttribute('aria-label','Select report for '+row.title+' on '+date.format(row.completedAt));
   input.onchange=()=>{if(input.checked&&selected.size<500)selected.add(row.id);else selected.delete(row.id);controls();if(selected.size===500)tell('500 reports selected. Delete this batch before selecting more.');};
   label.append(input);label.hidden=true;
   const heading=el('summary'),when=el('time',date.format(row.completedAt));when.dateTime=new Date(row.completedAt).toISOString();
   heading.append(el('span',row.title,'report-title'),when);
   const body=el('div',undefined,'report-detail');
   report.dataset.reportId=row.id;report.open=false;
   let loaded=false,loading=false;
   async function load(){
    if(invalidated||loaded||loading)return;
    loading=true;body.replaceChildren(el('p','Loading report…'));
    try{const data=await api('/game-reports/'+encodeURIComponent(row.id));if(!invalidated){detailTabs(body,data);loaded=true;}}
    catch(error){
     if(clearIfPrivate(error))return;
     const retry=el('button','Try again');retry.type='button';retry.onclick=load;
     body.replaceChildren(el('p','This report could not be loaded.'),retry);
    }finally{loading=false;}
   }
   report.addEventListener('toggle',()=>{if(report.open)return load();});
   report.append(heading,body);card.append(label,report);return {card,label,input};
  }
  function clearPrivate(){
   revision++;rows=[];selected.clear();cards.clear();list.replaceChildren();selecting=false;controls();
  }
  function render(next){
   if(next.length===rows.length&&next.every((row,index)=>row.id===rows[index].id))return;
   const ids=new Set(next.map(row=>row.id));
   for(const id of cards.keys())if(!ids.has(id)){cards.delete(id);selected.delete(id);}
   rows=next;
   for(const row of rows)if(!cards.has(row.id))cards.set(row.id,create(row));
   list.replaceChildren(...rows.map(row=>cards.get(row.id).card));controls();
  }
  async function refresh({announce=true}={}){
   if(invalidated||deleting)return;
   const ticket=++revision;
   if(!rows.length&&announce)tell('Loading game reports…');
   try{
    const result=await api('/game-reports');
    if(ticket!==revision)return;
    if(!Array.isArray(result))throw new Error('Invalid report list');
    render(result.slice().sort((a,b)=>b.completedAt-a.completedAt||String(a.id).localeCompare(String(b.id))));
    tell(rows.length?'':'Completed games will appear here.');
   }catch(error){
    if(ticket!==revision)return;
    if(!clearIfPrivate(error)&&(announce||!rows.length))tell('Game reports could not be loaded. Use Refresh to try again.',true);
   }
  }
  select.onclick=()=>{
   selecting=!selecting;
   if(!selecting)selected.clear();
   controls();
   if(selecting)cards.get(rows[0]?.id)?.input.focus();
  };
  remove.onclick=async()=>{
   const ids=[...selected];
   if(deleting||!ids.length||!confirm('Delete '+ids.length+' selected game report'+(ids.length===1?'':'s')+'? This cannot be undone.'))return;
   deleting=true;revision++;controls();tell('Deleting selected reports…');
   try{
    const {deleted}=await api('/game-reports/delete','POST',{ids});
    if(invalidated)return;
    const removed=new Set(ids);render(rows.filter(row=>!removed.has(row.id)));selecting=false;selected.clear();
    deleting=false;
    await refresh({announce:false});
    const suffix=rows.length?'':' Completed games will appear here.';
    if(status.dataset.error!=='true')tell(number.format(deleted)+' game report'+(deleted===1?'':'s')+' deleted.'+suffix);
    if(rows.length)select.focus();else $('refresh').focus();
   }catch(error){
    if(!clearIfPrivate(error))tell('The selected reports could not be deleted. Please try again.',true);
   }finally{deleting=false;controls();}
  };
  section.hidden=false;controls();
  return {refresh,invalidate(){invalidated=true;clearPrivate();section.hidden=true;}};
 }
 const exported={mount};
 if(typeof module!=='undefined'&&module.exports)module.exports=exported;
 if(root.document)root.GameReports=exported;
})(typeof window==='undefined'?globalThis:window);
