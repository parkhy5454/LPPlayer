import { neon } from '@neondatabase/serverless';
import { isOurFileUrl, deleteFiles } from '../lib/storage.js';
import { userFromRequest, isSuspended, NOT_CONFIGURED } from '../lib/auth.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LYRICS = 200000;   // characters

// year is optional; keep it only when it is a plausible year
function yearOrNull(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null;
}

// trimmed text, or null when empty
function textOrNull(v, max) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
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
    if (await isSuspended(sql, userId)) return res.status(403).json({ error: '이용이 정지된 계정입니다' });
    await sql`CREATE TABLE IF NOT EXISTS songs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT,
      artist TEXT,
      url TEXT NOT NULL,
      size INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS user_id UUID`;
    await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics TEXT`;
    await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS year INT`;
    await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS album TEXT`;
    await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS genre TEXT`;
    await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS cover_url TEXT`;

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, title, artist, album, genre, url, size, lyrics, year, cover_url, created_at
                             FROM songs WHERE user_id = ${userId}
                             ORDER BY created_at DESC LIMIT 500`;
      return res.status(200).json({ songs: rows });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { title, artist, url, size } = body;
      if (!url || typeof url !== 'string' || !isOurFileUrl(url)) {
        return res.status(400).json({ error: 'a valid uploaded file url is required' });
      }
      const cover = typeof body.cover_url === 'string' && body.cover_url ? body.cover_url : null;
      if (cover && !isOurFileUrl(cover)) return res.status(400).json({ error: 'a valid cover url is required' });
      const lyrics = typeof body.lyrics === 'string' && body.lyrics.trim()
        ? body.lyrics.slice(0, MAX_LYRICS) : null;
      const year = yearOrNull(body.year);
      const rows = await sql`INSERT INTO songs (user_id, title, artist, album, genre, url, size, lyrics, year, cover_url)
                             VALUES (${userId}, ${title || 'Untitled'}, ${artist || null}, ${textOrNull(body.album, 120)},
                                     ${textOrNull(body.genre, 60)}, ${url}, ${Number(size) || 0}, ${lyrics}, ${year}, ${cover})
                             RETURNING id, title, artist, album, genre, url, size, lyrics, year, cover_url, created_at`;
      return res.status(200).json({ song: rows[0] });
    }

    if (req.method === 'PATCH') {
      // edit one of the user's own songs: lyrics, or the info fields (only the keys that are sent change)
      const id = String(req.query.id || '');
      if (!UUID.test(id)) return res.status(400).json({ error: 'valid id is required' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const own = await sql`SELECT id FROM songs WHERE id = ${id} AND user_id = ${userId}`;
      if (!own.length) return res.status(404).json({ error: 'not found' });
      if ('lyrics' in body) {
        const lyrics = typeof body.lyrics === 'string' && body.lyrics.trim() ? body.lyrics.slice(0, MAX_LYRICS) : null;
        await sql`UPDATE songs SET lyrics = ${lyrics} WHERE id = ${id} AND user_id = ${userId}`;
      }
      if ('title' in body) await sql`UPDATE songs SET title = ${textOrNull(body.title, 80)} WHERE id = ${id} AND user_id = ${userId}`;
      if ('artist' in body) await sql`UPDATE songs SET artist = ${textOrNull(body.artist, 80)} WHERE id = ${id} AND user_id = ${userId}`;
      if ('album' in body) await sql`UPDATE songs SET album = ${textOrNull(body.album, 120)} WHERE id = ${id} AND user_id = ${userId}`;
      if ('genre' in body) await sql`UPDATE songs SET genre = ${textOrNull(body.genre, 60)} WHERE id = ${id} AND user_id = ${userId}`;
      if ('year' in body) await sql`UPDATE songs SET year = ${yearOrNull(body.year)} WHERE id = ${id} AND user_id = ${userId}`;
      const rows = await sql`SELECT id, title, artist, album, genre, year, lyrics FROM songs WHERE id = ${id} AND user_id = ${userId}`;
      return res.status(200).json({ song: rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!UUID.test(id)) return res.status(400).json({ error: 'valid id is required' });
      const rows = await sql`DELETE FROM songs WHERE id = ${id} AND user_id = ${userId} RETURNING url, cover_url`;
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      // best effort: free the audio file and the cover too; the DB row is already gone
      try { await deleteFiles([rows[0].url, rows[0].cover_url]); } catch (e) { console.error('blob delete failed', e.message); }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('songs api error', e);
    return res.status(500).json({ error: e.message });
  }
}
