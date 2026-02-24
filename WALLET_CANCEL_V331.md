# 대행사 작성 중단(취소) v3.3.1

## 🎯 목표
- 백엔드 API 추가/확정 (AGENCY 전용)
- 프론트(드로어) 노출/동작
- 지갑/거래 훅 (유지)
- 한글화/요청자(이메일) 표기(충전 관리 재확인)

---

## A. 백엔드 API 추가/확정 (AGENCY 전용)

### A-1. 즉시 취소 확인

### 📋 실행 단계

### 1. POST /agency/orders/:id/cancel 확인

**확인 항목:**
- [ ] Body: { reason: string } (10~300자)
- [ ] 허용 상태: SUBMITTED, ADMIN_INTAKE
- [ ] 처리:
  - [ ] status → CANCELED, canceledAt 기록, cancelReason 저장
  - [ ] 예약금이 있으면 Billing.release(orderId, reservedAmount) 호출 (지갑 reserved↓/available↑)
  - [ ] 감사로그 (actorId, agencyId, idempotencyKey, ip/ua)
- [ ] 응답: { message, status:"CANCELED" } (서버 원문 메시지 유지)

**확인 방법:**
1. API 호출 확인:
   - [ ] `POST /agency/orders/:id/cancel` 호출 확인
   - [ ] Request Body: { reason: string } (10~300자) 확인
   - [ ] 허용 상태: SUBMITTED, ADMIN_INTAKE 확인
2. 처리 확인:
   - [ ] 주문 상태: `CANCELED` 확인
   - [ ] `canceledAt` 기록 확인
   - [ ] `cancelReason` 저장 확인
   - [ ] 예약금이 있으면 `Billing.release(orderId, reservedAmount)` 호출 확인
   - [ ] 지갑 `reserved↓/available↑` 확인
   - [ ] 감사로그 기록 확인 (actorId, agencyId, idempotencyKey, ip/ua)
3. 응답 확인:
   - [ ] Response Body: { message, status:"CANCELED" } 확인
   - [ ] 서버 원문 메시지 유지 확인

**확인 체크리스트:**
- [ ] Body: { reason: string } (10~300자)
- [ ] 허용 상태: SUBMITTED, ADMIN_INTAKE
- [ ] 처리: status → CANCELED, canceledAt 기록, cancelReason 저장
- [ ] 예약금이 있으면 Billing.release(orderId, reservedAmount) 호출 (지갑 reserved↓/available↑)
- [ ] 감사로그 (actorId, agencyId, idempotencyKey, ip/ua)
- [ ] 응답: { message, status:"CANCELED" } (서버 원문 메시지 유지)

---

### A-2. 작성 중단 "요청" 확인

### 📋 실행 단계

### 1. POST /agency/orders/:id/cancel-request 확인

**확인 항목:**
- [ ] Body: { reason: string }
- [ ] 허용 상태: GENERATING, REGEN_QUEUED
- [ ] 처리: status → CANCEL_REQUESTED, cancelRequestedAt 기록 (예약 유지)
- [ ] 응답: { message, status:"CANCEL_REQUESTED" }

**확인 방법:**
1. API 호출 확인:
   - [ ] `POST /agency/orders/:id/cancel-request` 호출 확인
   - [ ] Request Body: { reason: string } 확인
   - [ ] 허용 상태: GENERATING, REGEN_QUEUED 확인
2. 처리 확인:
   - [ ] 주문 상태: `CANCEL_REQUESTED` 확인
   - [ ] `cancelRequestedAt` 기록 확인
   - [ ] 예약 유지 확인 (지갑 `reserved` 변동 없음)
3. 응답 확인:
   - [ ] Response Body: { message, status:"CANCEL_REQUESTED" } 확인

