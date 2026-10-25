# MODIO - 상용화 수익화 최종본 (로그인 + 영구 저장 + 결제)

## 왜 로그인이 수익화에 필수냐?

### 로그인 없으면:
- 누가 올렸는지 모름 -> 수익 분배 불가
- 누가 들었는지 모름 -> 조회수 추적 불가
- 누가 결제했는지 모름 -> 구독 관리 불가
- 법적 분쟁 시 책임 소재 불명

### 로그인 있으면:
- 업로드 추적: user_id로 누가 올렸는지 -> 수익 분배 가능
- 재생 추적: play_count로 조회수 -> 인기 차트, 수익 분배 기준
- 결제 추적: subscriptions 테이블로 누가 Beta/Pro인지 -> $4.99/월 과금
- 법적 보호: 내 창작물만 업로드 약관 + user_id로 책임 추적

## 수익화 모델 (3단계)

### Free (무료)
- 3곡까지 업로드 (Vercel Blob)
- 30초 미리듣기만
- 광고 표시 (추후)

### Beta ($4.99/월) - 지금 구현됨
- 무제한 업로드, 영구 저장, 모두가 들음
- 조회수 추적, 내 곡 차트
- 테스트 모드: 결제 없이 tier 변경 (실제로는 Stripe 연결 필요)

### Pro ($9.99/월) - 추후
- 수익 분배: 내 곡 재생수 비례 수익
- 고음질 업로드, 커버 아트

## 테이블 구조 (NeonDB)

users: id, email, password_hash, tier (free/beta/pro), created_at
songs: id, user_id, title, artist, genre, year, url (Vercel Blob), play_count, created_at
subscriptions: id, user_id, tier, amount, created_at
beta_users: 이메일 수집

## 배포

1. NeonDB: DATABASE_URL 복사
2. Vercel Blob: Storage > Blob > Create -> BLOB_READ_WRITE_TOKEN 복사
3. JWT_SECRET: openssl rand -base64 32
4. Vercel 환경변수 3개 추가:
   - DATABASE_URL
   - BLOB_READ_WRITE_TOKEN
   - JWT_SECRET
5. Deploy

## API

POST /api/auth/register {email, password} -> {user, token}
POST /api/auth/login {email, password} -> {user, token}
POST /api/upload?filename=xxx.mp3 (Authorization: Bearer token) -> {url}
POST /api/songs {title, url...} (Authorization) -> 저장 (free는 3개 제한)
GET /api/songs -> 모든 곡 목록 (로그인 없이도 들을 수 있음, 업로드는 로그인 필요)
POST /api/subscribe {tier: beta} (Authorization) -> tier 변경

## 로그아웃해도 파일 유지?

응! 파일은 Vercel Blob + NeonDB에 영구 저장, 로그인 세션과 무관. 로그아웃해도 모두가 들을 수 있음.

## 다음 단계 (정식 상용화)

1. Stripe 연결: /api/subscribe에 Stripe Checkout 연동
2. 약관: "본인 창작물만 업로드" 명시 + 신고 버튼
3. KOMCA 라이선스 (한국) 또는 SoundCloud처럼 창작물만 허용
