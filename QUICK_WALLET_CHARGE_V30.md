# 대행사 충전 관리 v3.0 - 빠른 참조

## 🚨 즉시 확인 (5분)

### 1. 범위/원칙
- [ ] 통화: KRW (원화) — 정수 (원) 기준, 소수점 없음, 천단위 구분
- [ ] 지갑 산식: balance, reserved, available, spentTotal 계산
- [ ] 비가역 장부: 삭제 불가, 정정은 ADJUST/REFUND으로만

### 2. 화면 설계
- [ ] 지갑 대시보드: 현재 잔액/가용/총 사용, 충전하기 버튼
- [ ] 충전하기: 빠른 선택 (1만/5만/10만/30만/50만)/직접 입력, 결제수단, 상태 뱃지
- [ ] 거래 내역: 컬럼, 유형 (TOPUP_REQUEST, TOPUP_APPROVED, CAPTURE, RELEASE, RESERVE, ADJUST, REFUND), 필터, 페이지네이션, CSV 내보내기

### 3. API/데이터
- [ ] 조회: GET /agency/wallet, GET /agency/transactions, GET /agency/topups
- [ ] 충전 요청: POST /agency/topups, GET /agency/topups/:id, POST /agency/topups/:id/cancel

### 4. 상태 기계
- [ ] TopupRequest: PENDING → APPROVED / REJECTED / CANCELED / EXPIRED
- [ ] WalletTxn (거래): 불변 레코드, 취소/정정은 REFUND/ADJUST로 상쇄

### 5. 유효성/검증 규칙
- [ ] 금액 입력: 정수, 10,000 ≤ amount ≤ 5,000,000
- [ ] 중복 제출 방지: Idempotency-Key 헤더 허용
- [ ] 속도 제한: 대행사당 분당 5회 충전 요청 제한

### 6. 예약/사용
- [ ] RESERVE (예약): 어드민 "원고 산출" 버튼 시 필요 포인트 홀드
- [ ] CAPTURE (사용): 대행사 검수 통과 (APPROVE) 시 사용 확정
- [ ] RELEASE (해제): 취소/실패 시 예약 해제

### 7. 보안/접근/감사
- [ ] 모든 엔드포인트는 AGENCY 역할만 접근
- [ ] 금액/지갑 관련 모든 동작은 비가역 로그 (AuditLog) 기록

### 8. 오류/경계 케이스
- [ ] 잔액 부족: 예약/사용 시 "잔액 부족" 메시지, "충전하기" CTA 제시
- [ ] 중복 요청: Idempotency-Key 동일 → 기존 요청 응답 재사용
- [ ] 만료: TopupRequest가 설정 유효시간 경과 시 자동 EXPIRED
- [ ] 수량/빈도 제한: 비정상적 빈도 시 429 (Too Many Requests)

### 9. 표시/포맷
- [ ] 금액 렌더: 1,234,567원 (소수 없음, 음수는 "−1,000원")
- [ ] 합계/카드: 항상 KRW 표시
- [ ] 날짜/시간: Asia/Seoul, YYYY-MM-DD HH:mm
- [ ] 통계 카드: 오늘/이번달 스위치 (선택)

---

## ✅ 합격 기준

1. [ ] 지갑 대시보드에 현재 잔액/가용/총 사용이 올바른 금액으로 표시된다 (KRW 정수, 천단위)
2. [ ] 충전하기: 1만/5만/10만/30만/50만/직접입력에서 요청 제출 → PENDING으로 생성되고 top-center 알림이 뜬다
3. [ ] 거래 내역: TOPUP_REQUEST가 즉시 1줄 추가되고, 일시/유형/금액/메모/참조가 맞다
4. [ ] **가용 금액 (available)**은 예약/해제에 따라 즉시 변한다 (대행사 화면에서 확인)
5. [ ] 중복 클릭 시 Idempotency로 중복 생성이 되지 않는다 (같은 응답 재사용)
6. [ ] 속도 제한 동작 (분당 5회 초과 시 429), 메시지가 명확하다
7. [ ] 권한 가드: AGENCY만 조회/요청 가능, 타 역할/미인증은 차단
8. [ ] CSV 내보내기: 거래 내역이 올바른 컬럼으로 추출된다

---

## 🔧 조치 요약

### 범위/원칙
- 통화: KRW (원화) — 정수 (원) 기준, 소수점 없음, 천단위 구분
- 지갑 산식: balance, reserved, available, spentTotal 계산
- 비가역 장부: 삭제 불가, 정정은 ADJUST/REFUND으로만

### 화면 설계
- 지갑 대시보드: 현재 잔액/가용/총 사용, 충전하기 버튼
- 충전하기: 빠른 선택/직접 입력, 결제수단, 상태 뱃지
- 거래 내역: 컬럼, 유형, 필터, 페이지네이션, CSV 내보내기

### API/데이터
- 조회: GET /agency/wallet, GET /agency/transactions, GET /agency/topups
- 충전 요청: POST /agency/topups, GET /agency/topups/:id, POST /agency/topups/:id/cancel

### 상태 기계
- TopupRequest: PENDING → APPROVED / REJECTED / CANCELED / EXPIRED
- WalletTxn (거래): 불변 레코드, 취소/정정은 REFUND/ADJUST로 상쇄

### 유효성/검증 규칙
- 금액 입력: 정수, 10,000 ≤ amount ≤ 5,000,000
- 중복 제출 방지: Idempotency-Key 헤더 허용
- 속도 제한: 대행사당 분당 5회 충전 요청 제한

### 예약/사용
- RESERVE (예약): 어드민 "원고 산출" 버튼 시 필요 포인트 홀드
- CAPTURE (사용): 대행사 검수 통과 (APPROVE) 시 사용 확정
- RELEASE (해제): 취소/실패 시 예약 해제

### 보안/접근/감사
- 모든 엔드포인트는 AGENCY 역할만 접근
- 금액/지갑 관련 모든 동작은 비가역 로그 (AuditLog) 기록

### 오류/경계 케이스
- 잔액 부족: 예약/사용 시 "잔액 부족" 메시지, "충전하기" CTA 제시
- 중복 요청: Idempotency-Key 동일 → 기존 요청 응답 재사용
- 만료: TopupRequest가 설정 유효시간 경과 시 자동 EXPIRED
- 수량/빈도 제한: 비정상적 빈도 시 429 (Too Many Requests)

### 표시/포맷
- 금액 렌더: 1,234,567원 (소수 없음, 음수는 "−1,000원")
- 합계/카드: 항상 KRW 표시
- 날짜/시간: Asia/Seoul, YYYY-MM-DD HH:mm
- 통계 카드: 오늘/이번달 스위치 (선택)






