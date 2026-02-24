# 대행사 마이페이지 v4.0 (Lite) - 설계/지시문 & 검증 체크리스트

## 🎯 목표
대행사가 직접 수정할 수 있는 필수 정보만 포함한 간소화된 마이페이지
- 개인 정보 (이메일, 담당자 이름, 연락처)
- 사업자 정보 (사업자명, 사업자등록번호, 대표자/담당자, 주소)
- 정산(환불) 계좌 (은행명, 예금주, 계좌번호)

---

## A. 라우팅 / 레이아웃

### 📋 실행 단계

### 1. 라우트 설정 확인

**확인 항목:**
- [ ] 경로: `/agency/mypage` (기존 좌측 메뉴 "마이 페이지"와 동일 경로 유지)
- [ ] 탭 3개: 개인 정보 / 사업자 정보 / 정산(환불) 계좌
- [ ] AppShell + RouteGuard(AGENCY 전용) 재사용
- [ ] 저장 토스트는 top-center
- [ ] 버튼은 저장 중 비활성화

**확인 방법:**
1. 라우트 파일 확인:
   - [ ] `apps/web/app/agency/mypage/page.tsx` 존재 확인
   - [ ] 경로가 `/agency/mypage`인지 확인
2. 레이아웃 확인:
   - [ ] `AppShell` 컴포넌트 사용 확인
   - [ ] `RouteGuard` with `requiredRole="AGENCY"` 확인
3. 탭 구조 확인:
   - [ ] 탭 3개 렌더링 확인 (개인 정보, 사업자 정보, 정산 계좌)
4. 토스트 위치 확인:
   - [ ] `toast` 설정이 `position: 'top-center'`인지 확인
5. 버튼 상태 확인:
   - [ ] 저장 중 버튼 `disabled` 및 로딩 스피너 표시 확인

**확인 체크리스트:**
- [ ] 경로: `/agency/mypage`
- [ ] 탭 3개: 개인 정보 / 사업자 정보 / 정산(환불) 계좌
- [ ] AppShell + RouteGuard(AGENCY 전용) 재사용
- [ ] 저장 토스트는 top-center
- [ ] 버튼은 저장 중 비활성화

---

## B. 화면·필드(최소)

### B-1. 개인 정보 탭

### 📋 실행 단계

### 1. 개인 정보 필드 확인

**확인 항목:**
- [ ] 이메일: readOnly (로그인 ID)
- [ ] 담당자 이름: name (필수)
- [ ] 연락처: phone (필수, 010-0000-0000 형식)
- [ ] [저장] 버튼
- [ ] 성공 토스트 "개인 정보가 저장되었어요"

**확인 방법:**
1. 필드 확인:
   - [ ] 이메일 필드가 `readOnly` 또는 `disabled`인지 확인
   - [ ] 담당자 이름 필드가 `required`인지 확인
   - [ ] 연락처 필드가 `required`이고 형식 검증(010-0000-0000)이 있는지 확인
2. 저장 동작 확인:
   - [ ] [저장] 버튼 클릭 시 API 호출 확인
   - [ ] 성공 시 토스트 "개인 정보가 저장되었어요" 표시 확인

**확인 체크리스트:**
- [ ] 이메일: readOnly (로그인 ID)
- [ ] 담당자 이름: name (필수)
- [ ] 연락처: phone (필수, 010-0000-0000 형식)
- [ ] [저장] 버튼
- [ ] 성공 토스트 "개인 정보가 저장되었어요"

---

### B-2. 사업자 정보 탭

### 📋 실행 단계

### 1. 사업자 정보 필드 확인

**확인 항목:**
- [ ] 사업자명: businessName (필수)
- [ ] 사업자등록번호: businessRegNo (필수, 숫자 10자리)
- [ ] 대표자/담당자(선택): ownerName / contactName
- [ ] 사업장 주소(선택): address
- [ ] [저장] 버튼
- [ ] 성공 토스트 "사업자 정보가 저장되었어요"

