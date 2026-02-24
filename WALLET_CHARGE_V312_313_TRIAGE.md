# 대행사 충전 관리 v3.1.2, v3.2, v3.3 트리아지 & 핫픽스

## 🎯 목표
- v3.1.2: 충전하기 제출 실패 트리아지 & 핫픽스
- v3.2: 지갑 ↔ 원고 플로우 연동 (예약/차감/해제 규칙)
- v3.3: 대행사 작성 중단(취소) 설계

---

## v3.1.2 "충전하기 제출 실패" 트리아지 & 핫픽스

### A. DevTools Network로 정확한 실패 유형 캡처 (필수)

### 📋 실행 단계

### 1. POST /agency/topups 요청 확인

**확인 항목:**
- [ ] Status (400/401/403/409/429/500 중 무엇?)
- [ ] Response Body.message (서버가 반환한 한 줄 원인)
- [ ] Headers: Authorization, Content-Type: application/json, Idempotency-Key 존재
- [ ] Payload: { amount: number, method?: 'REQUEST', memo? } – amount 정수 (원), 10,000~5,000,000
- [ ] Timing: preflight 실패 여부 (OPTIONS 2xx 여부)

**확인 방법:**
1. DevTools Network 탭 열기:
   - [ ] `POST /agency/topups` 요청 찾기
   - [ ] Status Code 확인 (400/401/403/409/429/500 중 무엇?)
   - [ ] Response Body에서 `message` 확인
2. Headers 확인:
   - [ ] `Authorization` 헤더 존재 확인
   - [ ] `Content-Type: application/json` 확인
   - [ ] `Idempotency-Key` 헤더 존재 확인
3. Payload 확인:
   - [ ] Request Body: `{ amount: number, method?: 'REQUEST', memo? }`
   - [ ] `amount` 정수 (원) 확인
   - [ ] `amount` 범위: 10,000~5,000,000 확인
4. Timing 확인:
   - [ ] `OPTIONS /agency/topups` 요청 확인
   - [ ] Status Code: 2xx 확인 (preflight 성공)

**확인 체크리스트:**
- [ ] Status (400/401/403/409/429/500 중 무엇?)
- [ ] Response Body.message (서버가 반환한 한 줄 원인)
- [ ] Headers: Authorization, Content-Type: application/json, Idempotency-Key 존재
- [ ] Payload: { amount: number, method?: 'REQUEST', memo? } – amount 정수 (원), 10,000~5,000,000
- [ ] Timing: preflight 실패 여부 (OPTIONS 2xx 여부)

---

### B. 가장 흔한 6가지 원인 → 즉시 점검 순서

### 📋 실행 단계

### 1. 금액 범위/형식 위반 → 400 확인

**확인 항목:**
- [ ] 천단위 쉼표 제거 후 정수 (원)로 전달됐는지
- [ ] 최소 10,000 / 최대 5,000,000

**확인 방법:**
1. 금액 입력 확인:
   - [ ] 입력: "12,345원" → 서버 전송: 12345 (정수)
   - [ ] 천단위 쉼표 제거 확인
2. 범위 확인:
   - [ ] 최소 금액: 10,000원 이상
   - [ ] 최대 금액: 5,000,000원 이하
3. DevTools Network 확인:
   - [ ] Request Body의 `amount`가 정수인지 확인
   - [ ] Status Code: `400 BAD REQUEST` 확인
   - [ ] Response Body의 `message` 확인

**확인 체크리스트:**
- [ ] 천단위 쉼표 제거 후 정수 (원)로 전달됐는지
- [ ] 최소 10,000 / 최대 5,000,000

---

### 2. Idempotency 우회 로직에 걸림 → 200인데 새 요청이 안 생기는 듯 보이는 케이스 확인

**확인 항목:**
- [ ] 서버가 "동일 사용자/금액/메모의 PENDING 요청이 이미 있으면 재사용" 정책
- [ ] UI는 **"기존 PENDING 요청 복원"**으로 처리해야 함 (성공 토스트 + 목록 새로고침)

