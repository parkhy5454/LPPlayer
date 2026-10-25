
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
export default async function handler(req,res){
 try{
  const auth=req.headers.authorization?.replace('Bearer ','');
  if(!auth) return res.status(401).json({error:'No token'});
  const payload=jwt.verify(auth, process.env.JWT_SECRET||'dev_secret');
  if(payload.role!=='admin' && !payload.email?.includes('parkhy') && !payload.email?.includes('admin')) return res.status(403).json({error:'Admin only'});
  const sql=neon(process.env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE, password_hash TEXT, display_name TEXT, role TEXT DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS songs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, title TEXT, url TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS beta_users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())`;
  const users=await sql`SELECT COUNT(*) as c FROM users`; const songs=await sql`SELECT COUNT(*) as c FROM songs`; const beta=await sql`SELECT COUNT(*) as c FROM beta_users`;
  const today=await sql`SELECT COUNT(*) as c FROM users WHERE created_at::date = NOW()::date`;
  const recent=await sql`SELECT * FROM users ORDER BY created_at DESC LIMIT 20`;
  const recentSongs=await sql`SELECT s.*, u.email FROM songs s LEFT JOIN users u ON s.user_id=u.id ORDER BY s.created_at DESC LIMIT 50`;
  return res.status(200).json({totalUsers: parseInt(users[0].c), totalSongs: parseInt(songs[0].c), betaUsers: parseInt(beta[0].c), todaySignups: parseInt(today[0].c), recentUsers: recent, recentSongs});
 }catch(e){ return res.status(500).json({error:e.message}); }
}
