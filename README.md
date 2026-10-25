# LPPlayer

개인용 음악 플레이어. 프론트엔드는 `index.html` 한 파일, 백엔드는 Vercel 서버리스 함수 2개(`api/songs.js`, `api/upload.js`)입니다.
- 곡 목록과 메타데이터: **Neon(Postgres)** `songs` 테이블
- 오디오 파일: **Vercel Blob**

## API
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/songs` | 곡 목록 (최신순, 최대 500개) |
| POST | `/api/songs` | 곡 저장 `{ title, artist?, url, size? }` |
| DELETE | `/api/songs?id=<uuid>` | 곡 삭제 (DB 행 + Blob 파일) |
| POST | `/api/upload?filename=<name>` | 원시 파일 본문을 Blob에 업로드, `{ url }` 반환 |

업로드는 요청 본문 기준 **4MB 이하**만 받습니다 (Vercel 함수 본문 제한 약 4.5MB).

## 환경 변수 (Vercel > Settings > Environment Variables)
- `DATABASE_URL` — Neon 연결 문자열
- `BLOB_READ_WRITE_TOKEN` — Vercel > Storage > Blob 스토어 연결 시 자동 생성

테이블 `songs`는 첫 요청 때 자동으로 만들어집니다.

## 배포
GitHub에 push → Vercel이 자동 배포합니다. PR 브랜치는 미리보기 주소가 생성됩니다.

## 로컬 확인
```
npm install
```
프론트엔드는 빌드 단계가 없으므로 `index.html`을 그대로 정적 서버로 열면 됩니다.
