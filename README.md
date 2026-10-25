# LPPlayer Cross-Device Final

Fix: upload actually saves to Vercel Blob + NeonDB so phone sees laptop upload

1. Upload API: put to Blob with public URL
2. Songs API: save URL to Neon, GET returns all songs
3. Frontend: calls /api/upload then /api/songs then reload

Test:
- Laptop upload mp3 -> Network tab /api/upload 200 -> Blob URL
- Phone refresh -> GET /api/songs -> sees new song