**확인 방법:**
1. Idempotency 확인:
   - [ ] 동일 사용자/금액/메모의 PENDING 요청 존재 확인
   - [ ] Status Code: `200 OK` 확인
   - [ ] Response Body에 기존 요청 ID 포함 확인
2. UI 처리 확인:
   - [ ] 성공 토스트 표시 확인
   - [ ] 요청 목록 새로고침 확인
   - [ ] 기존 PENDING 요청 표시 확인

**확인 체크리스트:**
- [ ] 서버가 "동일 사용자/금액/메모의 PENDING 요청이 이미 있으면 재사용" 정책
- [ ] UI는 **"기존 PENDING 요청 복원"**으로 처리해야 함 (성공 토스트 + 목록 새로고침)

---

### 3. 권한/토큰 문제 → 401/403 확인

**확인 항목:**
- [ ] Authorization 헤더 누락/만료. 재로그인

**확인 방법:**
1. 권한 확인:
   - [ ] `Authorization` 헤더 존재 확인
   - [ ] 토큰 만료 여부 확인
   - [ ] Status Code: `401 UNAUTHORIZED` 또는 `403 FORBIDDEN` 확인
2. 재로그인:
   - [ ] 로그인 페이지로 리다이렉트 확인
   - [ ] 재로그인 후 재시도 확인

**확인 체크리스트:**
- [ ] Authorization 헤더 누락/만료. 재로그인

---

### 4. 429 (속도 제한) 확인

**확인 항목:**
- [ ] 분당 5회 제한. 429 수신 시 3초 버튼 잠금 + 안내 토스트

**확인 방법:**
1. 속도 제한 확인:
   - [ ] 분당 5회 초과 요청 확인
   - [ ] Status Code: `429 Too Many Requests` 확인
2. UI 처리 확인:
   - [ ] 제출 버튼 3초 잠금 확인
   - [ ] top-center 토스트: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요." 확인

**확인 체크리스트:**
- [ ] 분당 5회 제한. 429 수신 시 3초 버튼 잠금 + 안내 토스트

---

### 5. (failed) preflight → CORS 확인

**확인 항목:**
- [ ] OPTIONS /agency/topups 가 2xx가 아닌지 확인
- [ ] Allowed headers: Authorization, Content-Type, Idempotency-Key 포함

**확인 방법:**
1. Preflight 확인:
   - [ ] `OPTIONS /agency/topups` 요청 확인
   - [ ] Status Code: 2xx 확인 (preflight 성공)
2. CORS 헤더 확인:
   - [ ] `Access-Control-Allow-Headers`에 `Authorization`, `Content-Type`, `Idempotency-Key` 포함 확인
   - [ ] `Access-Control-Allow-Origin` 확인

**확인 체크리스트:**
- [ ] OPTIONS /agency/topups 가 2xx가 아닌지 확인
- [ ] Allowed headers: Authorization, Content-Type, Idempotency-Key 포함

---

### 6. 서버 500 확인

**확인 항목:**
- [ ] 로그로 원인 확인 (엔티티/트랜잭션/DB 제약). 응답 메시지 원문을 토스트로 표기

**확인 방법:**
1. 서버 로그 확인:
   - [ ] 서버 로그에서 에러 원인 확인
   - [ ] 엔티티/트랜잭션/DB 제약 확인
2. UI 처리 확인:
   - [ ] Status Code: `500 Internal Server Error` 확인
   - [ ] Response Body의 `message` 확인
   - [ ] top-center 토스트: 서버 메시지 원문 표시 확인

**확인 체크리스트:**
- [ ] 로그로 원인 확인 (엔티티/트랜잭션/DB 제약). 응답 메시지 원문을 토스트로 표기

---

### C. 프런트 제출 규칙 (확정)

### 📋 실행 단계

### 1. 버튼 클릭 시 확인

**확인 항목:**
- [ ] 버튼 클릭 시: 로딩/disabled + Idempotency-Key 부여 (UUID 1회성)

