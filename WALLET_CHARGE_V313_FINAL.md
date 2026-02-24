# 대행사 충전 관리 v3.1.3, v3.3, v3.2 최종 체크리스트

## 🎯 목표
- v3.1.3: 충전 관리 한글화 + 요청자 표시
- v3.3: 대행사 작성 중단(취소) 기능
- v3.2: 지갑 ↔ 원고 연동 (확정 규칙)

---

## A. v3.1.3 "충전 관리" 한글화 + 요청자 표시

### A-1. 라벨 매핑 (프런트 표시만 변경, API 값은 그대로 유지)

### 📋 실행 단계

### 1. 충전요청 상태 (TopupRequest.status → 한글) 확인

**확인 항목:**
- [ ] PENDING → 승인 대기
- [ ] APPROVED → 승인 완료
- [ ] REJECTED → 반려
- [ ] CANCELED → 취소
- [ ] EXPIRED → 만료

**확인 방법:**
1. 충전 요청 목록 확인:
   - [ ] PENDING 상태 → "승인 대기" 표시 확인
   - [ ] APPROVED 상태 → "승인 완료" 표시 확인
   - [ ] REJECTED 상태 → "반려" 표시 확인
   - [ ] CANCELED 상태 → "취소" 표시 확인
   - [ ] EXPIRED 상태 → "만료" 표시 확인
2. API 값 확인:
   - [ ] API 응답의 status 값은 영문 그대로 유지 확인
   - [ ] 프런트에서만 한글 라벨로 변환 확인

**확인 체크리스트:**
- [ ] PENDING → 승인 대기
- [ ] APPROVED → 승인 완료
- [ ] REJECTED → 반려
- [ ] CANCELED → 취소
- [ ] EXPIRED → 만료

---

### 2. 거래유형 (Transaction.type → 한글) 확인

**확인 항목:**
- [ ] TOPUP_REQUEST → 충전 요청
- [ ] TOPUP_APPROVED → 충전 승인
- [ ] RESERVE → 예약
- [ ] CAPTURE → 사용(차감)
- [ ] RELEASE → 예약 해제
- [ ] ADJUST → 조정
- [ ] REFUND → 환불

**확인 방법:**
1. 거래 내역 확인:
   - [ ] TOPUP_REQUEST → "충전 요청" 표시 확인
   - [ ] TOPUP_APPROVED → "충전 승인" 표시 확인
   - [ ] RESERVE → "예약" 표시 확인
   - [ ] CAPTURE → "사용(차감)" 표시 확인
   - [ ] RELEASE → "예약 해제" 표시 확인
   - [ ] ADJUST → "조정" 표시 확인
   - [ ] REFUND → "환불" 표시 확인
2. API 값 확인:
   - [ ] API 응답의 type 값은 영문 그대로 유지 확인
   - [ ] 프런트에서만 한글 라벨로 변환 확인

**확인 체크리스트:**
- [ ] TOPUP_REQUEST → 충전 요청
- [ ] TOPUP_APPROVED → 충전 승인
- [ ] RESERVE → 예약
- [ ] CAPTURE → 사용(차감)
- [ ] RELEASE → 예약 해제
- [ ] ADJUST → 조정
- [ ] REFUND → 환불

---

### 3. 거래 상태 컬럼 확인

**확인 항목:**
- [ ] 거래 상태 컬럼: 트랜잭션에 별도 status가 없으면 "-" 표시 (충전 요청 목록에서만 상태 노출)

**확인 방법:**
1. 거래 내역 확인:
   - [ ] 트랜잭션에 status가 없으면 "-" 표시 확인
   - [ ] 충전 요청 목록에서만 상태 노출 확인

**확인 체크리스트:**
- [ ] 거래 상태 컬럼: 트랜잭션에 별도 status가 없으면 "-" 표시 (충전 요청 목록에서만 상태 노출)

---

### A-2. "요청ID" → "요청자(로그인 ID)" 확인

### 📋 실행 단계

### 1. API 응답에 requesterEmail 포함 확인

**확인 항목:**
- [ ] API 응답에 requesterEmail 포함되도록 /agency/topups (GET/POST/GET by id) 응답에 JWT의 email을 매핑해서 내려주기

