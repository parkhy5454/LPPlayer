import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { userFromRequest, signToken, NOT_CONFIGURED } from '../lib/auth.js';
import { EMAIL, cleanName, cleanPhone, ensureUserColumns } from '../lib/profile.js';

// The signed-in user's own account. A wrong current password is 400, not 401: the app treats 401 as an expired session.
//   GET                          -> name, phone, email
//   PATCH                        -> { name, phone }
//   POST ?action=email           -> { password, email } (checks the password, returns a new token)
//   POST ?action=password        -> { current, next } (checks the current password)
const WRONG_PW = '현재 비밀번호가 맞지 않습니다';

export default async function handler(req, res) {
  const who = userFromRequest(req);
  if (who.error === 'not-configured') return res.status(500).json({ error: NOT_CONFIGURED });
  if (who.error) return res.status(401).json({ error: 'unauthorized' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL is not set' });
  const userId = who.user.id;
  const sql = neon(process.env.DATABASE_URL);
  const action = String(req.query.action || '');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { body = {}; } }
  body = body || {};

  try {
    await ensureUserColumns(sql);
    const rows = await sql`SELECT id, email, name, phone, password_hash FROM users WHERE id = ${userId}`;
    if (!rows.length) return res.status(404).json({ error: 'account not found' });
    const me = rows[0];
    const view = (u) => ({ id: u.id, email: u.email, name: u.name || '', phone: u.phone || '' });

    if (req.method === 'GET') {
      return res.status(200).json({ user: view(me) });
    }

    if (req.method === 'PATCH') {
      const name = cleanName(body.name);
      const phone = cleanPhone(body.phone);
      if (!name) return res.status(400).json({ error: '이름을 입력해 주세요 (20자 이하)' });
      if (!phone) return res.status(400).json({ error: '휴대폰 번호를 확인해 주세요 (010으로 시작)' });
      const updated = await sql`UPDATE users SET name = ${name}, phone = ${phone} WHERE id = ${userId}
                                RETURNING id, email, name, phone`;
      return res.status(200).json({ user: view(updated[0]) });
    }

    if (req.method === 'POST' && action === 'email') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!EMAIL.test(email)) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다' });
      if (!(await bcrypt.compare(password, me.password_hash))) return res.status(400).json({ error: WRONG_PW });
      if (email === me.email) return res.status(400).json({ error: '현재 이메일과 같습니다' });
      try {
        const updated = await sql`UPDATE users SET email = ${email} WHERE id = ${userId} RETURNING id, email, name, phone`;
        // the token carries the email (used for the admin check), so a new one is issued
        return res.status(200).json({ token: signToken(updated[0]), user: view(updated[0]) });
      } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: '이미 가입된 이메일입니다' });
        throw e;
      }
    }

    if (req.method === 'POST' && action === 'password') {
      const current = String(body.current || '');
      const next = String(body.next || '');
      if (!(await bcrypt.compare(current, me.password_hash))) return res.status(400).json({ error: WRONG_PW });
      if (next.length < 8) return res.status(400).json({ error: '새 비밀번호는 8자 이상이어야 합니다' });
      if (next === current) return res.status(400).json({ error: '현재 비밀번호와 다르게 입력해 주세요' });
      const hash = await bcrypt.hash(next, 10);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PATCH, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('account api error', e);
    return res.status(500).json({ error: e.message });
  }
}