**확인 방법:**
1. 필드 확인:
   - [ ] 사업자명 필드가 `required`인지 확인
   - [ ] 사업자등록번호 필드가 `required`이고 숫자 10자리 검증이 있는지 확인
   - [ ] 대표자/담당자 필드가 선택 사항인지 확인
   - [ ] 사업장 주소 필드가 선택 사항인지 확인
2. 저장 동작 확인:
   - [ ] [저장] 버튼 클릭 시 API 호출 확인
   - [ ] 성공 시 토스트 "사업자 정보가 저장되었어요" 표시 확인

**확인 체크리스트:**
- [ ] 사업자명: businessName (필수)
- [ ] 사업자등록번호: businessRegNo (필수, 숫자 10자리)
- [ ] 대표자/담당자(선택): ownerName / contactName
- [ ] 사업장 주소(선택): address
- [ ] [저장] 버튼
- [ ] 성공 토스트 "사업자 정보가 저장되었어요"

---

### B-3. 정산(환불) 계좌 탭

### 📋 실행 단계

### 1. 정산 계좌 필드 확인

**확인 항목:**
- [ ] 은행명: bankName (필수)
- [ ] 예금주: accountHolder (필수)
- [ ] 계좌번호: accountNo (필수) — 화면 표시는 끝 4자리만 노출 (예: 110-****-**45)
- [ ] [저장] 버튼
- [ ] 성공 토스트 "정산 계좌가 저장되었어요"

**확인 방법:**
1. 필드 확인:
   - [ ] 은행명 필드가 `required`인지 확인
   - [ ] 예금주 필드가 `required`인지 확인
   - [ ] 계좌번호 필드가 `required`이고 입력 시 전체 표시, 저장 후 목록에는 끝 4자리만 마스킹 표시 확인
2. 저장 동작 확인:
   - [ ] [저장] 버튼 클릭 시 API 호출 확인
   - [ ] 성공 시 토스트 "정산 계좌가 저장되었어요" 표시 확인

**확인 체크리스트:**
- [ ] 은행명: bankName (필수)
- [ ] 예금주: accountHolder (필수)
- [ ] 계좌번호: accountNo (필수) — 화면 표시는 끝 4자리만 노출 (예: 110-****-**45)
- [ ] [저장] 버튼
- [ ] 성공 토스트 "정산 계좌가 저장되었어요"

---

## C. 백엔드 API (AGENCY 전용 / JWT + Role=AGENCY)

### C-1. GET /agency/me-lite

### 📋 실행 단계

### 1. 조회 API 확인

**확인 항목:**
- [ ] 엔드포인트: GET /agency/me-lite
- [ ] 가드: JWT + Role=AGENCY
- [ ] 응답: { profile, business, payout }
  - [ ] profile: { email, name, phone }
  - [ ] business: { businessName, businessRegNo, ownerName?, contactName?, address? }
  - [ ] payout: { bankName, accountHolder, accountNoMasked }

**확인 방법:**
1. API 엔드포인트 확인:
   - [ ] `GET /agency/me-lite` 엔드포인트 존재 확인
   - [ ] `@UseGuards(JwtAuthGuard, RolesGuard)` 및 `@Roles(UserRole.AGENCY)` 확인
2. 응답 확인:
   - [ ] 응답에 `profile`, `business`, `payout` 모두 포함 확인
   - [ ] `payout.accountNoMasked`가 끝 4자리만 노출하는지 확인

**확인 체크리스트:**
- [ ] 엔드포인트: GET /agency/me-lite
- [ ] 가드: JWT + Role=AGENCY
- [ ] 응답: { profile, business, payout }

---

### C-2. PUT /agency/me/profile

### 📋 실행 단계

### 1. 개인 정보 수정 API 확인