**확인 방법:**
1. API 응답 확인:
   - [ ] `GET /agency/topups` 응답에 `requesterEmail` 포함 확인
   - [ ] `POST /agency/topups` 응답에 `requesterEmail` 포함 확인
   - [ ] `GET /agency/topups/:id` 응답에 `requesterEmail` 포함 확인
2. JWT 확인:
   - [ ] JWT의 email을 매핑해서 내려주는지 확인

**확인 체크리스트:**
- [ ] API 응답에 requesterEmail 포함되도록 /agency/topups (GET/POST/GET by id) 응답에 JWT의 email을 매핑해서 내려주기

---

### 2. 프런트 컬럼명 및 값 표시 확인

**확인 항목:**
- [ ] 프런트 컬럼명은 "요청자(로그인 ID)"로 변경하고 값은 requesterEmail 표시
- [ ] 내부 UUID는 필요시 툴팁/복사 아이콘으로 숨김 제공 (표면에는 노출하지 않음)

**확인 방법:**
1. 컬럼명 확인:
   - [ ] 컬럼명: "요청자(로그인 ID)" 확인
   - [ ] 값: `requesterEmail` 표시 확인
2. UUID 확인:
   - [ ] 내부 UUID는 표면에 노출하지 않음 확인
   - [ ] 툴팁/복사 아이콘으로만 접근 가능 확인

**확인 체크리스트:**
- [ ] 프런트 컬럼명은 "요청자(로그인 ID)"로 변경하고 값은 requesterEmail 표시
- [ ] 내부 UUID는 필요시 툴팁/복사 아이콘으로 숨김 제공 (표면에는 노출하지 않음)

---

### 3. CSV 내보내기 한글화 확인

**확인 항목:**
- [ ] CSV 내보내기도 동일 라벨·필드로 한글화

**확인 방법:**
1. CSV 내보내기 확인:
   - [ ] CSV 내보내기 버튼 클릭
   - [ ] CSV 파일 다운로드 확인
   - [ ] 컬럼명: "요청자(로그인 ID)" 확인
   - [ ] 값: `requesterEmail` 확인
   - [ ] 상태/유형 한글 라벨 확인

**확인 체크리스트:**
- [ ] CSV 내보내기도 동일 라벨·필드로 한글화

---

### A-3. 금액/토스트 표준 확인

### 📋 실행 단계

### 1. 금액 포맷 확인

**확인 항목:**
- [ ] 금액 포맷: 1,234원 (소수점 X, 음수는 -1,000원)

**확인 방법:**
1. 금액 표시 확인:
   - [ ] 양수: 1,234원 (소수점 없음)
   - [ ] 음수: -1,000원
   - [ ] 천단위 구분 확인

**확인 체크리스트:**
- [ ] 금액 포맷: 1,234원 (소수점 X, 음수는 -1,000원)

---

### 2. 알림 표준 확인

**확인 항목:**
- [ ] 모든 알림: top-center, 서버 원문 메시지 그대로

**확인 방법:**
1. 알림 확인:
   - [ ] 모든 알림 위치: top-center 확인
   - [ ] 서버 원문 메시지 그대로 표시 확인

**확인 체크리스트:**
- [ ] 모든 알림: top-center, 서버 원문 메시지 그대로

---

### A-4. 검증 (합격 기준)

### ✅ 종합 검증

**1. 충전 요청/거래 내역의 상태·유형·버튼·CSV가 모두 한글**
- [ ] 충전 요청 상태 한글 확인
- [ ] 거래 유형 한글 확인
- [ ] 버튼 한글 확인
- [ ] CSV 한글 확인

**2. "요청자(로그인 ID)"에 현재 로그인 이메일이 표시된다**
- [ ] 컬럼명: "요청자(로그인 ID)" 확인
- [ ] 값: 현재 로그인 이메일 표시 확인

**3. 기존 UUID는 표면에 보이지 않고 복사 아이콘(툴팁)로만 접근**
- [ ] UUID 표면 노출 없음 확인
- [ ] 복사 아이콘(툴팁)로만 접근 가능 확인

