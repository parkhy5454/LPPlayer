
import { getDb } from './db.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({error:'Method'});
  try{
    const auth = req.headers.authorization?.replace('Bearer ','');
    if(!auth) return res.status(401).json({error:'로그인 필요'});
    let payload;
    try{ payload = jwt.verify(auth, process.env.JWT_SECRET || 'dev_secret'); }catch{ return res.status(401).json({error:'토큰 만료'}); }
    const { tier } = req.body || {};
    const sql = getDb();
    await sql`CREATE TABLE IF NOT EXISTS subscriptions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, tier TEXT, amount INT, created_at TIMESTAMPTZ DEFAULT NOW())`;
    // 테스트 모드: $4.99 결제 없이 tier 변경
    await sql`UPDATE users SET tier = ${tier} WHERE id = ${payload.id}`;
    await sql`INSERT INTO subscriptions (user_id, tier, amount) VALUES (${payload.id}, ${tier}, 499)`;
    return res.status(200).json({ok:true, tier});
  }catch(e){ return res.status(500).json({error: e.message}); }
}
