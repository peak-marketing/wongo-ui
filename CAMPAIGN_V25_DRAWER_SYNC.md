# v2.5 (드로어 동기화 + 통과/반려 카운트)

## 🎯 목표
- 드로어 상태 동기화 (열릴 때, 유지, 닫힐 때)
- 검수 액션 API 규칙 (승인, 반려, 검증/제한)
- 드로어 UI 동기화 (프런트 동작 규칙)
- 레이스/중복 처리
- 권한/보안 확인
- 관측/장애 복구

---

## A. 사전 체크리스트

### 📋 실행 단계

### 1. 대행사 권한 토큰 확인

**확인 항목:**
- [ ] 대행사 권한 토큰(AGENCY)로 `/agency/**` 호출 OK
- [ ] JWT 토큰에서 `role=AGENCY` 확인

**확인 방법:**
1. DevTools Network에서 요청 확인:
   - [ ] `GET /agency/stats` 호출
   - [ ] `GET /agency/orders/:id` 호출
   - [ ] Request Headers: `Authorization: Bearer <JWT_TOKEN>`
   - [ ] Status Code: `200 OK` (403/401 아님)
2. JWT 토큰 디코드:
   - [ ] `role: "AGENCY"` 확인

**확인 체크리스트:**
- [ ] 대행사 권한 토큰(AGENCY)로 `/agency/**` 호출 OK
- [ ] JWT 토큰에서 `role=AGENCY` 확인

---

### 2. 드로어 진입 시 id 쿼리 동기화 확인

**확인 항목:**
- [ ] 드로어 진입 시 `id` 쿼리 동기화 (`?id=`) 유지
- [ ] 새로고침 시 동일 상세 복원

**확인 방법:**
1. 행 클릭:
   - [ ] 드로어 열림
   - [ ] URL에 `?id=<주문ID>` 추가됨
2. 새로고침:
   - [ ] 동일 상세 복원
   - [ ] 드로어 자동 열림

**확인 체크리스트:**
- [ ] 드로어 진입 시 `id` 쿼리 동기화 (`?id=`) 유지
- [ ] 새로고침 시 동일 상세 복원

---

### 3. 대시보드 통계 API 확인

**확인 항목:**
- [ ] 대시보드 통계 API (`GET /agency/stats`)가 최신 버킷 규칙으로 응답 OK

**확인 방법:**
1. DevTools Network에서 요청 확인:
   - [ ] `GET /agency/stats` 호출
   - [ ] Response Body:
     ```json
     {
       "writing": 5,
       "firstReview": 2,
       "todayDone": 1,
       "balance": 100000,
       "spentTotal": 50000
     }
     ```
2. 버킷 규칙 확인:
   - [ ] `writing`: 작성 중 버킷 (SUBMITTED, ADMIN_INTAKE, GENERATING, GENERATED, ADMIN_REVIEW, REGEN_QUEUED, ADMIN_REJECTED, REVISION_REQUESTED, FAILED, DRAFT)
   - [ ] `firstReview`: 1차 검수 버킷 (AGENCY_REVIEW)
   - [ ] `todayDone`: 금일 완료 버킷 (COMPLETE AND completedAt=today)

**확인 체크리스트:**
- [ ] 대시보드 통계 API (`GET /agency/stats`)가 최신 버킷 규칙으로 응답 OK
- [ ] 버킷 규칙 일치 확인

---

## B. 드로어 "상태 동기화" 규칙

### 📋 실행 단계

### B-1. 열릴 때

**확인 항목:**
- [ ] 드로어 오픈 트리거 (행 클릭/URL `?id=`) → 즉시 상세 재조회
- [ ] `GET /agency/orders/:id?include=manuscript,validationReport,counters`
- [ ] 응답 필드: `status`, `approveCount`, `rejectCount`, `manuscript` (권한/상태 검증 반영), `validationReport`, `updatedAt`

**확인 방법:**
1. 행 클릭:
   - [ ] 드로어 열림
   - [ ] DevTools Network에서 `GET /agency/orders/:id?include=manuscript,validationReport,counters` 호출 확인
   - [ ] Status Code: `200 OK`
2. Response Body 확인:
   - [ ] `status` 필드 존재
   - [ ] `approveCount` 필드 존재
   - [ ] `rejectCount` 필드 존재
   - [ ] `manuscript` 필드 존재 (권한/상태 검증 반영)
   - [ ] `validationReport` 필드 존재
   - [ ] `updatedAt` 필드 존재

