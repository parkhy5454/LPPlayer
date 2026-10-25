# LPPlayer - Clean Tabs v3.0

## Spotify처럼 하단 고정탭 UI

- 상단 설명글 전부 제거
- 하단 고정탭 5개: Home, Search, Library, Upload, Mixtape
- 미니 플레이어 + 풀스크린 레코드판
- Vercel Blob 영구 저장 + NeonDB + JWT Auth

## Deploy
1. GitHub에 이 폴더 업로드 (Add file → Upload files)
2. Vercel은 자동 배포됨 (환경변수 그대로 유지)
3. https://lpplayer-hazel.vercel.app 접속 → 테스트

## Env vars (이미 설정됨)
DATABASE_URL, BLOB_READ_WRITE_TOKEN, BLOB_STORE_ID, JWT_SECRET
