
import { put } from '@vercel/blob';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'POST'});
 try{
  const auth=req.headers.authorization?.replace('Bearer ','');
  const payload=jwt.verify(auth, process.env.JWT_SECRET||'dev_secret');
  const sql=neon(process.env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS songs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, title TEXT, artist TEXT, url TEXT, size INT, created_at TIMESTAMPTZ DEFAULT NOW())`;
  const cnt=await sql`SELECT COUNT(*) as c FROM songs WHERE user_id=${payload.id}`;
  if(parseInt(cnt[0].c)>=3){
    const beta=await sql`SELECT * FROM beta_users WHERE email=${payload.email} LIMIT 1`;
    if(beta.length===0) return res.status(403).json({error:'Free limit 3 songs', needBeta:true});
  }
  // expect multipart handled via busboy? Simplified: use Vercel Blob direct upload handled client-side
  return res.status(200).json({ok:true});
 }catch(e){ return res.status(500).json({error:e.message}); }
}