**확인 체크리스트:**
- [ ] 드로어 오픈 트리거 → 즉시 상세 재조회
- [ ] `GET /agency/orders/:id?include=manuscript,validationReport,counters`
- [ ] 응답 필드: `status`, `approveCount`, `rejectCount`, `manuscript`, `validationReport`, `updatedAt`

---

### B-2. 유지 (자동 동기화)

**확인 항목:**
- [ ] 리포커스/가시성 회복 시 1회 재조회
- [ ] 10초 폴링 (데스크톱 기준) 또는 수동 새로고침 버튼 제공
- [ ] PASS/REJECT 성공 직후에는 강제 재조회 (optimistic 업데이트 후 정합 확인)

**확인 방법:**
1. 리포커스 테스트:
   - [ ] 다른 탭으로 이동 후 복귀
   - [ ] 드로어 열린 상태에서 리포커스
   - [ ] 1회 재조회 확인
2. 폴링 테스트:
   - [ ] 10초 대기
   - [ ] DevTools Network에서 재조회 요청 확인
   - [ ] 또는 수동 새로고침 버튼 클릭
3. PASS/REJECT 성공 직후:
   - [ ] 통과 버튼 클릭
   - [ ] optimistic 업데이트 후 강제 재조회 확인

**확인 체크리스트:**
- [ ] 리포커스/가시성 회복 시 1회 재조회
- [ ] 10초 폴링 (데스크톱 기준) 또는 수동 새로고침 버튼 제공
- [ ] PASS/REJECT 성공 직후에는 강제 재조회

---

### B-3. 닫힐 때

**확인 항목:**
- [ ] 드로어 닫힘 → URL `?id=` 제거
- [ ] 포커스 복원 (이전 행)

**확인 방법:**
1. 드로어 닫기:
   - [ ] ESC 키 또는 닫기 버튼 클릭
   - [ ] URL에서 `?id=` 제거 확인
   - [ ] 포커스가 이전 행으로 복원 확인

**확인 체크리스트:**
- [ ] 드로어 닫힘 → URL `?id=` 제거
- [ ] 포커스 복원 (이전 행)

---

## C. 검수 액션 API 규칙 (누적 카운트 포함)

### 📋 실행 단계

### C-1. 승인 (통과)

**확인 항목:**
- [ ] `POST /agency/orders/:id/review`
- [ ] Body: `{ decision: "APPROVE" }`
- [ ] 조건: 현재 상태가 `AGENCY_REVIEW`일 때만 허용
- [ ] 원자성: 트랜잭션으로 처리
- [ ] `status → COMPLETE`
- [ ] `approveCount = approveCount + 1`
- [ ] `completedAt = now(Asia/Seoul)`
- [ ] `billing.capture` (중복 방지: 이미 CAPTURED면 무시)
- [ ] 응답 (요약): `{ message, status:"COMPLETE", approveCount, rejectCount, completedAt }`

**확인 방법:**
1. 통과 버튼 클릭:
   - [ ] DevTools Network에서 `POST /agency/orders/:id/review` 호출 확인
   - [ ] Request Body: `{ decision: "APPROVE" }`
   - [ ] Status Code: `200 OK`
2. Response Body 확인:
   - [ ] `message` 필드 존재
   - [ ] `status: "COMPLETE"`
   - [ ] `approveCount` 증가 확인
   - [ ] `rejectCount` 유지 확인
   - [ ] `completedAt` 필드 존재
3. DB 확인:
   - [ ] `status = COMPLETE`
   - [ ] `approveCount` 증가
   - [ ] `completedAt` 설정됨

**확인 체크리스트:**
- [ ] `POST /agency/orders/:id/review` Body: `{ decision: "APPROVE" }`
- [ ] 조건: 현재 상태가 `AGENCY_REVIEW`일 때만 허용
- [ ] 원자성: 트랜잭션으로 처리
- [ ] `status → COMPLETE`, `approveCount + 1`, `completedAt` 설정
- [ ] `billing.capture` (중복 방지)
- [ ] 응답 필드 확인

---

### C-2. 반려

**확인 항목:**
- [ ] `POST /agency/orders/:id/review`
- [ ] Body: `{ decision: "REJECT", reason: "<1~300자>" }`
- [ ] 조건: 현재 상태가 `AGENCY_REVIEW`일 때만 허용
- [ ] 원자성 (트랜잭션):
  - [ ] `status → REGEN_QUEUED` (자동 재생성 루프 시작)
  - [ ] `rejectCount = rejectCount + 1`
  - [ ] `completedAt = null` (있다면 초기화)
