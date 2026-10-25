# LPPlayer

개인용 음악 플레이어. 프론트엔드는 `index.html` 한 파일, 백엔드는 Vercel 서버리스 함수입니다.
- 곡 목록과 정보: **Neon(Postgres)** `songs` 테이블
- 오디오 파일: **Vercel Blob** (브라우저가 직접 업로드)
- 접근: 계정별 로그인 (이메일 + 비밀번호, 토큰은 `JWT_SECRET`으로 서명)

## 구조
| 경로 | 역할 |
|---|---|
| `index.html` | 앱 전체 (홈, 보관함, 업로드, 설정) |
| `api/auth/register.js` | 회원가입 |
| `api/auth/login.js` | 로그인 |
| `api/songs.js` | 내 곡 목록 / 저장 / 삭제 (계정별로 분리) |
| `api/blob-token.js` | 업로드 토큰 발급 (로그인 확인 후) |
| `lib/auth.js` | 토큰 발급과 확인 |
| `sw.js`, `manifest.json` | PWA (설치, 셸 캐시) |

## API
로그인이 필요한 API는 헤더 `Authorization: Bearer <token>`을 보내야 합니다. 없거나 틀리면 `401`.

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/register` | `{ email, password }` 가입 (비밀번호 8자 이상), `{ token, user }` 반환 |
| POST | `/api/auth/login` | `{ email, password }` 로그인, `{ token, user }` 반환 |
| GET | `/api/songs` | 내 곡 목록 (최신순, 최대 500개) |
| POST | `/api/songs` | `{ title, artist?, url, size? }` 저장. `url`은 우리 Blob 주소만 허용 |
| DELETE | `/api/songs?id=<uuid>` | 내 곡 삭제 (DB 행과 Blob 파일) |
| POST | `/api/blob-token` | Vercel Blob 업로드 토큰 발급 (Blob 클라이언트가 호출) |

업로드 한도: 파일당 500MB. 50MB를 넘으면 자동으로 나눠서 올립니다.

## 환경 변수 (Vercel > Settings > Environment Variables)
- `DATABASE_URL` — Neon 연결 문자열
- `BLOB_READ_WRITE_TOKEN` — Vercel > Storage > Blob 스토어 연결 시 자동 생성
- `JWT_SECRET` — 로그인 토큰 서명 키. 길고 임의의 문자열로 정하세요 (없으면 가입과 로그인이 실패합니다)

`songs` 테이블은 첫 요청 때 자동으로 만들어집니다.

## 배포
GitHub에 push하면 Vercel이 자동 배포합니다. PR 브랜치는 미리보기 주소가 생깁니다.
