
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
export default async function handler(req,res){
 try{
  const auth=req.headers.authorization?.replace('Bearer ',''); if(!auth) return res.status(401).json({error:'No token'});
  const payload=jwt.verify(auth, process.env.JWT_SECRET||'dev_secret');
  if(payload.role!=='admin' && !payload.email?.includes('parkhy')) return res.status(403).json({error:'Admin only'});
  const sql=neon(process.env.DATABASE_URL);
  const users=await sql`SELECT COUNT(*) as c FROM users`; const songs=await sql`SELECT COUNT(*) as c FROM songs`;
  const recent=await sql`SELECT * FROM users ORDER BY created_at DESC LIMIT 20`;
  const recentSongs=await sql`SELECT s.*, u.email FROM songs s LEFT JOIN users u ON s.user_id=u.id ORDER BY s.created_at DESC LIMIT 50`;
  return res.status(200).json({totalUsers: parseInt(users[0].c), totalSongs: parseInt(songs[0].c), recentUsers: recent, recentSongs});
 }catch(e){ return res.status(500).json({error:e.message}); }
}