- [ ] 응답 (요약): `{ message, status:"REGEN_QUEUED", approveCount, rejectCount }`

**확인 방법:**
1. 반려 버튼 클릭:
   - [ ] 반려 사유 입력
   - [ ] DevTools Network에서 `POST /agency/orders/:id/review` 호출 확인
   - [ ] Request Body: `{ decision: "REJECT", reason: "..." }`
   - [ ] Status Code: `200 OK`
2. Response Body 확인:
   - [ ] `message` 필드 존재
   - [ ] `status: "REGEN_QUEUED"`
   - [ ] `approveCount` 유지 확인
   - [ ] `rejectCount` 증가 확인
3. DB 확인:
   - [ ] `status = REGEN_QUEUED`
   - [ ] `rejectCount` 증가
   - [ ] `completedAt = null`

**확인 체크리스트:**
- [ ] `POST /agency/orders/:id/review` Body: `{ decision: "REJECT", reason: "..." }`
- [ ] 조건: 현재 상태가 `AGENCY_REVIEW`일 때만 허용
- [ ] 원자성: 트랜잭션으로 처리
- [ ] `status → REGEN_QUEUED`, `rejectCount + 1`, `completedAt = null`
- [ ] 응답 필드 확인

---

### C-3. 검증/제한

**확인 항목:**
- [ ] 반려 사유 필수, 길이 300자 이내
- [ ] Idempotency-Key 헤더 허용 (중복 클릭 방지)
- [ ] 허용 상태 외 요청 → 409 (CONFLICT) + 메시지
- [ ] 모든 응답 메시지는 서버 원문 그대로 토스트 노출 (top-center)

**확인 방법:**
1. 반려 사유 검증:
   - [ ] 반려 사유 미입력 → 버튼 disabled
   - [ ] 반려 사유 300자 초과 → 버튼 disabled 또는 토스트
2. Idempotency-Key:
   - [ ] Request Headers에 `Idempotency-Key` 포함
   - [ ] 동일 요청 중복 방지 확인
3. 허용 상태 외 요청:
   - [ ] `AGENCY_REVIEW` 아닌 상태에서 통과/반려 버튼 클릭
   - [ ] Status Code: `409 CONFLICT`
   - [ ] 서버 메시지 원문 토스트 표시
4. 토스트 확인:
   - [ ] 모든 응답 메시지는 top-center로 서버 원문 표시

**확인 체크리스트:**
- [ ] 반려 사유 필수, 길이 300자 이내
- [ ] Idempotency-Key 헤더 허용 (중복 클릭 방지)
- [ ] 허용 상태 외 요청 → 409 (CONFLICT) + 메시지
- [ ] 모든 응답 메시지는 서버 원문 그대로 토스트 노출 (top-center)

---

## D. 드로어 UI 동기화 (프런트 동작 규칙)

### 📋 실행 단계

### D-1. 오픈 시

**확인 항목:**
- [ ] 스켈레톤 → `GET /agency/orders/:id` 2xx → 본문/카운트/리포트 렌더
- [ ] 상태가 `AGENCY_REVIEW|COMPLETE`일 때만 원고 본문 섹션 표시

**확인 방법:**
1. 드로어 열기:
   - [ ] 스켈레톤 표시
   - [ ] `GET /agency/orders/:id` 호출
   - [ ] Status Code: `200 OK`
   - [ ] 본문/카운트/리포트 렌더
2. 본문 표시 확인:
   - [ ] `AGENCY_REVIEW` 상태: 원고 본문 표시
   - [ ] `COMPLETE` 상태: 원고 본문 표시
   - [ ] 그 외 상태: 원고 본문 숨김

**확인 체크리스트:**
- [ ] 스켈레톤 → `GET /agency/orders/:id` 2xx → 본문/카운트/리포트 렌더
- [ ] 상태가 `AGENCY_REVIEW|COMPLETE`일 때만 원고 본문 섹션 표시

---

### D-2. 버튼/카운트 업데이트

**확인 항목:**
- [ ] 통과 클릭:
  - [ ] 버튼 disabled + 로딩
  - [ ] optimistic: 드로어 헤더 카운트 `approveCount+1`, 상태 뱃지를 "완료"로 선반영
  - [ ] 서버 성공 → 확정, 실패 → 롤백 + 실패 토스트
