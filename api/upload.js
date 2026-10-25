
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
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN missing. Vercel Dashboard > Storage > Create Blob Store > Connect to project > Redeploy' });
    }
    const filename = (req.query.filename || `lpplayer_${Date.now()}.mp3`).replace(/[^a-zA-Z0-9._-]/g,'_');
    // Read raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    console.log('Upload buffer size', buffer.length);
    if (buffer.length === 0) return res.status(400).json({ error: 'Empty file - browser did not send file' });
    const blob = await put(filename, buffer, { access: 'public', contentType: 'audio/mpeg', addRandomSuffix: false });
    console.log('Blob OK', blob.url);
    return res.status(200).json({ url: blob.url, ...blob });
  } catch (e) {
    console.error('Blob error', e);
    return res.status(500).json({ error: e.message, stack: e.stack?.substring(0,500) });
  }
}