---

## B. v3.3 "대행사 작성 중단(취소)" 기능

### B-1. 버튼 노출 규칙 (드로어 상세 패널)

### 📋 실행 단계

### 1. 즉시 취소 가능 (빨간 버튼 "작성 중단") 확인

**확인 항목:**
- [ ] 즉시 취소 가능 (빨간 버튼 "작성 중단"): SUBMITTED, ADMIN_INTAKE

**확인 방법:**
1. 버튼 노출 확인:
   - [ ] 주문 상태: `SUBMITTED` → 빨간 버튼 "작성 중단" 표시 확인
   - [ ] 주문 상태: `ADMIN_INTAKE` → 빨간 버튼 "작성 중단" 표시 확인

**확인 체크리스트:**
- [ ] 즉시 취소 가능 (빨간 버튼 "작성 중단"): SUBMITTED, ADMIN_INTAKE

---

### 2. 취소 요청만 가능 (회색 테두리 버튼 "작성 중단 요청") 확인

**확인 항목:**
- [ ] 취소 요청만 가능 (회색 테두리 버튼 "작성 중단 요청"): GENERATING, REGEN_QUEUED

**확인 방법:**
1. 버튼 노출 확인:
   - [ ] 주문 상태: `GENERATING` → 회색 테두리 버튼 "작성 중단 요청" 표시 확인
   - [ ] 주문 상태: `REGEN_QUEUED` → 회색 테두리 버튼 "작성 중단 요청" 표시 확인

**확인 체크리스트:**
- [ ] 취소 요청만 가능 (회색 테두리 버튼 "작성 중단 요청"): GENERATING, REGEN_QUEUED

---

### 3. 비활성/미노출 확인

**확인 항목:**
- [ ] 비활성/미노출: AGENCY_REVIEW, COMPLETE, FAILED, CANCELED

**확인 방법:**
1. 버튼 노출 확인:
   - [ ] 주문 상태: `AGENCY_REVIEW` → 버튼 비활성/미노출 확인
   - [ ] 주문 상태: `COMPLETE` → 버튼 비활성/미노출 확인
   - [ ] 주문 상태: `FAILED` → 버튼 비활성/미노출 확인
   - [ ] 주문 상태: `CANCELED` → 버튼 비활성/미노출 확인

**확인 체크리스트:**
- [ ] 비활성/미노출: AGENCY_REVIEW, COMPLETE, FAILED, CANCELED

---

### B-2. 동작 규칙

### 📋 실행 단계

### 1. 작성 중단 (즉시 취소) 확인

**확인 항목:**
- [ ] 사유 입력 (필수) → 확인 모달 → POST /agency/orders/:id/cancel
- [ ] 성공 시: status = CANCELED
- [ ] 예약 존재 시 RELEASE (지갑 reserved↓, available↑)
- [ ] 리스트/상단 카드/지갑 카드 즉시 재조회, 성공 토스트

**확인 방법:**
1. 작성 중단 확인:
   - [ ] 사유 입력 (필수) 확인
   - [ ] 확인 모달 표시 확인
   - [ ] `POST /agency/orders/:id/cancel` 호출 확인
2. 성공 처리 확인:
   - [ ] 주문 상태: `CANCELED` 확인
   - [ ] 예약 존재 시 RELEASE 확인 (지갑 reserved↓, available↑)
   - [ ] 리스트/상단 카드/지갑 카드 즉시 재조회 확인
   - [ ] top-center 토스트: 서버 메시지 원문 표시 확인

**확인 체크리스트:**
- [ ] 사유 입력 (필수) → 확인 모달 → POST /agency/orders/:id/cancel
- [ ] 성공 시: status = CANCELED
- [ ] 예약 존재 시 RELEASE (지갑 reserved↓, available↑)
- [ ] 리스트/상단 카드/지갑 카드 즉시 재조회, 성공 토스트

---

### 2. 작성 중단 요청 확인

**확인 항목:**
- [ ] 사유 입력 (필수) → 확인 모달 → POST /agency/orders/:id/cancel-request
- [ ] 성공 시: status = CANCEL_REQUESTED (어드민 승인 대기)
- [ ] 드로어에 "취소 요청됨" 배지 표시, 성공 토스트
- [ ] 실제 RELEASE는 어드민이 취소 승인한 시점에 수행

