import { userFromRequest, NOT_CONFIGURED } from '../lib/auth.js';

// Looks up synced lyrics on LRCLIB (https://lrclib.net) for a track.
// Called from the server so the browser never talks to the lyrics service directly.
const UA = 'LPPlayer/10 (personal music player)';

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

function syncedOf(o) {
  return (o && (o.syncedLyrics || o.synced_lyrics)) || null;
}

export default async function handler(req, res) {
  const who = userFromRequest(req);
  if (who.error === 'not-configured') return res.status(500).json({ error: NOT_CONFIGURED });
  if (who.error) return res.status(401).json({ error: 'unauthorized' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const title = String(req.query.title || '').trim().slice(0, 200);
  const artist = String(req.query.artist || '').trim().slice(0, 200);
  const duration = Math.round(Number(req.query.duration) || 0);
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    // 1) exact match on title, artist and length
    const exactQuery = { track_name: title, artist_name: artist };
    if (duration > 0) exactQuery.duration = String(duration);   // length only helps when it is known
    const exact = await getJson('https://lrclib.net/api/get?' + new URLSearchParams(exactQuery));
    if (syncedOf(exact)) return res.status(200).json({ found: true, synced: syncedOf(exact) });

    // 2) fallback: search by title and artist, keep the first result with synced lyrics
    const list = await getJson('https://lrclib.net/api/search?' + new URLSearchParams({
      track_name: title, artist_name: artist
    }));
    const hit = (Array.isArray(list) ? list : []).find((x) => syncedOf(x));
    if (hit) return res.status(200).json({ found: true, synced: syncedOf(hit) });

    return res.status(200).json({ found: false });
  } catch (e) {
    console.error('lyrics lookup failed', e.message);
    return res.status(502).json({ error: 'lyrics service unavailable' });
  }
}