**확인 체크리스트:**
- [ ] Body: { reason: string }
- [ ] 허용 상태: GENERATING, REGEN_QUEUED
- [ ] 처리: status → CANCEL_REQUESTED, cancelRequestedAt 기록 (예약 유지)
- [ ] 응답: { message, status:"CANCEL_REQUESTED" }

---

### A-3. 공통 규칙 확인

### 📋 실행 단계

### 1. Idempotency-Key 확인

**확인 항목:**
- [ ] 헤더 Idempotency-Key 허용 (중복 클릭 방지)

**확인 방법:**
1. Idempotency-Key 확인:
   - [ ] Request Headers에 `Idempotency-Key` 포함 확인
   - [ ] 중복 클릭 방지 확인

**확인 체크리스트:**
- [ ] 헤더 Idempotency-Key 허용 (중복 클릭 방지)

---

### 2. 권한 가드 확인

**확인 항목:**
- [ ] 권한 가드: 주문의 agencyId와 JWT 일치 확인 → 불일치 403

**확인 방법:**
1. 권한 확인:
   - [ ] 주문의 `agencyId`와 JWT 일치 확인
   - [ ] 불일치 시 Status Code: `403 FORBIDDEN` 확인

**확인 체크리스트:**
- [ ] 권한 가드: 주문의 agencyId와 JWT 일치 확인 → 불일치 403

---

### 3. 상태 불일치 처리 확인

**확인 항목:**
- [ ] 상태 불일치 시 409 (CONFLICT) + 원문 메시지

**확인 방법:**
1. 상태 불일치 확인:
   - [ ] 허용되지 않은 상태에서 요청 시도
   - [ ] Status Code: `409 CONFLICT` 확인
   - [ ] Response Body의 원문 메시지 확인

**확인 체크리스트:**
- [ ] 상태 불일치 시 409 (CONFLICT) + 원문 메시지

---

### 4. 큐 연동 가드 확인

**확인 항목:**
- [ ] 큐 연동 가드 (선처리): 워커가 잡을 때 CANCEL_REQUESTED면 생성/후속 작업 스킵하고 빠르게 CANCELED + release로 정리 (어드민 최종취소 API가 준비되기 전의 안전장치)

**확인 방법:**
1. 큐 연동 확인:
   - [ ] 워커가 주문을 잡을 때 `CANCEL_REQUESTED` 상태 확인
   - [ ] 생성/후속 작업 스킵 확인
   - [ ] 빠르게 `CANCELED + release`로 정리 확인

**확인 체크리스트:**
- [ ] 큐 연동 가드 (선처리): 워커가 잡을 때 CANCEL_REQUESTED면 생성/후속 작업 스킵하고 빠르게 CANCELED + release로 정리

---

## B. 프론트(드로어) 노출/동작

### B-1. 버튼 노출 조건 (드로어 상세 우측/하단) 확인

### 📋 실행 단계

### 1. 즉시 취소 가능 버튼 확인

**확인 항목:**
- [ ] SUBMITTED | ADMIN_INTAKE → [작성 중단] (위험/빨강)

**확인 방법:**
1. 버튼 노출 확인:
   - [ ] 주문 상태: `SUBMITTED` → [작성 중단] 버튼 표시 확인 (위험/빨강)
   - [ ] 주문 상태: `ADMIN_INTAKE` → [작성 중단] 버튼 표시 확인 (위험/빨강)

**확인 체크리스트:**
- [ ] SUBMITTED | ADMIN_INTAKE → [작성 중단] (위험/빨강)

---

### 2. 취소 요청만 가능 버튼 확인

**확인 항목:**
- [ ] GENERATING | REGEN_QUEUED → [작성 중단 요청] (회색 외곽선)

**확인 방법:**
1. 버튼 노출 확인:
   - [ ] 주문 상태: `GENERATING` → [작성 중단 요청] 버튼 표시 확인 (회색 외곽선)
   - [ ] 주문 상태: `REGEN_QUEUED` → [작성 중단 요청] 버튼 표시 확인 (회색 외곽선)