**확인 방법:**
1. 작성 중단 요청 확인:
   - [ ] 사유 입력 (필수) 확인
   - [ ] 확인 모달 표시 확인
   - [ ] `POST /agency/orders/:id/cancel-request` 호출 확인
2. 성공 처리 확인:
   - [ ] 주문 상태: `CANCEL_REQUESTED` 확인
   - [ ] 드로어에 "취소 요청됨" 배지 표시 확인
   - [ ] top-center 토스트: 서버 메시지 원문 표시 확인
   - [ ] 실제 RELEASE는 어드민이 취소 승인한 시점에 수행 확인

**확인 체크리스트:**
- [ ] 사유 입력 (필수) → 확인 모달 → POST /agency/orders/:id/cancel-request
- [ ] 성공 시: status = CANCEL_REQUESTED (어드민 승인 대기)
- [ ] 드로어에 "취소 요청됨" 배지 표시, 성공 토스트
- [ ] 실제 RELEASE는 어드민이 취소 승인한 시점에 수행

---

### B-3. UI/UX 세부 확인

### 📋 실행 단계

### 1. 버튼 위치 확인

**확인 항목:**
- [ ] 버튼은 드로어 푸터 좌측 고정 (통과/반려와 시각적으로 분리)

**확인 방법:**
1. 버튼 위치 확인:
   - [ ] 드로어 푸터 좌측 고정 확인
   - [ ] 통과/반려와 시각적으로 분리 확인

**확인 체크리스트:**
- [ ] 버튼은 드로어 푸터 좌측 고정 (통과/반려와 시각적으로 분리)

---

### 2. 사유 입력 확인

**확인 항목:**
- [ ] 사유 입력 10~300자, 비우면 제출 불가

**확인 방법:**
1. 사유 입력 확인:
   - [ ] 사유 입력 필드 확인
   - [ ] 최소 10자 확인
   - [ ] 최대 300자 확인
   - [ ] 비우면 제출 불가 확인

**확인 체크리스트:**
- [ ] 사유 입력 10~300자, 비우면 제출 불가

---

### 3. 409 (CONFLICT) 처리 확인

**확인 항목:**
- [ ] 409 (CONFLICT) 수신 시 드로어 강제 재조회 + "상태가 변경되었습니다…" 토스트

**확인 방법:**
1. 409 처리 확인:
   - [ ] 409 (CONFLICT) 수신 시 드로어 강제 재조회 확인
   - [ ] top-center 토스트: "상태가 변경되었습니다…" 확인

**확인 체크리스트:**
- [ ] 409 (CONFLICT) 수신 시 드로어 강제 재조회 + "상태가 변경되었습니다…" 토스트

---

### B-4. API 계약 (대행사 역할)

### 📋 실행 단계

### 1. POST /agency/orders/:id/cancel 확인

**확인 항목:**
- [ ] 허용 상태: SUBMITTED, ADMIN_INTAKE
- [ ] Body: { reason: string }
- [ ] 처리: CANCELED + (있다면) RELEASE + 감사 로그

**확인 방법:**
1. API 확인:
   - [ ] `POST /agency/orders/:id/cancel` 호출 확인
   - [ ] 허용 상태: SUBMITTED, ADMIN_INTAKE 확인
   - [ ] Request Body: { reason: string } 확인
   - [ ] 처리: CANCELED + (있다면) RELEASE + 감사 로그 확인

**확인 체크리스트:**
- [ ] 허용 상태: SUBMITTED, ADMIN_INTAKE
- [ ] Body: { reason: string }
- [ ] 처리: CANCELED + (있다면) RELEASE + 감사 로그

---

### 2. POST /agency/orders/:id/cancel-request 확인

**확인 항목:**
- [ ] 허용 상태: GENERATING, REGEN_QUEUED
- [ ] Body: { reason: string }
- [ ] 처리: CANCEL_REQUESTED + 감사 로그

