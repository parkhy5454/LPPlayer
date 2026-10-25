
# LPPlayer Bilingual - Modified Only

## 변경된 파일
- index.html : 영어/한글 전환 버튼 추가, i18n 시스템
  - 우상단 EN/한글 토글 버튼
  - localStorage lp_lang 저장
  - data-i18n 속성으로 번역
  - 지원 키: home, search, library, upload, profile, forYou, searchPlaceholder, uploadTitle, login, adminBtn 등

## 기존 파일은 그대로 유지
- api/ 폴더, package.json, vercel.json, manifest.json 등은 기존 LPPLAYER_AUTH_ADMIN_FINAL.zip 것을 그대로 사용하세요
- 이 압축은 수정된 index.html만 포함 (디렉토리 포함)

## 적용 방법
1. 기존 lpplayer 레포에 이 index.html 덮어쓰기
2. Vercel 자동 재배포
3. 우상단 버튼으로 EN/한글 전환