**확인 체크리스트:**
- [ ] GENERATING | REGEN_QUEUED → [작성 중단 요청] (회색 외곽선)

---

### 3. 취소 요청됨 배지 확인

**확인 항목:**
- [ ] CANCEL_REQUESTED → 상단 배지 "작성 중단 요청됨" (노란색), 버튼 비활성

**확인 방법:**
1. 배지 확인:
   - [ ] 주문 상태: `CANCEL_REQUESTED` → 상단 배지 "작성 중단 요청됨" 표시 확인 (노란색)
   - [ ] 버튼 비활성 확인

**확인 체크리스트:**
- [ ] CANCEL_REQUESTED → 상단 배지 "작성 중단 요청됨" (노란색), 버튼 비활성

---

### 4. 버튼 미노출 확인

**확인 항목:**
- [ ] CANCELED | COMPLETE | FAILED | AGENCY_REVIEW → 버튼 미노출

**확인 방법:**
1. 버튼 미노출 확인:
   - [ ] 주문 상태: `CANCELED` → 버튼 미노출 확인
   - [ ] 주문 상태: `COMPLETE` → 버튼 미노출 확인
   - [ ] 주문 상태: `FAILED` → 버튼 미노출 확인
   - [ ] 주문 상태: `AGENCY_REVIEW` → 버튼 미노출 확인

**확인 체크리스트:**
- [ ] CANCELED | COMPLETE | FAILED | AGENCY_REVIEW → 버튼 미노출

---

### B-2. 실행 절차 (둘 다 공통) 확인

### 📋 실행 단계

### 1. 클릭 → 사유 입력 모달 확인

**확인 항목:**
- [ ] 클릭 → 사유 입력 모달 (필수 10~300자) → 확인 시

**확인 방법:**
1. 클릭 확인:
   - [ ] 버튼 클릭 → 사유 입력 모달 표시 확인
   - [ ] 사유 입력 필수 10~300자 확인
   - [ ] 확인 시 제출 확인

**확인 체크리스트:**
- [ ] 클릭 → 사유 입력 모달 (필수 10~300자) → 확인 시

---

### 2. 버튼 disabled + Idempotency-Key 부여 확인

**확인 항목:**
- [ ] 버튼 disabled + Idempotency-Key 부여 → API 호출

**확인 방법:**
1. 버튼 상태 확인:
   - [ ] 버튼 disabled 확인
   - [ ] Request Headers에 `Idempotency-Key` 포함 확인
   - [ ] API 호출 확인

**확인 체크리스트:**
- [ ] 버튼 disabled + Idempotency-Key 부여 → API 호출

---

### 3. 성공 처리 확인

**확인 항목:**
- [ ] 성공: 드로어 강제 재조회 + 리스트/요약 카드 갱신 + 지갑 카드 갱신

**확인 방법:**
1. 성공 처리 확인:
   - [ ] Status Code: `200 OK` 확인
   - [ ] 드로어 강제 재조회 확인
   - [ ] 리스트 갱신 확인
   - [ ] 요약 카드 갱신 확인
   - [ ] 지갑 카드 갱신 확인

**확인 체크리스트:**
- [ ] 성공: 드로어 강제 재조회 + 리스트/요약 카드 갱신 + 지갑 카드 갱신

---

### 4. 실패 처리 확인

**확인 항목:**
- [ ] 실패: 409면 드로어 강제 재조회 후 "상태가 변경되었습니다" 토스트

**확인 방법:**
1. 실패 처리 확인:
   - [ ] Status Code: `409 CONFLICT` 확인
   - [ ] 드로어 강제 재조회 확인
   - [ ] top-center 토스트: "상태가 변경되었습니다" 확인

**확인 체크리스트:**
- [ ] 실패: 409면 드로어 강제 재조회 후 "상태가 변경되었습니다" 토스트

---

### 5. 알림 표준 확인

