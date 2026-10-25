import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { signToken, NOT_CONFIGURED } from '../../lib/auth.js';

const WRONG = '이메일 또는 비밀번호가 맞지 않습니다';   // same message for "no such account" and "wrong password"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  if (!process.env.JWT_SECRET) return res.status(500).json({ error: NOT_CONFIGURED });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL is not set' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return res.status(400).json({ error: WRONG });

    const sql = neon(process.env.DATABASE_URL);
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false`;
    const rows = await sql`SELECT id, email, password_hash, suspended FROM users WHERE email = ${email} LIMIT 1`;
    if (!rows.length) return res.status(401).json({ error: WRONG });
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: WRONG });
    // checked after the password, so the message does not reveal anything to someone who does not know it
    if (rows[0].suspended) return res.status(403).json({ error: '이용이 정지된 계정입니다' });

    return res.status(200).json({ token: signToken(rows[0]), user: { id: rows[0].id, email: rows[0].email } });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: e.message });
  }
}