**확인 방법:**
1. API 확인:
   - [ ] `POST /agency/orders/:id/cancel-request` 호출 확인
   - [ ] 허용 상태: GENERATING, REGEN_QUEUED 확인
   - [ ] Request Body: { reason: string } 확인
   - [ ] 처리: CANCEL_REQUESTED + 감사 로그 확인

**확인 체크리스트:**
- [ ] 허용 상태: GENERATING, REGEN_QUEUED
- [ ] Body: { reason: string }
- [ ] 처리: CANCEL_REQUESTED + 감사 로그

---

### 3. Idempotency-Key 확인

**확인 항목:**
- [ ] 모든 요청에 Idempotency-Key 허용 (중복 클릭 방지)

**확인 방법:**
1. Idempotency-Key 확인:
   - [ ] Request Headers에 `Idempotency-Key` 포함 확인
   - [ ] 중복 클릭 방지 확인

**확인 체크리스트:**
- [ ] 모든 요청에 Idempotency-Key 허용 (중복 클릭 방지)

---

### B-5. 검증 (합격 기준)

### ✅ 종합 검증

**1. SUBMITTED/ADMIN_INTAKE에서 작성 중단이 즉시 완료되고 리스트에서 사라짐**
- [ ] SUBMITTED/ADMIN_INTAKE에서 작성 중단 즉시 완료 확인
- [ ] 리스트에서 사라짐 확인

**2. GENERATING/REGEN_QUEUED에서 작성 중단 요청으로 상태가 바뀌고 배지 표시**
- [ ] GENERATING/REGEN_QUEUED에서 작성 중단 요청으로 상태 변경 확인
- [ ] 배지 표시 확인

**3. 예약되어 있던 건을 즉시 취소하면 지갑 reserved↓가 반영됨**
- [ ] 예약되어 있던 건 즉시 취소 확인
- [ ] 지갑 reserved↓ 반영 확인

**4. 모든 알림은 top-center, 서버 원문 메시지**
- [ ] 모든 알림 위치: top-center 확인
- [ ] 서버 원문 메시지 표시 확인

---

## C. v3.2 지갑 ↔ 원고 연동 (확정 규칙)

### C-1. 금액 계산 확인

### 📋 실행 단계

### 1. UNIT_PRICE_PER_ORDER 확인

**확인 항목:**
- [ ] UNIT_PRICE_PER_ORDER (env) × submitCount (1~5) = 주문 단가
- [ ] 주문 엔티티에 unitPrice, submitCount, reservedAmount 스냅샷 보관

**확인 방법:**
1. 금액 계산 확인:
   - [ ] `UNIT_PRICE_PER_ORDER` 환경변수 확인
   - [ ] `submitCount` 1~5 확인
   - [ ] 주문 단가 = `UNIT_PRICE_PER_ORDER × submitCount` 확인
2. 주문 엔티티 확인:
   - [ ] 주문 엔티티에 `unitPrice` 스냅샷 보관 확인
   - [ ] 주문 엔티티에 `submitCount` 스냅샷 보관 확인
   - [ ] 주문 엔티티에 `reservedAmount` 스냅샷 보관 확인

**확인 체크리스트:**
- [ ] UNIT_PRICE_PER_ORDER (env) × submitCount (1~5) = 주문 단가
- [ ] 주문 엔티티에 unitPrice, submitCount, reservedAmount 스냅샷 보관

---

### C-2. 이벤트 훅 (요약) 확인

### 📋 실행 단계

### 1. 어드민 산출 시작 → RESERVE 확인

**확인 항목:**
- [ ] 어드민 산출 시작 → RESERVE (amount)

**확인 방법:**
1. 산출 시작 확인:
   - [ ] 어드민 '산출' 버튼 클릭
   - [ ] `RESERVE (amount)` 호출 확인
   - [ ] 지갑 `reserved` 증가 확인
   - [ ] 거래 원장에 RESERVE 레코드 추가 확인

**확인 체크리스트:**
- [ ] 어드민 산출 시작 → RESERVE (amount)

---

### 2. 대행사 승인 (APPROVE) → CAPTURE 확인

**확인 항목:**
- [ ] 대행사 승인 (APPROVE) → CAPTURE (amount)

