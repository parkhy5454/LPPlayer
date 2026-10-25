import jwt from 'jsonwebtoken';

// Accounts use a signed token (HS256, 30 days). Fails closed: without JWT_SECRET nothing is accepted.
export const NOT_CONFIGURED = 'JWT_SECRET is not set on the server (Vercel > Settings > Environment Variables)';

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// returns { user: { id, email } } or { error: 'unauthorized' | 'not-configured' }
export function userFromToken(token) {
  if (!process.env.JWT_SECRET) return { error: 'not-configured' };
  if (typeof token !== 'string' || !token) return { error: 'unauthorized' };
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    return { user: { id: p.id, email: p.email } };
  } catch {
    return { error: 'unauthorized' };
  }
}

export function userFromRequest(req) {
  const h = req.headers['authorization'] || '';
  return userFromToken(h.startsWith('Bearer ') ? h.slice(7) : '');
}

// Admins are listed in the ADMIN_EMAILS environment variable (comma-separated).
export function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(String(email).toLowerCase());
}

// Tokens stay valid for 30 days, so a suspension must be checked against the database on each request.
// A missing account counts as suspended.
export async function isSuspended(sql, userId) {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false`;
  const rows = await sql`SELECT suspended FROM users WHERE id = ${userId}`;
  return !rows.length || rows[0].suspended === true;
}
