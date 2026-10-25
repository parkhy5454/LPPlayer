
import { neon } from '@neondatabase/serverless';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const envCheck = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
    JWT_SECRET: !!process.env.JWT_SECRET,
    DATABASE_URL_prefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0,30)+'...' : 'missing',
  };
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(200).json({ env: envCheck, error: 'DATABASE_URL missing', fix: 'Vercel Dashboard > Settings > Environment Variables > Add DATABASE_URL from Neon' });
    }
    const sql = neon(process.env.DATABASE_URL);
    await sql`CREATE TABLE IF NOT EXISTS songs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, title TEXT, artist TEXT, url TEXT, size INT, play_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`;
    const rows = await sql`SELECT COUNT(*) as count FROM songs`;
    const recent = await sql`SELECT id, title, url, created_at FROM songs ORDER BY created_at DESC LIMIT 5`;
    return res.status(200).json({ 
      env: envCheck, 
      db_connected: true,
      songs_count: rows[0].count,
      recent_songs: recent,
      message: 'DB OK - if songs_count > 0 but frontend shows 0, frontend fetch is broken'
    });
  } catch(e) {
    return res.status(500).json({ env: envCheck, db_connected: false, error: e.message, stack: e.stack });
  }
}