**확인 항목:**
- [ ] 모든 알림은 top-center, 서버 원문 그대로

**확인 방법:**
1. 알림 확인:
   - [ ] 모든 알림 위치: top-center 확인
   - [ ] 서버 원문 메시지 그대로 표시 확인

**확인 체크리스트:**
- [ ] 모든 알림은 top-center, 서버 원문 그대로

---

### B-3. 레이블/필터 보강 확인

### 📋 실행 단계

### 1. 상태 라벨 추가 확인

**확인 항목:**
- [ ] 상태 라벨에 "취소됨(CANCELED)" / "취소 요청(CANCEL_REQUESTED)" 추가

**확인 방법:**
1. 상태 라벨 확인:
   - [ ] "취소됨(CANCELED)" 라벨 표시 확인
   - [ ] "취소 요청(CANCEL_REQUESTED)" 라벨 표시 확인

**확인 체크리스트:**
- [ ] 상태 라벨에 "취소됨(CANCELED)" / "취소 요청(CANCEL_REQUESTED)" 추가

---

### 2. 탭/필터 반영 확인

**확인 항목:**
- [ ] 탭/필터에서 취소/취소요청 포함 여부 반영 (작성 중 탭엔 취소요청은 포함, 취소는 제외)

**확인 방법:**
1. 탭/필터 확인:
   - [ ] 작성 중 탭에 취소요청 포함 확인
   - [ ] 작성 중 탭에 취소 제외 확인

**확인 체크리스트:**
- [ ] 탭/필터에서 취소/취소요청 포함 여부 반영 (작성 중 탭엔 취소요청은 포함, 취소는 제외)

---

## C. 지갑/거래 훅 (유지)

### 📋 실행 단계

### 1. 산출 시작 (RESERVE) 확인

**확인 항목:**
- [ ] 산출 시작 (RESERVE): 어드민 산출 버튼에서 reserved↑

**확인 방법:**
1. 산출 시작 확인:
   - [ ] 어드민 산출 버튼 클릭
   - [ ] `RESERVE` 호출 확인
   - [ ] 지갑 `reserved↑` 확인
   - [ ] 거래 원장에 RESERVE 레코드 추가 확인 (ref=orderId)

**확인 체크리스트:**
- [ ] 산출 시작 (RESERVE): 어드민 산출 버튼에서 reserved↑

---

### 2. 대행사 승인 (CAPTURE) 확인

**확인 항목:**
- [ ] 대행사 승인 (CAPTURE): 승인 시 balance↓ / reserved↓ / spentTotal↑

**확인 방법:**
1. 대행사 승인 확인:
   - [ ] 대행사 승인 버튼 클릭
   - [ ] `CAPTURE` 호출 확인
   - [ ] 지갑 `balance↓ / reserved↓ / spentTotal↑` 확인
   - [ ] 거래 원장에 CAPTURE 레코드 추가 확인 (ref=orderId)

**확인 체크리스트:**
- [ ] 대행사 승인 (CAPTURE): 승인 시 balance↓ / reserved↓ / spentTotal↑

---

### 3. 즉시 취소/실패 (RELEASE) 확인

**확인 항목:**
- [ ] 즉시 취소/실패 (RELEASE): 즉시 취소/산출 실패/어드민 취소 승인 시 reserved↓

**확인 방법:**
1. 즉시 취소/실패 확인:
   - [ ] 즉시 취소 → `RELEASE` 호출 확인
   - [ ] 산출 실패 → `RELEASE` 호출 확인
   - [ ] 어드민 취소 승인 → `RELEASE` 호출 확인
   - [ ] 지갑 `reserved↓` 확인
   - [ ] 거래 원장에 RELEASE 레코드 추가 확인 (ref=orderId)

**확인 체크리스트:**
- [ ] 즉시 취소/실패 (RELEASE): 즉시 취소/산출 실패/어드민 취소 승인 시 reserved↓

---

