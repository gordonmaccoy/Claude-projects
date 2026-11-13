const {randomUUID}=require('node:crypto');
const {problem}=require('./account-store');
const {validateTest}=require('./exam');
const normalizeEmail=value=>typeof value==='string'?value.trim().toLowerCase():'';
const receipt=()=>({ok:true,message:'If this account can receive quizzes, a request has been sent.'});
function createSharingStore(pool,accounts,store){
 async function cleanup(){await pool.query("UPDATE onscreen_v2_quiz_shares SET status='expired',snapshot=NULL WHERE status='pending' AND expires_at<=NOW()");await pool.query("DELETE FROM onscreen_v2_quiz_shares WHERE expires_at<NOW()-INTERVAL '30 days'");}
 const activeRecipient=`EXISTS(SELECT 1 FROM onscreen_v2_accounts a WHERE a.owner_id=s.recipient_id AND a.state='active')`;
 const activeSender=`EXISTS(SELECT 1 FROM onscreen_v2_accounts a WHERE a.owner_id=s.sender_id AND a.state='active')`;
 const methods={
  async registerShareIdentity(user){
   const email=normalizeEmail(user.email);if(!email)return;
   return accounts.withOwner(user.id,async()=>{
    // Only the remotely verified auth identity may populate this private directory.
    // Duplicate email claims disable lookup rather than moving another user's identity.
    await pool.query(`INSERT INTO onscreen_v2_share_identities(owner_id,email) VALUES($1,$2)
      ON CONFLICT(owner_id) DO UPDATE SET email=EXCLUDED.email WHERE onscreen_v2_share_identities.email<>EXCLUDED.email`,[user.id,email]);
   });
  },
  async createShare(user,testId,email,requestId){return accounts.withOwner(user.id,async()=>{
   email=normalizeEmail(email);await cleanup();
   const old=(await pool.query('SELECT source_id,recipient_email FROM onscreen_v2_quiz_shares WHERE sender_id=$1 AND request_key=$2',[user.id,requestId])).rows[0];
   if(old){if(old.source_id!==testId||old.recipient_email!==email)throw problem('Sharing request changed. Please try again.');return receipt();}
   const count=(await pool.query("SELECT COUNT(*) AS n FROM onscreen_v2_quiz_shares WHERE sender_id=$1 AND created_at>NOW()-INTERVAL '1 hour'",[user.id])).rows[0];
   if(Number(count.n)>=20)throw problem('Sharing limit reached. Please try again later.',429);
   const source=await store.getTest(user.id,testId);if(!source)throw problem('Quiz not found.',404);
   const snapshot=validateTest(source);if(!snapshot)throw problem('Review and save this quiz before sharing.',400);
   const matches=(await pool.query(`SELECT i.owner_id FROM onscreen_v2_share_identities i JOIN onscreen_v2_accounts a ON a.owner_id=i.owner_id WHERE i.email=$1 AND a.state='active'`,[email])).rows;
   let recipientId=matches.length===1&&matches[0].owner_id!==user.id?matches[0].owner_id:null;
   // Limit repeated unwanted invitations without revealing account existence.
   if(recipientId){const duplicate=(await pool.query("SELECT id FROM onscreen_v2_quiz_shares WHERE sender_id=$1 AND recipient_id=$2 AND (status='pending' OR created_at>NOW()-INTERVAL '1 day')",[user.id,recipientId])).rows;
    if(duplicate.length>=5)recipientId=null;
   }
   await pool.query(`INSERT INTO onscreen_v2_quiz_shares(id,sender_id,sender_email,recipient_id,recipient_email,source_id,request_key,title,question_count,snapshot)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[randomUUID(),user.id,normalizeEmail(user.email),recipientId,email,testId,requestId,snapshot.title,snapshot.questions.length,recipientId?JSON.stringify(snapshot):null]);
   return receipt();
  });},
  async listShares(user){return accounts.withOwner(user.id,async()=>{
   await cleanup();
   const incoming=(await pool.query(`SELECT s.id,s.title,s.question_count AS "questionCount",s.sender_email AS "senderEmail",s.created_at AS "createdAt",s.expires_at AS "expiresAt" FROM onscreen_v2_quiz_shares s WHERE s.recipient_id=$1 AND s.recipient_email=$2 AND s.status='pending' AND s.snapshot IS NOT NULL AND ${activeSender} ORDER BY s.created_at DESC LIMIT 100`,[user.id,normalizeEmail(user.email)])).rows;
   // Includes indistinguishable receipts for unknown addresses, never deliverable after signup.
   const outgoing=(await pool.query(`SELECT id,title,recipient_email AS "recipientEmail",status,created_at AS "createdAt",expires_at AS "expiresAt" FROM onscreen_v2_quiz_shares WHERE sender_id=$1 ORDER BY created_at DESC LIMIT 100`,[user.id])).rows;
   return {incoming,outgoing};
  });},
  async acceptShare(user,id,folderId){return accounts.withOwner(user.id,async()=>{
   await cleanup();
   const share=(await pool.query(`SELECT s.* FROM onscreen_v2_quiz_shares s WHERE s.id=$1 AND s.recipient_id=$2 AND s.recipient_email=$3 AND ${activeSender} AND ${activeRecipient} FOR UPDATE`,[id,user.id,normalizeEmail(user.email)])).rows[0];
   if(share?.status==='accepted'){const existing=await store.getTest(user.id,share.copy_id);if(existing)return existing;throw problem('The imported quiz was removed.',410);}
   if(!share||share.status!=='pending'||!share.snapshot)throw problem('This sharing request is not available.',404);
   const clean=validateTest(share.snapshot);if(!clean)throw problem('This shared quiz is invalid.',400);
   if(folderId&&!await store.getFolder(user.id,folderId))throw problem('Class folder not found. Choose another folder.',400);
   const copy={...clean,id:randomUUID(),folderId:folderId||null};await store.saveTest(user.id,copy);
   await pool.query("UPDATE onscreen_v2_quiz_shares SET status='accepted',copy_id=$2,snapshot=NULL WHERE id=$1",[id,copy.id]);return copy;
  });},
  async declineShare(user,id){return accounts.withOwner(user.id,async()=>{
   await pool.query("UPDATE onscreen_v2_quiz_shares SET status='declined',snapshot=NULL WHERE id=$1 AND recipient_id=$2 AND recipient_email=$3 AND status='pending'",[id,user.id,normalizeEmail(user.email)]);return {ok:true};
  });},
  async cancelShare(user,id){return accounts.withOwner(user.id,async()=>{
   await pool.query("UPDATE onscreen_v2_quiz_shares SET status='cancelled',snapshot=NULL WHERE id=$1 AND sender_id=$2 AND status='pending'",[id,user.id]);return {ok:true};
  });}
 };
 return {methods,async init(){
  await pool.query('CREATE TABLE IF NOT EXISTS onscreen_v2_share_identities(owner_id TEXT PRIMARY KEY,email TEXT NOT NULL)');
  await pool.query('CREATE INDEX IF NOT EXISTS onscreen_v2_share_email ON onscreen_v2_share_identities(email)');
  await pool.query(`CREATE TABLE IF NOT EXISTS onscreen_v2_quiz_shares(id TEXT PRIMARY KEY,sender_id TEXT NOT NULL REFERENCES onscreen_v2_share_identities(owner_id) ON DELETE CASCADE,sender_email TEXT NOT NULL,recipient_id TEXT REFERENCES onscreen_v2_share_identities(owner_id) ON DELETE CASCADE,recipient_email TEXT NOT NULL,source_id TEXT NOT NULL,request_key TEXT NOT NULL,title TEXT NOT NULL,question_count INTEGER NOT NULL,snapshot JSONB,copy_id TEXT,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled','expired')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '7 days',UNIQUE(sender_id,request_key))`);
  await pool.query('CREATE INDEX IF NOT EXISTS onscreen_v2_shares_recipient ON onscreen_v2_quiz_shares(recipient_id,status)');
  await pool.query('CREATE INDEX IF NOT EXISTS onscreen_v2_shares_sender ON onscreen_v2_quiz_shares(sender_id,created_at)');
  // Server-owner access only; never expose this private directory through a data API.
  for(const table of ['onscreen_v2_share_identities','onscreen_v2_quiz_shares'])await pool.query('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY');
 }};
}
module.exports={createSharingStore,normalizeEmail};