**확인 방법:**
1. 버튼 클릭 확인:
   - [ ] 제출 버튼 클릭 → 로딩 상태 표시 + disabled
   - [ ] DevTools Network에서 `Idempotency-Key` 헤더 확인 (UUID 1회성)

**확인 체크리스트:**
- [ ] 버튼 클릭 시: 로딩/disabled + Idempotency-Key 부여 (UUID 1회성)

---

### 2. 성공 응답 처리 확인

**확인 항목:**
- [ ] 성공 응답 (새로 생성 또는 기존 PENDING 재사용) 시:
  - [ ] 지갑 카드, 충전 요청 목록, 거래 원장 동시 재조회
  - [ ] top-center 토스트: 서버 메시지 원문

**확인 방법:**
1. 성공 응답 확인:
   - [ ] Status Code: `200 OK` 확인
   - [ ] Response Body 확인 (새로 생성 또는 기존 PENDING 재사용)
2. 동시 재조회 확인:
   - [ ] DevTools Network에서 `GET /agency/wallet` 재조회 확인
   - [ ] DevTools Network에서 `GET /agency/topups` 재조회 확인
   - [ ] DevTools Network에서 `GET /agency/transactions` 재조회 확인
3. UI 갱신 확인:
   - [ ] 지갑 카드 갱신 확인
   - [ ] 충전 요청 목록 갱신 확인
   - [ ] 거래 원장 갱신 확인
   - [ ] top-center 토스트: 서버 메시지 원문 표시 확인

**확인 체크리스트:**
- [ ] 성공 응답 (새로 생성 또는 기존 PENDING 재사용) 시:
  - [ ] 지갑 카드, 충전 요청 목록, 거래 원장 동시 재조회
  - [ ] top-center 토스트: 서버 메시지 원문

---

### 3. 취소 처리 확인

**확인 항목:**
- [ ] 취소는 PENDING만 허용: POST /agency/topups/:id/cancel → 성공 시 상태 CANCELED 반영

**확인 방법:**
1. 취소 확인:
   - [ ] PENDING인 요청만 취소 버튼 표시 확인
   - [ ] 취소 버튼 클릭 → `POST /agency/topups/:id/cancel` 호출 확인
   - [ ] Status Code: `200 OK` 확인
2. 상태 반영 확인:
   - [ ] 요청 목록에서 상태 `CANCELED` 반영 확인
   - [ ] 거래 원장 갱신 확인

**확인 체크리스트:**
- [ ] 취소는 PENDING만 허용: POST /agency/topups/:id/cancel → 성공 시 상태 CANCELED 반영

---

### 합격 기준 (체크)

### ✅ 종합 검증

**1. POST /agency/topups 2xx + 성공 토스트**
- [ ] POST /agency/topups 2xx 응답 확인
- [ ] top-center 토스트: "충전 요청이 접수되었습니다." 확인

**2. 요청 목록에 PENDING 1건 즉시 보임**
- [ ] 요청 목록에 PENDING 1건 즉시 표시 확인
- [ ] 기존 PENDING이면 동일 건 표시 확인

**3. CSV/원장에 TOPUP_REQUEST 1줄 추가**
- [ ] 거래 원장에 TOPUP_REQUEST 1줄 추가 확인
- [ ] CSV 내보내기에서 TOPUP_REQUEST 1줄 확인

**4. 429/400/409/401/403/500 시 서버 메시지가 top-center로 정확히 표기**
- [ ] 429 시 서버 메시지 top-center 표시 확인
- [ ] 400 시 서버 메시지 top-center 표시 확인
- [ ] 409 시 서버 메시지 top-center 표시 확인
- [ ] 401 시 서버 메시지 top-center 표시 확인
- [ ] 403 시 서버 메시지 top-center 표시 확인
- [ ] 500 시 서버 메시지 top-center 표시 확인

---

## v3.2 "지갑 ↔ 원고 플로우 연동" (예약/차감/해제 규칙)