**확인 항목:**
- [ ] 엔드포인트: PUT /agency/me/profile
- [ ] 가드: JWT + Role=AGENCY
- [ ] 요청: { name, phone }
- [ ] 검증: phone 010-0000-0000 패턴 미일치 시 400
- [ ] 권한: req.user.id와 대상 userId 매칭 필수
- [ ] 감사로그: who, when, what(before→after)

**확인 방법:**
1. API 엔드포인트 확인:
   - [ ] `PUT /agency/me/profile` 엔드포인트 존재 확인
   - [ ] `@UseGuards(JwtAuthGuard, RolesGuard)` 및 `@Roles(UserRole.AGENCY)` 확인
2. 검증 확인:
   - [ ] phone 형식 검증 (010-0000-0000 패턴) 확인
   - [ ] 형식 불일치 시 400 응답 확인
3. 권한 확인:
   - [ ] 다른 userId로 PUT 시 403 응답 확인
4. 감사로그 확인:
   - [ ] 변경 감사로그 기록 확인 (who, when, what)

**확인 체크리스트:**
- [ ] 엔드포인트: PUT /agency/me/profile
- [ ] 가드: JWT + Role=AGENCY
- [ ] 요청: { name, phone }
- [ ] 검증: phone 010-0000-0000 패턴 미일치 시 400
- [ ] 권한: req.user.id와 대상 userId 매칭 필수
- [ ] 감사로그: who, when, what(before→after)

---

### C-3. PUT /agency/me/business

### 📋 실행 단계

### 1. 사업자 정보 수정 API 확인

**확인 항목:**
- [ ] 엔드포인트: PUT /agency/me/business
- [ ] 가드: JWT + Role=AGENCY
- [ ] 요청: { businessName, businessRegNo, ownerName?, contactName?, address? }
- [ ] 검증: businessRegNo 숫자 10자리만 허용 (미달·문자 포함 시 400)
- [ ] 권한: req.user.id와 대상 userId 매칭 필수
- [ ] 감사로그: who, when, what(before→after)

**확인 방법:**
1. API 엔드포인트 확인:
   - [ ] `PUT /agency/me/business` 엔드포인트 존재 확인
   - [ ] `@UseGuards(JwtAuthGuard, RolesGuard)` 및 `@Roles(UserRole.AGENCY)` 확인
2. 검증 확인:
   - [ ] businessRegNo 숫자 10자리 검증 확인
   - [ ] 미달 또는 문자 포함 시 400 응답 확인
3. 권한 확인:
   - [ ] 다른 userId로 PUT 시 403 응답 확인
4. 감사로그 확인:
   - [ ] 변경 감사로그 기록 확인 (who, when, what)

**확인 체크리스트:**
- [ ] 엔드포인트: PUT /agency/me/business
- [ ] 가드: JWT + Role=AGENCY
- [ ] 요청: { businessName, businessRegNo, ownerName?, contactName?, address? }
- [ ] 검증: businessRegNo 숫자 10자리만 허용 (미달·문자 포함 시 400)
- [ ] 권한: req.user.id와 대상 userId 매칭 필수
- [ ] 감사로그: who, when, what(before→after)

---

### C-4. PUT /agency/me/payout

### 📋 실행 단계

### 1. 정산 계좌 수정 API 확인

**확인 항목:**
- [ ] 엔드포인트: PUT /agency/me/payout
- [ ] 가드: JWT + Role=AGENCY
- [ ] 요청: { bankName, accountHolder, accountNo }
- [ ] 저장: accountNo는 평문으로 받아서 서버 보관 시 암호화 필드(예: at-rest 암호화)에 저장
- [ ] 응답: accountNoMasked (끝 4자리만 노출)
- [ ] 권한: req.user.id와 대상 userId 매칭 필수
- [ ] 감사로그: who, when, what(before→after)

