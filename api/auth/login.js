
import { getDb } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({error:'Method'});
  try{
    const { email, password } = req.body || {};
    const sql = getDb();
    const users = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
    if(users.length === 0) return res.status(401).json({error:'가입된 이메일이 없습니다'});
    const user = users[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if(!ok) return res.status(401).json({error:'비밀번호 틀림'});
    const token = jwt.sign({id: user.id, email: user.email, tier: user.tier}, process.env.JWT_SECRET || 'dev_secret', {expiresIn:'30d'});
    return res.status(200).json({user: {id: user.id, email: user.email, tier: user.tier, created_at: user.created_at}, token});
  }catch(e){ return res.status(500).json({error: e.message}); }
}