- [ ] 반려 클릭:
  - [ ] 사유 미입력 시 버튼 disabled
  - [ ] optimistic: `rejectCount+1`, 상태 뱃지를 "작성 중(재생성)" 버킷으로 선이동
  - [ ] 서버 성공 → 확정, 실패 → 롤백

**확인 방법:**
1. 통과 클릭:
   - [ ] 버튼 disabled + 로딩 표시
   - [ ] optimistic: 드로어 헤더 카운트 `approveCount+1` 선반영
   - [ ] 상태 뱃지를 "완료"로 선반영
   - [ ] 서버 성공 → 확정
   - [ ] 서버 실패 → 롤백 + 실패 토스트
2. 반려 클릭:
   - [ ] 사유 미입력 시 버튼 disabled
   - [ ] 사유 입력 후 버튼 클릭
   - [ ] optimistic: `rejectCount+1` 선반영
   - [ ] 상태 뱃지를 "작성 중(재생성)" 버킷으로 선이동
   - [ ] 서버 성공 → 확정
   - [ ] 서버 실패 → 롤백

**확인 체크리스트:**
- [ ] 통과 클릭: 버튼 disabled + 로딩, optimistic 업데이트, 서버 성공/실패 처리
- [ ] 반려 클릭: 사유 미입력 시 버튼 disabled, optimistic 업데이트, 서버 성공/실패 처리

---

### D-3. 리스트/상단 카드 동기화

**확인 항목:**
- [ ] 액션 성공 시:
  - [ ] 현재 탭에서 항목 제거/이동 (버킷 전환)
  - [ ] 상단 3카드 (작성 중/1차 검수/금일 완료) 즉시 재조회
  - [ ] 상세가 열려 있으면 강제 재조회로 카운트 정합 확인

**확인 방법:**
1. 통과 액션:
   - [ ] 통과 버튼 클릭
   - [ ] 현재 탭에서 항목 제거 (1차 검수 → 금일 완료)
   - [ ] 상단 카드 "금일 완료" 즉시 재조회
   - [ ] 상세가 열려 있으면 강제 재조회
2. 반려 액션:
   - [ ] 반려 버튼 클릭
   - [ ] 현재 탭에서 항목 이동 (1차 검수 → 작성 중)
   - [ ] 상단 카드 "작성 중" 즉시 재조회
   - [ ] 상세가 열려 있으면 강제 재조회

**확인 체크리스트:**
- [ ] 액션 성공 시: 현재 탭에서 항목 제거/이동, 상단 카드 즉시 재조회, 상세 강제 재조회

---

## E. 레이스/중복 처리

### 📋 실행 단계

### 1. 중복 요청 방지

**확인 항목:**
- [ ] 동일 주문에 대한 승인/반려 요청은 버튼 잠금 + Idempotency-Key로 중복 방지
- [ ] 상태 불일치 (사이에 상태가 바뀐 경우) → 409 수신 시 드로어 전체 재조회 후 안내 토스트 "상태가 변경되었습니다. 화면을 새로고침했습니다."

**확인 방법:**
1. 중복 요청 방지:
   - [ ] 통과 버튼 클릭
   - [ ] 버튼 잠금 (disabled)
   - [ ] Request Headers에 `Idempotency-Key` 포함
   - [ ] 동일 요청 중복 방지 확인
2. 상태 불일치:
   - [ ] `AGENCY_REVIEW` 아닌 상태에서 통과/반려 버튼 클릭
   - [ ] Status Code: `409 CONFLICT`
   - [ ] 드로어 전체 재조회
   - [ ] 안내 토스트: "상태가 변경되었습니다. 화면을 새로고침했습니다."

**확인 체크리스트:**
- [ ] 동일 주문에 대한 승인/반려 요청은 버튼 잠금 + Idempotency-Key로 중복 방지
- [ ] 상태 불일치 → 409 수신 시 드로어 전체 재조회 후 안내 토스트

---

## F. 권한/보안

### 📋 실행 단계

### 1. 권한 확인

**확인 항목:**
- [ ] 엔드포인트는 AGENCY 전용, JWT에서 `agencyId` 바인딩
- [ ] 다른 대행사 주문 접근 시 403
- [ ] 서버 로깅: `orderId`, `agencyId`, `decision`, `actorId`, `ip`, `userAgent`, `idempotencyKey`

