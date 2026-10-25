
import { neon } from '@neondatabase/serverless';
export default async function handler(req,res){
  const sql=neon(process.env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS beta_users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())`;
  const {email}=req.body||{};
  if(!email) return res.status(400).json({error:'email'});
  await sql`INSERT INTO beta_users (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING`;
  return res.status(200).json({ok:true});
}
