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
