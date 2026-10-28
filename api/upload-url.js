import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { userFromRequest, isSuspended, NOT_CONFIGURED } from '../lib/auth.js';
import { r2Configured, presignUpload, publicUrlFor } from '../lib/storage.js';

// The browser uploads the file straight to Cloudflare R2 with a short-lived signed PUT address.
// This route checks the signed-in account and returns that address; the file never passes through here,
// so the serverless body limit does not apply.
const MAX_BYTES = 500 * 1024 * 1024;
const SAFE_NAME = /^[A-Za-z0-9._-]{1,200}$/;
const ALLOWED_TYPES = /^(audio|video|image)\//;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  if (!r2Configured()) {
    return res.status(500).json({ error: 'R2 storage is not configured (R2_* environment variables)' });
  }
  const who = userFromRequest(req);
  if (who.error === 'not-configured') return res.status(500).json({ error: NOT_CONFIGURED });
  if (who.error) return res.status(401).json({ error: 'unauthorized' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { pathname, contentType, size } = body;
    if (typeof pathname !== 'string' || !SAFE_NAME.test(pathname)) {
      return res.status(400).json({ error: 'bad file name' });
    }
    if (typeof contentType !== 'string' || !ALLOWED_TYPES.test(contentType)) {
      return res.status(400).json({ error: 'file type is not allowed' });
    }
    if (!Number.isFinite(Number(size)) || Number(size) > MAX_BYTES) {
      return res.status(400).json({ error: 'file is too large' });
    }
    if (await isSuspended(neon(process.env.DATABASE_URL), who.user.id)) {
      return res.status(403).json({ error: 'suspended' });
    }
    // unique key per user; the random id keeps two uploads with the same name apart
    const key = `files/${who.user.id}/${randomUUID()}-${pathname}`;
    const uploadUrl = await presignUpload(key, contentType);
    return res.status(200).json({ uploadUrl, url: publicUrlFor(key) });
  } catch (e) {
    console.error('upload-url failed', e.message);
    return res.status(500).json({ error: 'could not prepare the upload' });
  }
}
