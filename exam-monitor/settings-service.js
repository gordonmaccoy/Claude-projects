const {problem}=require('./account-store');
function field(value,min,max,label,multiline=false){if(typeof value!=='string')throw problem('Enter '+label+'.',400);const text=value.trim();if(text.length<min||text.length>max||(multiline?/[\x00-\x08\x0b\x0c\x0e-\x1f]/:/[\x00-\x1f]/).test(text))throw problem('Enter '+label+' ('+min+'–'+max+' characters).',400);return text;}
function validateProfile(body){return {firstName:field(body?.firstName,1,80,'first name'),lastName:field(body?.lastName||'',0,80,'last name'),institution:field(body?.institution||'',0,160,'school/institution')};}
function validateContact(body){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body?.requestId||''))throw problem('Start a new contact message and try again.',400);if(!['question','problem','feature'].includes(body?.category))throw problem('Choose a contact category.',400);return {requestId:body.requestId,category:body.category,subject:field(body.subject,1,120,'subject'),message:field(body.message,1,3000,'message',true)};}
function validEmail(value){return typeof value==='string'&&value.length<=254&&!/[\r\n]/.test(value)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
function createMailTransport(env=process.env,request=globalThis.fetch){
 const to=env.CONTACT_TO||'gordon.maccoy@gmail.com',from=env.CONTACT_FROM,key=env.RESEND_API_KEY;
 if(!key||!from||!validEmail(to)||/[\r\n]/.test(from))return null;
 return async record=>{if(!validEmail(record.email))throw new Error('Invalid reply address');const r=await request('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'onscreen-contact-'+record.id},signal:AbortSignal.timeout(15000),body:JSON.stringify({from,to:[to],reply_to:record.email,subject:'OnScreen '+record.category+': '+record.subject,text:'Reference: '+record.id+'\nFrom: '+record.email+'\n\n'+record.message})});if(!r.ok)throw new Error('Email notification is queued for retry.');};
}
function createAccountRemover(config,env=process.env,createClient=require('@supabase/supabase-js').createClient){
 const key=env.SUPABASE_ADMIN_KEY;if(!key||!config.url)return null;let privileged=key.startsWith('sb_secret_');try{privileged||=JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role==='service_role';}catch{}if(!privileged)return null;
 const client=createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)})}});
 return async id=>{const {error}=await client.auth.admin.deleteUser(id,false);if(error&&error.code!=='user_not_found')throw new Error('Identity deletion will be retried.');};
}
module.exports={validateProfile,validateContact,validEmail,createMailTransport,createAccountRemover};