### A. 금액 규칙 (예시)

### 📋 실행 단계

### 1. UNIT_PRICE_PER_ORDER 확인

**확인 항목:**
- [ ] UNIT_PRICE_PER_ORDER (환경변수) = 1건당 과금액 (원)
- [ ] submitCount가 1~5이면 예약/차감도 그 수량만큼

**확인 방법:**
1. 환경변수 확인:
   - [ ] `UNIT_PRICE_PER_ORDER` 환경변수 확인
   - [ ] 1건당 과금액 (원) 확인
2. 수량 확인:
   - [ ] `submitCount` 1~5 확인
   - [ ] 예약/차감 금액 = `UNIT_PRICE_PER_ORDER * submitCount` 확인

**확인 체크리스트:**
- [ ] UNIT_PRICE_PER_ORDER (환경변수) = 1건당 과금액 (원)
- [ ] submitCount가 1~5이면 예약/차감도 그 수량만큼

---

### B. 연동 시퀀스 (상태 전이와 1:1 대응)

### 📋 실행 단계

### 1. 어드민 '산출' 버튼 → RESERVE 확인

**확인 항목:**
- [ ] Billing.reserve(orderId, amount = UNIT_PRICE * 주문수량)
- [ ] 성공 → 주문 reservedAmount, reservedAt 기록 → status=GENERATING
- [ ] 실패 (잔액 부족) → 산출 불가 (어드민/대행사에 "잔액 부족 · 충전 요청" 안내)

**확인 방법:**
1. 산출 버튼 클릭:
   - [ ] 어드민 '산출' 버튼 클릭
   - [ ] `Billing.reserve(orderId, amount = UNIT_PRICE * 주문수량)` 호출 확인
2. 성공 확인:
   - [ ] 주문 `reservedAmount`, `reservedAt` 기록 확인
   - [ ] 주문 상태: `GENERATING` 확인
   - [ ] 거래 원장에 RESERVE 레코드 추가 확인
3. 실패 확인:
   - [ ] 잔액 부족 시 산출 불가 확인
   - [ ] 어드민/대행사에 "잔액 부족 · 충전 요청" 안내 확인

**확인 체크리스트:**
- [ ] Billing.reserve(orderId, amount = UNIT_PRICE * 주문수량)
- [ ] 성공 → 주문 reservedAmount, reservedAt 기록 → status=GENERATING
- [ ] 실패 (잔액 부족) → 산출 불가 (어드민/대행사에 "잔액 부족 · 충전 요청" 안내)

---

### 2. 자동 생성 완료 → status=GENERATED → ADMIN_REVIEW 확인

**확인 항목:**
- [ ] 자동 생성 완료 → status=GENERATED → ADMIN_REVIEW
- [ ] 예약은 유지 (금액 변동 없음)

**확인 방법:**
1. 자동 생성 완료 확인:
   - [ ] 주문 상태: `GENERATED` 확인
   - [ ] 주문 상태: `ADMIN_REVIEW` 확인
2. 예약 유지 확인:
   - [ ] 지갑 `reserved` 금액 변동 없음 확인
   - [ ] 거래 원장에 추가 레코드 없음 확인

**확인 체크리스트:**
- [ ] 자동 생성 완료 → status=GENERATED → ADMIN_REVIEW
- [ ] 예약은 유지 (금액 변동 없음)

---

### 3. 어드민 PASS → status=AGENCY_REVIEW 확인

**확인 항목:**
- [ ] 어드민 PASS → status=AGENCY_REVIEW
- [ ] 예약 유지

**확인 방법:**
1. 어드민 PASS 확인:
   - [ ] 어드민 PASS 버튼 클릭
   - [ ] 주문 상태: `AGENCY_REVIEW` 확인
2. 예약 유지 확인:
   - [ ] 지갑 `reserved` 금액 변동 없음 확인
   - [ ] 거래 원장에 추가 레코드 없음 확인

