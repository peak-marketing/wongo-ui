# 어드민 인테이크 & 산출 v2.0 구현 체크리스트

## 📋 현재 구현 상태 점검

### ✅ 이미 구현됨
- [x] 접근 가드: `/admin/**`는 ADMIN 전용 (`RouteGuard`)
- [x] API 엔드포인트: `POST /admin/orders/:id/assign-persona`, `POST /admin/orders/:id/generate`, `POST /admin/orders/:id/review`
- [x] 상태 전이: SUBMITTED → ADMIN_INTAKE → GENERATING → GENERATED → ADMIN_REVIEW → AGENCY_REVIEW
- [x] 자동검수 리포트: ValidationReport 컴포넌트 존재
- [x] 큐 관측: `/health` 엔드포인트로 `queue.waiting/active` 확인 가능
- [x] 재시도 액션: 실패 시 재시도 버튼 존재

### ⚠️ 개선 필요
- [ ] 인테이크 카드: 대행사명, 키워드 요약, 이미지 수 표시 추가 필요
- [ ] 카드 액션 순서: [페르소나 배정] → [원고 산출] 순서 고정 필요
- [ ] 잔액 부족 시 안내: `reserve` 실패 시 토스트 (top-center)
- [ ] 페르소나 배정 패널: 프리셋 4축 (연령대/성별/성격/톤) UI 추가 필요
- [ ] 동일 place 5건 배치: 빠른 배정 기능 추가 필요
- [ ] 자동검수 리포트: 4항목 정확히 표시 (자수 1,500~2,000 / 해시태그 ≤5 / 필수·강조 포함 / 링크·지도 플래그 일치)
- [ ] 검수 버튼: PASS / FAIL / 수정요청 (코멘트 필수)
- [ ] 워커 실패 처리: FAILED + release (홀드 해제)
- [ ] 알림: 모든 알림 top-center, 서버 메시지 원문 사용

---

## A. 인테이크 카드 (어드민 대시보드)

### 📝 요구사항
- **목록 노출 항목:**
  - 대행사명
  - 업체명 (placeName)
  - 키워드 요약 (n개)
  - 접수시간 (createdAt)
  - 이미지 수 (photos 배열 길이)
  - 상태 (status)

- **카드 액션 순서 고정:**
  1. [페르소나 배정] 버튼 (SUBMITTED 상태일 때만 표시)
  2. [원고 산출] 버튼 (ADMIN_INTAKE 상태일 때만 표시)

- **산출 시 reserve 트리거:**
  - `billingService.reserve()` 호출
  - 잔액 부족 시 안내 토스트 (top-center)

### ✅ 확인 사항
- [ ] 인테이크 카드에 대행사명 표시 (`order.agency?.displayName` 또는 `order.agencyId`)
- [ ] 키워드 요약 표시 (`order.searchKeywords`를 배열로 변환하여 "n개" 형식)
- [ ] 이미지 수 표시 (`order.photos?.length || 0`)
- [ ] 접수시간 포맷팅 (Asia/Seoul 타임존)
- [ ] [페르소나 배정] 버튼이 SUBMITTED 상태일 때만 표시
- [ ] [원고 산출] 버튼이 ADMIN_INTAKE 상태일 때만 표시
- [ ] 산출 시 잔액 부족 에러 처리 및 토스트 (top-center)

### 🔧 구현 위치
- `apps/web/app/admin/intake/page.tsx`

---

## B. 상태 전이 (표준화)

### 📝 요구사항
```
SUBMITTED → ADMIN_INTAKE(배정) → GENERATING(큐 add) → GENERATED(미리보기) → ADMIN_REVIEW(검수)
PASS → AGENCY_REVIEW(대행사 1차 검수 요청)
FAIL/수정요청 → REGEN_QUEUED(자동 재생성 루프)
워커 실패 → FAILED + release(홀드 해제)
```

