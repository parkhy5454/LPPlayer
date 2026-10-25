
import { put } from '@vercel/blob';
export const config = { api: { bodyParser: false } };
export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({error:'POST only'});
  try{
    const token = req.headers.authorization?.replace('Bearer ','');
    if(!token) return res.status(401).json({error:'로그인 필요 - 수익화 추적을 위해 로그인 필수'});
    const filename = req.query.filename || `song_${Date.now()}.mp3`;
    if(!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).json({error:'BLOB token not set'});
    const blob = await put(filename, req, { access: 'public' });
    return res.status(200).json(blob);
  }catch(e){ return res.status(500).json({error: e.message}); }
}
