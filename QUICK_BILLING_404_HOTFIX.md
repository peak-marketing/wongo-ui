# 대행사 충전 관리 v3.1.1 /agency/billing 404 핫픽스 - 빠른 참조

## 🚨 즉시 확인 (5분)

### A. 404의 가장 흔한 원인 6가지
1. [ ] 라우트 파일 부재: apps/web/src/app/agency/billing/page.tsx 없음 → 404
2. [ ] 레이아웃 미연결: app/agency/layout.tsx가 children을 렌더하지 않음 / 경로가 다름
3. [ ] 가드에서 404 리턴: RouteGuard가 미인증/오류 시 notFound()/빈 렌더를 반환
4. [ ] 사이드바 링크 오타: /agency/billing이 아닌 다른 경로로 링크됨
5. [ ] 라우트 그룹/세그먼트 문제: app/(agency)/agency/billing처럼 그룹 세그먼트 쓴 경우 경로가 달라짐
6. [ ] HMR 캐시: 새 라우트 추가 후 dev 서버가 라우트를 못 잡음

### B. 복구 단계
1. [ ] 라우트 파일 존재 확인: apps/web/src/app/agency/billing/page.tsx
2. [ ] 레이아웃/가드 적용 확인: children 렌더, RouteGuard (AGENCY 전용)
3. [ ] 사이드바 네비 연동 확인: 링크 정확성, active 상태
4. [ ] 개발 서버 재기동: pnpm --filter @repo/web dev
5. [ ] 초기 데이터 호출 확인: GET /agency/wallet

### C. 검증문 (합격 기준)
1. [ ] http://localhost:3000/agency/billing 접속 시 404가 아닌 빈/스켈레톤 화면이라도 나온다
2. [ ] 사이드바의 충전 관리를 눌러도 동일 페이지로 진입한다 (오타/경로 오류 없음)
3. [ ] GET /agency/wallet 2xx, 상단 카드에 현재 잔액/가용/총 사용이 표기된다
4. [ ] 미인증/권한 불일치 시 /auth/login으로 리다이렉트되고, 404는 발생하지 않는다
5. [ ] 새 라우트 추가 후 웹 dev 재기동으로 라우트가 등록된다 (콘솔에 route 로그 출력)

### D. 추가 트리아지 (여전히 404면)
1. [ ] 경로 철자/대소문자: billing vs Billing
2. [ ] 라우트 그룹 사용 여부: app/(routes)/agency/billing 등으로 폴더가 다르면 실제 URL이 달라짐
3. [ ] page.tsx export 누락: default export가 없으면 Next가 라우트를 안 올림
4. [ ] middleware.ts 리라이트: /agency/*가 다른 곳으로 rewrite/redirect 되는지 확인
5. [ ] 404 전용 페이지 간섭: 커스텀 not-found.tsx가 특정 조건에서 잘못 호출되는지

---

## ✅ 합격 기준

1. [ ] http://localhost:3000/agency/billing 접속 시 404가 아닌 빈/스켈레톤 화면이라도 나온다
2. [ ] 사이드바의 충전 관리를 눌러도 동일 페이지로 진입한다 (오타/경로 오류 없음)
3. [ ] GET /agency/wallet 2xx, 상단 카드에 현재 잔액/가용/총 사용이 표기된다
4. [ ] 미인증/권한 불일치 시 /auth/login으로 리다이렉트되고, 404는 발생하지 않는다
5. [ ] 새 라우트 추가 후 웹 dev 재기동으로 라우트가 등록된다 (콘솔에 route 로그 출력)

---

## 🔧 조치 요약

### 404 원인 점검
- 라우트 파일 부재: apps/web/src/app/agency/billing/page.tsx 없음 → 404
- 레이아웃 미연결: app/agency/layout.tsx가 children을 렌더하지 않음 / 경로가 다름
- 가드에서 404 리턴: RouteGuard가 미인증/오류 시 notFound()/빈 렌더를 반환
- 사이드바 링크 오타: /agency/billing이 아닌 다른 경로로 링크됨
- 라우트 그룹/세그먼트 문제: app/(agency)/agency/billing처럼 그룹 세그먼트 쓴 경우 경로가 달라짐
- HMR 캐시: 새 라우트 추가 후 dev 서버가 라우트를 못 잡음

### 복구 단계
- 라우트 파일 존재 확인: apps/web/src/app/agency/billing/page.tsx
- 레이아웃/가드 적용 확인: children 렌더, RouteGuard (AGENCY 전용)
- 사이드바 네비 연동 확인: 링크 정확성, active 상태
- 개발 서버 재기동: pnpm --filter @repo/web dev
- 초기 데이터 호출 확인: GET /agency/wallet

### 추가 트리아지 (여전히 404면)
- 경로 철자/대소문자: billing vs Billing
- 라우트 그룹 사용 여부: app/(routes)/agency/billing 등으로 폴더가 다르면 실제 URL이 달라짐
- page.tsx export 누락: default export가 없으면 Next가 라우트를 안 올림
- middleware.ts 리라이트: /agency/*가 다른 곳으로 rewrite/redirect 되는지 확인
- 404 전용 페이지 간섭: 커스텀 not-found.tsx가 특정 조건에서 잘못 호출되는지

---

## 📋 다음 액션 (정상 진입 후)

### 지갑 카드
- GET /agency/wallet 바인딩 (잔액/가용/총 사용, KRW 포맷)

### 충전하기 모달
- POST /agency/topups (Idempotency-Key), 성공 시 요청 목록 & 원장 & 지갑 카드 동시 갱신

### 요청 목록
- GET /agency/topups, PENDING 취소 → POST /agency/topups/:id/cancel

### 거래 원장
- GET /agency/transactions 필터/CSV

---

## 🎯 주요 포인트

### 라우트 파일
- 경로: apps/web/src/app/agency/billing/page.tsx
- 최소 요건: default export 컴포넌트 1개

### 레이아웃/가드
- apps/web/src/app/agency/layout.tsx가 children을 렌더하고 AppShell + AgencySidebar로 감싸져 있는지 확인
- 모든 /agency/**에서 RouteGuard (AGENCY 전용)가 동작하도록:
  - 미인증/권한 불일치 시 /auth/login으로 router.replace (❌ notFound 금지)
  - 가드 내부 에러 때도 404 반환 금지 (토스트 + 로그인 유도)

### 사이드바 네비
- AgencySidebar에 충전 관리 항목 추가: 링크가 정확히 /agency/billing 인지, active 상태가 맞는지

### 개발 서버 재기동
- WEB dev 재시작: pnpm --filter @repo/web dev
- 브라우저 강력 새로고침 (캐시 무시) 후 http://localhost:3000/agency/billing 재접속

### 초기 데이터 호출
- 페이지 마운트 후 우선 한 번만 호출: GET /agency/wallet
- 2xx 응답이면 화면 상단 카드 (잔액/가용/총사용)에 표시
- 401/403이면 로그인/권한 문제 → 가드 동작 재확인





