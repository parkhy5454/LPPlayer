
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
export default async function handler(req,res){
 try{
  const auth=req.headers.authorization?.replace('Bearer ',''); const payload=jwt.verify(auth, process.env.JWT_SECRET||'dev_secret');
  if(payload.role!=='admin' && !payload.email?.includes('parkhy')) return res.status(403).json({error:'Admin'});
  const {id}=req.body||{}; const sql=neon(process.env.DATABASE_URL);
  await sql`DELETE FROM songs WHERE user_id=${id}`; await sql`DELETE FROM users WHERE id=${id}`;
  return res.status(200).json({ok:true});
 }catch(e){ return res.status(500).json({error:e.message}); }
}