**확인 방법:**
1. API 엔드포인트 확인:
   - [ ] `PUT /agency/me/payout` 엔드포인트 존재 확인
   - [ ] `@UseGuards(JwtAuthGuard, RolesGuard)` 및 `@Roles(UserRole.AGENCY)` 확인
2. 암호화 확인:
   - [ ] accountNo가 암호화되어 저장되는지 확인 (at-rest 암호화)
   - [ ] 응답에 평문 accountNo가 포함되지 않는지 확인
   - [ ] 응답에 accountNoMasked (끝 4자리만) 포함 확인
3. 권한 확인:
   - [ ] 다른 userId로 PUT 시 403 응답 확인
4. 감사로그 확인:
   - [ ] 변경 감사로그 기록 확인 (who, when, what)

**확인 체크리스트:**
- [ ] 엔드포인트: PUT /agency/me/payout
- [ ] 가드: JWT + Role=AGENCY
- [ ] 요청: { bankName, accountHolder, accountNo }
- [ ] 저장: accountNo는 평문으로 받아서 서버 보관 시 암호화 필드에 저장
- [ ] 응답: accountNoMasked (끝 4자리만 노출)
- [ ] 권한: req.user.id와 대상 userId 매칭 필수
- [ ] 감사로그: who, when, what(before→after)

---

## D. 데이터 모델(심플)

### 📋 실행 단계

### 1. 데이터 모델 확인

**확인 항목:**
- [ ] users(기존): id, email, name, phone, role, status, createdAt
- [ ] agency_profiles: userId(FK), businessName, businessRegNo, ownerName, contactName, address
- [ ] agency_payouts: userId(FK), bankName, accountHolder, accountNoEnc, accountNoLast4

**확인 방법:**
1. 엔티티 확인:
   - [ ] `User` 엔티티에 `name`, `phone` 필드 존재 확인
   - [ ] `AgencyProfile` 엔티티 생성 및 필드 확인
   - [ ] `AgencyPayout` 엔티티 생성 및 필드 확인 (accountNoEnc, accountNoLast4)
2. 관계 확인:
   - [ ] `AgencyProfile.userId`가 `User.id`와 FK 관계인지 확인
   - [ ] `AgencyPayout.userId`가 `User.id`와 FK 관계인지 확인

**확인 체크리스트:**
- [ ] users(기존): id, email, name, phone, role, status, createdAt
- [ ] agency_profiles: userId(FK), businessName, businessRegNo, ownerName, contactName, address
- [ ] agency_payouts: userId(FK), bankName, accountHolder, accountNoEnc, accountNoLast4

---

## 📊 VS Code 검증 지시문 (체크리스트)

### 1) 기본 조회/렌더

### 📋 실행 단계

### 1. GET /agency/me-lite 200 응답 확인

**확인 항목:**
- [ ] GET /agency/me-lite 200 응답
- [ ] 응답에 profile·business·payout 모두 포함
- [ ] 이메일은 읽기 전용, 다른 입력값은 스켈레톤 → 편집 가능

**확인 방법:**
1. API 호출 확인:
   - [ ] `GET /agency/me-lite` 호출 시 200 응답 확인
   - [ ] 응답에 `profile`, `business`, `payout` 모두 포함 확인
2. UI 렌더링 확인:
   - [ ] 이메일 필드가 읽기 전용인지 확인
   - [ ] 다른 입력 필드가 편집 가능한지 확인
   - [ ] 로딩 중 스켈레톤 표시 확인

**확인 체크리스트:**
- [ ] GET /agency/me-lite 200 응답
- [ ] 응답에 profile·business·payout 모두 포함
- [ ] 이메일은 읽기 전용, 다른 입력값은 스켈레톤 → 편집 가능

---

### 2) 저장 성공·오류 흐름

### 📋 실행 단계

### 1. 개인 정보 저장 성공 확인

**확인 항목:**
- [ ] 개인 정보 저장: 올바른 name/phone → 200 & top-center 토스트

