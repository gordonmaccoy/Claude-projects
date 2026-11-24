(function(root){
 'use strict';
 root.createExamioLiveResults=function({api,renderSummary,openQuestion,t=value=>value,isVisible=()=>true}){
  const states=new Map();let generation=0,busy=false;
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
  function state(session){if(!states.has(session.id))states.set(session.id,{numbers:true,names:false,scores:false,view:'summary'});return states.get(session.id);}
  function draw(host,session){
   const s=state(session),data=s.data,students=data?.summaryStudents||session.students;
   const scroll=host.querySelector('.table-wrap')?.scrollLeft||0;
   const expanded=new Set([...host.querySelectorAll('details[open][data-student-id]')].map(el=>el.dataset.studentId));
   host.replaceChildren();host.className='live-results';host.dataset.liveResults=session.id;
   const toolbar=node('div',null,'result-toolbar');toolbar.setAttribute('aria-label',t('Live result views'));
   for(const [value,label]of [['summary','Summary'],['details','Detailed Results']]){const button=node('button',t(label));button.type='button';button.setAttribute('aria-pressed',String(s.view===value));button.onclick=()=>{s.view=value;draw(host,session);};toolbar.append(button);}
   host.append(toolbar);
   const privacy=node('div',null,'actions live-result-privacy');
   for(const [key,label]of [['numbers','Show student numbers'],['names','Show names'],['scores','Show scores']]){
    if(key==='numbers'&&session.requireStudentNumber===false)continue;
    const labelEl=node('label',null,'privacy-switch'),input=node('input'),track=node('span',null,'switch-track');input.type='checkbox';input.checked=s[key];input.setAttribute('role','switch');track.setAttribute('aria-hidden','true');input.onchange=()=>{s[key]=input.checked;draw(host,session);};labelEl.append(input,track,document.createTextNode(t(label)));privacy.append(labelEl);
   }host.append(privacy);
   const stats=node('div',null,'result-stats live-result-stats');
   for(const [label,value]of [['Students',students.length],['Still to submit',students.filter(student=>!student.result).length]]){const cell=node('div');cell.append(node('span',t(label)),node('strong',String(value)));stats.append(cell);}host.append(stats);
   const content=node('div',null,'table-wrap');host.append(content);
   if(s.view==='summary')renderSummary(content,{...session,students},{names:s.names,numbers:s.numbers,scores:s.scores,keepNameColumn:true});
   else if(!data)content.textContent=t('Loading live results…');
   else{
    const table=node('table',null,'answer-grid'),header=table.createTHead().insertRow();
    const columns=[...(session.requireStudentNumber!==false&&s.numbers?['Student number']:[]),'Name','State',...(s.scores?['Score']:[])];
    for(const label of columns){const th=node('th',t(label));th.scope='col';header.append(th);}
    data.questions.forEach((question,index)=>{const th=node('th'),button=node('button','Q'+(index+1));button.type='button';button.title=question;button.setAttribute('aria-label',t('Question')+' '+(index+1)+': '+question);button.onclick=()=>openQuestion({...data,liveResults:true},index);th.scope='col';th.append(button);header.append(th);});
    const body=table.createTBody();
    for(const student of [...data.students].sort((a,b)=>session.requireStudentNumber===false?a.name.localeCompare(b.name):String(a.number).localeCompare(String(b.number),undefined,{numeric:true}))){
     const row=body.insertRow();if(session.requireStudentNumber!==false&&s.numbers)row.insertCell().textContent=student.number;const nameCell=row.insertCell();nameCell.textContent=s.names?student.name:'*****';const device=node('small',students.find(item=>item.id===student.id)?.deviceType||'Unknown device','student-device-label');device.title='Estimated device type reported by the browser';nameCell.append(device);
     row.insertCell().textContent=t(student.submitted?'Submitted':'Draft')+(students.find(item=>item.id===student.id)?.fullscreenUnavailable?' · '+t('Fullscreen unavailable'):'');
     if(s.scores){const summary=students.find(item=>item.id===student.id);row.insertCell().textContent=summary?.result?.pending?t('Grading…'):summary?.result?summary.score+' / '+summary.total+' · '+summary.result.percentage+'%':t('Pending');}
     for(const answer of student.answers){const cell=row.insertCell();cell.className='answer-'+answer.status;cell.textContent=answer.status==='grading'?t('Grading…'):(answer.status==='correct'?'✓ ':answer.status==='incorrect'?'✗ ':'')+(answer.letter||answer.answer||'—')+(answer.status==='partial'?' · '+answer.points+'/'+answer.maxPoints:'');cell.title=answer.question+' · '+(answer.answer||t('Unanswered'));}
    }
    const averages=table.createTFoot().insertRow();averages.className='question-average-row';const label=node('th',t('Question average'));label.colSpan=columns.length;label.scope='row';averages.append(label);
    data.questions.forEach((question,index)=>{const answers=data.students.map(student=>student.answers[index]).filter(answer=>answer&&answer.status!=='pending'&&answer.status!=='unanswered'&&answer.status!=='grading');const average=answers.length?Math.round(answers.reduce((sum,a)=>sum+(Number.isFinite(a.points)&&a.maxPoints>0?a.points/a.maxPoints:Number(a.status==='correct')),0)/answers.length*10000)/100:null;averages.insertCell().textContent=average==null?'—':average+'%';});
    content.append(table);
   }
   content.scrollLeft=scroll;for(const details of content.querySelectorAll('details[data-student-id]'))details.open=expanded.has(details.dataset.studentId);
   if(s.error){const status=node('p',t('Live results could not refresh. Retrying…'),'live-results-status');status.setAttribute('role','status');host.append(status);}
  }
  async function refresh(){
   if(busy||document.hidden||!isVisible())return;busy=true;const version=generation;
   try{await Promise.all([...document.querySelectorAll('[data-live-results]')].map(async host=>{
    const id=host.dataset.liveResults,s=states.get(id);if(!s?.session||!host.isConnected||!host.checkVisibility())return;
    try{const data=await api('/sessions/'+encodeURIComponent(id)+'/details?live=1');if(version!==generation||!host.isConnected||host.dataset.liveResults!==id)return;
     const signature=JSON.stringify(data);if(signature!==s.signature||s.error){s.data=data;s.signature=signature;s.error=false;draw(host,s.session);}
    }catch{if(version===generation&&host.isConnected){s.error=true;draw(host,s.session);}}
   }));}finally{busy=false;}
  }
  return {mount(host,session){const s=state(session);s.session=session;draw(host,session);},refresh,reset(){generation++;states.clear();document.querySelectorAll('[data-live-results]').forEach(host=>host.replaceChildren());}};
 };
})(window);
