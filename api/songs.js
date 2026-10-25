
import { getDb } from '../db.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res){
  try{
    const sql = getDb();
    await sql`CREATE TABLE IF NOT EXISTS songs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, title TEXT, artist TEXT, genre TEXT, year INT, url TEXT, thumbnail TEXT, play_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`;
    
    if(req.method === 'GET'){
      const songs = await sql`SELECT s.*, u.email as uploader_email FROM songs s LEFT JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 100`;
      return res.status(200).json({songs});
    }
    if(req.method === 'POST'){
      const auth = req.headers.authorization?.replace('Bearer ','');
      if(!auth) return res.status(401).json({error:'로그인 필요'});
      let payload;
      try{ payload = jwt.verify(auth, process.env.JWT_SECRET || 'dev_secret'); }catch{ return res.status(401).json({error:'토큰 만료, 다시 로그인'}); }
      const { title, artist, genre, year, url, thumbnail } = req.body || {};
      if(!url) return res.status(400).json({error:'url required'});
      // Check tier for upload limit
      const users = await sql`SELECT tier FROM users WHERE id = ${payload.id}`;
      const tier = users[0]?.tier || 'free';
      if(tier === 'free'){
        const cnt = await sql`SELECT COUNT(*) as c FROM songs WHERE user_id = ${payload.id}`;
        if(parseInt(cnt[0].c) >= 3) return res.status(403).json({error:'무료는 3개까지, Beta 가입 필요'});
      }
      const result = await sql`INSERT INTO songs (user_id, title, artist, genre, year, url, thumbnail) VALUES (${payload.id}, ${title}, ${artist}, ${genre}, ${year}, ${url}, ${thumbnail}) RETURNING *`;
      return res.status(200).json({song: result[0]});
    }
    return res.status(405).json({error:'Method'});
  }catch(e){ return res.status(500).json({error: e.message}); }
}
