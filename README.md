
# LPPlayer v9 FINAL ALL FIXED
- 소리: real <audio> playback with blob URL
- 새로고침 사라짐: POST /api/songs saves to NeonDB, GET returns all
- 노트북->핸드폰 안보임: same - DB + Blob URL shared
- iCloud/Naver/NAS: accept audio/*,.mp3,.m4a,.wav,.flac,.aac,.mp4,video/*,application/octet-stream,.* + allow type==="" (iCloud empty type)
- Icon: icon-192.png, icon-512.png with LP vinyl + LPPlayer text
Deploy: GitHub upload all -> Vercel auto deploy -> Check env: DATABASE_URL, BLOB_READ_WRITE_TOKEN, JWT_SECRET
Test: laptop upload mp3 -> refresh still there? phone sees it? sound plays? iCloud Files app > mp3 > upload works?
