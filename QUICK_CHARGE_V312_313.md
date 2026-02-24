# 대행사 충전 관리 v3.1.2, v3.2, v3.3 - 빠른 참조

## 🚨 즉시 확인 (5분)

### v3.1.2 "충전하기 제출 실패" 트리아지 & 핫픽스

#### A. DevTools Network로 정확한 실패 유형 캡처
1. [ ] Status (400/401/403/409/429/500 중 무엇?)
2. [ ] Response Body.message (서버가 반환한 한 줄 원인)
3. [ ] Headers: Authorization, Content-Type: application/json, Idempotency-Key 존재
4. [ ] Payload: { amount: number, method?: 'REQUEST', memo? } – amount 정수 (원), 10,000~5,000,000
5. [ ] Timing: preflight 실패 여부 (OPTIONS 2xx 여부)

#### B. 가장 흔한 6가지 원인
1. [ ] 금액 범위/형식 위반 → 400 (천단위 쉼표 제거 후 정수 (원)로 전달, 최소 10,000 / 최대 5,000,000)
2. [ ] Idempotency 우회 로직에 걸림 → 200인데 새 요청이 안 생기는 듯 보이는 케이스
3. [ ] 권한/토큰 문제 → 401/403 (Authorization 헤더 누락/만료. 재로그인)
4. [ ] 429 (속도 제한) (분당 5회 제한. 429 수신 시 3초 버튼 잠금 + 안내 토스트)
5. [ ] (failed) preflight → CORS (OPTIONS /agency/topups 가 2xx가 아닌지 확인, Allowed headers: Authorization, Content-Type, Idempotency-Key 포함)
6. [ ] 서버 500 (로그로 원인 확인 (엔티티/트랜잭션/DB 제약). 응답 메시지 원문을 토스트로 표기)

#### C. 프런트 제출 규칙
1. [ ] 버튼 클릭 시: 로딩/disabled + Idempotency-Key 부여 (UUID 1회성)
2. [ ] 성공 응답 (새로 생성 또는 기존 PENDING 재사용) 시: 지갑 카드, 충전 요청 목록, 거래 원장 동시 재조회, top-center 토스트: 서버 메시지 원문
3. [ ] 취소는 PENDING만 허용: POST /agency/topups/:id/cancel → 성공 시 상태 CANCELED 반영

#### 합격 기준
1. [ ] POST /agency/topups 2xx + 성공 토스트
2. [ ] 요청 목록에 PENDING 1건 즉시 보임 (기존 PENDING이면 동일 건 표시)
3. [ ] CSV/원장에 TOPUP_REQUEST 1줄 추가
4. [ ] 429/400/409/401/403/500 시 서버 메시지가 top-center로 정확히 표기

---

### v3.2 "지갑 ↔ 원고 플로우 연동" (예약/차감/해제 규칙)

#### A. 금액 규칙
1. [ ] UNIT_PRICE_PER_ORDER (환경변수) = 1건당 과금액 (원)
2. [ ] submitCount가 1~5이면 예약/차감도 그 수량만큼

#### B. 연동 시퀀스
1. [ ] 어드민 '산출' 버튼 → RESERVE (Billing.reserve(orderId, amount = UNIT_PRICE * 주문수량), 성공 → 주문 reservedAmount, reservedAt 기록 → status=GENERATING, 실패 (잔액 부족) → 산출 불가)
2. [ ] 자동 생성 완료 → status=GENERATED → ADMIN_REVIEW (예약은 유지 (금액 변동 없음))
3. [ ] 어드민 PASS → status=AGENCY_REVIEW (예약 유지)
4. [ ] 대행사 승인 (통과) → CAPTURE (예약분 차감 확정 (balance↓, reserved↓, spentTotal↑), status=COMPLETE / completedAt 기록)
5. [ ] 대행사 반려 (자동 재생성 루프) → 예약 유지 (REGEN_QUEUED → GENERATING → … (최종 승인 시점에만 capture))
6. [ ] 취소/실패 → RELEASE (예약 해제) (산출 실패 (FAILED), 어드민/대행사 취소 → RELEASE (예약 해제), 상태: CANCELED 또는 FAILED로 종료)
7. [ ] 지갑 화면 동기화 (예약/차감/해제 시 /agency/wallet의 balance/reserved/available 즉시 반영, 원장에는 각각 RESERVE / CAPTURE / RELEASE 레코드 추가 (참조=주문ID))

---

### v3.3 "대행사 작성 중단(취소)" 설계

#### A. 허용 상태 (안전 구간)
1. [ ] SUBMITTED (대행사 제출 후, 아직 산출 시작 전)
2. [ ] ADMIN_INTAKE (어드민 접수 대기 중) → 즉시 취소 허용: status → CANCELED, 예약이 있었다면 RELEASE 처리 (보통 없음)

#### B. 상태별 처리
1. [ ] 이미 산출 시작 (GENERATING/REGEN_QUEUED 등) → 대행사는 **"취소 요청"**만 가능 → CANCEL_REQUESTED, 실제 취소/해제는 어드민이 승인해야 함 (워커 중단/예약 해제 포함)
2. [ ] AGENCY_REVIEW 이후 → 이미 비용이 예약된 상태이므로 취소 불가 (반려로 루프), 완전히 중단하려면 어드민에게 취소 요청 전환 (정책에 따라 수수료/패널티 별도)

