import { timingSafeEqual } from 'node:crypto';

// One shared app password (env APP_PASSWORD). Fails closed: if it is not set, nothing is allowed.
export function keyIsValid(key) {
  const expected = process.env.APP_PASSWORD;
  if (!expected || typeof key !== 'string' || !key) return false;
  const a = Buffer.from(key), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function keyFromRequest(req) {
  return req.headers['x-app-key'];
}