**확인 방법:**
1. 대행사 승인 확인:
   - [ ] 대행사 승인 버튼 클릭
   - [ ] `CAPTURE (amount)` 호출 확인
   - [ ] 지갑 `balance↓ / reserved↓ / spentTotal↑` 확인
   - [ ] 거래 원장에 CAPTURE 레코드 추가 확인

**확인 체크리스트:**
- [ ] 대행사 승인 (APPROVE) → CAPTURE (amount)

---

### 3. 즉시 취소 (CANCELED) / 산출 실패 (FAILED) → RELEASE 확인

**확인 항목:**
- [ ] 즉시 취소 (CANCELED) / 산출 실패 (FAILED) → RELEASE (amount)

**확인 방법:**
1. 즉시 취소/산출 실패 확인:
   - [ ] 즉시 취소 → 주문 상태: `CANCELED` 확인
   - [ ] 산출 실패 → 주문 상태: `FAILED` 확인
   - [ ] `RELEASE (amount)` 호출 확인
   - [ ] 지갑 `reserved↓` 확인
   - [ ] 거래 원장에 RELEASE 레코드 추가 확인

**확인 체크리스트:**
- [ ] 즉시 취소 (CANCELED) / 산출 실패 (FAILED) → RELEASE (amount)

---

### 4. 반려→재생성 루프 확인

**확인 항목:**
- [ ] 반려→재생성 루프에서는 예약 유지, 최종 승인 때만 capture

**확인 방법:**
1. 반려→재생성 루프 확인:
   - [ ] 대행사 반려 → 주문 상태: `REGEN_QUEUED` 확인
   - [ ] 주문 상태: `GENERATING` 확인
   - [ ] 예약 유지 확인 (지갑 `reserved` 변동 없음)
   - [ ] 최종 승인 때만 capture 확인

**확인 체크리스트:**
- [ ] 반려→재생성 루프에서는 예약 유지, 최종 승인 때만 capture

---

### C-3. 검증 (합격 기준)

### ✅ 종합 검증

**1. 산출 시 reserved가 증가, 승인 시 balance↓ / reserved↓ / spentTotal↑**
- [ ] 산출 시 `reserved` 증가 확인
- [ ] 승인 시 `balance↓ / reserved↓ / spentTotal↑` 확인

**2. 즉시 취소/실패 시 reserved↓**
- [ ] 즉시 취소 시 `reserved↓` 확인
- [ ] 산출 실패 시 `reserved↓` 확인

**3. 거래 원장에 RESERVE / CAPTURE / RELEASE가 참조(주문ID)와 함께 기록**
- [ ] 거래 원장에 RESERVE 레코드 추가 확인 (참조=주문ID)
- [ ] 거래 원장에 CAPTURE 레코드 추가 확인 (참조=주문ID)
- [ ] 거래 원장에 RELEASE 레코드 추가 확인 (참조=주문ID)

---

## ✅ 실행 전 체크리스트

### 📋 실행 단계

### 1. /agency/topups 응답에 requesterEmail 포함 (서버) 확인

**확인 항목:**
- [ ] /agency/topups 응답에 requesterEmail 포함 (서버)

**확인 방법:**
1. API 응답 확인:
   - [ ] `GET /agency/topups` 응답에 `requesterEmail` 포함 확인
   - [ ] `POST /agency/topups` 응답에 `requesterEmail` 포함 확인
   - [ ] `GET /agency/topups/:id` 응답에 `requesterEmail` 포함 확인

**확인 체크리스트:**
- [ ] /agency/topups 응답에 requesterEmail 포함 (서버)

---

### 2. 프런트 라벨 포맷터 (상태/유형) 적용, CSV도 한글화 확인

**확인 항목:**
- [ ] 프런트 라벨 포맷터 (상태/유형) 적용, CSV도 한글화

**확인 방법:**
1. 프런트 라벨 확인:
   - [ ] 상태 한글 라벨 포맷터 적용 확인
   - [ ] 유형 한글 라벨 포맷터 적용 확인
2. CSV 확인:
   - [ ] CSV 내보내기 한글화 확인

