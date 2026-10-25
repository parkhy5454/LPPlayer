
import { getDb } from './db.js';
export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({error:'Method'});
  try{
    const { email } = req.body || {};
    const sql = getDb();
    await sql`CREATE TABLE IF NOT EXISTS beta_users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`INSERT INTO beta_users (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING`;
    return res.status(200).json({ok:true});
  }catch(e){ return res.status(500).json({error: e.message}); }
}
