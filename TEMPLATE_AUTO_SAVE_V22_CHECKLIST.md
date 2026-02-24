# A업체 자동저장 드롭다운 v2.2 (대행사) 구현 체크리스트

## 📋 현재 구현 상태 점검

### ✅ 이미 구현됨
- [x] OrderTemplate 엔티티: `(agencyId, placeName)` 조합으로 저장
- [x] GET /agency/order-templates?place=<placeName> API
- [x] 템플릿 자동 저장: 임시 저장/최종 접수 시 자동 저장
- [x] 최근 5개 유지: 기존 템플릿 개수 확인 후 오래된 것 삭제
- [x] 프론트엔드 드롭다운: 플레이스명 입력 시 자동 로드
- [x] 템플릿 선택 시 폼 자동 채움 (사진 제외)

### ⚠️ 개선 필요
- [ ] 저장 타이밍 명확화: DRAFT 또는 최종 접수 성공 시점에만 저장
- [ ] 스냅샷 범위 확인: 텍스트/체크 필드만 저장 (사진 제외)
- [ ] 드롭다운 위치: 우측 사이드 패널 상단으로 이동
- [ ] 디바운스 적용: placeName 입력 시 자동 호출 디바운스
- [ ] 라벨 개선: "최근 템플릿 불러오기(업체명 기준)" / 빈 상태 메시지
- [ ] 권한 검증: agencyId 스코프 확인

---

## A. 저장 전략 (언제 저장?)

### 📝 요구사항
- **저장 타이밍:**
  - 임시 저장(DRAFT) 성공 시점
  - 최종 접수 성공 시점

- **스냅샷 범위 (복원 대상):**
  - 검색키워드 (searchKeywords)
  - 필수 키워드 (requiredKeywords)
  - 강조 키워드 (emphasizeKeywords)
  - 링크/지도 플래그 (link, map)
  - 해시태그 (hashtags, 최대 5개)
  - 비고 (notes)
  - 주소 (address)
  - 원고에 들어갈 내용 (includeText)
  - 참고 리뷰 (referenceText)

- **사진:**
  - 복원하지 않음 (매 접수 재업로드 원칙)

### ✅ 확인 사항
- [ ] `saveAsDraft=true` 성공 시 템플릿 자동 저장
- [ ] `saveAsDraft=false` (최종 접수) 성공 시 템플릿 자동 저장
- [ ] 스냅샷에 텍스트/체크 필드만 포함 (사진 제외)
- [ ] 사진 메타데이터는 템플릿에 저장하지 않음

### 🔧 구현 위치
- `apps/api/src/orders/orders.service.ts` (createOrder, updateOrder 메서드)

---

## B. 식별 키 (무엇을 기억?)

### 📝 요구사항
- **키:** `(agencyId, placeName)` 조합
- **보관 개수:** 최근 N개 (예: 5개)만 유지
- **삭제 규칙:** 오래된 것부터 삭제

### ✅ 확인 사항
- [ ] OrderTemplate 테이블에 `agencyId`, `placeName` 컬럼 존재
- [ ] 저장 시 `(agencyId, placeName)` 조합으로 저장
- [ ] 조회 시 `(agencyId, placeName)` 기준으로 필터링
- [ ] 기존 템플릿 개수 확인 (COUNT 쿼리)
- [ ] 5개 이상일 때 가장 오래된 것 삭제 (createdAt ASC 정렬)
- [ ] 삭제 후 새 템플릿 저장

### 🔧 구현 위치
- `apps/api/src/agency/order-template.entity.ts`
- `apps/api/src/orders/orders.service.ts` (템플릿 저장 로직)

---

## C. API 스펙 (엔드포인트 수준)

### 📝 요구사항

**GET /agency/order-templates?place=<placeName>**
- 반환: 최근 템플릿 리스트
- 텍스트/체크 필드만 (사진 제외)
- 최신순 정렬
- 최대 5개

**POST /agency/order-templates** (또는 자동 저장)
- 입력: `(placeName, snapshot)`
- 호출 시점: DRAFT 또는 최종 접수 직후
- 자동 저장 (명시적 POST 호출 없이 주문 생성/업데이트 시 자동 저장)

