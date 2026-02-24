# 대행사 충전 관리 v3.1.1 /agency/billing 404 핫픽스

## 🎯 목표
- /agency/billing 404 오류 원인 파악
- 라우트 파일 존재 확인
- 레이아웃/가드 적용 확인
- 사이드바 네비 연동 확인
- 개발 서버 재기동
- 초기 데이터 호출 확인

---

## A. 404의 가장 흔한 원인 6가지 (먼저 점검)

### 📋 실행 단계

### 1. 라우트 파일 부재 확인

**확인 항목:**
- [ ] 라우트 파일 부재: apps/web/src/app/agency/billing/page.tsx 없음 → 404

**확인 방법:**
1. 파일 시스템 확인:
   - [ ] `apps/web/src/app/agency/billing/page.tsx` 파일 존재 확인
   - [ ] 파일이 없으면 → 404 원인

**확인 체크리스트:**
- [ ] 라우트 파일 부재: apps/web/src/app/agency/billing/page.tsx 없음 → 404

---

### 2. 레이아웃 미연결 확인

**확인 항목:**
- [ ] 레이아웃 미연결: app/agency/layout.tsx가 children을 렌더하지 않음 / 경로가 다름

**확인 방법:**
1. 레이아웃 파일 확인:
   - [ ] `apps/web/src/app/agency/layout.tsx` 파일 존재 확인
   - [ ] `children`을 렌더하는지 확인
   - [ ] 경로가 정확한지 확인

**확인 체크리스트:**
- [ ] 레이아웃 미연결: app/agency/layout.tsx가 children을 렌더하지 않음 / 경로가 다름

---

### 3. 가드에서 404 리턴 확인

**확인 항목:**
- [ ] 가드에서 404 리턴: RouteGuard가 미인증/오류 시 notFound()/빈 렌더를 반환. (우린 로그인으로 리다이렉트해야 함)

**확인 방법:**
1. RouteGuard 확인:
   - [ ] `RouteGuard` 컴포넌트 확인
   - [ ] 미인증/오류 시 `notFound()` 호출 여부 확인
   - [ ] 로그인으로 리다이렉트하는지 확인

**확인 체크리스트:**
- [ ] 가드에서 404 리턴: RouteGuard가 미인증/오류 시 notFound()/빈 렌더를 반환. (우린 로그인으로 리다이렉트해야 함)

---

### 4. 사이드바 링크 오타 확인

**확인 항목:**
- [ ] 사이드바 링크 오타: /agency/billing이 아닌 다른 경로로 링크됨 (슬래시/대소문자)

**확인 방법:**
1. 사이드바 확인:
   - [ ] `AgencySidebar` 컴포넌트 확인
   - [ ] 링크가 정확히 `/agency/billing`인지 확인
   - [ ] 슬래시/대소문자 오타 확인

**확인 체크리스트:**
- [ ] 사이드바 링크 오타: /agency/billing이 아닌 다른 경로로 링크됨 (슬래시/대소문자)

---

### 5. 라우트 그룹/세그먼트 문제 확인

**확인 항목:**
- [ ] 라우트 그룹/세그먼트 문제: app/(agency)/agency/billing처럼 그룹 세그먼트 쓴 경우 경로가 달라짐

**확인 방법:**
1. 라우트 구조 확인:
   - [ ] `apps/web/src/app/` 디렉토리 구조 확인
   - [ ] 라우트 그룹 `(agency)` 사용 여부 확인
   - [ ] 실제 경로와 URL 경로 일치 확인

**확인 체크리스트:**
- [ ] 라우트 그룹/세그먼트 문제: app/(agency)/agency/billing처럼 그룹 세그먼트 쓴 경우 경로가 달라짐

---

### 6. HMR 캐시 확인

**확인 항목:**
- [ ] HMR 캐시: 새 라우트 추가 후 dev 서버가 라우트를 못 잡음 (재기동 필요)

**확인 방법:**
1. 개발 서버 확인:
   - [ ] 새 라우트 추가 후 dev 서버 재기동 여부 확인
   - [ ] 브라우저 강력 새로고침 (캐시 무시) 확인

**확인 체크리스트:**
- [ ] HMR 캐시: 새 라우트 추가 후 dev 서버가 라우트를 못 잡음 (재기동 필요)

---

## B. 복구 단계 (정석)

### 📋 실행 단계

### B-1. 라우트 파일 존재 확인

**확인 항목:**
- [ ] 경로: apps/web/src/app/agency/billing/page.tsx
- [ ] 최소 요건: default export 컴포넌트 1개 (파일이 있어야 Next가 404를 해제함)

