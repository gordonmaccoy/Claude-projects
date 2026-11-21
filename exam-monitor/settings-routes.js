const express=require('express');
const {validateProfile,validateRegistration,validateContact,validEmail,createMailTransport,createAccountRemover}=require('./settings-service');
const {createHelpAssistant,helpGuide}=require('./help');
const {problem}=require('./account-store');
function createSettingsController({store,config={},supportAdminEmail='',adminAllowed=async()=>false,sendMail=createMailTransport(),removeAccount=createAccountRemover(config),helpAssistant=createHelpAssistant(),helpConfigured=Boolean(process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL)}){
 const router=express.Router(),budgets=new Map();let jobsRunning=false;
 const wrap=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res)).catch(next);
 const admin=async user=>await adminAllowed(user)||(!!supportAdminEmail&&user.email.toLowerCase()===supportAdminEmail.toLowerCase());
 function begin(user,kind,max){const now=Date.now(),key=user.id+':'+kind,old=budgets.get(key),state=old&&now-old.start<3600000?old:{start:now,count:0,busy:false};if(state.busy||state.count>=max)throw problem('Please wait before sending another '+(kind==='help'?'help question.':'contact request.'),429);state.count++;state.busy=true;budgets.set(key,state);if(budgets.size>5000)for(const [k,v] of budgets)if(now-v.start>=3600000)budgets.delete(k);return state;}
 async function deliver(id){if(!sendMail)return;try{return await store.deliverContact(id,sendMail);}catch{await store.delayContact(id);}}
 async function erase(id){if(!removeAccount)return {state:'deleting'};try{return await store.completeDeletion(id,removeAccount);}catch{await store.delayDeletion(id);return {state:'deleting'};}}
 router.put('/gradebooks/order',wrap(async(req,res)=>res.json(await store.orderGradebooks(req.user.id,req.body?.ids))));
 router.patch('/gradebooks/:id',wrap(async(req,res)=>res.json(await store.gradebookPreferences(req.user.id,req.params.id,req.body))));
 router.get('/gradebooks',wrap(async(req,res)=>res.json(await store.listGradebooks(req.user.id))));
 router.post('/gradebooks',wrap(async(req,res)=>res.status(201).json(await store.createGradebook(req.user.id,req.body))));
 router.get('/settings',wrap(async(req,res)=>{const account=await store.getAccount(req.user.id);res.json({profile:{firstName:'',lastName:'',institution:'',...account.profile,email:req.user.email},registrationRequired:!account.profile.registrationComplete&&!account.profile.firstName&&!await store.hasWorkspaceHistory(req.user.id),helpConfigured,deletionConfigured:!!removeAccount,supportInboxAllowed:await admin(req.user),accountState:account.state});}));
 router.get('/account-summary',wrap(async(req,res)=>res.json({email:req.user.email,emailVerified:req.user.emailVerified===true,memberSince:req.user.createdAt||null,providers:req.user.providers||[],accountType:'beta',usage:await store.accountUsage(req.user.id)})));
 router.put('/profile',wrap(async(req,res)=>res.json({...await store.saveProfile(req.user.id,validateProfile(req.body)),email:req.user.email})));
 router.post('/registration',wrap(async(req,res)=>res.json({...await store.saveProfile(req.user.id,validateRegistration(req.body)),email:req.user.email})));
 router.get('/launch-preferences',wrap(async(req,res)=>{const account=await store.getAccount(req.user.id);res.json(account.profile.quickLaunch||null);}));
 router.put('/launch-preferences',wrap(async(req,res)=>{const input=req.body||{},options=require('./exam').launchOptions({...input,deliveryType:input.deliveryType||'free'});if(input.roomName!==undefined)options.roomName=require('./rooms').roomName(input.roomName).name;await store.saveProfile(req.user.id,{quickLaunch:options});res.json(options);}));
 router.get('/contact',wrap(async(req,res)=>res.json(await store.listContacts(req.user.id))));
 router.post('/contact',wrap(async(req,res)=>{const input=validateContact(req.body);if(!validEmail(req.user.email))throw problem('A verified reply email is required.',400);const budget=begin(req.user,'contact',5);try{const record=await store.saveContact(req.user.id,req.user.email,input);const saved=await deliver(record.id)||record;res.status(201).json({id:saved.id,status:saved.status});}finally{budget.busy=false;}}));
 router.get('/support/requests',wrap(async(req,res)=>{if(!await admin(req.user))throw problem('Support inbox access is restricted.',403);res.json(await store.supportInbox());}));
 router.get('/help/guide',(req,res)=>res.json(helpGuide));
 router.post('/help',wrap(async(req,res)=>{if(!helpConfigured)throw problem('AI help is unavailable. Use the guide, Take tour, or Contact us.',503);const budget=begin(req.user,'help',20);try{res.json(await helpAssistant(req.body));}finally{budget.busy=false;}}));
 router.delete('/account',wrap(async(req,res)=>{
  if(!removeAccount)throw problem('Account deletion is currently unavailable. Please contact support.',503);
  if(!req.body||Object.keys(req.body).some(k=>!['confirmation','email'].includes(k))||req.body.confirmation!=='DELETE'||typeof req.body.email!=='string'||req.body.email.trim().toLowerCase()!==req.user.email.toLowerCase())throw problem('Type DELETE and your signed-in email to confirm.',400);
  await store.beginDeletion(req.user.id);const result=await erase(req.user.id);res.status(result.state==='deleted'?200:202).json(result);
 }));
 return {router,async runJobs(){if(jobsRunning)return;jobsRunning=true;try{if(removeAccount)for(const owner of await store.pendingDeletions())await erase(owner);if(sendMail)for(const id of await store.queuedContacts())await deliver(id);}finally{jobsRunning=false;}}};
}
module.exports={createSettingsController};
