const {workbook,exportFilename}=require('./export');
function failure(status,message){return Object.assign(new Error(message),{status});}
function createExportMailer({key=process.env.RESEND_API_KEY,from=process.env.EXPORT_FROM||process.env.CONTACT_FROM,transport,now=Date.now,maxPerHour=5}={}){
 const configured=Boolean(key&&from),requests=new Map(),rates=new Map(),ttl=3600000;
 const deliver=transport||async function(payload,idempotencyKey){const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});if(!response.ok)throw failure(502,'Email delivery failed. Please retry.');return response.json();};
 async function send({session,user,email,detail,requestId}){
  if(!configured)throw failure(503,'Email export is not configured. Download the Excel file instead.');
  if(typeof email!=='string'||email.length>254||! /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email.trim())||typeof detail!=='boolean'||typeof requestId!=='string'||! /^[a-zA-Z0-9_-]{8,100}$/.test(requestId))throw failure(400,'Enter a valid email address and export request.');
  email=email.trim();const time=now();for(const [key,entry]of requests)if(time-entry.time>ttl)requests.delete(key);for(const [key,entry]of rates)if(time-entry.time>ttl)rates.delete(key);
  const id=user.id+':'+requestId,fingerprint=JSON.stringify([session.id,email,detail]),existing=requests.get(id);
  if(existing){if(existing.fingerprint!==fingerprint)throw failure(409,'This request was already used for another export.');return existing.promise;}
  const rate=rates.get(user.id)||{time,count:0};if(rate.count>=maxPerHour||requests.size>=10000||rates.size>=10000)throw failure(429,'Email export limit reached. Try again in an hour or download Excel.');rate.count++;rates.set(user.id,rate);
  const promise=Promise.resolve().then(async()=>{const result=await deliver({from,to:[email],subject:'Examio - '+exportFilename(session,detail).replace(/\.xlsx$/,''),text:'Your '+(detail?'detailed':'summary')+' grades are attached as an Excel workbook.',attachments:[{filename:exportFilename(session,detail),content:workbook(session,detail).toString('base64')}]},'examio-'+user.id+'-'+requestId);return {ok:true,id:result?.id||null};}).catch(error=>{requests.delete(id);throw failure(error.status||502,'Email delivery failed. Please retry.');});
  requests.set(id,{time,fingerprint,promise});return promise;
 }
 return {configured,send};
}
module.exports={createExportMailer};
