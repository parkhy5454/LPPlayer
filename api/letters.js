import { neon } from '@neondatabase/serverless';
import { userFromRequest, isSuspended, NOT_CONFIGURED } from '../lib/auth.js';

// 📮 Time capsule: letters to your past self, sealed until they open.
// A letter's text and song are sent only after it has opened, so a sealed letter cannot be read early.
//   GET  -> the signed-in user's letters
//   POST -> { year, content, songId?, years: 1 | 5 | 10 }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CONTENT = 2000;
let ready = false;

async function ensureTable(sql) {
  if (ready) return;
  await sql`CREATE TABLE IF NOT EXISTS letters (
    id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL, year INT NOT NULL, content TEXT NOT NULL,
    song_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), open_date TIMESTAMPTZ NOT NULL)`;
  ready = true;
}

export default async function handler(req, res) {
  const who = userFromRequest(req);
  if (who.error === 'not-configured') return res.status(500).json({ error: NOT_CONFIGURED });
  if (who.error) return res.status(401).json({ error: 'unauthorized' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL is not set' });
  const sql = neon(process.env.DATABASE_URL);
  const me = who.user.id;
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { body = {}; } }
  body = body || {};

  try {
    await ensureTable(sql);
    if (await isSuspended(sql, me)) return res.status(403).json({ error: '이용이 정지된 계정입니다' });

    if (req.method === 'GET') {
      const rows = await sql`SELECT l.id, l.year, l.created_at, l.open_date,
          (l.open_date <= NOW()) AS opened,
          CASE WHEN l.open_date <= NOW() THEN l.content END AS content,
          CASE WHEN l.open_date <= NOW() THEN l.song_id END AS song_id
        FROM letters l
        WHERE l.user_id = ${me}
        ORDER BY l.open_date`;
      return res.status(200).json({ letters: rows });
    }

    if (req.method === 'POST') {
      const year = Number(body.year);
      const years = Number(body.years);
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      const songId = body.songId ? String(body.songId) : null;
      if (!Number.isInteger(year) || year < 1900 || year > 2100) return res.status(400).json({ error: '연도를 확인해 주세요' });
      if (!content) return res.status(400).json({ error: '편지 내용을 입력해 주세요' });
      if (content.length > MAX_CONTENT) return res.status(400).json({ error: `편지는 ${MAX_CONTENT}자 이하로 써 주세요` });
      if (![1, 5, 10].includes(years)) return res.status(400).json({ error: '열리는 시기를 골라 주세요' });
      if (songId) {
        if (!UUID.test(songId)) return res.status(400).json({ error: '곡을 확인해 주세요' });
        const own = await sql`SELECT id FROM songs WHERE id = ${songId} AND user_id = ${me}`;
        if (!own.length) return res.status(404).json({ error: '내 보관함에 없는 곡입니다' });
      }
      const rows = await sql`INSERT INTO letters (user_id, year, content, song_id, open_date)
        VALUES (${me}, ${year}, ${content}, ${songId}, NOW() + make_interval(years => ${years}::int))
        RETURNING id, year, open_date`;
      return res.status(200).json({ letter: rows[0] });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('letters api error', e);
    return res.status(500).json({ error: e.message });
  }
}