**확인 방법:**
1. 저장 동작 확인:
   - [ ] 올바른 name, phone 입력 후 저장
   - [ ] 200 응답 확인
   - [ ] top-center 토스트 "개인 정보가 저장되었어요" 표시 확인

**확인 체크리스트:**
- [ ] 개인 정보 저장: 올바른 name/phone → 200 & top-center 토스트

---

### 2. 전화번호 오류 확인

**확인 항목:**
- [ ] 전화번호 오류: 형식 불일치 → 400 & 서버 메시지 그대로 표기

**확인 방법:**
1. 오류 동작 확인:
   - [ ] 잘못된 전화번호 형식 입력 (예: 010-1234-567)
   - [ ] 400 응답 확인
   - [ ] 서버 메시지가 토스트에 그대로 표시되는지 확인

**확인 체크리스트:**
- [ ] 전화번호 오류: 형식 불일치 → 400 & 서버 메시지 그대로 표기

---

### 3. 사업자등록번호 오류 확인

**확인 항목:**
- [ ] 사업자등록번호 오류: 자릿수 ≠ 10 → 400

**확인 방법:**
1. 오류 동작 확인:
   - [ ] 잘못된 사업자등록번호 입력 (예: 12345 또는 123456789012)
   - [ ] 400 응답 확인
   - [ ] 서버 메시지가 토스트에 그대로 표시되는지 확인

**확인 체크리스트:**
- [ ] 사업자등록번호 오류: 자릿수 ≠ 10 → 400

---

### 4. 정산계좌 저장 확인

**확인 항목:**
- [ ] 정산계좌 저장: 200 & 목록엔 accountNoMasked(끝 4자리만)로 노출

**확인 방법:**
1. 저장 동작 확인:
   - [ ] 올바른 계좌 정보 입력 후 저장
   - [ ] 200 응답 확인
   - [ ] 저장 후 목록/조회 시 accountNoMasked (끝 4자리만)로 표시 확인

**확인 체크리스트:**
- [ ] 정산계좌 저장: 200 & 목록엔 accountNoMasked(끝 4자리만)로 노출

---

### 3) 권한·보안

### 📋 실행 단계

### 1. 다른 userId로 PUT 시 403 확인

**확인 항목:**
- [ ] 다른 userId로 PUT 시 403

**확인 방법:**
1. 권한 확인:
   - [ ] 다른 userId로 PUT 요청 시도
   - [ ] 403 응답 확인

**확인 체크리스트:**
- [ ] 다른 userId로 PUT 시 403

---

### 2. 계좌번호 암호화 확인

**확인 항목:**
- [ ] 서버 저장 시 계좌번호 암호화가 적용되는지 (마이그레이션/엔티티 확인)
- [ ] 응답에 평문 계좌번호가 절대 포함되지 않음

**확인 방법:**
1. 암호화 확인:
   - [ ] 엔티티에서 accountNoEnc 필드 확인
   - [ ] 저장 시 암호화 로직 확인
   - [ ] 응답에 평문 accountNo가 포함되지 않는지 확인

**확인 체크리스트:**
- [ ] 서버 저장 시 계좌번호 암호화가 적용되는지 (마이그레이션/엔티티 확인)
- [ ] 응답에 평문 계좌번호가 절대 포함되지 않음

---

### 4) UI/UX

### 📋 실행 단계

### 1. 저장 중 버튼 비활성화 및 로딩 표시 확인

**확인 항목:**
- [ ] 저장 중 버튼 비활성화 & 로딩 표시

**확인 방법:**
1. UI 확인:
   - [ ] 저장 버튼 클릭 시 `disabled` 상태 확인
   - [ ] 로딩 스피너 표시 확인

**확인 체크리스트:**
- [ ] 저장 중 버튼 비활성화 & 로딩 표시

---

### 2. 토스트 위치 확인

**확인 항목:**
- [ ] 모든 토스트 한글/상단 중앙

