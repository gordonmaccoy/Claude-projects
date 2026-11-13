const {test}=require('node:test'),assert=require('node:assert/strict');
const {createApp}=require('../server');
test('a stalled support retry never delays live monitoring',async()=>{
 let release,entered,checks=0;const blocked=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const store={async pendingDeletions(){entered();await blocked;return [];},async activeSessions(){checks++;return [];}};
 const app=createApp({store,verifyUser:async()=>null,sweepInterval:0,settingsOptions:{removeAccount:async()=>{},sendMail:null}});
 let job,tick;try{tick=app.tick();let result=await Promise.race([tick.then(()=>true),new Promise(r=>setTimeout(()=>r(false),200))]);assert.equal(result,true,'Monitoring must not start and await support work');assert.equal(checks,1);job=app.runSettingsJobs();await started;const next=app.tick();result=await Promise.race([next.then(()=>true),new Promise(r=>setTimeout(()=>r(false),200))]);assert.equal(result,true,'Pending support work must not block the monitoring sweep');assert.equal(checks,2);}finally{release();await tick;await job;await app.close();}
});
