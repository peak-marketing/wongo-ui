# 대행사 작성 중단(취소) v3.3.1 - 빠른 참조

## 🚨 즉시 확인 (5분)

### A. 백엔드 API 추가/확정 (AGENCY 전용)

#### 즉시 취소
1. [ ] POST /agency/orders/:id/cancel
   - [ ] Body: { reason: string } (10~300자)
   - [ ] 허용 상태: SUBMITTED, ADMIN_INTAKE
   - [ ] 처리: status → CANCELED, canceledAt 기록, cancelReason 저장
   - [ ] 예약금이 있으면 Billing.release(orderId, reservedAmount) 호출 (지갑 reserved↓/available↑)
   - [ ] 감사로그 (actorId, agencyId, idempotencyKey, ip/ua)
   - [ ] 응답: { message, status:"CANCELED" } (서버 원문 메시지 유지)

#### 작성 중단 "요청"
1. [ ] POST /agency/orders/:id/cancel-request
   - [ ] Body: { reason: string }
   - [ ] 허용 상태: GENERATING, REGEN_QUEUED
   - [ ] 처리: status → CANCEL_REQUESTED, cancelRequestedAt 기록 (예약 유지)
   - [ ] 응답: { message, status:"CANCEL_REQUESTED" }

#### 공통 규칙
1. [ ] 헤더 Idempotency-Key 허용 (중복 클릭 방지)
2. [ ] 권한 가드: 주문의 agencyId와 JWT 일치 확인 → 불일치 403
3. [ ] 상태 불일치 시 409 (CONFLICT) + 원문 메시지
4. [ ] 큐 연동 가드 (선처리): 워커가 잡을 때 CANCEL_REQUESTED면 생성/후속 작업 스킵하고 빠르게 CANCELED + release로 정리

---

### B. 프론트(드로어) 노출/동작

#### 버튼 노출 조건 (드로어 상세 우측/하단)
1. [ ] SUBMITTED | ADMIN_INTAKE → [작성 중단] (위험/빨강)
2. [ ] GENERATING | REGEN_QUEUED → [작성 중단 요청] (회색 외곽선)
3. [ ] CANCEL_REQUESTED → 상단 배지 "작성 중단 요청됨" (노란색), 버튼 비활성
4. [ ] CANCELED | COMPLETE | FAILED | AGENCY_REVIEW → 버튼 미노출

#### 실행 절차 (둘 다 공통)
1. [ ] 클릭 → 사유 입력 모달 (필수 10~300자) → 확인 시
2. [ ] 버튼 disabled + Idempotency-Key 부여 → API 호출
3. [ ] 성공: 드로어 강제 재조회 + 리스트/요약 카드 갱신 + 지갑 카드 갱신
4. [ ] 실패: 409면 드로어 강제 재조회 후 "상태가 변경되었습니다" 토스트
5. [ ] 모든 알림은 top-center, 서버 원문 그대로

#### 레이블/필터 보강
1. [ ] 상태 라벨에 "취소됨(CANCELED)" / "취소 요청(CANCEL_REQUESTED)" 추가
2. [ ] 탭/필터에서 취소/취소요청 포함 여부 반영 (작성 중 탭엔 취소요청은 포함, 취소는 제외)

---

### C. 지갑/거래 훅 (유지)
1. [ ] 산출 시작 (RESERVE): 어드민 산출 버튼에서 reserved↑
2. [ ] 대행사 승인 (CAPTURE): 승인 시 balance↓ / reserved↓ / spentTotal↑
3. [ ] 즉시 취소/실패 (RELEASE): 즉시 취소/산출 실패/어드민 취소 승인 시 reserved↓
4. [ ] 거래 원장: RESERVE/CAPTURE/RELEASE에 ref=orderId 기록

---

### D. 한글화/요청자(이메일) 표기 (충전 관리 재확인)
1. [ ] 상태/유형 라벨 (요청/거래) 전면 한글 (예: PENDING→승인 대기)
2. [ ] 요청 목록 컬럼은 **"요청자(로그인 ID)"**로 이메일 표시 (내부 UUID는 툴팁/복사)
3. [ ] CSV 내보내기도 동일 라벨 적용

---

## ✅ 합격 기준

### 백엔드 API
1. [ ] 즉시 취소: POST /agency/orders/:id/cancel 정상 동작 (허용 상태, 처리, 응답)
2. [ ] 작성 중단 "요청": POST /agency/orders/:id/cancel-request 정상 동작 (허용 상태, 처리, 응답)
3. [ ] 공통 규칙: Idempotency-Key, 권한 가드, 상태 불일치 처리, 큐 연동 가드 정상 동작

### 프론트(드로어) 노출/동작
1. [ ] 버튼 노출 조건 정확 (즉시 취소 가능, 취소 요청만 가능, 취소 요청됨 배지, 버튼 미노출)
2. [ ] 실행 절차 정상 (클릭 → 사유 입력 모달, 버튼 disabled + Idempotency-Key 부여, 성공 처리, 실패 처리, 알림 표준)
3. [ ] 레이블/필터 보강 정상 (상태 라벨 추가, 탭/필터 반영)

