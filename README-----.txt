MYCOM V4 리디자인 배포 패키지
==============================

저장소: stormstorepc-ctrl/mycom-v4 (main)

1) deploy/public/ 안의 파일 22개를 저장소의 public/ 폴더에 덮어쓰기
   (public/ 을 통째로 지우지 마세요 — 아래 4번 참고)

2) deploy/server.js 를 저장소 루트의 server.js 에 덮어쓰기
   index.html 스크립트 주입 미들웨어가 제거된 버전입니다.
   특가 배너 / 히어로 이미지 / 매장 이미지 / 알림 / 역할별 메뉴는
   index.html 안에서 직접 처리합니다.

3) 아래 5개 파일은 삭제 (기능을 index.html이 흡수했습니다)
   public/home-enhance.js
   public/my-menu-fix.js
   public/image-auto.js
   public/shop-image-fix.js
   public/special-banners.js

4) 아래 파일은 반드시 그대로 두세요 (리디자인에 포함되지 않음)
   public/admin.html
   public/image-manager.html
   public/special-banners-admin.html
   public/partner.js
   public/shop-edit.js
   public/partner-link.js
   public/ai-build-recommend.js
   public/shop-status.js
   public/uploads/  (업로드된 이미지)

5) 커밋 -> push -> Render 자동 재배포

배포 후 확인할 것
------------------
- 홈: 오늘의 특가 배너가 히어로 아래에 뜨는지 (등록된 배너가 없으면 표시되지 않는 것이 정상)
- 마이페이지: 업체 계정으로 로그인 시 '내 매장 관리' -> /partner.html 이동
- 업체 예약 페이지: 예약 목록이 뜨는지 (/api/shops/my -> /api/reservations/shop/:id)
- 매장 카드 사진이 뜨는지 (/api/shop-image/:id)