**확인 체크리스트:**
- [ ] 어드민 PASS → status=AGENCY_REVIEW
- [ ] 예약 유지

---

### 4. 대행사 승인 (통과) → CAPTURE 확인

**확인 항목:**
- [ ] 대행사 승인 (통과) → CAPTURE
- [ ] 예약분 차감 확정 (balance↓, reserved↓, spentTotal↑)
- [ ] status=COMPLETE / completedAt 기록

**확인 방법:**
1. 대행사 승인 확인:
   - [ ] 대행사 승인 버튼 클릭
   - [ ] 주문 상태: `COMPLETE` 확인
   - [ ] 주문 `completedAt` 기록 확인
2. 차감 확정 확인:
   - [ ] 지갑 `balance` 감소 확인
   - [ ] 지갑 `reserved` 감소 확인
   - [ ] 지갑 `spentTotal` 증가 확인
   - [ ] 거래 원장에 CAPTURE 레코드 추가 확인

**확인 체크리스트:**
- [ ] 대행사 승인 (통과) → CAPTURE
- [ ] 예약분 차감 확정 (balance↓, reserved↓, spentTotal↑)
- [ ] status=COMPLETE / completedAt 기록

---

### 5. 대행사 반려 (자동 재생성 루프) → 예약 유지 확인

**확인 항목:**
- [ ] 대행사 반려 (자동 재생성 루프) → 예약 유지
- [ ] REGEN_QUEUED → GENERATING → … (최종 승인 시점에만 capture)

**확인 방법:**
1. 대행사 반려 확인:
   - [ ] 대행사 반려 버튼 클릭
   - [ ] 주문 상태: `REGEN_QUEUED` 확인
   - [ ] 주문 상태: `GENERATING` 확인
2. 예약 유지 확인:
   - [ ] 지갑 `reserved` 금액 변동 없음 확인
   - [ ] 거래 원장에 추가 레코드 없음 확인
   - [ ] 최종 승인 시점에만 capture 확인

**확인 체크리스트:**
- [ ] 대행사 반려 (자동 재생성 루프) → 예약 유지
- [ ] REGEN_QUEUED → GENERATING → … (최종 승인 시점에만 capture)

---

### 6. 취소/실패 → RELEASE (예약 해제) 확인

**확인 항목:**
- [ ] 산출 실패 (FAILED), 어드민/대행사 취소 (아래 v3.3) → RELEASE (예약 해제)
- [ ] 상태: CANCELED 또는 FAILED로 종료

**확인 방법:**
1. 취소/실패 확인:
   - [ ] 산출 실패 → 주문 상태: `FAILED` 확인
   - [ ] 어드민/대행사 취소 → 주문 상태: `CANCELED` 확인
2. 예약 해제 확인:
   - [ ] 지갑 `reserved` 감소 확인
   - [ ] 거래 원장에 RELEASE 레코드 추가 확인

**확인 체크리스트:**
- [ ] 산출 실패 (FAILED), 어드민/대행사 취소 (아래 v3.3) → RELEASE (예약 해제)
- [ ] 상태: CANCELED 또는 FAILED로 종료

---

### 7. 지갑 화면 동기화 확인

**확인 항목:**
- [ ] 예약/차감/해제 시 /agency/wallet의 balance/reserved/available 즉시 반영
- [ ] 원장에는 각각 RESERVE / CAPTURE / RELEASE 레코드 추가 (참조=주문ID)

**확인 방법:**
1. 지갑 화면 동기화 확인:
   - [ ] 예약 시 `/agency/wallet`의 `balance/reserved/available` 즉시 반영 확인
   - [ ] 차감 시 `/agency/wallet`의 `balance/reserved/available` 즉시 반영 확인
   - [ ] 해제 시 `/agency/wallet`의 `balance/reserved/available` 즉시 반영 확인
2. 원장 확인:
   - [ ] RESERVE 레코드 추가 확인 (참조=주문ID)
   - [ ] CAPTURE 레코드 추가 확인 (참조=주문ID)
   - [ ] RELEASE 레코드 추가 확인 (참조=주문ID)

