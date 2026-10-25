
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'POST'});
 const {email,password}=req.body||{};
 const sql=neon(process.env.DATABASE_URL);
 const users=await sql`SELECT * FROM users WHERE email=${email} LIMIT 1`;
 if(!users.length) return res.status(401).json({error:'Not found'});
 const ok=await bcrypt.compare(password, users[0].password_hash);
 if(!ok) return res.status(401).json({error:'Wrong password'});
 const token=jwt.sign({id:users[0].id,email:users[0].email,role:users[0].role}, process.env.JWT_SECRET||'dev_secret',{expiresIn:'7d'});
 return res.status(200).json({token,user:{id:users[0].id,email:users[0].email,display_name:users[0].display_name,role:users[0].role}});
}
