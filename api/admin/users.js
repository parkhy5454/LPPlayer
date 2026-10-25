
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
export default async function handler(req,res){
 try{
  const auth=req.headers.authorization?.replace('Bearer ',''); const payload=jwt.verify(auth, process.env.JWT_SECRET||'dev_secret');
  if(payload.role!=='admin' && !payload.email?.includes('parkhy')) return res.status(403).json({error:'Admin only'});
  const sql=neon(process.env.DATABASE_URL);
  const users=await sql`SELECT u.*, (SELECT COUNT(*) FROM songs s WHERE s.user_id=u.id) as song_count FROM users u ORDER BY u.created_at DESC LIMIT 100`;
  return res.status(200).json({users});
 }catch(e){ return res.status(500).json({error:e.message}); }
}