**확인 체크리스트:**
- [ ] 프런트 라벨 포맷터 (상태/유형) 적용, CSV도 한글화

---

### 3. 드로어에 "작성 중단/작성 중단 요청" 버튼 노출 규칙 연결 확인

**확인 항목:**
- [ ] 드로어에 "작성 중단/작성 중단 요청" 버튼 노출 규칙 연결

**확인 방법:**
1. 버튼 노출 확인:
   - [ ] 드로어에 "작성 중단" 버튼 노출 규칙 연결 확인
   - [ ] 드로어에 "작성 중단 요청" 버튼 노출 규칙 연결 확인

**확인 체크리스트:**
- [ ] 드로어에 "작성 중단/작성 중단 요청" 버튼 노출 규칙 연결

---

### 4. 두 취소 엔드포인트에 사유·Idempotency-Key 처리 확인

**확인 항목:**
- [ ] 두 취소 엔드포인트에 사유·Idempotency-Key 처리

**확인 방법:**
1. 취소 엔드포인트 확인:
   - [ ] `POST /agency/orders/:id/cancel`에 사유·Idempotency-Key 처리 확인
   - [ ] `POST /agency/orders/:id/cancel-request`에 사유·Idempotency-Key 처리 확인

**확인 체크리스트:**
- [ ] 두 취소 엔드포인트에 사유·Idempotency-Key 처리

---

### 5. 지갑 이벤트 훅 (RESERVE/CAPTURE/RELEASE) 로그로 검증 확인

**확인 항목:**
- [ ] 지갑 이벤트 훅 (RESERVE/CAPTURE/RELEASE) 로그로 검증

**확인 방법:**
1. 이벤트 훅 확인:
   - [ ] RESERVE 이벤트 훅 로그 확인
   - [ ] CAPTURE 이벤트 훅 로그 확인
   - [ ] RELEASE 이벤트 훅 로그 확인

**확인 체크리스트:**
- [ ] 지갑 이벤트 훅 (RESERVE/CAPTURE/RELEASE) 로그로 검증

---

## 📊 종합 검증 체크리스트

### ✅ v3.1.3 "충전 관리" 한글화 + 요청자 표시
1. [ ] 라벨 매핑 (충전요청 상태, 거래유형, 거래 상태 컬럼)
2. [ ] "요청ID" → "요청자(로그인 ID)" (API 응답에 requesterEmail 포함, 프런트 컬럼명 및 값 표시, CSV 내보내기 한글화)
3. [ ] 금액/토스트 표준 (금액 포맷, 알림 표준)
4. [ ] 검증 (합격 기준)

### ✅ v3.3 "대행사 작성 중단(취소)" 기능
1. [ ] 버튼 노출 규칙 (즉시 취소 가능, 취소 요청만 가능, 비활성/미노출)
2. [ ] 동작 규칙 (작성 중단, 작성 중단 요청)
3. [ ] UI/UX 세부 (버튼 위치, 사유 입력, 409 처리)
4. [ ] API 계약 (POST /agency/orders/:id/cancel, POST /agency/orders/:id/cancel-request, Idempotency-Key)
5. [ ] 검증 (합격 기준)

### ✅ v3.2 지갑 ↔ 원고 연동 (확정 규칙)
1. [ ] 금액 계산 (UNIT_PRICE_PER_ORDER, 주문 엔티티 스냅샷 보관)
2. [ ] 이벤트 훅 (어드민 산출 시작 → RESERVE, 대행사 승인 → CAPTURE, 즉시 취소/산출 실패 → RELEASE, 반려→재생성 루프)
3. [ ] 검증 (합격 기준)

### ✅ 실행 전 체크리스트
1. [ ] /agency/topups 응답에 requesterEmail 포함 (서버)
2. [ ] 프런트 라벨 포맷터 (상태/유형) 적용, CSV도 한글화
3. [ ] 드로어에 "작성 중단/작성 중단 요청" 버튼 노출 규칙 연결
4. [ ] 두 취소 엔드포인트에 사유·Idempotency-Key 처리
5. [ ] 지갑 이벤트 훅 (RESERVE/CAPTURE/RELEASE) 로그로 검증