### 4. 거래 원장 참조 확인

**확인 항목:**
- [ ] 거래 원장: RESERVE/CAPTURE/RELEASE에 ref=orderId 기록

**확인 방법:**
1. 거래 원장 확인:
   - [ ] RESERVE 레코드에 ref=orderId 기록 확인
   - [ ] CAPTURE 레코드에 ref=orderId 기록 확인
   - [ ] RELEASE 레코드에 ref=orderId 기록 확인

**확인 체크리스트:**
- [ ] 거래 원장: RESERVE/CAPTURE/RELEASE에 ref=orderId 기록

---

## D. 한글화/요청자(이메일) 표기 (충전 관리 재확인)

### 📋 실행 단계

### 1. 상태/유형 라벨 한글화 확인

**확인 항목:**
- [ ] 상태/유형 라벨 (요청/거래) 전면 한글 (예: PENDING→승인 대기)

**확인 방법:**
1. 상태 라벨 확인:
   - [ ] PENDING → "승인 대기" 표시 확인
   - [ ] APPROVED → "승인 완료" 표시 확인
   - [ ] REJECTED → "반려" 표시 확인
   - [ ] CANCELED → "취소됨" 표시 확인
   - [ ] EXPIRED → "만료" 표시 확인
   - [ ] CANCEL_REQUESTED → "취소 요청" 표시 확인
2. 유형 라벨 확인:
   - [ ] TOPUP_REQUEST → "충전 요청" 표시 확인
   - [ ] TOPUP_APPROVED → "충전 승인" 표시 확인
   - [ ] RESERVE → "예약" 표시 확인
   - [ ] CAPTURE → "사용(차감)" 표시 확인
   - [ ] RELEASE → "예약 해제" 표시 확인
   - [ ] ADJUST → "조정" 표시 확인
   - [ ] REFUND → "환불" 표시 확인

**확인 체크리스트:**
- [ ] 상태/유형 라벨 (요청/거래) 전면 한글 (예: PENDING→승인 대기)

---

### 2. 요청 목록 컬럼 확인

**확인 항목:**
- [ ] 요청 목록 컬럼은 **"요청자(로그인 ID)"**로 이메일 표시 (내부 UUID는 툴팁/복사)

**확인 방법:**
1. 컬럼명 확인:
   - [ ] 컬럼명: "요청자(로그인 ID)" 확인
   - [ ] 값: 이메일 표시 확인
   - [ ] 내부 UUID는 툴팁/복사로만 접근 가능 확인

**확인 체크리스트:**
- [ ] 요청 목록 컬럼은 **"요청자(로그인 ID)"**로 이메일 표시 (내부 UUID는 툴팁/복사)

---

### 3. CSV 내보내기 한글화 확인

**확인 항목:**
- [ ] CSV 내보내기도 동일 라벨 적용

**확인 방법:**
1. CSV 내보내기 확인:
   - [ ] CSV 내보내기 버튼 클릭
   - [ ] CSV 파일 다운로드 확인
   - [ ] 컬럼명: "요청자(로그인 ID)" 확인
   - [ ] 상태/유형 한글 라벨 확인

**확인 체크리스트:**
- [ ] CSV 내보내기도 동일 라벨 적용

---

## 📊 종합 검증 체크리스트

### ✅ A. 백엔드 API 추가/확정 (AGENCY 전용)
1. [ ] 즉시 취소: POST /agency/orders/:id/cancel (Body, 허용 상태, 처리, 응답)
2. [ ] 작성 중단 "요청": POST /agency/orders/:id/cancel-request (Body, 허용 상태, 처리, 응답)
3. [ ] 공통 규칙: Idempotency-Key, 권한 가드, 상태 불일치 처리, 큐 연동 가드

