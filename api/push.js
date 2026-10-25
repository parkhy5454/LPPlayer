import { neon } from '@neondatabase/serverless';
import { userFromRequest, isSuspended, NOT_CONFIGURED } from '../lib/auth.js';

// Push subscriptions for time capsule alerts (the browser asks for permission; this only stores the subscription).
//   GET            -> { publicKey }   the VAPID public key the browser subscribes with (null when not configured)
//   POST           -> { endpoint, keys: { p256dh, auth } }   save this device's subscription
//   DELETE ?endpoint=...             remove it
let ready = false;

async function ensureTable(sql) {
  if (ready) return;
  await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY, user_id UUID NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  ready = true;
}

export default async function handler(req, res) {
  const who = userFromRequest(req);
  if (who.error === 'not-configured') return res.status(500).json({ error: NOT_CONFIGURED });
  if (who.error) return res.status(401).json({ error: 'unauthorized' });

  if (req.method === 'GET') {
    return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
  }

  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL is not set' });
  const sql = neon(process.env.DATABASE_URL);
  const me = who.user.id;
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { body = {}; } }
  body = body || {};

  try {
    await ensureTable(sql);
    if (await isSuspended(sql, me)) return res.status(403).json({ error: '이용이 정지된 계정입니다' });

    if (req.method === 'POST') {
      const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
      const p256dh = body.keys && typeof body.keys.p256dh === 'string' ? body.keys.p256dh : '';
      const auth = body.keys && typeof body.keys.auth === 'string' ? body.keys.auth : '';
      let ok = false;
      try { ok = new URL(endpoint).protocol === 'https:'; } catch {}
      if (!ok || !p256dh || !auth) return res.status(400).json({ error: '알림 정보를 확인해 주세요' });
      await sql`INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (${endpoint}, ${me}, ${p256dh}, ${auth})
                ON CONFLICT (endpoint) DO UPDATE SET user_id = ${me}, p256dh = ${p256dh}, auth = ${auth}`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const endpoint = String(req.query.endpoint || '');
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${me}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('push api error', e);
    return res.status(500).json({ error: e.message });
  }
}