**확인 방법:**
1. 권한 테스트:
   - [ ] AGENCY 역할로 로그인 → 접근 가능
   - [ ] ADMIN 역할로 로그인 → 접근 불가 (403)
2. 다른 대행사 주문 접근:
   - [ ] 다른 대행사의 주문 ID로 접근 시도
   - [ ] Status Code: `403 Forbidden`
3. 서버 로깅 확인:
   - [ ] 서버 로그에서 `orderId`, `agencyId`, `decision`, `actorId`, `ip`, `userAgent`, `idempotencyKey` 확인

**확인 체크리스트:**
- [ ] 엔드포인트는 AGENCY 전용, JWT에서 `agencyId` 바인딩
- [ ] 다른 대행사 주문 접근 시 403
- [ ] 서버 로깅: 모든 필드 확인

---

## G. 관측/장애 복구

### 📋 실행 단계

### 1. 큐/워커 상태 확인

**확인 항목:**
- [ ] 큐/워커 상태 확인: `/health`의 `queue.waiting|active|failed`
- [ ] 반려 후 자동 재생성 실패 시: 드로어 상단에 "재생성 실패" 배지 표시 + "재시도" 버튼 (어드민 처리 영역으로 안내 가능)

**확인 방법:**
1. `/health` 확인:
   - [ ] `queue.waiting` 값 확인
   - [ ] `queue.active` 값 확인
   - [ ] `queue.failed` 값 확인
2. 재생성 실패:
   - [ ] 반려 버튼 클릭
   - [ ] 자동 재생성 실패 시뮬레이션
   - [ ] 드로어 상단에 "재생성 실패" 배지 표시
   - [ ] "재시도" 버튼 표시

**확인 체크리스트:**
- [ ] 큐/워커 상태 확인: `/health`의 `queue.waiting|active|failed`
- [ ] 반려 후 자동 재생성 실패 시: "재생성 실패" 배지 표시 + "재시도" 버튼

---

## H. 검증문 (합격 기준)

### ✅ 종합 검증

**1. 드로어 상태 동기화**
- [ ] 드로어 열릴 때, 상세/카운트/리포트가 항상 최신 (오픈/리포커스/액션 후 재조회)
- [ ] 드로어 닫힘 → URL `?id=` 제거, 포커스 복원

**2. 검수 액션**
- [ ] 승인: 상태가 `COMPLETE`로 바뀌고 `approveCount` 증가, 상단 카드 (금일 완료) 즉시 반영
- [ ] 반려: 상태가 `REGEN_QUEUED`로 바뀌고 `rejectCount` 증가, 리스트 항목이 "작성 중" 버킷으로 이동

**3. 에러 처리**
- [ ] 409/4xx 시 정중한 토스트 + 드로어 재조회로 정합 회복
- [ ] 모든 알림은 top-center로 서버 메시지 원문 표시

**4. 권한/보안**
- [ ] 엔드포인트는 AGENCY 전용, JWT에서 `agencyId` 바인딩
- [ ] 다른 대행사 주문 접근 시 403

**5. 관측/장애 복구**
- [ ] 큐/워커 상태 확인: `/health`의 `queue.waiting|active|failed`
- [ ] 반려 후 자동 재생성 실패 시: "재생성 실패" 배지 표시 + "재시도" 버튼

---

## 📊 종합 검증 체크리스트

### ✅ 사전 체크리스트
1. [ ] 대행사 권한 토큰(AGENCY)로 `/agency/**` 호출 OK
2. [ ] 드로어 진입 시 `id` 쿼리 동기화 (`?id=`) 유지
3. [ ] 대시보드 통계 API (`GET /agency/stats`)가 최신 버킷 규칙으로 응답 OK

### ✅ 드로어 "상태 동기화" 규칙
1. [ ] 열릴 때: 드로어 오픈 트리거 → 즉시 상세 재조회
2. [ ] 유지: 리포커스/가시성 회복 시 1회 재조회, 10초 폴링, PASS/REJECT 성공 직후 강제 재조회
3. [ ] 닫힐 때: 드로어 닫힘 → URL `?id=` 제거, 포커스 복원

### ✅ 검수 액션 API 규칙
1. [ ] 승인: `POST /agency/orders/:id/review` Body: `{ decision: "APPROVE" }`, 트랜잭션 처리
2. [ ] 반려: `POST /agency/orders/:id/review` Body: `{ decision: "REJECT", reason: "..." }`, 트랜잭션 처리
3. [ ] 검증/제한: 반려 사유 필수, 길이 300자 이내, Idempotency-Key, 409 처리