**확인 방법:**
1. 파일 시스템 확인:
   - [ ] `apps/web/src/app/agency/billing/page.tsx` 파일 존재 확인
   - [ ] default export 컴포넌트 1개 확인
   - [ ] 파일이 없으면 생성

**확인 체크리스트:**
- [ ] 경로: apps/web/src/app/agency/billing/page.tsx
- [ ] 최소 요건: default export 컴포넌트 1개 (파일이 있어야 Next가 404를 해제함)

---

### B-2. 레이아웃/가드 적용 확인

**확인 항목:**
- [ ] apps/web/src/app/agency/layout.tsx가 children을 렌더하고 AppShell + AgencySidebar로 감싸져 있는지 확인
- [ ] 모든 /agency/**에서 **RouteGuard (AGENCY 전용)**가 동작하도록:
  - [ ] 미인증/권한 불일치 시 /auth/login으로 router.replace (❌ notFound 금지)
  - [ ] 가드 내부 에러 때도 404 반환 금지 (토스트 + 로그인 유도)

**확인 방법:**
1. 레이아웃 파일 확인:
   - [ ] `apps/web/src/app/agency/layout.tsx` 파일 확인
   - [ ] `children`을 렌더하는지 확인
   - [ ] `AppShell + AgencySidebar`로 감싸져 있는지 확인
2. RouteGuard 확인:
   - [ ] `RouteGuard` 컴포넌트 확인
   - [ ] AGENCY 전용 가드 동작 확인
   - [ ] 미인증/권한 불일치 시 `/auth/login`으로 `router.replace` 확인
   - [ ] `notFound()` 호출 없음 확인
   - [ ] 가드 내부 에러 시 404 반환 없음 확인

**확인 체크리스트:**
- [ ] apps/web/src/app/agency/layout.tsx가 children을 렌더하고 AppShell + AgencySidebar로 감싸져 있는지 확인
- [ ] 모든 /agency/**에서 **RouteGuard (AGENCY 전용)**가 동작하도록:
  - [ ] 미인증/권한 불일치 시 /auth/login으로 router.replace (❌ notFound 금지)
  - [ ] 가드 내부 에러 때도 404 반환 금지 (토스트 + 로그인 유도)

---

### B-3. 사이드바 네비 연동 확인

**확인 항목:**
- [ ] AgencySidebar에 충전 관리 항목 추가: 링크가 정확히 /agency/billing 인지, active 상태가 맞는지
- [ ] 사이드바에서 클릭 시 동일 404가 재현되는지 확인

**확인 방법:**
1. 사이드바 확인:
   - [ ] `AgencySidebar` 컴포넌트 확인
   - [ ] 충전 관리 항목 추가 확인
   - [ ] 링크가 정확히 `/agency/billing`인지 확인
   - [ ] active 상태가 맞는지 확인
2. 클릭 테스트:
   - [ ] 사이드바에서 충전 관리 클릭
   - [ ] 동일 404가 재현되는지 확인

**확인 체크리스트:**
- [ ] AgencySidebar에 충전 관리 항목 추가: 링크가 정확히 /agency/billing 인지, active 상태가 맞는지
- [ ] 사이드바에서 클릭 시 동일 404가 재현되는지 확인

---

### B-4. 개발 서버 재기동 확인

**확인 항목:**
- [ ] WEB dev 재시작: pnpm --filter @repo/web dev
- [ ] 브라우저 강력 새로고침 (캐시 무시) 후 http://localhost:3000/agency/billing 재접속

**확인 방법:**
1. 개발 서버 재기동:
   - [ ] `pnpm --filter @repo/web dev` 실행
   - [ ] 서버 재시작 확인
2. 브라우저 확인:
   - [ ] 브라우저 강력 새로고침 (캐시 무시)
   - [ ] `http://localhost:3000/agency/billing` 재접속
   - [ ] 404 오류 해결 확인

**확인 체크리스트:**
- [ ] WEB dev 재시작: pnpm --filter @repo/web dev
- [ ] 브라우저 강력 새로고침 (캐시 무시) 후 http://localhost:3000/agency/billing 재접속

---

### B-5. 초기 데이터 호출 (연결 확인)

**확인 항목:**
- [ ] 페이지 마운트 후 우선 한 번만 호출: GET /agency/wallet
- [ ] 2xx 응답이면 화면 상단 카드 (잔액/가용/총사용)에 표시
- [ ] 401/403이면 로그인/권한 문제 → 가드 동작 재확인

**확인 방법:**
1. 초기 데이터 호출 확인:
   - [ ] 페이지 마운트 후 `GET /agency/wallet` 호출 확인
   - [ ] DevTools Network에서 요청 확인
2. 응답 확인:
   - [ ] 2xx 응답 → 화면 상단 카드 (잔액/가용/총사용)에 표시 확인
   - [ ] 401/403 응답 → 로그인/권한 문제 확인, 가드 동작 재확인

**확인 체크리스트:**
- [ ] 페이지 마운트 후 우선 한 번만 호출: GET /agency/wallet
- [ ] 2xx 응답이면 화면 상단 카드 (잔액/가용/총사용)에 표시
- [ ] 401/403이면 로그인/권한 문제 → 가드 동작 재확인

---

## C. 검증문 (합격 기준)

### ✅ 종합 검증

**1. 404 해결**
- [ ] http://localhost:3000/agency/billing 접속 시 404가 아닌 빈/스켈레톤 화면이라도 나온다

**2. 사이드바 네비**
- [ ] 사이드바의 충전 관리를 눌러도 동일 페이지로 진입한다 (오타/경로 오류 없음)

**3. 초기 데이터 호출**
- [ ] GET /agency/wallet 2xx, 상단 카드에 현재 잔액/가용/총 사용이 표기된다

**4. 가드 동작**
- [ ] 미인증/권한 불일치 시 /auth/login으로 리다이렉트되고, 404는 발생하지 않는다

**5. 라우트 등록**
- [ ] 새 라우트 추가 후 웹 dev 재기동으로 라우트가 등록된다 (콘솔에 route 로그 출력)

---

## D. 여전히 404면 → 추가 트리아지 (빠른 체크 5개)

### 📋 실행 단계

### 1. 경로 철자/대소문자 확인

**확인 항목:**
- [ ] 경로 철자/대소문자: billing vs Billing (Windows에선 덜하지만 CI/운영은 민감)

**확인 방법:**
1. 경로 확인:
   - [ ] 파일명: `billing` vs `Billing` 확인
   - [ ] URL 경로: `/agency/billing` vs `/agency/Billing` 확인
   - [ ] 대소문자 일치 확인

**확인 체크리스트:**
- [ ] 경로 철자/대소문자: billing vs Billing (Windows에선 덜하지만 CI/운영은 민감)

---

### 2. 라우트 그룹 사용 여부 확인

**확인 항목:**
- [ ] 라우트 그룹 사용 여부: app/(routes)/agency/billing 등으로 폴더가 다르면 실제 URL이 달라짐

**확인 방법:**
1. 라우트 구조 확인:
   - [ ] `apps/web/src/app/` 디렉토리 구조 확인
   - [ ] 라우트 그룹 `(routes)` 사용 여부 확인
   - [ ] 실제 URL 경로와 파일 경로 일치 확인

**확인 체크리스트:**
- [ ] 라우트 그룹 사용 여부: app/(routes)/agency/billing 등으로 폴더가 다르면 실제 URL이 달라짐

---

### 3. page.tsx export 누락 확인

**확인 항목:**
- [ ] page.tsx export 누락: default export가 없으면 Next가 라우트를 안 올림

**확인 방법:**
1. page.tsx 파일 확인:
   - [ ] `apps/web/src/app/agency/billing/page.tsx` 파일 확인
   - [ ] default export 존재 확인
   - [ ] export 누락 여부 확인

**확인 체크리스트:**
- [ ] page.tsx export 누락: default export가 없으면 Next가 라우트를 안 올림

---

### 4. middleware.ts 리라이트 확인

**확인 항목:**
- [ ] middleware.ts 리라이트: /agency/*가 다른 곳으로 rewrite/redirect 되는지 확인

**확인 방법:**
1. middleware.ts 파일 확인:
   - [ ] `apps/web/src/middleware.ts` 파일 확인
   - [ ] `/agency/*` 경로에 대한 rewrite/redirect 확인
   - [ ] 잘못된 리라이트 여부 확인

**확인 체크리스트:**
- [ ] middleware.ts 리라이트: /agency/*가 다른 곳으로 rewrite/redirect 되는지 확인

---

### 5. 404 전용 페이지 간섭 확인

**확인 항목:**
- [ ] 404 전용 페이지 간섭: 커스텀 not-found.tsx가 특정 조건에서 잘못 호출되는지

**확인 방법:**
1. not-found.tsx 파일 확인:
   - [ ] `apps/web/src/app/not-found.tsx` 파일 확인
   - [ ] `apps/web/src/app/agency/not-found.tsx` 파일 확인
   - [ ] 잘못된 호출 조건 확인

**확인 체크리스트:**
- [ ] 404 전용 페이지 간섭: 커스텀 not-found.tsx가 특정 조건에서 잘못 호출되는지

---

## E. 다음 액션 (정상 진입 후)

### 📋 실행 단계

### 1. 지갑 카드 확인

**확인 항목:**
- [ ] 지갑 카드: GET /agency/wallet 바인딩 (잔액/가용/총 사용, KRW 포맷)

**확인 방법:**
1. 지갑 카드 확인:
   - [ ] `GET /agency/wallet` 호출 확인
   - [ ] 잔액/가용/총 사용 표시 확인
   - [ ] KRW 포맷 확인

**확인 체크리스트:**
- [ ] 지갑 카드: GET /agency/wallet 바인딩 (잔액/가용/총 사용, KRW 포맷)

---

### 2. 충전하기 모달 확인

**확인 항목:**
- [ ] 충전하기 모달: POST /agency/topups (Idempotency-Key), 성공 시 요청 목록 & 원장 & 지갑 카드 동시 갱신

**확인 방법:**
1. 충전하기 모달 확인:
   - [ ] `POST /agency/topups` 호출 확인
   - [ ] `Idempotency-Key` 헤더 확인
   - [ ] 성공 시 요청 목록 & 원장 & 지갑 카드 동시 갱신 확인

**확인 체크리스트:**
- [ ] 충전하기 모달: POST /agency/topups (Idempotency-Key), 성공 시 요청 목록 & 원장 & 지갑 카드 동시 갱신

---

### 3. 요청 목록 확인

**확인 항목:**
- [ ] 요청 목록: GET /agency/topups, PENDING 취소 → POST /agency/topups/:id/cancel

**확인 방법:**
1. 요청 목록 확인:
   - [ ] `GET /agency/topups` 호출 확인
   - [ ] PENDING 취소 → `POST /agency/topups/:id/cancel` 호출 확인

**확인 체크리스트:**
- [ ] 요청 목록: GET /agency/topups, PENDING 취소 → POST /agency/topups/:id/cancel

---

### 4. 거래 원장 확인

**확인 항목:**
- [ ] 거래 원장: GET /agency/transactions 필터/CSV

**확인 방법:**
1. 거래 원장 확인:
   - [ ] `GET /agency/transactions` 호출 확인
   - [ ] 필터 동작 확인
   - [ ] CSV 내보내기 확인

**확인 체크리스트:**
- [ ] 거래 원장: GET /agency/transactions 필터/CSV

---

## 📊 종합 검증 체크리스트

### ✅ 404 원인 점검
1. [ ] 라우트 파일 부재: apps/web/src/app/agency/billing/page.tsx 없음 → 404
2. [ ] 레이아웃 미연결: app/agency/layout.tsx가 children을 렌더하지 않음 / 경로가 다름
3. [ ] 가드에서 404 리턴: RouteGuard가 미인증/오류 시 notFound()/빈 렌더를 반환
4. [ ] 사이드바 링크 오타: /agency/billing이 아닌 다른 경로로 링크됨
5. [ ] 라우트 그룹/세그먼트 문제: app/(agency)/agency/billing처럼 그룹 세그먼트 쓴 경우 경로가 달라짐
6. [ ] HMR 캐시: 새 라우트 추가 후 dev 서버가 라우트를 못 잡음

### ✅ 복구 단계
1. [ ] 라우트 파일 존재 확인: apps/web/src/app/agency/billing/page.tsx
2. [ ] 레이아웃/가드 적용 확인: children 렌더, RouteGuard (AGENCY 전용)
3. [ ] 사이드바 네비 연동 확인: 링크 정확성, active 상태
4. [ ] 개발 서버 재기동: pnpm --filter @repo/web dev
5. [ ] 초기 데이터 호출 확인: GET /agency/wallet

### ✅ 검증문 (합격 기준)
1. [ ] http://localhost:3000/agency/billing 접속 시 404가 아닌 빈/스켈레톤 화면이라도 나온다
2. [ ] 사이드바의 충전 관리를 눌러도 동일 페이지로 진입한다 (오타/경로 오류 없음)
3. [ ] GET /agency/wallet 2xx, 상단 카드에 현재 잔액/가용/총 사용이 표기된다
4. [ ] 미인증/권한 불일치 시 /auth/login으로 리다이렉트되고, 404는 발생하지 않는다
5. [ ] 새 라우트 추가 후 웹 dev 재기동으로 라우트가 등록된다 (콘솔에 route 로그 출력)

### ✅ 추가 트리아지 (여전히 404면)
1. [ ] 경로 철자/대소문자: billing vs Billing
2. [ ] 라우트 그룹 사용 여부: app/(routes)/agency/billing 등으로 폴더가 다르면 실제 URL이 달라짐
3. [ ] page.tsx export 누락: default export가 없으면 Next가 라우트를 안 올림
4. [ ] middleware.ts 리라이트: /agency/*가 다른 곳으로 rewrite/redirect 되는지 확인
5. [ ] 404 전용 페이지 간섭: 커스텀 not-found.tsx가 특정 조건에서 잘못 호출되는지

### ✅ 다음 액션 (정상 진입 후)
1. [ ] 지갑 카드: GET /agency/wallet 바인딩 (잔액/가용/총 사용, KRW 포맷)
2. [ ] 충전하기 모달: POST /agency/topups (Idempotency-Key), 성공 시 요청 목록 & 원장 & 지갑 카드 동시 갱신
3. [ ] 요청 목록: GET /agency/topups, PENDING 취소 → POST /agency/topups/:id/cancel
4. [ ] 거래 원장: GET /agency/transactions 필터/CSV

---

## 🔧 트리아지 리포트 템플릿

### /agency/billing 404 핫픽스 리포트 작성 시:

```
## /agency/billing 404 핫픽스 리포트

### 1. 404 원인 점검
- 라우트 파일 부재: [ ] apps/web/src/app/agency/billing/page.tsx 없음 [ ] 파일 존재
- 레이아웃 미연결: [ ] app/agency/layout.tsx가 children을 렌더하지 않음 [ ] 정상
- 가드에서 404 리턴: [ ] RouteGuard가 미인증/오류 시 notFound()/빈 렌더를 반환 [ ] 정상
- 사이드바 링크 오타: [ ] /agency/billing이 아닌 다른 경로로 링크됨 [ ] 정상
- 라우트 그룹/세그먼트 문제: [ ] app/(agency)/agency/billing처럼 그룹 세그먼트 쓴 경우 경로가 달라짐 [ ] 정상
- HMR 캐시: [ ] 새 라우트 추가 후 dev 서버가 라우트를 못 잡음 [ ] 정상

### 2. 복구 단계
- 라우트 파일 존재 확인: [ ] apps/web/src/app/agency/billing/page.tsx [ ] 확인 완료
- 레이아웃/가드 적용 확인: [ ] children 렌더, RouteGuard (AGENCY 전용) [ ] 확인 완료
- 사이드바 네비 연동 확인: [ ] 링크 정확성, active 상태 [ ] 확인 완료
- 개발 서버 재기동: [ ] pnpm --filter @repo/web dev [ ] 재기동 완료
- 초기 데이터 호출 확인: [ ] GET /agency/wallet [ ] 호출 완료

### 3. 검증문 (합격 기준)
- 404 해결: [ ] http://localhost:3000/agency/billing 접속 시 404가 아닌 빈/스켈레톤 화면이라도 나온다 [ ] 해결됨
- 사이드바 네비: [ ] 사이드바의 충전 관리를 눌러도 동일 페이지로 진입한다 [ ] 정상
- 초기 데이터 호출: [ ] GET /agency/wallet 2xx, 상단 카드에 현재 잔액/가용/총 사용이 표기된다 [ ] 정상
- 가드 동작: [ ] 미인증/권한 불일치 시 /auth/login으로 리다이렉트되고, 404는 발생하지 않는다 [ ] 정상
- 라우트 등록: [ ] 새 라우트 추가 후 웹 dev 재기동으로 라우트가 등록된다 [ ] 정상

### 4. 추가 트리아지 (여전히 404면)
- 경로 철자/대소문자: [ ] billing vs Billing [ ] 확인 완료
- 라우트 그룹 사용 여부: [ ] app/(routes)/agency/billing 등으로 폴더가 다르면 실제 URL이 달라짐 [ ] 확인 완료
- page.tsx export 누락: [ ] default export가 없으면 Next가 라우트를 안 올림 [ ] 확인 완료
- middleware.ts 리라이트: [ ] /agency/*가 다른 곳으로 rewrite/redirect 되는지 확인 [ ] 확인 완료
- 404 전용 페이지 간섭: [ ] 커스텀 not-found.tsx가 특정 조건에서 잘못 호출되는지 [ ] 확인 완료

### 5. 원인 추정
1순위: [ ] 라우트 파일 부재
2순위: [ ] 레이아웃 미연결
3순위: [ ] 가드에서 404 리턴

### 6. 조치
- [ ] 라우트 파일 생성/확인
- [ ] 레이아웃/가드 적용 확인/수정
- [ ] 사이드바 네비 연동 확인/수정
- [ ] 개발 서버 재기동
- [ ] 초기 데이터 호출 확인/수정
```





