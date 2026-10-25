import { neon } from '@neondatabase/serverless';
import webpush from 'web-push';

// Runs once a day (see vercel.json). Sends a push to each device of the owner of a letter that has just opened.
// Only Vercel's cron (which sends CRON_SECRET as a bearer token) may call it.
const BATCH = 200;

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL is not set' });
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return res.status(500).json({ error: 'push keys are not set' });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const sql = neon(process.env.DATABASE_URL);

  try {
    await sql`CREATE TABLE IF NOT EXISTS letters (
      id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL, year INT NOT NULL, content TEXT NOT NULL,
      song_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), open_date TIMESTAMPTZ NOT NULL)`;
    await sql`ALTER TABLE letters ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ`;
    await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY, user_id UUID NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

    const due = await sql`SELECT id, user_id, year FROM letters
                          WHERE open_date <= NOW() AND notified_at IS NULL ORDER BY open_date LIMIT ${BATCH}`;
    let sent = 0;
    let removed = 0;
    for (const l of due) {
      const subs = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${l.user_id}`;
      const payload = JSON.stringify({ title: '📮 타임캡슐이 도착했어요', body: `${l.year}년의 나에게 보낸 편지가 열렸어요`, url: './' });
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
          sent++;
        } catch (e) {
          // the browser has dropped this subscription
          if (e.statusCode === 404 || e.statusCode === 410) {
            await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
            removed++;
          }
        }
      }
      await sql`UPDATE letters SET notified_at = NOW() WHERE id = ${l.id}`;
    }
    return res.status(200).json({ letters: due.length, sent, removed });
  } catch (e) {
    console.error('letters cron error', e);
    return res.status(500).json({ error: e.message });
  }
}
