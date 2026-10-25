import { neon } from '@neondatabase/serverless';
import { del } from '@vercel/blob';
import { userFromRequest, isAdminEmail, NOT_CONFIGURED } from '../lib/auth.js';

// Admin tools. Only accounts listed in ADMIN_EMAILS get anything but 403.
//   GET                          -> totals and the user list
//   GET  ?action=songs&q=        -> recent songs (search by title or artist), with owner email
//   DELETE ?id=<song id>         -> remove a song and its audio file
//   POST ?action=suspend         -> body { userId, suspended } to suspend or restore an account
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  const who = userFromRequest(req);
  if (who.error === 'not-configured') return res.status(500).json({ error: NOT_CONFIGURED });
  if (who.error) return res.status(401).json({ error: 'unauthorized' });
  if (!isAdminEmail(who.user.email)) return res.status(403).json({ error: 'admin only' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL is not set' });
  const sql = neon(process.env.DATABASE_URL);
  const action = String(req.query.action || '');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { body = {}; } }
  body = body || {};

  try {
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false`;
    await sql`CREATE TABLE IF NOT EXISTS songs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT, artist TEXT, url TEXT NOT NULL,
      size INT, created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS user_id UUID`;
    await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS year INT`;

    if (req.method === 'GET' && action === 'songs') {
      const q = String(req.query.q || '').trim().slice(0, 80);
      const like = `%${q}%`;
      const rows = await sql`SELECT s.id, s.title, s.artist, s.size, s.year, s.created_at, u.email
                             FROM songs s LEFT JOIN users u ON u.id = s.user_id
                             WHERE ${q} = '' OR s.title ILIKE ${like} OR COALESCE(s.artist, '') ILIKE ${like}
                             ORDER BY s.created_at DESC LIMIT 100`;
      return res.status(200).json({ songs: rows.map((r) => ({ ...r, size: Number(r.size) || 0 })) });
    }

    if (req.method === 'GET' && !action) {
      const [t] = await sql`SELECT (SELECT COUNT(*)::int FROM users) AS users,
                                   (SELECT COUNT(*)::int FROM songs) AS songs,
                                   (SELECT COALESCE(SUM(size), 0)::bigint FROM songs) AS bytes`;
      const users = await sql`SELECT u.id, u.email, u.created_at, u.suspended,
                                     COUNT(s.id)::int AS songs, COALESCE(SUM(s.size), 0)::bigint AS bytes
                              FROM users u LEFT JOIN songs s ON s.user_id = u.id
                              GROUP BY u.id ORDER BY u.created_at DESC LIMIT 500`;
      return res.status(200).json({
        totals: { users: t.users, songs: t.songs, bytes: Number(t.bytes) || 0 },
        users: users.map((u) => ({ ...u, bytes: Number(u.bytes) || 0 })),
      });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!UUID.test(id)) return res.status(400).json({ error: 'valid id is required' });
      const rows = await sql`DELETE FROM songs WHERE id = ${id} RETURNING url`;
      if (!rows.length) return res.status(404).json({ error: 'not found' });
      // best effort: the row is already gone, the audio file is freed as well
      try { await del(rows[0].url); } catch (e) { console.error('blob delete failed', e.message); }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && action === 'suspend') {
      const userId = String(body.userId || '');
      if (!UUID.test(userId)) return res.status(400).json({ error: 'valid userId is required' });
      const target = await sql`SELECT email FROM users WHERE id = ${userId}`;
      if (!target.length) return res.status(404).json({ error: 'not found' });
      if (isAdminEmail(target[0].email)) return res.status(400).json({ error: '관리자 계정은 정지할 수 없습니다' });
      await sql`UPDATE users SET suspended = ${body.suspended === true} WHERE id = ${userId}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, DELETE, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('admin api error', e);
    return res.status(500).json({ error: e.message });
  }
}