**확인 체크리스트:**
- [ ] 예약/차감/해제 시 /agency/wallet의 balance/reserved/available 즉시 반영
- [ ] 원장에는 각각 RESERVE / CAPTURE / RELEASE 레코드 추가 (참조=주문ID)

---

## v3.3 "대행사 작성 중단(취소)" 설계

### A. 허용 상태 (안전 구간)

### 📋 실행 단계

### 1. SUBMITTED/ADMIN_INTAKE 확인

**확인 항목:**
- [ ] SUBMITTED (대행사 제출 후, 아직 산출 시작 전)
- [ ] ADMIN_INTAKE (어드민 접수 대기 중)
- [ ] 즉시 취소 허용: status → CANCELED
- [ ] 예약이 있었다면 RELEASE 처리 (보통 없음)

**확인 방법:**
1. 허용 상태 확인:
   - [ ] 주문 상태: `SUBMITTED` 확인
   - [ ] 주문 상태: `ADMIN_INTAKE` 확인
2. 즉시 취소 확인:
   - [ ] "작성 중단" 버튼 활성 확인
   - [ ] 취소 버튼 클릭 → 주문 상태: `CANCELED` 확인
   - [ ] 예약이 있었다면 RELEASE 처리 확인

**확인 체크리스트:**
- [ ] SUBMITTED (대행사 제출 후, 아직 산출 시작 전)
- [ ] ADMIN_INTAKE (어드민 접수 대기 중)
- [ ] 즉시 취소 허용: status → CANCELED
- [ ] 예약이 있었다면 RELEASE 처리 (보통 없음)

---

### B. 상태별 처리

### 📋 실행 단계

### 1. 이미 산출 시작 (GENERATING/REGEN_QUEUED 등) 확인

**확인 항목:**
- [ ] 대행사는 **"취소 요청"**만 가능 → CANCEL_REQUESTED
- [ ] 실제 취소/해제는 어드민이 승인해야 함 (워커 중단/예약 해제 포함)

**확인 방법:**
1. 산출 시작 확인:
   - [ ] 주문 상태: `GENERATING` 확인
   - [ ] 주문 상태: `REGEN_QUEUED` 확인
2. 취소 요청 확인:
   - [ ] "취소 요청" 버튼 활성 확인
   - [ ] 취소 요청 버튼 클릭 → 주문 상태: `CANCEL_REQUESTED` 확인
   - [ ] 어드민 승인 필요 확인

**확인 체크리스트:**
- [ ] 대행사는 **"취소 요청"**만 가능 → CANCEL_REQUESTED
- [ ] 실제 취소/해제는 어드민이 승인해야 함 (워커 중단/예약 해제 포함)

---

### 2. AGENCY_REVIEW 이후 확인

**확인 항목:**
- [ ] 이미 비용이 예약된 상태이므로 취소 불가 (반려로 루프)
- [ ] 완전히 중단하려면 어드민에게 취소 요청 전환 (정책에 따라 수수료/패널티 별도)

**확인 방법:**
1. AGENCY_REVIEW 이후 확인:
   - [ ] 주문 상태: `AGENCY_REVIEW` 확인
   - [ ] 취소 버튼 비활성 확인
2. 취소 불가 확인:
   - [ ] "현재 단계에서는 작성 중단이 불가합니다." 토스트 확인
   - [ ] 어드민에게 취소 요청 전환 안내 확인

**확인 체크리스트:**
- [ ] 이미 비용이 예약된 상태이므로 취소 불가 (반려로 루프)
- [ ] 완전히 중단하려면 어드민에게 취소 요청 전환 (정책에 따라 수수료/패널티 별도)

---

### C. UI/UX 규칙 (대행사)

### 📋 실행 단계

### 1. "작성 중단" 버튼 확인

**확인 항목:**
- [ ] "작성 중단" 버튼 (허용 상태에서만 활성) → 사유 입력 (필수) → 확인 모달