**확인 방법:**
1. 토스트 확인:
   - [ ] 모든 토스트 메시지가 한글로 표시되는지 확인
   - [ ] 토스트 위치가 상단 중앙인지 확인

**확인 체크리스트:**
- [ ] 모든 토스트 한글/상단 중앙

---

### 3. 마지막 저장 시간 표기 확인

**확인 항목:**
- [ ] 마지막 저장 시간 "마지막 업데이트: YYYY.MM.DD HH:mm" 표기

**확인 방법:**
1. UI 확인:
   - [ ] 각 탭에 "마지막 업데이트: YYYY.MM.DD HH:mm" 형식으로 표시되는지 확인
   - [ ] 저장 후 시간이 업데이트되는지 확인

**확인 체크리스트:**
- [ ] 마지막 저장 시간 "마지막 업데이트: YYYY.MM.DD HH:mm" 표기

---

### 5) DoD(완료 기준)

### 📋 실행 단계

### 1. 완료 기준 확인

**확인 항목:**
- [ ] 위 항목 전부 PASS
- [ ] 타입/ESLint 오류 0 (또는 빌드 차단 無)
- [ ] 스크린샷 3장: 탭별 화면/성공 토스트/오류 토스트

**확인 방법:**
1. 코드 품질 확인:
   - [ ] TypeScript 타입 오류 0개 확인
   - [ ] ESLint 오류 0개 확인
   - [ ] 빌드 성공 확인
2. 스크린샷 확인:
   - [ ] 탭별 화면 스크린샷 (개인 정보, 사업자 정보, 정산 계좌)
   - [ ] 성공 토스트 스크린샷
   - [ ] 오류 토스트 스크린샷

**확인 체크리스트:**
- [ ] 위 항목 전부 PASS
- [ ] 타입/ESLint 오류 0 (또는 빌드 차단 無)
- [ ] 스크린샷 3장: 탭별 화면/성공 토스트/오류 토스트

---

## 🔧 트리아지 리포트 템플릿

### 대행사 마이페이지 v4.0 (Lite) 실패 리포트 작성 시:

```
## 대행사 마이페이지 v4.0 (Lite) 실패 리포트

### 1. 기본 조회/렌더
- GET /agency/me-lite: [ ] 200 응답 [ ] 오류
- 응답 구조: [ ] profile·business·payout 모두 포함 [ ] 오류
- UI 렌더링: [ ] 이메일 읽기 전용 [ ] 오류

### 2. 저장 성공·오류 흐름
- 개인 정보 저장: [ ] 200 & 토스트 [ ] 오류
- 전화번호 오류: [ ] 400 & 서버 메시지 표기 [ ] 오류
- 사업자등록번호 오류: [ ] 400 [ ] 오류
- 정산계좌 저장: [ ] 200 & 마스킹 표시 [ ] 오류

### 3. 권한·보안
- 다른 userId로 PUT: [ ] 403 [ ] 오류
- 계좌번호 암호화: [ ] 적용됨 [ ] 오류
- 응답에 평문 계좌번호: [ ] 포함 안 됨 [ ] 오류

### 4. UI/UX
- 저장 중 버튼: [ ] 비활성화 & 로딩 [ ] 오류
- 토스트 위치: [ ] 한글/상단 중앙 [ ] 오류
- 마지막 저장 시간: [ ] 표기됨 [ ] 오류

### 5. DoD
- 모든 항목 PASS: [ ] 예 [ ] 아니오
- 타입/ESLint 오류: [ ] 0개 [ ] 오류
- 스크린샷: [ ] 3장 모두 [ ] 누락

### 6. 원인 추정
1순위: [ ] API 오류
2순위: [ ] UI/UX 오류
3순위: [ ] 권한/보안 오류

### 7. 조치
- [ ] API 수정
- [ ] UI/UX 수정
- [ ] 권한/보안 수정
```