#### C. UI/UX 규칙 (대행사)
1. [ ] "작성 중단" 버튼 (허용 상태에서만 활성) → 사유 입력 (필수) → 확인 모달
2. [ ] 성공 시: CANCELED 라벨, 리스트에서 제거/히스토리 이동, top-center 토스트
3. [ ] 허용 안 되는 상태 클릭 시: "현재 단계에서는 작성 중단이 불가합니다." 토스트

#### 합격 기준
1. [ ] SUBMITTED/ADMIN_INTAKE에서 즉시 취소 가능, 원장에 기록 (필요 시 RELEASE)
2. [ ] GENERATING 이후에는 취소 요청만 가능 (CANCEL_REQUESTED), 어드민 승인 후 최종 취소
3. [ ] 취소/요청 후 리스트/통계/지갑 카드 값이 즉시 갱신
4. [ ] 모든 알림은 top-center로 서버 메시지 원문

---

## ✅ 합격 기준 요약

### v3.1.2
1. [ ] POST /agency/topups 2xx + 성공 토스트
2. [ ] 요청 목록에 PENDING 1건 즉시 보임 (기존 PENDING이면 동일 건 표시)
3. [ ] CSV/원장에 TOPUP_REQUEST 1줄 추가
4. [ ] 429/400/409/401/403/500 시 서버 메시지가 top-center로 정확히 표기

### v3.2
1. [ ] 어드민 '산출' 버튼 → RESERVE (성공 → 주문 reservedAmount, reservedAt 기록 → status=GENERATING, 실패 (잔액 부족) → 산출 불가)
2. [ ] 대행사 승인 (통과) → CAPTURE (예약분 차감 확정 (balance↓, reserved↓, spentTotal↑), status=COMPLETE / completedAt 기록)
3. [ ] 취소/실패 → RELEASE (예약 해제) (산출 실패 (FAILED), 어드민/대행사 취소 → RELEASE (예약 해제))
4. [ ] 지갑 화면 동기화 (예약/차감/해제 시 /agency/wallet의 balance/reserved/available 즉시 반영, 원장에는 각각 RESERVE / CAPTURE / RELEASE 레코드 추가 (참조=주문ID))

### v3.3
1. [ ] SUBMITTED/ADMIN_INTAKE에서 즉시 취소 가능, 원장에 기록 (필요 시 RELEASE)
2. [ ] GENERATING 이후에는 취소 요청만 가능 (CANCEL_REQUESTED), 어드민 승인 후 최종 취소
3. [ ] 취소/요청 후 리스트/통계/지갑 카드 값이 즉시 갱신
4. [ ] 모든 알림은 top-center로 서버 메시지 원문

---

## 🔧 조치 요약

### v3.1.2 "충전하기 제출 실패" 트리아지 & 핫픽스
- DevTools Network로 정확한 실패 유형 캡처 (Status, Response Body.message, Headers, Payload, Timing)
- 가장 흔한 6가지 원인 점검 (금액 범위/형식 위반, Idempotency 우회, 권한/토큰 문제, 429, CORS, 서버 500)
- 프런트 제출 규칙 확인 (버튼 클릭 시, 성공 응답 처리, 취소 처리)

### v3.2 "지갑 ↔ 원고 플로우 연동" (예약/차감/해제 규칙)
- 금액 규칙 확인 (UNIT_PRICE_PER_ORDER, submitCount 1~5)
- 연동 시퀀스 확인 (어드민 '산출' 버튼 → RESERVE, 자동 생성 완료 → ADMIN_REVIEW, 어드민 PASS → AGENCY_REVIEW, 대행사 승인 → CAPTURE, 대행사 반려 → 예약 유지, 취소/실패 → RELEASE)
- 지갑 화면 동기화 확인 (예약/차감/해제 시 /agency/wallet의 balance/reserved/available 즉시 반영, 원장에는 각각 RESERVE / CAPTURE / RELEASE 레코드 추가)

### v3.3 "대행사 작성 중단(취소)" 설계
- 허용 상태 확인 (SUBMITTED/ADMIN_INTAKE에서 즉시 취소 허용)
- 상태별 처리 확인 (이미 산출 시작 → 취소 요청만 가능, AGENCY_REVIEW 이후 → 취소 불가)
- UI/UX 규칙 확인 ("작성 중단" 버튼, 성공 시 처리, 허용 안 되는 상태 클릭 시)

---

## 🎯 주요 포인트

### v3.1.2
- DevTools Network로 정확한 실패 유형 캡처 필수
- 가장 흔한 6가지 원인 즉시 점검
- 프런트 제출 규칙 확정 (버튼 클릭 시, 성공 응답 처리, 취소 처리)

### v3.2
- 요금 시점: "원고 완료(대행사 승인) 시 차감"이 맞다
- 산출 직전 '예약(홀드)'을 걸어 잔액 부족 사전 차단까지 함께 운영
- 연동 시퀀스: 상태 전이와 1:1 대응

### v3.3
- 목적: 대행사가 잘못 접수했을 때 "작성 중" 단계에서 스스로 취소 가능하게
- 허용 상태: SUBMITTED/ADMIN_INTAKE에서 즉시 취소 허용
- 상태별 처리: 이미 산출 시작 → 취소 요청만 가능, AGENCY_REVIEW 이후 → 취소 불가