### ✅ 드로어 UI 동기화
1. [ ] 오픈 시: 스켈레톤 → `GET /agency/orders/:id` 2xx → 본문/카운트/리포트 렌더
2. [ ] 버튼/카운트 업데이트: optimistic 업데이트, 서버 성공/실패 처리
3. [ ] 리스트/상단 카드 동기화: 액션 성공 시 항목 제거/이동, 상단 카드 즉시 재조회

### ✅ 레이스/중복 처리
1. [ ] 동일 주문에 대한 승인/반려 요청은 버튼 잠금 + Idempotency-Key로 중복 방지
2. [ ] 상태 불일치 → 409 수신 시 드로어 전체 재조회 후 안내 토스트

### ✅ 권한/보안
1. [ ] 엔드포인트는 AGENCY 전용, JWT에서 `agencyId` 바인딩
2. [ ] 다른 대행사 주문 접근 시 403
3. [ ] 서버 로깅: 모든 필드 확인

### ✅ 관측/장애 복구
1. [ ] 큐/워커 상태 확인: `/health`의 `queue.waiting|active|failed`
2. [ ] 반려 후 자동 재생성 실패 시: "재생성 실패" 배지 표시 + "재시도" 버튼

---

## 🔧 트리아지 리포트 템플릿

### 드로어 동기화 실패 리포트 작성 시:

```
## 드로어 동기화 실패 리포트

### 1. 사전 체크리스트
- 대행사 권한 토큰: [ ] OK [ ] 실패
- 드로어 진입 시 id 쿼리 동기화: [ ] OK [ ] 실패
- 대시보드 통계 API: [ ] OK [ ] 실패

### 2. 드로어 "상태 동기화" 규칙
- 열릴 때: [ ] 즉시 상세 재조회 [ ] 재조회 안 됨
- 유지: [ ] 리포커스/가시성 회복 시 1회 재조회 [ ] 재조회 안 됨
- 닫힐 때: [ ] URL ?id= 제거, 포커스 복원 [ ] 복원 안 됨

### 3. 검수 액션 API 규칙
- 승인: [ ] POST /agency/orders/:id/review 호출 [ ] 호출 안 됨
- 반려: [ ] POST /agency/orders/:id/review 호출 [ ] 호출 안 됨
- 검증/제한: [ ] 반려 사유 필수, 길이 300자 이내 [ ] 검증 안 됨
- Idempotency-Key: [ ] 포함 [ ] 포함 안 됨
- 409 처리: [ ] 드로어 전체 재조회 후 안내 토스트 [ ] 처리 안 됨

### 4. 드로어 UI 동기화
- 오픈 시: [ ] 스켈레톤 → GET /agency/orders/:id 2xx → 본문/카운트/리포트 렌더 [ ] 렌더 안 됨
- 버튼/카운트 업데이트: [ ] optimistic 업데이트 [ ] 업데이트 안 됨
- 리스트/상단 카드 동기화: [ ] 액션 성공 시 항목 제거/이동 [ ] 동기화 안 됨

### 5. 레이스/중복 처리
- 중복 요청 방지: [ ] 버튼 잠금 + Idempotency-Key [ ] 방지 안 됨
- 상태 불일치: [ ] 409 수신 시 드로어 전체 재조회 후 안내 토스트 [ ] 처리 안 됨

### 6. 권한/보안
- 엔드포인트 AGENCY 전용: [ ] OK [ ] 실패
- 다른 대행사 주문 접근: [ ] 403 [ ] 허용됨
- 서버 로깅: [ ] 모든 필드 확인 [ ] 누락

### 7. 관측/장애 복구
- 큐/워커 상태 확인: [ ] /health의 queue.waiting|active|failed 확인 [ ] 확인 안 됨
- 재생성 실패: [ ] "재생성 실패" 배지 표시 + "재시도" 버튼 [ ] 표시 안 됨

### 8. 원인 추정
1순위: [ ] 드로어 상태 동기화 문제
2순위: [ ] 검수 액션 API 문제
3순위: [ ] 레이스/중복 처리 문제

### 9. 조치
- [ ] 드로어 상태 동기화 확인/수정
- [ ] 검수 액션 API 확인/수정
- [ ] 레이스/중복 처리 확인/수정
- [ ] 권한/보안 확인/수정
- [ ] 관측/장애 복구 확인/수정
```