### ✅ B. 프론트(드로어) 노출/동작
1. [ ] 버튼 노출 조건 (즉시 취소 가능, 취소 요청만 가능, 취소 요청됨 배지, 버튼 미노출)
2. [ ] 실행 절차 (클릭 → 사유 입력 모달, 버튼 disabled + Idempotency-Key 부여, 성공 처리, 실패 처리, 알림 표준)
3. [ ] 레이블/필터 보강 (상태 라벨 추가, 탭/필터 반영)

### ✅ C. 지갑/거래 훅 (유지)
1. [ ] 산출 시작 (RESERVE): 어드민 산출 버튼에서 reserved↑
2. [ ] 대행사 승인 (CAPTURE): 승인 시 balance↓ / reserved↓ / spentTotal↑
3. [ ] 즉시 취소/실패 (RELEASE): 즉시 취소/산출 실패/어드민 취소 승인 시 reserved↓
4. [ ] 거래 원장: RESERVE/CAPTURE/RELEASE에 ref=orderId 기록

### ✅ D. 한글화/요청자(이메일) 표기 (충전 관리 재확인)
1. [ ] 상태/유형 라벨 (요청/거래) 전면 한글
2. [ ] 요청 목록 컬럼은 **"요청자(로그인 ID)"**로 이메일 표시 (내부 UUID는 툴팁/복사)
3. [ ] CSV 내보내기도 동일 라벨 적용

---

## 🔧 트리아지 리포트 템플릿

### 대행사 작성 중단(취소) 실패 리포트 작성 시:

```
## 대행사 작성 중단(취소) 실패 리포트

### 1. 백엔드 API
- 즉시 취소: [ ] POST /agency/orders/:id/cancel (Body, 허용 상태, 처리, 응답) [ ] 오류
- 작성 중단 "요청": [ ] POST /agency/orders/:id/cancel-request (Body, 허용 상태, 처리, 응답) [ ] 오류
- 공통 규칙: [ ] Idempotency-Key [ ] 권한 가드 [ ] 상태 불일치 처리 [ ] 큐 연동 가드 [ ] 오류

### 2. 프론트(드로어) 노출/동작
- 버튼 노출 조건: [ ] 즉시 취소 가능 [ ] 취소 요청만 가능 [ ] 취소 요청됨 배지 [ ] 버튼 미노출 [ ] 오류
- 실행 절차: [ ] 클릭 → 사유 입력 모달 [ ] 버튼 disabled + Idempotency-Key 부여 [ ] 성공 처리 [ ] 실패 처리 [ ] 알림 표준 [ ] 오류
- 레이블/필터 보강: [ ] 상태 라벨 추가 [ ] 탭/필터 반영 [ ] 오류

### 3. 지갑/거래 훅
- 산출 시작 (RESERVE): [ ] 어드민 산출 버튼에서 reserved↑ [ ] 오류
- 대행사 승인 (CAPTURE): [ ] 승인 시 balance↓ / reserved↓ / spentTotal↑ [ ] 오류
- 즉시 취소/실패 (RELEASE): [ ] 즉시 취소/산출 실패/어드민 취소 승인 시 reserved↓ [ ] 오류
- 거래 원장: [ ] RESERVE/CAPTURE/RELEASE에 ref=orderId 기록 [ ] 오류

### 4. 한글화/요청자(이메일) 표기
- 상태/유형 라벨: [ ] 전면 한글 [ ] 오류
- 요청 목록 컬럼: [ ] "요청자(로그인 ID)"로 이메일 표시 [ ] 오류
- CSV 내보내기: [ ] 동일 라벨 적용 [ ] 오류

### 5. 원인 추정
1순위: [ ] 백엔드 API 오류
2순위: [ ] 프론트 노출/동작 오류
3순위: [ ] 지갑/거래 훅 오류

### 6. 조치
- [ ] 백엔드 API 확인/수정
- [ ] 프론트 노출/동작 확인/수정
- [ ] 지갑/거래 훅 확인/수정
- [ ] 한글화/요청자(이메일) 표기 확인/수정
```