**확인 방법:**
1. 버튼 확인:
   - [ ] 허용 상태에서만 "작성 중단" 버튼 활성 확인
   - [ ] 비허용 상태에서 버튼 비활성 확인
2. 사유 입력 확인:
   - [ ] 사유 입력 필드 필수 확인
   - [ ] 확인 모달 표시 확인

**확인 체크리스트:**
- [ ] "작성 중단" 버튼 (허용 상태에서만 활성) → 사유 입력 (필수) → 확인 모달

---

### 2. 성공 시 처리 확인

**확인 항목:**
- [ ] 성공 시: CANCELED 라벨, 리스트에서 제거/히스토리 이동, top-center 토스트

**확인 방법:**
1. 성공 처리 확인:
   - [ ] 주문 상태: `CANCELED` 라벨 표시 확인
   - [ ] 리스트에서 제거/히스토리 이동 확인
   - [ ] top-center 토스트: 서버 메시지 원문 표시 확인

**확인 체크리스트:**
- [ ] 성공 시: CANCELED 라벨, 리스트에서 제거/히스토리 이동, top-center 토스트

---

### 3. 허용 안 되는 상태 클릭 시 확인

**확인 항목:**
- [ ] 허용 안 되는 상태 클릭 시: "현재 단계에서는 작성 중단이 불가합니다." 토스트

**확인 방법:**
1. 비허용 상태 클릭 확인:
   - [ ] 비허용 상태에서 "작성 중단" 버튼 클릭
   - [ ] top-center 토스트: "현재 단계에서는 작성 중단이 불가합니다." 확인

**확인 체크리스트:**
- [ ] 허용 안 되는 상태 클릭 시: "현재 단계에서는 작성 중단이 불가합니다." 토스트

---

### 합격 기준 (체크)

### ✅ 종합 검증

**1. SUBMITTED/ADMIN_INTAKE에서 즉시 취소 가능**
- [ ] SUBMITTED/ADMIN_INTAKE에서 즉시 취소 가능 확인
- [ ] 원장에 기록 (필요 시 RELEASE) 확인

**2. GENERATING 이후에는 취소 요청만 가능**
- [ ] GENERATING 이후에는 취소 요청만 가능 (CANCEL_REQUESTED) 확인
- [ ] 어드민 승인 후 최종 취소 확인

**3. 취소/요청 후 리스트/통계/지갑 카드 값이 즉시 갱신**
- [ ] 취소/요청 후 리스트 갱신 확인
- [ ] 통계 갱신 확인
- [ ] 지갑 카드 값 갱신 확인

**4. 모든 알림은 top-center로 서버 메시지 원문**
- [ ] 모든 알림은 top-center로 서버 메시지 원문 표시 확인

---

## 📊 종합 검증 체크리스트

### ✅ v3.1.2 "충전하기 제출 실패" 트리아지 & 핫픽스
1. [ ] DevTools Network로 정확한 실패 유형 캡처 (Status, Response Body.message, Headers, Payload, Timing)
2. [ ] 가장 흔한 6가지 원인 점검 (금액 범위/형식 위반, Idempotency 우회, 권한/토큰 문제, 429, CORS, 서버 500)
3. [ ] 프런트 제출 규칙 확인 (버튼 클릭 시, 성공 응답 처리, 취소 처리)
4. [ ] 합격 기준 확인 (POST /agency/topups 2xx + 성공 토스트, 요청 목록에 PENDING 1건 즉시 보임, CSV/원장에 TOPUP_REQUEST 1줄 추가, 429/400/409/401/403/500 시 서버 메시지가 top-center로 정확히 표기)

