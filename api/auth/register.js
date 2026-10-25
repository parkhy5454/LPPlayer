
import { getDb } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const { email, password } = req.body || {};
    if(!email || !password) return res.status(400).json({error:'Email and password required'});
    const sql = getDb();
    await sql`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, tier TEXT DEFAULT 'free', created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS beta_users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())`;
    const hash = await bcrypt.hash(password, 10);
    const result = await sql`INSERT INTO users (email, password_hash, tier) VALUES (${email}, ${hash}, 'free') ON CONFLICT (email) DO NOTHING RETURNING id, email, tier, created_at`;
    if(result.length === 0) return res.status(409).json({error:'이미 존재하는 이메일'});
    const user = result[0];
    const token = jwt.sign({id: user.id, email: user.email, tier: user.tier}, process.env.JWT_SECRET || 'dev_secret', {expiresIn:'30d'});
    await sql`INSERT INTO beta_users (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING`;
    return res.status(200).json({user, token});
  }catch(e){ console.error(e); return res.status(500).json({error: e.message}); }
}
