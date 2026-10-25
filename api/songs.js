import { neon } from '@neondatabase/serverless';
import { del } from '@vercel/blob';
import { userFromRequest, NOT_CONFIGURED } from '../lib/auth.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// only links to files in our own Blob store may be saved
function isOurBlobUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch { return false; }
}

export default async function handler(req, res) {
  const who = userFromRequest(req);
  if (who.error === 'not-configured') return res.status(500).json({ error: NOT_CONFIGURED });
  if (who.error) return res.status(401).json({ error: 'unauthorized' });
  const userId = who.user.id;

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL is not set (Vercel > Settings > Environment Variables)' });
  }
  const sql = neon(process.env.DATABASE_URL);

  try {
    await sql`CREATE TABLE IF NOT EXISTS songs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT,
      artist TEXT,
      url TEXT NOT NULL,
      size INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS user_id UUID`;

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, title, artist, url, size, created_at
                             FROM songs WHERE user_id = ${userId}
                             ORDER BY created_at DESC LIMIT 500`;
      return res.status(200).json({ songs: rows });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { title, artist, url, size } = body;
      if (!url || typeof url !== 'string' || !isOurBlobUrl(url)) {
        return res.status(400).json({ error: 'a valid uploaded file url is required' });
      }
      const rows = await sql`INSERT INTO songs (user_id, title, artist, url, size)
                             VALUES (${userId}, ${title || 'Untitled'}, ${artist || null}, ${url}, ${Number(size) || 0})
                             RETURNING id, title, artist, url, size, created_at`;
      return res.status(200).json({ song: rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!UUID.test(id)) return res.status(400).json({ error: 'valid id is required' });
      const rows = await sql`DELETE FROM songs WHERE id = ${id} AND user_id = ${userId} RETURNING url`;
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      // best effort: free the audio file too; the DB row is already gone
      try { await del(rows[0].url); } catch (e) { console.error('blob delete failed', e.message); }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('songs api error', e);
    return res.status(500).json({ error: e.message });
  }
}
