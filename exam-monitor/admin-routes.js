const express=require('express');
const {problem}=require('./account-store');
function createAdminController({store,ownerEmail=process.env.ADMIN_OWNER_EMAIL||'',ownerId=process.env.ADMIN_OWNER_ID||''}){
 const router=express.Router(),config={ownerEmail,ownerId};
 const allowed=user=>store.isAdmin?store.isAdmin(user,config):Promise.resolve(false);
 const wrap=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res)).catch(next);
 router.use((req,res,next)=>allowed(req.user).then(ok=>ok?next():next(problem('Owner access is required.',403))).catch(next));
 function page(req){const raw=req.query.page??'0';if(typeof raw!=='string'||!/^\d{1,6}$/.test(raw))throw problem('Invalid page.',400);return Number(raw);}
 function search(req){const q=req.query.q??'';if(typeof q!=='string'||q.length>120)throw problem('Search is too long.',400);return q.trim();}
 router.get('/overview',wrap(async(req,res)=>res.json(await store.adminOverview())));
 router.get('/accounts',wrap(async(req,res)=>res.json(await store.adminAccounts({q:search(req),page:page(req)}))));
 router.patch('/accounts/:id',wrap(async(req,res)=>{if(!(await store.getAccountForAdmin(req.params.id)))throw problem('Account not found.',404);res.json(await store.adminUpdateAccount(req.user.id,req.params.id,req.body));}));
 async function protect(req,id,email){if(id===req.user.id||(email||'').toLowerCase()===(req.user.email||'').toLowerCase()||(ownerEmail&&email?.toLowerCase()===ownerEmail.toLowerCase())||(id&&await allowed({id,email:email||'unknown'})))throw problem('The owner account is protected.',400);}
 router.get('/bans',wrap(async(req,res)=>res.json(await store.adminBans())));
 router.post('/bans',wrap(async(req,res)=>{const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';const reason=req.body?.reason||'';if(!require('./settings-service').validEmail(email)||typeof reason!=='string'||reason.length>500)throw problem('Enter a valid email and a reason under 500 characters.',400);const account=await store.adminEmailIdentity(email);await protect(req,account?.id,email);res.json(await store.adminBan(req.user.id,email,reason));}));
 router.delete('/bans/:email',wrap(async(req,res)=>res.json(await store.adminUnban(req.user.id,req.params.email.toLowerCase()))));
 router.get('/support',wrap(async(req,res)=>{const state=req.query.state??'';if(!['','open','in_progress','resolved'].includes(state))throw problem('Invalid request status.',400);res.json(await store.adminSupport({state,page:page(req),q:search(req)}));}));
 router.patch('/support/:id',wrap(async(req,res)=>res.json(await store.adminUpdateSupport(req.user.id,req.params.id,req.body))));
 router.get('/audit',wrap(async(req,res)=>res.json(await store.adminAudit({page:page(req),q:search(req)}))));
 return {router,allowed};
}
module.exports={createAdminController};
