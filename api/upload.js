
import { put } from '@vercel/blob';
export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not set. Create Blob store in Vercel Dashboard > Storage' });
    }
    const filename = req.query.filename || `lpplayer_${Date.now()}.mp3`;
    // req is readable stream
    const blob = await put(filename, req, { access: 'public' });
    return res.status(200).json(blob);
  } catch (e) {
    console.error('Blob upload error', e);
    return res.status(500).json({ error: e.message });
  }
}
