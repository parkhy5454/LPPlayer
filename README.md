
# LPPlayer v7.0 Mobile Fully Optimized

## 모바일 최적화 체크리스트
- 100dvh (주소창 대응) + env(safe-area-inset-top/bottom) 노치 대응
- 스와이프: LP판 좌/우 스와이프로 이전/다음 곡
- 한손모드: 72px 재생버튼 하단 중앙 엄지 위치, 44px 터치타겟
- PWA: manifest 192/512, standalone, apple-touch-icon, black-translucent
- 터치: scale(0.95) 피드백, vibrate(10) 햅틱, user-select none, overscroll none, tap-highlight transparent
- 폰트 16px 이상 (iOS 줌 방지)
- 가운데 LP판 280px 회전 + 가사, 업로드 자동닫힘 "업로드 되었습니다" 토스트, 크로스디바이스

## Deploy
GitHub lpplayer 레포에 덮어쓰기 -> Vercel 자동배포 -> 핸드폰에서 lpplayer-hazel.vercel.app 접속 -> 홈화면에 추가

테스트:
- LP판 스와이프로 곡 넘어감?
- 하단 재생버튼 엄지로 닿음?
- 아이폰 노치에 안가려짐?
- 업로드 후 토스트뜨고 닫힘?
- 설치 후 앱처럼 실행됨?
