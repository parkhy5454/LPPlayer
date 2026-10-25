import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { signToken, NOT_CONFIGURED } from '../../lib/auth.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    if (!EMAIL.test(email)) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다' });
    if (password.length < 8) return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다' });

    const sql = neon(process.env.DATABASE_URL);
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    const hash = await bcrypt.hash(password, 10);
    const rows = await sql`INSERT INTO users (email, password_hash) VALUES (${email}, ${hash})
                           ON CONFLICT (email) DO NOTHING RETURNING id, email`;
    if (!rows.length) return res.status(409).json({ error: '이미 가입된 이메일입니다' });

    return res.status(200).json({ token: signToken(rows[0]), user: { id: rows[0].id, email: rows[0].email } });
  } catch (e) {
    console.error('register error', e);
    return res.status(500).json({ error: e.message });
  }
}
