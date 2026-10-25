# LPPlayer

개인용 음악 플레이어. 프론트엔드는 `index.html` 한 파일, 백엔드는 Vercel 서버리스 함수입니다.
- 곡 목록과 정보: **Neon(Postgres)** `songs` 테이블
- 오디오 파일: **Vercel Blob** (브라우저가 직접 업로드)
- 접근: 앱 비밀번호 하나 (`APP_PASSWORD`)

## 구조
| 경로 | 역할 |
|---|---|
| `index.html` | 앱 전체 (홈, 보관함, 업로드, 설정) |
| `api/songs.js` | GET 목록 / POST 저장 / DELETE 삭제 |
| `api/blob-token.js` | 업로드 토큰 발급 (비밀번호 확인 후) |
| `lib/auth.js` | 비밀번호 검사 |
| `vendor/blob-client.js` | 브라우저용 `@vercel/blob` 클라이언트 (빌드 산출물) |
| `sw.js`, `manifest.json` | PWA (설치, 셸 캐시) |

## API
모든 API는 헤더 `x-app-key: <APP_PASSWORD>`가 필요합니다. 없거나 틀리면 `401`.

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/songs` | 곡 목록 (최신순, 최대 500개) |
| POST | `/api/songs` | `{ title, artist?, url, size? }` 저장. `url`은 우리 Blob 주소만 허용 |
| DELETE | `/api/songs?id=<uuid>` | DB 행과 Blob 파일 삭제 |
| POST | `/api/blob-token` | Vercel Blob 업로드 토큰 발급 (Blob 클라이언트가 호출) |

업로드 한도: 파일당 500MB. 50MB를 넘으면 자동으로 나눠서 올립니다.

## 환경 변수 (Vercel > Settings > Environment Variables)
- `DATABASE_URL` — Neon 연결 문자열
- `BLOB_READ_WRITE_TOKEN` — Vercel > Storage > Blob 스토어 연결 시 자동 생성
- `APP_PASSWORD` — 앱 접속 비밀번호 (없으면 모든 요청이 거부됩니다)

`songs` 테이블은 첫 요청 때 자동으로 만들어집니다.

## 배포
GitHub에 push하면 Vercel이 자동 배포합니다. PR 브랜치는 미리보기 주소가 생깁니다.

## 번들 다시 만들기
`vendor/blob-client.js`는 `@vercel/blob`을 브라우저용으로 묶은 파일입니다. `@vercel/blob` 버전을 올릴 때만 다시 만듭니다.
```
npm install
npx esbuild node_modules/@vercel/blob/dist/client.js --bundle --format=esm --platform=browser --minify --target=es2019 --outfile=vendor/blob-client.js
```
