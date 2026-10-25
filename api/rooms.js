import { neon } from '@neondatabase/serverless';
import { userFromRequest, isSuspended, NOT_CONFIGURED } from '../lib/auth.js';

// Mixtape Together: one host controls playback, members follow the room state (polled every 2 s).
// Positions are kept on the server clock (updated_at), so clients only compare server times.
const EMOJI = ['❤️', '🔥', '😭', '👏'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let ready = false;

async function ensureTables(sql) {
  if (ready) return;
  await sql`CREATE TABLE IF NOT EXISTS songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT, artist TEXT, url TEXT NOT NULL,
    size INT, created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS user_id UUID`;
  await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics TEXT`;
  await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS year INT`;
  await sql`CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY, host_id UUID NOT NULL, current_song_id UUID,
    position DOUBLE PRECISION NOT NULL DEFAULT 0, playing BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS room_members (
    room_code TEXT NOT NULL, user_id UUID NOT NULL, email TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (room_code, user_id))`;
  await sql`CREATE TABLE IF NOT EXISTS room_queue (
    id BIGSERIAL PRIMARY KEY, room_code TEXT NOT NULL, song_id UUID NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS room_reactions (
    id BIGSERIAL PRIMARY KEY, room_code TEXT NOT NULL, emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  ready = true;
}

function cleanPosition(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 86400 ? n : 0;
}

export default async function handler(req, res) {
  const who = userFromRequest(req);
  if (who.error === 'not-configured') return res.status(500).json({ error: NOT_CONFIGURED });
  if (who.error) return res.status(401).json({ error: 'unauthorized' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL is not set' });
  const sql = neon(process.env.DATABASE_URL);
  const me = who.user.id;
  const email = who.user.email || '';
  const action = String(req.query.action || '');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { body = {}; } }
  body = body || {};
  const code = String(req.query.code || body.code || '');

  try {
    await ensureTables(sql);
    if (await isSuspended(sql, me)) return res.status(403).json({ error: '이용이 정지된 계정입니다' });

    // member check used by every room action; the host is always a member
    async function requireMember() {
      if (!/^\d{6}$/.test(code)) return { error: 400, msg: 'invalid room code' };
      const rows = await sql`SELECT r.host_id FROM rooms r
                             JOIN room_members m ON m.room_code = r.code AND m.user_id = ${me}
                             WHERE r.code = ${code}`;
      if (!rows.length) return { error: 404, msg: 'room not found or ended' };
      return { isHost: rows[0].host_id === me };
    }

    if (action === 'create' && req.method === 'POST') {
      // one room per host: an old room of this host is closed first
      await sql`DELETE FROM room_queue WHERE room_code IN (SELECT code FROM rooms WHERE host_id = ${me})`;
      await sql`DELETE FROM room_reactions WHERE room_code IN (SELECT code FROM rooms WHERE host_id = ${me})`;
      await sql`DELETE FROM room_members WHERE room_code IN (SELECT code FROM rooms WHERE host_id = ${me})`;
      await sql`DELETE FROM rooms WHERE host_id = ${me}`;
      let made = null;
      for (let i = 0; i < 10 && !made; i++) {
        const c = String(100000 + Math.floor(Math.random() * 900000));
        const r = await sql`INSERT INTO rooms (code, host_id) VALUES (${c}, ${me})
                            ON CONFLICT (code) DO NOTHING RETURNING code`;
        if (r.length) made = c;
      }
      if (!made) return res.status(500).json({ error: 'could not create a room, try again' });
      await sql`INSERT INTO room_members (room_code, user_id, email) VALUES (${made}, ${me}, ${email})`;
      return res.status(200).json({ code: made });
    }

    if (action === 'join' && req.method === 'POST') {
      if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'enter the 6-digit code' });
      const rows = await sql`SELECT code FROM rooms WHERE code = ${code}`;
      if (!rows.length) return res.status(404).json({ error: 'room not found' });
      await sql`INSERT INTO room_members (room_code, user_id, email) VALUES (${code}, ${me}, ${email})
                ON CONFLICT (room_code, user_id) DO NOTHING`;
      return res.status(200).json({ code });
    }

    if (action === 'state' && req.method === 'GET') {
      const m = await requireMember();
      if (m.error) return res.status(m.error).json({ error: m.msg });
      const [room] = await sql`SELECT current_song_id, position, playing, updated_at, NOW() AS server_now
                               FROM rooms WHERE code = ${code}`;
      let song = null;
      if (room.current_song_id) {
        const s = await sql`SELECT id, title, artist, url, lyrics, year FROM songs WHERE id = ${room.current_song_id}`;
        song = s[0] || null;
      }
      const members = await sql`SELECT email FROM room_members WHERE room_code = ${code} ORDER BY joined_at`;
      const queue = await sql`SELECT q.id AS qid, s.id, s.title, s.artist FROM room_queue q
                              JOIN songs s ON s.id = q.song_id WHERE q.room_code = ${code} ORDER BY q.added_at, q.id`;
      const reactions = await sql`SELECT id, emoji FROM room_reactions
                                  WHERE room_code = ${code} AND created_at > NOW() - INTERVAL '20 seconds'
                                  ORDER BY id DESC LIMIT 20`;
      return res.status(200).json({
        isHost: m.isHost,
        song,
        position: room.position,
        playing: room.playing,
        updatedAt: room.updated_at,
        serverNow: room.server_now,
        members: members.map((x) => x.email || ''),
        queue,
        reactions: reactions.reverse(),
      });
    }

    if (action === 'control' && req.method === 'POST') {
      const m = await requireMember();
      if (m.error) return res.status(m.error).json({ error: m.msg });
      if (!m.isHost) return res.status(403).json({ error: 'only the host can control playback' });
      const pos = cleanPosition(body.position);
      const kind = String(body.action || '');

      if (kind === 'play') {
        await sql`UPDATE rooms SET playing = true, position = ${pos}, updated_at = NOW() WHERE code = ${code}`;
      } else if (kind === 'pause') {
        await sql`UPDATE rooms SET playing = false, position = ${pos}, updated_at = NOW() WHERE code = ${code}`;
      } else if (kind === 'seek') {
        await sql`UPDATE rooms SET position = ${pos}, updated_at = NOW() WHERE code = ${code}`;
      } else if (kind === 'song' || kind === 'queue') {
        const songId = String(body.songId || '');
        if (!UUID.test(songId)) return res.status(400).json({ error: 'valid songId is required' });
        const own = await sql`SELECT id FROM songs WHERE id = ${songId} AND user_id = ${me}`;
        if (!own.length) return res.status(404).json({ error: 'song not found in your library' });
        if (kind === 'song') {
          await sql`UPDATE rooms SET current_song_id = ${songId}, position = 0, playing = true, updated_at = NOW()
                    WHERE code = ${code}`;
          await sql`DELETE FROM room_queue WHERE room_code = ${code} AND song_id = ${songId}`;
        } else {
          await sql`INSERT INTO room_queue (room_code, song_id) VALUES (${code}, ${songId})`;
        }
      } else if (kind === 'next') {
        const nxt = await sql`SELECT id, song_id FROM room_queue WHERE room_code = ${code} ORDER BY added_at, id LIMIT 1`;
        if (nxt.length) {
          await sql`DELETE FROM room_queue WHERE id = ${nxt[0].id}`;
          await sql`UPDATE rooms SET current_song_id = ${nxt[0].song_id}, position = 0, playing = true, updated_at = NOW()
                    WHERE code = ${code}`;
        } else {
          await sql`UPDATE rooms SET playing = false, position = 0, updated_at = NOW() WHERE code = ${code}`;
        }
      } else if (kind === 'move') {
        // swap the queue position of one row with its neighbour (queue order = added_at, id)
        const qid = Number(body.qid);
        const dir = body.dir === -1 ? -1 : 1;
        const rows = await sql`SELECT id, added_at FROM room_queue WHERE room_code = ${code} ORDER BY added_at, id`;
        const i = rows.findIndex((r) => Number(r.id) === qid);
        const j = i + dir;
        if (i >= 0 && j >= 0 && j < rows.length) {
          await sql`UPDATE room_queue SET added_at = CASE WHEN id = ${rows[i].id} THEN ${rows[j].added_at}::timestamptz
                                                     ELSE ${rows[i].added_at}::timestamptz END
                    WHERE id IN (${rows[i].id}, ${rows[j].id})`;
        }
      } else {
        return res.status(400).json({ error: 'unknown action' });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'react' && req.method === 'POST') {
      const m = await requireMember();
      if (m.error) return res.status(m.error).json({ error: m.msg });
      const emoji = String(body.emoji || '');
      if (!EMOJI.includes(emoji)) return res.status(400).json({ error: 'unknown reaction' });
      await sql`INSERT INTO room_reactions (room_code, emoji) VALUES (${code}, ${emoji})`;
      return res.status(200).json({ ok: true });
    }

    if (action === 'leave' && req.method === 'POST') {
      const m = await requireMember();
      if (m.error) return res.status(200).json({ ok: true });   // already gone
      if (m.isHost) {
        await sql`DELETE FROM room_queue WHERE room_code = ${code}`;
        await sql`DELETE FROM room_reactions WHERE room_code = ${code}`;
        await sql`DELETE FROM room_members WHERE room_code = ${code}`;
        await sql`DELETE FROM rooms WHERE code = ${code}`;
      } else {
        await sql`DELETE FROM room_members WHERE room_code = ${code} AND user_id = ${me}`;
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('rooms api error', e);
    return res.status(500).json({ error: e.message });
  }
}