### ✅ 확인 사항
- [ ] `POST /admin/orders/:id/assign-persona` → 상태 ADMIN_INTAKE로 변경
- [ ] `POST /admin/orders/:id/generate` → 상태 GENERATING으로 변경 + 큐 add + reserve
- [ ] 워커 완료 → 상태 GENERATED로 변경
- [ ] `POST /admin/orders/:id/start-review` → 상태 ADMIN_REVIEW로 변경
- [ ] `POST /admin/orders/:id/review` (PASS) → 상태 AGENCY_REVIEW로 변경
- [ ] `POST /admin/orders/:id/review` (FAIL/REVISION) → 상태 REGEN_QUEUED로 변경 + 자동 재생성
- [ ] 워커 실패 → 상태 FAILED로 변경 + `billingService.release()` 호출

### 🔧 구현 위치
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/queue/generation.processor.ts`

---

## C. 어드민 상세 (미리보기 + 자동검수 리포트)

### 📝 요구사항
- **리포트 항목 고정:**
  1. 자수 1,500~2,000
  2. 해시태그 ≤5
  3. 필수·강조 포함
  4. 링크·지도 플래그 일치

- **버튼:**
  - PASS
  - FAIL
  - 수정요청 (코멘트 필수)

- **알림:**
  - 모든 알림 top-center
  - 서버 메시지 원문 사용

### ✅ 확인 사항
- [ ] 자동검수 리포트에 자수 1,500~2,000 범위 표시
- [ ] 해시태그 ≤5 개수 표시
- [ ] 필수 키워드 포함 여부 표시
- [ ] 강조 키워드 포함 여부 표시
- [ ] 링크 플래그 일치 여부 표시
- [ ] 지도 플래그 일치 여부 표시
- [ ] PASS 버튼: `decision: "PASS"` 전송
- [ ] FAIL 버튼: `decision: "FAIL"`, `reason` 필수
- [ ] 수정요청 버튼: `decision: "REVISION"`, `reason` 또는 `extraInstruction` 필수
- [ ] 모든 토스트 top-center 위치
- [ ] 서버 에러 메시지 원문 표시

### 🔧 구현 위치
- `apps/web/app/admin/orders/[id]/page.tsx`
- `apps/web/components/admin/ValidationReport.tsx`

---

## D. 페르소나 배정 패널

### 📝 요구사항
- **프리셋 4축:**
  - 연령대: 20 / 30 / 40 / 50
  - 성별: 남 / 여
  - 성격: 4가지 (예: 활발, 차분, 전문, 친근)
  - 톤: 3가지 (예: 격식, 캐주얼, 중립)

- **동일 place 5건 배치:**
  - 5개 조합 빠른 배정 (무작위/프리셋)

### ✅ 확인 사항
- [ ] 페르소나 배정 패널에 프리셋 4축 UI 추가
- [ ] 연령대 선택 드롭다운/라디오: 20 / 30 / 40 / 50
- [ ] 성별 선택: 남 / 여
- [ ] 성격 선택: 4가지 옵션
- [ ] 톤 선택: 3가지 옵션
- [ ] 프리셋 선택 시 자동으로 `personaId` 생성 또는 매핑
- [ ] 동일 place 5건 배치 기능 (선택된 주문 5건에 대해 빠른 배정)
- [ ] 무작위 배정 옵션
- [ ] 프리셋 기반 배정 옵션

### 🔧 구현 위치
- `apps/web/app/admin/intake/page.tsx`
- 새로운 컴포넌트: `apps/web/components/admin/PersonaAssignPanel.tsx` (선택)

---

## E. 큐/관측

### 📝 요구사항
- 산출 직후 `/health`의 `queue.waiting/active` 변동 확인
- 폴링 또는 버튼 클릭 후 즉시 재조회
- 실패 시 재시도 액션 노출
- 실패 원문 메시지를 토스트로 표시

### ✅ 확인 사항
- [ ] 산출 직후 `/health` 엔드포인트 호출하여 큐 상태 확인
- [ ] `queue.waiting` 또는 `queue.active` 증가 확인
- [ ] 폴링 (10초 간격) 또는 버튼 클릭 후 즉시 재조회
- [ ] 실패 시 재시도 액션 버튼 노출
- [ ] 실패 원문 메시지를 토스트로 표시 (top-center)

### 🔧 구현 위치
- `apps/web/app/admin/page.tsx` (대시보드)
- `apps/web/app/admin/intake/page.tsx` (인테이크)

---

## F. 접근 가드

### 📝 요구사항
- `/admin/**`는 ADMIN 전용
- 미인증/권한 불일치 시 `/auth/login`으로 이동

### ✅ 확인 사항
- [ ] 모든 `/admin/**` 페이지에 `RouteGuard requiredRole="ADMIN"` 적용
- [ ] 미인증 시 `/auth/login`으로 리다이렉트
- [ ] 권한 불일치 시 `/auth/login`으로 리다이렉트

### 🔧 구현 위치
- `apps/web/app/admin/**/*.tsx` 모든 파일

---

## G. API 흐름 (엔드포인트 수준)

### 📝 요구사항
- `POST /admin/orders/:id/assign-persona` → ADMIN_INTAKE
- `POST /admin/orders/:id/generate` → GENERATING(큐 add, reserve)
- `GET /admin/orders/:id` → 주문 + 최신 원고 + validationReport
- `POST /admin/orders/:id/review` → `{decision: PASS|FAIL|REVISION, notes?}`
- `POST /admin/orders/:id/cancel` → ADMIN_REJECTED + release

### ✅ 확인 사항
- [ ] `POST /admin/orders/:id/assign-persona`: 상태 ADMIN_INTAKE로 변경
- [ ] `POST /admin/orders/:id/generate`: 상태 GENERATING + 큐 add + `billingService.reserve()`
- [ ] `GET /admin/orders/:id`: 주문 객체 + 원고 + validationReport 반환
- [ ] `POST /admin/orders/:id/review`: decision (PASS/FAIL/REVISION), notes(선택) 처리
- [ ] `POST /admin/orders/:id/cancel`: 상태 ADMIN_REJECTED + `billingService.release()`

### 🔧 구현 위치
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.service.ts`

