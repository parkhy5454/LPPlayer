import { put } from '@vercel/blob';

// The request body is the raw file (the browser sends the File as the body).
export const config = { api: { bodyParser: false } };

const MAX_BYTES = 4 * 1024 * 1024; // Vercel serverless request-body limit is ~4.5 MB

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not set (Vercel > Storage > Blob)' });
  }

  try {
    const filename = String(req.query.filename || `track_${Date.now()}.mp3`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 150);

    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BYTES) return res.status(413).json({ error: 'File is larger than 4 MB' });
      chunks.push(chunk);
    }
    if (size === 0) return res.status(400).json({ error: 'Empty file' });

    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const blob = await put(filename, Buffer.concat(chunks), {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    });
    return res.status(200).json({ url: blob.url });
  } catch (e) {
    console.error('upload error', e);
    return res.status(500).json({ error: e.message });
  }
}