### ✅ 확인 사항
- [ ] GET 엔드포인트: `placeName` 파라미터로 필터링
- [ ] GET 응답: 텍스트/체크 필드만 포함 (사진 제외)
- [ ] GET 응답: 최신순 정렬 (createdAt DESC)
- [ ] GET 응답: 최대 5개 제한
- [ ] 자동 저장: DRAFT 또는 최종 접수 성공 시 자동 저장
- [ ] 저장 시 `(agencyId, placeName)` 조합 사용

### 🔧 구현 위치
- `apps/api/src/agency/order-template.controller.ts`
- `apps/api/src/orders/orders.service.ts` (자동 저장 로직)

---

## D. UI 동작 (우측 패널 드롭다운)

### 📝 요구사항
- **위치:** "새 주문 생성" 폼의 우측 사이드 패널 상단
- **동작:**
  1. `placeName` 입력 시 자동으로 GET /agency/order-templates 호출 (디바운스)
  2. 드롭다운 선택 시 현재 폼에 덮어쓰기 적용 (사진 제외)
  3. 복원 후에도 사진 카운터/제출 조건(15~20장)은 그대로 적용
- **라벨:**
  - 드롭다운: "최근 템플릿 불러오기(업체명 기준)"
  - 비어 있으면: "이 업체의 저장된 템플릿이 없습니다."

### ✅ 확인 사항
- [ ] 드롭다운 위치: 우측 사이드 패널 상단 (또는 플레이스명 입력 필드 아래)
- [ ] `placeName` 입력 시 자동 호출 (디바운스 적용, 예: 500ms)
- [ ] 드롭다운 선택 시 폼 덮어쓰기 (텍스트/체크 필드만)
- [ ] 사진은 복원하지 않음 (사진 배열은 그대로 유지)
- [ ] 사진 카운터: 15~20장 조건 유지
- [ ] 제출 버튼 활성 조건: 사진 15~20장 + 필수 필드 충족
- [ ] 라벨: "최근 템플릿 불러오기(업체명 기준)"
- [ ] 빈 상태: "이 업체의 저장된 템플릿이 없습니다." 메시지

### 🔧 구현 위치
- `apps/web/app/agency/orders/new/page.tsx`

---

## E. 권한/보안

### 📝 요구사항
- 템플릿은 대행사 소속 데이터만 조회 가능 (agencyId 스코프)
- 서버는 `(agencyId, placeName)` 기준으로만 반환/저장 처리

### ✅ 확인 사항
- [ ] GET 엔드포인트: JWT에서 `agencyId` 추출
- [ ] GET 쿼리: `WHERE agencyId = :agencyId AND placeName = :placeName`
- [ ] POST/자동 저장: JWT에서 `agencyId` 추출하여 저장
- [ ] 다른 대행사의 템플릿 접근 불가 (403 또는 빈 리스트)

### 🔧 구현 위치
- `apps/api/src/agency/order-template.controller.ts`
- `apps/api/src/orders/orders.service.ts` (자동 저장 시 agencyId 사용)

---

## ✅ 검증문 (합격 기준)

1. [ ] 임시 저장/접수 성공 시점에 템플릿이 자동 저장된다.
2. [ ] 동일 업체명으로 새 주문을 열면 드롭다운에 최근 템플릿 목록이 보인다.
3. [ ] 템플릿 선택 시 텍스트/체크 항목만 폼이 채워지고, 사진은 복원되지 않는다.
4. [ ] 접근은 해당 대행사 소속 데이터로만 제한된다.

---

## 🚀 구현 우선순위

### Phase 1: 필수 기능 (즉시 구현)
1. 저장 타이밍 명확화: DRAFT 또는 최종 접수 성공 시점에만 저장
2. 스냅샷 범위 확인: 텍스트/체크 필드만 저장 (사진 제외)
3. 권한 검증: agencyId 스코프 확인

### Phase 2: UI 개선 (1주 내)
1. 드롭다운 위치: 우측 사이드 패널 상단으로 이동
2. 디바운스 적용: placeName 입력 시 자동 호출 디바운스
3. 라벨 개선: "최근 템플릿 불러오기(업체명 기준)" / 빈 상태 메시지

### Phase 3: 최적화 (선택)
1. 템플릿 저장 성능 최적화
2. 템플릿 복원 UX 개선







