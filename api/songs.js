
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`CREATE TABLE IF NOT EXISTS songs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, title TEXT, artist TEXT, url TEXT, size INT, play_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE, password_hash TEXT, display_name TEXT, role TEXT DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT NOW())`;
    
    if (req.method === 'GET') {
      const rows = await sql`SELECT s.*, u.email as user_email, u.display_name FROM songs s LEFT JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 200`;
      return res.status(200).json({ songs: rows });
    }
    if (req.method === 'POST') {
      let userId = null;
      let userEmail = null;
      const auth = req.headers.authorization?.replace('Bearer ','');
      if (auth) {
        try {
          const payload = jwt.verify(auth, process.env.JWT_SECRET || 'dev_secret');
          userId = payload.id;
          userEmail = payload.email;
          // Check free limit
          const cnt = await sql`SELECT COUNT(*) as c FROM songs WHERE user_id=${userId}`;
          if (parseInt(cnt[0].c) >= 3) {
            const users = await sql`SELECT role FROM users WHERE id=${userId}`;
            const role = users[0]?.role || 'user';
            if (role !== 'admin') {
              const beta = await sql`SELECT * FROM beta_users WHERE email=${userEmail} LIMIT 1`;
              // Allow anyway for now, but flag
            }
          }
        } catch(e) { console.log('JWT invalid, saving as anon', e.message); }
      }
      const { title, artist, url, size } = req.body || {};
      if (!url) return res.status(400).json({ error: 'url required' });
      const result = await sql`INSERT INTO songs (user_id, title, artist, url, size) VALUES (${userId}, ${title}, ${artist}, ${url}, ${size||0}) RETURNING *`;
      return res.status(200).json({ song: result[0] });
    }
    return res.status(405).json({ error: 'Method' });
  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
