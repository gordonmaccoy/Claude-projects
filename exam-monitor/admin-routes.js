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
 router.get('/support',wrap(async(req,res)=>{const state=req.query.state??'';if(!['','open','in_progress','resolved'].includes(state))throw problem('Invalid request status.',400);res.json(await store.adminSupport({state,page:page(req),q:search(req)}));}));
 router.patch('/support/:id',wrap(async(req,res)=>res.json(await store.adminUpdateSupport(req.user.id,req.params.id,req.body))));
 router.get('/audit',wrap(async(req,res)=>res.json(await store.adminAudit({page:page(req),q:search(req)}))));
 return {router,allowed};
}
module.exports={createAdminController};
