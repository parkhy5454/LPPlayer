import { handleUpload } from '@vercel/blob/client';
import { neon } from '@neondatabase/serverless';
import { userFromToken, isSuspended, NOT_CONFIGURED } from '../lib/auth.js';

// The browser uploads the file straight to Vercel Blob. This route only hands out a short-lived,
// path-limited upload token after checking the signed-in account. The file never passes through here,
// so the 4.5 MB serverless body limit does not apply.
const MAX_BYTES = 500 * 1024 * 1024;
const SAFE_PATH = /^[A-Za-z0-9._-]{1,200}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not set' });
  }

  try {
    // Vercel usually parses the JSON body already; read the stream if it did not
    let body = req.body;
    if (body === undefined) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    } else if (typeof body === 'string') {
      body = JSON.parse(body);
    }
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload = {};
        try { payload = JSON.parse(clientPayload || '{}'); } catch {}
        const who = userFromToken(payload.token);
        if (who.error === 'not-configured') throw new Error(NOT_CONFIGURED);
        if (who.error) throw new Error('unauthorized');
        if (await isSuspended(neon(process.env.DATABASE_URL), who.user.id)) throw new Error('suspended');
        if (!SAFE_PATH.test(pathname)) throw new Error('bad file name');
        return {
          allowedContentTypes: ['audio/*', 'video/*', 'image/*', 'application/octet-stream'],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
        };
      },
      onUploadCompleted: async () => {},   // songs are saved by /api/songs after the upload finishes
    });
    return res.status(200).json(json);
  } catch (e) {
    const status = e.message === 'unauthorized' ? 401 : e.message === 'suspended' ? 403
      : e.message === NOT_CONFIGURED ? 500 : 400;
    return res.status(status).json({ error: e.message });
  }
}