### ✅ v3.2 "지갑 ↔ 원고 플로우 연동" (예약/차감/해제 규칙)
1. [ ] 금액 규칙 확인 (UNIT_PRICE_PER_ORDER, submitCount 1~5)
2. [ ] 연동 시퀀스 확인 (어드민 '산출' 버튼 → RESERVE, 자동 생성 완료 → ADMIN_REVIEW, 어드민 PASS → AGENCY_REVIEW, 대행사 승인 → CAPTURE, 대행사 반려 → 예약 유지, 취소/실패 → RELEASE)
3. [ ] 지갑 화면 동기화 확인 (예약/차감/해제 시 /agency/wallet의 balance/reserved/available 즉시 반영, 원장에는 각각 RESERVE / CAPTURE / RELEASE 레코드 추가)

### ✅ v3.3 "대행사 작성 중단(취소)" 설계
1. [ ] 허용 상태 확인 (SUBMITTED/ADMIN_INTAKE에서 즉시 취소 허용)
2. [ ] 상태별 처리 확인 (이미 산출 시작 → 취소 요청만 가능, AGENCY_REVIEW 이후 → 취소 불가)
3. [ ] UI/UX 규칙 확인 ("작성 중단" 버튼, 성공 시 처리, 허용 안 되는 상태 클릭 시)
4. [ ] 합격 기준 확인 (SUBMITTED/ADMIN_INTAKE에서 즉시 취소 가능, GENERATING 이후에는 취소 요청만 가능, 취소/요청 후 리스트/통계/지갑 카드 값이 즉시 갱신, 모든 알림은 top-center로 서버 메시지 원문)

---

## 🔧 트리아지 리포트 템플릿

### 충전하기 제출 실패 리포트 작성 시:

```
## 충전하기 제출 실패 리포트

### 1. DevTools Network로 정확한 실패 유형 캡처
- Status: [ ] 400 [ ] 401 [ ] 403 [ ] 409 [ ] 429 [ ] 500
- Response Body.message: [서버가 반환한 한 줄 원인]
- Headers: [ ] Authorization [ ] Content-Type: application/json [ ] Idempotency-Key 존재
- Payload: [ ] amount 정수 (원), 10,000~5,000,000
- Timing: [ ] preflight 실패 여부 (OPTIONS 2xx 여부)

### 2. 가장 흔한 6가지 원인 점검
- 금액 범위/형식 위반: [ ] 천단위 쉼표 제거 후 정수 (원)로 전달 [ ] 최소 10,000 / 최대 5,000,000
- Idempotency 우회: [ ] 서버가 "동일 사용자/금액/메모의 PENDING 요청이 이미 있으면 재사용" 정책 [ ] UI는 "기존 PENDING 요청 복원"으로 처리
- 권한/토큰 문제: [ ] Authorization 헤더 누락/만료. 재로그인
- 429 (속도 제한): [ ] 분당 5회 제한. 429 수신 시 3초 버튼 잠금 + 안내 토스트
- (failed) preflight → CORS: [ ] OPTIONS /agency/topups 가 2xx가 아닌지 확인 [ ] Allowed headers: Authorization, Content-Type, Idempotency-Key 포함
- 서버 500: [ ] 로그로 원인 확인 (엔티티/트랜잭션/DB 제약). 응답 메시지 원문을 토스트로 표기

### 3. 프런트 제출 규칙
- 버튼 클릭 시: [ ] 로딩/disabled + Idempotency-Key 부여 (UUID 1회성)
- 성공 응답: [ ] 지갑 카드, 충전 요청 목록, 거래 원장 동시 재조회 [ ] top-center 토스트: 서버 메시지 원문
- 취소: [ ] PENDING만 허용: POST /agency/topups/:id/cancel → 성공 시 상태 CANCELED 반영

### 4. 원인 추정
1순위: [ ] 금액 범위/형식 위반
2순위: [ ] 권한/토큰 문제
3순위: [ ] 서버 500

### 5. 조치
- [ ] 금액 범위/형식 위반 확인/수정
- [ ] Idempotency 우회 로직 확인/수정
- [ ] 권한/토큰 문제 확인/수정
- [ ] 429 속도 제한 확인/수정
- [ ] CORS 확인/수정
- [ ] 서버 500 확인/수정
```





