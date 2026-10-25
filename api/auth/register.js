
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'POST'});
 const {email,password,displayName}=req.body||{};
 if(!email||!password) return res.status(400).json({error:'email/password'});
 if(password.length<6) return res.status(400).json({error:'6+ chars'});
 try{
  const sql=neon(process.env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE, password_hash TEXT, display_name TEXT, role TEXT DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT NOW())`;
  const hash=await bcrypt.hash(password,10);
  const role=(email.includes('parkhy')||email.includes('admin'))?'admin':'user';
  const rows=await sql`INSERT INTO users (email,password_hash,display_name,role) VALUES (${email},${hash},${displayName||email.split('@')[0]},${role}) ON CONFLICT (email) DO NOTHING RETURNING id,email,display_name,role`;
  if(rows.length===0) return res.status(409).json({error:'Exists'});
  const token=jwt.sign({id:rows[0].id,email:rows[0].email,role:rows[0].role}, process.env.JWT_SECRET||'dev_secret',{expiresIn:'7d'});
  return res.status(200).json({token,user:rows[0]});
 }catch(e){ return res.status(500).json({error:e.message}); }
}
