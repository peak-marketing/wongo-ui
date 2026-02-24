# 대행사 충전 관리 v3.1.3, v3.3, v3.2 최종 - 빠른 참조

## 🚨 즉시 확인 (5분)

### A. v3.1.3 "충전 관리" 한글화 + 요청자 표시

#### A-1. 라벨 매핑
1. [ ] 충전요청 상태: PENDING → 승인 대기, APPROVED → 승인 완료, REJECTED → 반려, CANCELED → 취소, EXPIRED → 만료
2. [ ] 거래유형: TOPUP_REQUEST → 충전 요청, TOPUP_APPROVED → 충전 승인, RESERVE → 예약, CAPTURE → 사용(차감), RELEASE → 예약 해제, ADJUST → 조정, REFUND → 환불
3. [ ] 거래 상태 컬럼: 트랜잭션에 별도 status가 없으면 "-" 표시

#### A-2. "요청ID" → "요청자(로그인 ID)"
1. [ ] API 응답에 requesterEmail 포함 (/agency/topups GET/POST/GET by id)
2. [ ] 프런트 컬럼명: "요청자(로그인 ID)", 값: requesterEmail 표시
3. [ ] 내부 UUID는 툴팁/복사 아이콘으로만 접근
4. [ ] CSV 내보내기도 동일 라벨·필드로 한글화

#### A-3. 금액/토스트 표준
1. [ ] 금액 포맷: 1,234원 (소수점 X, 음수는 -1,000원)
2. [ ] 모든 알림: top-center, 서버 원문 메시지 그대로

#### A-4. 검증 (합격 기준)
1. [ ] 충전 요청/거래 내역의 상태·유형·버튼·CSV가 모두 한글
2. [ ] "요청자(로그인 ID)"에 현재 로그인 이메일이 표시된다
3. [ ] 기존 UUID는 표면에 보이지 않고 복사 아이콘(툴팁)로만 접근

---

### B. v3.3 "대행사 작성 중단(취소)" 기능

#### B-1. 버튼 노출 규칙 (드로어 상세 패널)
1. [ ] 즉시 취소 가능 (빨간 버튼 "작성 중단"): SUBMITTED, ADMIN_INTAKE
2. [ ] 취소 요청만 가능 (회색 테두리 버튼 "작성 중단 요청"): GENERATING, REGEN_QUEUED
3. [ ] 비활성/미노출: AGENCY_REVIEW, COMPLETE, FAILED, CANCELED

#### B-2. 동작 규칙
1. [ ] 작성 중단 (즉시 취소): 사유 입력 (필수) → 확인 모달 → POST /agency/orders/:id/cancel, 성공 시: status = CANCELED, 예약 존재 시 RELEASE, 리스트/상단 카드/지갑 카드 즉시 재조회, 성공 토스트
2. [ ] 작성 중단 요청: 사유 입력 (필수) → 확인 모달 → POST /agency/orders/:id/cancel-request, 성공 시: status = CANCEL_REQUESTED, 드로어에 "취소 요청됨" 배지 표시, 성공 토스트

#### B-3. UI/UX 세부
1. [ ] 버튼은 드로어 푸터 좌측 고정 (통과/반려와 시각적으로 분리)
2. [ ] 사유 입력 10~300자, 비우면 제출 불가
3. [ ] 409 (CONFLICT) 수신 시 드로어 강제 재조회 + "상태가 변경되었습니다…" 토스트

#### B-4. API 계약
1. [ ] POST /agency/orders/:id/cancel (허용 상태: SUBMITTED, ADMIN_INTAKE, Body: { reason: string }, 처리: CANCELED + (있다면) RELEASE + 감사 로그)
2. [ ] POST /agency/orders/:id/cancel-request (허용 상태: GENERATING, REGEN_QUEUED, Body: { reason: string }, 처리: CANCEL_REQUESTED + 감사 로그)
3. [ ] 모든 요청에 Idempotency-Key 허용 (중복 클릭 방지)

#### B-5. 검증 (합격 기준)
1. [ ] SUBMITTED/ADMIN_INTAKE에서 작성 중단이 즉시 완료되고 리스트에서 사라짐
2. [ ] GENERATING/REGEN_QUEUED에서 작성 중단 요청으로 상태가 바뀌고 배지 표시
3. [ ] 예약되어 있던 건을 즉시 취소하면 지갑 reserved↓가 반영됨
4. [ ] 모든 알림은 top-center, 서버 원문 메시지

---

### C. v3.2 지갑 ↔ 원고 연동 (확정 규칙)

#### C-1. 금액 계산
1. [ ] UNIT_PRICE_PER_ORDER (env) × submitCount (1~5) = 주문 단가
2. [ ] 주문 엔티티에 unitPrice, submitCount, reservedAmount 스냅샷 보관

