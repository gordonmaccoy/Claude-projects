const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<section id="one"></section><section id="two"></section>');
  await page.addScriptTag({path:path.resolve('public/live-results.js')});
  await page.evaluate(()=>{
   const students=[{id:'a',name:'Alex',number:'1',result:null},{id:'b',name:'Beth',number:'2',result:null}];
   window.session={id:'one',mode:'test',students};window.payload={questions:['Capital?'],questionDetails:[{text:'Capital?'}],summaryStudents:students,students:students.map(s=>({...s,submitted:false,answers:[{status:'pending',answer:'',question:'Capital?'}]}))};
   window.controller=createExamioLiveResults({api:async()=>structuredClone(payload),renderSummary:(host,session,visibility)=>{host.textContent='Summary: '+session.students.length;host.dataset.visibility=JSON.stringify(visibility);},openQuestion:(data,index)=>{window.clicked=data.questions[index];}});
   controller.mount(document.querySelector('#one'),session);controller.mount(document.querySelector('#two'),{...session,id:'two'});
  });
  const first=page.locator('#one');
  assert.match(await first.textContent(),/Still to submit2/);
  await first.getByRole('button',{name:'Detailed Results'}).click();await page.evaluate(()=>controller.refresh());
  assert.equal(await first.locator('tbody tr').count(),2);assert.equal(await first.locator('tfoot td').textContent(),'—');
  await page.evaluate(()=>{payload.students[0].answers[0]={question:'Capital?',answer:'Seoul',letter:'A',status:'correct',points:1,maxPoints:1};});
  await page.evaluate(()=>controller.refresh());assert.match(await first.locator('tbody').textContent(),/✓ A/);assert.equal(await first.locator('tfoot td').textContent(),'100%');
  await first.getByRole('button',{name:'Question 1: Capital?'}).click();assert.equal(await page.evaluate(()=>clicked),'Capital?');
  await first.getByRole('switch',{name:'Show names',exact:true}).check();assert.match(await first.locator('tbody').textContent(),/Alex/);
  await first.getByRole('switch',{name:'Show student numbers'}).uncheck();assert.equal(await first.getByRole('columnheader',{name:'Student number',exact:true}).count(),0);
  assert.equal(await page.locator('#two').getByRole('switch',{name:'Show names',exact:true}).isChecked(),false);
  await page.evaluate(()=>{payload.summaryStudents[0].result={percentage:100};payload.summaryStudents[0].score=1;payload.summaryStudents[0].total=1;payload.students[0].submitted=true;});await page.evaluate(()=>controller.refresh());
  assert.match(await first.textContent(),/Still to submit1/);assert.equal(await first.getByRole('switch',{name:'Show names',exact:true}).isChecked(),true);
  await first.getByRole('switch',{name:'Show scores',exact:true}).check();assert.match(await first.locator('tbody').textContent(),/1 \/ 1 · 100%/);
  for(const name of ['Delete results','Rename results','Download'])assert.equal(await first.getByRole('button',{name,exact:true}).count(),0);
  await page.evaluate(()=>controller.reset());assert.equal(await first.textContent(),'');assert.deepEqual(errors,[]);
  console.log('Live results verified: draft answers, submission counts, question averages, question click, privacy toggles, independent sessions, reset.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
