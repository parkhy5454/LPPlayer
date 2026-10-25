
import { neon } from '@neondatabase/serverless';
export default async function handler(req,res){
 const sql=neon(process.env.DATABASE_URL);
 try{
  await sql`CREATE TABLE IF NOT EXISTS songs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, title TEXT, artist TEXT, genre TEXT, year INT, url TEXT, size INT, play_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`;
  const rows=await sql`SELECT s.*, u.email FROM songs s LEFT JOIN users u ON s.user_id=u.id ORDER BY s.created_at DESC LIMIT 200`;
  return res.status(200).json({songs:rows});
 }catch(e){ return res.status(500).json({error:e.message, songs:[]}); }
}