#### C-2. 이벤트 훅 (요약)
1. [ ] 어드민 산출 시작 → RESERVE (amount)
2. [ ] 대행사 승인 (APPROVE) → CAPTURE (amount)
3. [ ] 즉시 취소 (CANCELED) / 산출 실패 (FAILED) → RELEASE (amount)
4. [ ] 반려→재생성 루프에서는 예약 유지, 최종 승인 때만 capture

#### C-3. 검증 (합격 기준)
1. [ ] 산출 시 reserved가 증가, 승인 시 balance↓ / reserved↓ / spentTotal↑
2. [ ] 즉시 취소/실패 시 reserved↓
3. [ ] 거래 원장에 RESERVE / CAPTURE / RELEASE가 참조(주문ID)와 함께 기록

---

## ✅ 실행 전 체크리스트

1. [ ] /agency/topups 응답에 requesterEmail 포함 (서버)
2. [ ] 프런트 라벨 포맷터 (상태/유형) 적용, CSV도 한글화
3. [ ] 드로어에 "작성 중단/작성 중단 요청" 버튼 노출 규칙 연결
4. [ ] 두 취소 엔드포인트에 사유·Idempotency-Key 처리
5. [ ] 지갑 이벤트 훅 (RESERVE/CAPTURE/RELEASE) 로그로 검증

---

## 🔧 조치 요약

### v3.1.3 "충전 관리" 한글화 + 요청자 표시
- 라벨 매핑 (충전요청 상태, 거래유형, 거래 상태 컬럼)
- "요청ID" → "요청자(로그인 ID)" (API 응답에 requesterEmail 포함, 프런트 컬럼명 및 값 표시, CSV 내보내기 한글화)
- 금액/토스트 표준 (금액 포맷, 알림 표준)

### v3.3 "대행사 작성 중단(취소)" 기능
- 버튼 노출 규칙 (즉시 취소 가능, 취소 요청만 가능, 비활성/미노출)
- 동작 규칙 (작성 중단, 작성 중단 요청)
- UI/UX 세부 (버튼 위치, 사유 입력, 409 처리)
- API 계약 (POST /agency/orders/:id/cancel, POST /agency/orders/:id/cancel-request, Idempotency-Key)

### v3.2 지갑 ↔ 원고 연동 (확정 규칙)
- 금액 계산 (UNIT_PRICE_PER_ORDER, 주문 엔티티 스냅샷 보관)
- 이벤트 훅 (어드민 산출 시작 → RESERVE, 대행사 승인 → CAPTURE, 즉시 취소/산출 실패 → RELEASE, 반려→재생성 루프)

---

## 🎯 주요 포인트

### v3.1.3
- 목표: 충전/거래 UI 전면 한글화, "요청ID" 컬럼을 로그인 ID(이메일)로 표시
- 라벨 매핑: 프런트 표시만 변경, API 값은 그대로 유지
- 금액 포맷: 1,234원 (소수점 X, 음수는 -1,000원)
- 모든 알림: top-center, 서버 원문 메시지 그대로

### v3.3
- 목표: 대행사가 "작성 중" 단계에서 즉시 취소 또는 취소 요청을 할 수 있게
- 버튼 노출 규칙: 즉시 취소 가능 (SUBMITTED, ADMIN_INTAKE), 취소 요청만 가능 (GENERATING, REGEN_QUEUED)
- 동작 규칙: 작성 중단 (즉시 취소), 작성 중단 요청
- API 계약: POST /agency/orders/:id/cancel, POST /agency/orders/:id/cancel-request

### v3.2
- 원칙: 완료(승인) 시 차감 / 산출 시작 시 예약 / 취소·실패 시 해제
- 금액 계산: UNIT_PRICE_PER_ORDER (env) × submitCount (1~5) = 주문 단가
- 이벤트 훅: 어드민 산출 시작 → RESERVE, 대행사 승인 → CAPTURE, 즉시 취소/산출 실패 → RELEASE

---

## 📋 API 엔드포인트 요약

### 충전 관리
- `GET /agency/topups` → 응답에 `requesterEmail` 포함
- `POST /agency/topups` → 응답에 `requesterEmail` 포함
- `GET /agency/topups/:id` → 응답에 `requesterEmail` 포함

### 작성 중단 (취소)
- `POST /agency/orders/:id/cancel` (허용 상태: SUBMITTED, ADMIN_INTAKE, Body: { reason: string })
- `POST /agency/orders/:id/cancel-request` (허용 상태: GENERATING, REGEN_QUEUED, Body: { reason: string })

### 지갑 이벤트 훅
- `RESERVE (amount)` → 어드민 산출 시작
- `CAPTURE (amount)` → 대행사 승인 (APPROVE)
- `RELEASE (amount)` → 즉시 취소 (CANCELED) / 산출 실패 (FAILED)





