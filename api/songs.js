import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not set' });
  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`CREATE TABLE IF NOT EXISTS songs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, title TEXT, artist TEXT, url TEXT, size INT, play_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE, password_hash TEXT, display_name TEXT, role TEXT DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT NOW())`;
    if (req.method === 'GET') {
      const rows = await sql`SELECT s.id, s.title, s.artist, s.url, s.size, s.created_at FROM songs s ORDER BY s.created_at DESC LIMIT 200`;
      return res.status(200).json({ songs: rows });
    }
    if (req.method === 'POST') {
      let userId = null;
      const auth = req.headers.authorization?.replace('Bearer ','');
      if (auth) { try { const p = jwt.verify(auth, process.env.JWT_SECRET||'dev_secret'); userId = p.id; } catch(e){} }
      let body = req.body; if (typeof body==='string'){ try{ body=JSON.parse(body);}catch(e){} }
      const { title, artist, url, size } = body || {};
      if (!url) return res.status(400).json({ error: 'url required' });
      const result = await sql`INSERT INTO songs (user_id, title, artist, url, size) VALUES (${userId}, ${title||'Untitled'}, ${artist||'Unknown'}, ${url}, ${size||0}) RETURNING *`;
      return res.status(200).json({ song: result[0], message: 'Saved - all devices + persists' });
    }
    if (req.method === 'DELETE') { const { id } = req.query; await sql`DELETE FROM songs WHERE id=${id}`; return res.status(200).json({ ok: true }); }
    return res.status(405).json({ error: 'Method' });
  } catch(e) { console.error(e); return res.status(500).json({ error: e.message }); }
}