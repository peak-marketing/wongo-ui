# 대행사 마이페이지 v4.0 (Lite) - 빠른 참조

## 🚨 즉시 확인 (5분)

### 1. 기본 조회/렌더
1. [ ] GET /agency/me-lite 200 응답
2. [ ] 응답에 profile·business·payout 모두 포함
3. [ ] 이메일은 읽기 전용, 다른 입력값은 스켈레톤 → 편집 가능

### 2. 저장 성공·오류 흐름
1. [ ] 개인 정보 저장: 올바른 name/phone → 200 & top-center 토스트
2. [ ] 전화번호 오류: 형식 불일치 → 400 & 서버 메시지 그대로 표기
3. [ ] 사업자등록번호 오류: 자릿수 ≠ 10 → 400
4. [ ] 정산계좌 저장: 200 & 목록엔 accountNoMasked(끝 4자리만)로 노출

### 3. 권한·보안
1. [ ] 다른 userId로 PUT 시 403
2. [ ] 서버 저장 시 계좌번호 암호화가 적용되는지 (마이그레이션/엔티티 확인)
3. [ ] 응답에 평문 계좌번호가 절대 포함되지 않음

### 4. UI/UX
1. [ ] 저장 중 버튼 비활성화 & 로딩 표시
2. [ ] 모든 토스트 한글/상단 중앙
3. [ ] 마지막 저장 시간 "마지막 업데이트: YYYY.MM.DD HH:mm" 표기

### 5. DoD(완료 기준)
1. [ ] 위 항목 전부 PASS
2. [ ] 타입/ESLint 오류 0 (또는 빌드 차단 無)
3. [ ] 스크린샷 3장: 탭별 화면/성공 토스트/오류 토스트

---

## ✅ 합격 기준

### 1. 기본 조회/렌더
1. [ ] GET /agency/me-lite 200 응답
2. [ ] 응답에 profile·business·payout 모두 포함
3. [ ] 이메일은 읽기 전용, 다른 입력값은 편집 가능

### 2. 저장 성공·오류 흐름
1. [ ] 개인 정보 저장 성공 (200 & 토스트)
2. [ ] 전화번호 오류 처리 (400 & 서버 메시지)
3. [ ] 사업자등록번호 오류 처리 (400)
4. [ ] 정산계좌 저장 성공 (200 & 마스킹 표시)

### 3. 권한·보안
1. [ ] 다른 userId로 PUT 시 403
2. [ ] 계좌번호 암호화 적용
3. [ ] 응답에 평문 계좌번호 포함 안 됨

### 4. UI/UX
1. [ ] 저장 중 버튼 비활성화 & 로딩 표시
2. [ ] 모든 토스트 한글/상단 중앙
3. [ ] 마지막 저장 시간 표기

### 5. DoD
1. [ ] 모든 항목 PASS
2. [ ] 타입/ESLint 오류 0개
3. [ ] 스크린샷 3장 모두

---

## 🔧 조치 요약

### 1. 기본 조회/렌더
- GET /agency/me-lite 엔드포인트 구현
- 응답 구조: { profile, business, payout }
- UI: 이메일 읽기 전용, 다른 필드 편집 가능

### 2. 저장 성공·오류 흐름
- PUT /agency/me/profile (name, phone)
- PUT /agency/me/business (businessName, businessRegNo, ...)
- PUT /agency/me/payout (bankName, accountHolder, accountNo)
- 검증: phone 형식, businessRegNo 10자리, 계좌번호 마스킹

### 3. 권한·보안
- JWT + Role=AGENCY 가드
- req.user.id와 대상 userId 매칭 필수
- 계좌번호 암호화 (at-rest)
- 응답에 평문 계좌번호 포함 안 됨

### 4. UI/UX
- 저장 중 버튼 비활성화 & 로딩 표시
- 모든 토스트 한글/상단 중앙
- 마지막 저장 시간 표기

### 5. DoD
- 모든 항목 PASS
- 타입/ESLint 오류 0개
- 스크린샷 3장 모두

---

## 🎯 주요 포인트

### 1. 라우팅 / 레이아웃
- 경로: /agency/mypage
- 탭 3개: 개인 정보 / 사업자 정보 / 정산(환불) 계좌
- AppShell + RouteGuard(AGENCY 전용) 재사용
- 저장 토스트는 top-center
- 버튼은 저장 중 비활성화

### 2. 화면·필드(최소)
- 개인 정보: 이메일(readOnly), 담당자 이름(필수), 연락처(필수, 010-0000-0000 형식)
- 사업자 정보: 사업자명(필수), 사업자등록번호(필수, 숫자 10자리), 대표자/담당자(선택), 주소(선택)
- 정산 계좌: 은행명(필수), 예금주(필수), 계좌번호(필수, 끝 4자리만 노출)

### 3. 백엔드 API
- GET /agency/me-lite → { profile, business, payout }
- PUT /agency/me/profile → { name, phone }
- PUT /agency/me/business → { businessName, businessRegNo, ... }
- PUT /agency/me/payout → { bankName, accountHolder, accountNo }
- 검증: phone 형식, businessRegNo 10자리, 계좌번호 암호화

### 4. 데이터 모델
- users(기존): id, email, name, phone, role, status, createdAt
- agency_profiles: userId(FK), businessName, businessRegNo, ownerName, contactName, address
- agency_payouts: userId(FK), bankName, accountHolder, accountNoEnc, accountNoLast4

---

## 📋 API 엔드포인트 요약

### 조회
- `GET /agency/me-lite` → { profile, business, payout }

### 수정
- `PUT /agency/me/profile` → { name, phone }
- `PUT /agency/me/business` → { businessName, businessRegNo, ownerName?, contactName?, address? }
- `PUT /agency/me/payout` → { bankName, accountHolder, accountNo }

---

## 🔍 검증 체크리스트 요약

### 1. 기본 조회/렌더
- [ ] GET /agency/me-lite 200 응답
- [ ] 응답에 profile·business·payout 모두 포함
- [ ] 이메일은 읽기 전용, 다른 입력값은 편집 가능

### 2. 저장 성공·오류 흐름
- [ ] 개인 정보 저장: 올바른 name/phone → 200 & top-center 토스트
- [ ] 전화번호 오류: 형식 불일치 → 400 & 서버 메시지 그대로 표기
- [ ] 사업자등록번호 오류: 자릿수 ≠ 10 → 400
- [ ] 정산계좌 저장: 200 & 목록엔 accountNoMasked(끝 4자리만)로 노출

### 3. 권한·보안
- [ ] 다른 userId로 PUT 시 403
- [ ] 서버 저장 시 계좌번호 암호화가 적용되는지 (마이그레이션/엔티티 확인)
- [ ] 응답에 평문 계좌번호가 절대 포함되지 않음

### 4. UI/UX
- [ ] 저장 중 버튼 비활성화 & 로딩 표시
- [ ] 모든 토스트 한글/상단 중앙
- [ ] 마지막 저장 시간 "마지막 업데이트: YYYY.MM.DD HH:mm" 표기

### 5. DoD(완료 기준)
- [ ] 위 항목 전부 PASS
- [ ] 타입/ESLint 오류 0 (또는 빌드 차단 無)
- [ ] 스크린샷 3장: 탭별 화면/성공 토스트/오류 토스트



