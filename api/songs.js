
import { neon } from '@neondatabase/serverless';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // Debug logging
  console.log('Songs API', req.method, 'env DATABASE_URL exists?', !!process.env.DATABASE_URL);
  
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not set in Vercel Env Vars. Go to Vercel Dashboard > Settings > Environment Variables > Add DATABASE_URL from Neon dashboard' });
  }
  
  try {
    const { neon: neonFn } = await import('@neondatabase/serverless');
    const sql = neonFn(process.env.DATABASE_URL);
    
    // Ensure table exists
    await sql`CREATE TABLE IF NOT EXISTS songs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, title TEXT, artist TEXT, url TEXT, size INT, play_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`;
    
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, title, artist, url, size, created_at FROM songs ORDER BY created_at DESC LIMIT 200`;
      console.log('GET songs success', rows.length);
      return res.status(200).json({ songs: rows, count: rows.length });
    }
    
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
      if (!body || typeof body !== 'object') { body = {}; }
      
      // Try to get from query too (fallback)
      const url = body.url || req.query.url;
      const title = body.title || req.query.title || 'Untitled';
      const artist = body.artist || req.query.artist || 'Unknown';
      const size = body.size || 0;
      
      console.log('POST songs body', { title, url: url?.substring(0,50) });
      
      if (!url) {
        return res.status(400).json({ error: 'url required. First upload to /api/upload, then save url to /api/songs', received: body });
      }
      
      const result = await sql`INSERT INTO songs (title, artist, url, size) VALUES (${title}, ${artist}, ${url}, ${size}) RETURNING *`;
      console.log('INSERT success', result[0].id);
      return res.status(200).json({ song: result[0], message: 'Saved permanently', count: result.length });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch(e) {
    console.error('Songs API error', e);
    return res.status(500).json({ error: e.message, stack: e.stack?.substring(0,500) });
  }
}