---

## ✅ 검증문 (합격 기준)

1. [ ] 인테이크 카드에서 배정→산출이 순서대로 동작하고, 산출 직후 큐 waiting→active 변동이 보인다.
2. [ ] 상세에 자동검수 리포트 4항목이 정확히 표시된다.
3. [ ] PASS 시 대행사 "원고 1차 검수 요청" 버킷으로 즉시 이동한다.
4. [ ] FAIL/수정요청 시 자동 재생성 루프가 시작되고 대행사 화면은 "작성 중"으로 회귀한다.
5. [ ] 워커 실패 시 FAILED + release, 재시도 액션 노출된다.
6. [ ] 모든 알림은 top-center로 서버 메시지 원문이 뜬다.

---

## 🚀 우선순위별 구현 계획

### Phase 1: 필수 기능 (즉시 구현)
1. 인테이크 카드 정보 추가 (대행사명, 키워드 요약, 이미지 수)
2. 잔액 부족 시 토스트 처리
3. 자동검수 리포트 4항목 정확히 표시
4. 검수 버튼: PASS/FAIL/수정요청 (코멘트 필수)

### Phase 2: 중요 기능 (1주 내)
1. 페르소나 배정 패널 프리셋 4축 UI
2. 동일 place 5건 배치 기능
3. 워커 실패 처리 (FAILED + release)
4. 큐 관측 개선 (폴링 또는 즉시 재조회)

### Phase 3: 개선 기능 (선택)
1. 대행사별 진행 현황 통계
2. 배치 작업 최적화