### 지갑/거래 훅
1. [ ] 산출 시작 (RESERVE): 어드민 산출 버튼에서 reserved↑ 정상
2. [ ] 대행사 승인 (CAPTURE): 승인 시 balance↓ / reserved↓ / spentTotal↑ 정상
3. [ ] 즉시 취소/실패 (RELEASE): 즉시 취소/산출 실패/어드민 취소 승인 시 reserved↓ 정상
4. [ ] 거래 원장: RESERVE/CAPTURE/RELEASE에 ref=orderId 기록 정상

### 한글화/요청자(이메일) 표기
1. [ ] 상태/유형 라벨 (요청/거래) 전면 한글 정상
2. [ ] 요청 목록 컬럼은 **"요청자(로그인 ID)"**로 이메일 표시 정상
3. [ ] CSV 내보내기도 동일 라벨 적용 정상

---

## 🔧 조치 요약

### 백엔드 API 추가/확정 (AGENCY 전용)
- 즉시 취소: POST /agency/orders/:id/cancel (Body, 허용 상태, 처리, 응답)
- 작성 중단 "요청": POST /agency/orders/:id/cancel-request (Body, 허용 상태, 처리, 응답)
- 공통 규칙: Idempotency-Key, 권한 가드, 상태 불일치 처리, 큐 연동 가드

### 프론트(드로어) 노출/동작
- 버튼 노출 조건 (즉시 취소 가능, 취소 요청만 가능, 취소 요청됨 배지, 버튼 미노출)
- 실행 절차 (클릭 → 사유 입력 모달, 버튼 disabled + Idempotency-Key 부여, 성공 처리, 실패 처리, 알림 표준)
- 레이블/필터 보강 (상태 라벨 추가, 탭/필터 반영)

### 지갑/거래 훅 (유지)
- 산출 시작 (RESERVE): 어드민 산출 버튼에서 reserved↑
- 대행사 승인 (CAPTURE): 승인 시 balance↓ / reserved↓ / spentTotal↑
- 즉시 취소/실패 (RELEASE): 즉시 취소/산출 실패/어드민 취소 승인 시 reserved↓
- 거래 원장: RESERVE/CAPTURE/RELEASE에 ref=orderId 기록

### 한글화/요청자(이메일) 표기 (충전 관리 재확인)
- 상태/유형 라벨 (요청/거래) 전면 한글
- 요청 목록 컬럼은 **"요청자(로그인 ID)"**로 이메일 표시 (내부 UUID는 툴팁/복사)
- CSV 내보내기도 동일 라벨 적용

---

## 🎯 주요 포인트

### 백엔드 API
- 즉시 취소: POST /agency/orders/:id/cancel (허용 상태: SUBMITTED, ADMIN_INTAKE)
- 작성 중단 "요청": POST /agency/orders/:id/cancel-request (허용 상태: GENERATING, REGEN_QUEUED)
- 공통 규칙: Idempotency-Key, 권한 가드, 상태 불일치 처리, 큐 연동 가드

### 프론트(드로어) 노출/동작
- 버튼 노출 조건: 즉시 취소 가능 (SUBMITTED, ADMIN_INTAKE), 취소 요청만 가능 (GENERATING, REGEN_QUEUED)
- 실행 절차: 클릭 → 사유 입력 모달 (필수 10~300자) → 확인 시 → 버튼 disabled + Idempotency-Key 부여 → API 호출
- 성공: 드로어 강제 재조회 + 리스트/요약 카드 갱신 + 지갑 카드 갱신
- 실패: 409면 드로어 강제 재조회 후 "상태가 변경되었습니다" 토스트

### 지갑/거래 훅
- 산출 시작 (RESERVE): 어드민 산출 버튼에서 reserved↑
- 대행사 승인 (CAPTURE): 승인 시 balance↓ / reserved↓ / spentTotal↑
- 즉시 취소/실패 (RELEASE): 즉시 취소/산출 실패/어드민 취소 승인 시 reserved↓

### 한글화/요청자(이메일) 표기
- 상태/유형 라벨 (요청/거래) 전면 한글
- 요청 목록 컬럼은 **"요청자(로그인 ID)"**로 이메일 표시 (내부 UUID는 툴팁/복사)
- CSV 내보내기도 동일 라벨 적용

---

## 📋 API 엔드포인트 요약

### 즉시 취소
- `POST /agency/orders/:id/cancel` (허용 상태: SUBMITTED, ADMIN_INTAKE, Body: { reason: string })

### 작성 중단 "요청"
- `POST /agency/orders/:id/cancel-request` (허용 상태: GENERATING, REGEN_QUEUED, Body: { reason: string })

### 지갑 이벤트 훅
- `RESERVE (amount)` → 어드민 산출 시작
- `CAPTURE (amount)` → 대행사 승인 (APPROVE)
- `RELEASE (amount)` → 즉시 취소 (CANCELED) / 산출 실패 (FAILED) / 어드민 취소 승인





