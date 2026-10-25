import { neon } from '@neondatabase/serverless';

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// display name: 1 to 20 characters after trimming
export function cleanName(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  return s && s.length <= 20 ? s : null;
}

// Korean mobile number, stored as 010-1234-5678 (or 010-123-4567)
export function cleanPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (!/^01[016789]\d{7,8}$/.test(d)) return null;
  return d.length === 11
    ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
    : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

// accounts created before these fields existed get the columns on first use
export async function ensureUserColumns(sql) {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false`;
}
