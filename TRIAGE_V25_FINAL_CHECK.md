# 원고 접수 실패 최종 점검 v2.5 (실행 단계)

## 🚨 가장 유력한 3가지 원인 (우선순위)

### 1순위: 사진 URL 화이트리스트 불일치 ⚠️
- **증상:** 400 + "유효하지 않은 사진 URL입니다" 또는 "허용되지 않은 도메인"
- **확률:** 높음 (로컬 개발 환경에서 blob: 또는 localhost 도메인 미허용)
- **즉시 확인:** Request Payload의 `photos` 배열 URL 도메인과 서버 `.env`의 `ALLOWED_S3_DOMAINS` 비교

### 2순위: 템플릿 적용 이후 필수 필드 누락 또는 사진 메타 불일치
- **증상:** 400 + "필수 필드 누락" 또는 "사진은 최소 15장이 필요합니다"
- **확률:** 중간 (템플릿 적용 후 필드 초기화 과정에서 불일치 발생 가능)
- **즉시 확인:** 템플릿 선택 후 제출 직전 필드 상태 확인

### 3순위: 토큰/agencyId 불일치
- **증상:** 401/403 또는 400 + "대행사 식별자가 필요합니다"
- **확률:** 중간 (재로그인 필요, role/agency 스코프 문제)
- **즉시 확인:** Request Headers의 Authorization 토큰 및 JWT 디코드

---

## A) 실패 유형 식별 (반드시 1회 캡처) — DevTools Network

### 📋 실행 단계

**1. DevTools Network 열기**
```
1. Chrome/Firefox: F12 또는 우클릭 → 검사
2. Network 탭 선택
3. 필터: "Fetch/XHR" 선택
4. "Preserve log" 체크 (페이지 리다이렉트 시에도 로그 유지)
```

**2. 주문 제출 실행**
- 실패가 발생하는 시나리오 재현
- 제출 버튼 클릭

**3. 실패한 요청 선택**
- `POST /orders` 또는 `PUT /agency/orders/:id` 선택
- Status Code가 4xx 또는 5xx인 요청

**4. 5가지 값 캡처 (스크린샷 또는 복사)**

#### 4-1. Status Code
```
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
413 Payload Too Large
500 Internal Server Error
```
← **이 값 캡처**

#### 4-2. Response Body.message
```
Request 탭 → Response 또는 Preview 탭
{
  "message": "사진은 최소 15장이 필요합니다 (현재: 10장)"
}
```
← **이 메시지 한 줄 캡처 (서버 원인)**

#### 4-3. Request Payload 요약
```
Request 탭 → Payload 또는 Request 탭
{
  "place": { "name": "업체명" },                    ← 확인
  "guide": { "searchKeywords": ["키워드1", ...] },  ← 배열 길이 확인
  "photos": ["url1", "url2", ...],                  ← 배열 길이 확인
  "photoMetas": [...],                              ← 길이 = photos.length 확인
  "submitCount": 1-5                                ← 새 접수만, 편집에는 없어야 함
}
```
**확인 사항:**
- [ ] `place.name`: 존재 여부
- [ ] `guide.searchKeywords.length`: N (≥ 1)
- [ ] `photoMetas.length`: N (15~20)
- [ ] `submitCount`: 존재 여부 (새 접수/편집 모드)

#### 4-4. Request Headers
```
Request 탭 → Headers 탭 → Request Headers
Authorization: Bearer <JWT_TOKEN>  ← 확인
Content-Type: application/json      ← 확인
```
← **이 두 값 캡처**

#### 4-5. Timing
```
Request 탭 → Timing 탭
- Preflight (OPTIONS): CORS preflight 요청 여부
- CORS: 지연 시간 확인
- Total: 전체 요청 시간
```
← **Preflight/CORS 대기/차단 여부 확인**

**5. 편집 제출 실패도 있다면**
- `PUT /agency/orders/:id` 요청도 동일 방식으로 캡처

**6. 리포트 작성**
- 위 5가지 값을 스크린샷 또는 텍스트로 저장
- 트리아지 리포트에 포함

---

## B) 가장 흔한 7가지 원인 → 즉시 확인 순서

### 🔴 1순위: 사진 URL 화이트리스트 불일치

**증상:**
- Status Code: 400
- 메시지: "유효하지 않은 사진 URL입니다" 또는 "허용되지 않은 도메인/스킴"

**점검 절차:**
1. Request Payload의 `photos` 배열에서 URL 추출
2. URL 파싱하여 도메인/스킴 확인:
   ```javascript
   // 예시
   "photos": [
     "blob:http://localhost:3000/abc-123-def",
     "http://localhost:3000/uploads/photo1.jpg"
   ]
   // 도메인: "localhost"
   // 스킴: "blob:", "http:"
   ```
3. 서버 `.env` 파일 확인:
   ```env
   ALLOWED_S3_DOMAINS=localhost,127.0.0.1,blob
   ```
4. 비교: URL 도메인/스킴이 화이트리스트에 포함되어 있는지 확인

**조치:**
- 개발용 도메인/스킴을 화이트리스트에 추가
- 예: `ALLOWED_S3_DOMAINS=localhost,127.0.0.1,blob,http://localhost:3000`
- 서버 재시작 후 테스트
- 운영 전까지 개발용 도메인 화이트리스트 유지

---

### 🔴 2순위: 사진 개수 불일치 (15~20)

**증상:**
- Status Code: 400
- 메시지: "사진은 최소 15장이 필요합니다" 또는 "사진은 최대 20장까지 업로드할 수 있습니다"

**점검 절차:**
1. 프론트 카운터 확인: 화면에 표시된 사진 개수
2. Request Payload 확인:
   - `photos` 배열 길이
   - `photoMetas` 배열 길이
3. 비교: 프론트 카운터 = `photos.length` = `photoMetas.length` = 15~20

**가능한 원인:**
- 템플릿 적용 후 필드 초기화 과정에서 불일치 발생
- 사진 삭제/추가 후 제출 직전 검증 미흡

**조치:**
- 제출 직전 폼 검증으로 15~20 강제 유지
- 템플릿 적용 후에도 사진 카운터 재확인
- `handleSubmit` 함수에서 제출 직전 재검증

---

### 🔴 3순위: 권한/agencyId 누락

**증상:**
- Status Code: 401 (Unauthorized) 또는 403 (Forbidden)
- 또는 400 + 메시지: "대행사 식별자가 필요합니다"

**점검 절차:**
1. Request Headers 확인:
   - `Authorization: Bearer <JWT_TOKEN>` 존재 여부
2. JWT 토큰 디코드 (https://jwt.io):
   ```json
   {
     "role": "AGENCY",  ← 확인
     "sub": "user-id",
     "email": "agency@example.com"
   }
   ```
3. 서버 로그 확인:
   - `[OrdersController.create] BadRequestException: 대행사 식별자가 필요합니다` 여부

**조치:**
- 재로그인 후 재시도
- 토큰 저장/전달 경로 복구 확인
- `localStorage.getItem('token')` 확인
- API 호출 시 Authorization 헤더 포함 확인

---

### 🔴 4순위: DTO 필수값/타입 오류

**증상:**
- Status Code: 400
- 메시지: "필드 누락" 또는 "타입 오류"

**점검 절차:**
1. Request Payload 확인:
   - `place.name`: 문자열 존재 (trim 후 길이 > 0)
   - `guide.searchKeywords`: 배열 길이 ≥ 1
   - `hashtags`: 배열 길이 ≤ 5
2. 타입 확인:
   - `targetChars`: `[number, number]` (문자열 배열 아님)
   - `photoLimits`: `[number, number]` (문자열 배열 아님)
   - `submitCount`: `number` (문자열 아님)

**조치:**
- 제출 직전 폼 가드로 차단
- 필수 필드 검증 강화
- 타입 변환 확인 (숫자 필드는 숫자로 직렬화)

---

### 🔴 5순위: submitCount 규칙 위반

**증상:**
- Status Code: 400
- 메시지: "다건 규칙/범위" 관련

**점검 절차:**
1. Request Payload 확인:
   - 새 접수: `submitCount` 존재 (1~5)
   - 임시저장/편집: `submitCount` 없어야 함
2. 네트워크 페이로드로 실제 전송 유무 재확인

**조치:**
- 네트워크 페이로드로 실제 전송 유무 재확인
- 프론트엔드 코드에서 `submitCount` 전송 조건 확인
- 서버 DTO에서 `submitCount` 검증 규칙 확인

---

### 🔴 6순위: 413 Payload Too Large (바디 제한)

**증상:**
- Status Code: 413
- 또는 프록시/서버 바디 제한 문구

**점검 절차:**
1. Request Payload 크기 확인:
   - DevTools Network → Request 탭 → Payload 크기
2. 메타 크기 확인:
   - `photoMetas` 배열의 총 크기
   - 대형 base64, 과도한 EXIF 등

**조치:**
- 사진은 파일 업로드(S3 presigned URL), 서버에는 메타만 전송
- EXIF 데이터 제거 또는 최소화
- 서버 바디 크기 제한 설정 확인

---

### 🔴 7순위: 라우트/가드 미스매치

**증상:**
- Status Code: 404 또는 403
- 경로/역할 불일치

**점검 절차:**
1. Request URL 확인:
   - 신규: `POST /orders`
   - 편집: `PUT /agency/orders/:id`
2. 토큰 역할 확인:
   - 대행사 전용 라우트에 ADMIN 토큰으로 호출하지 않았는지

**조치:**
- 올바른 라우트로 요청 전송 확인
- 토큰 역할 확인 (AGENCY vs ADMIN)
- RouteGuard 적용 확인

---

## C) 서버 측 동시 확인

### 📋 실행 단계

**1. /health 확인**

**제출 전:**
```bash
curl http://localhost:3001/health | jq '.queue.waiting, .queue.active'
# 출력: 0, 0
```

**제출 후 (5초 내):**
```bash
curl http://localhost:3001/health | jq '.queue.waiting, .queue.active'
# 출력: 1, 0 (또는 0, 1) ← 변화가 있어야 함
```

❌ **문제 진단:**
- 변화 없음 → 컨트롤러/서비스 단계에서 이미 실패
- 위 B 섹션 항목 우선 재점검

**2. 서버 로그 확인**

**서버 콘솔 또는 로그 파일에서 확인:**
```
[OrdersController.create] BadRequestException: 플레이스명은 필수입니다
[OrdersService.createOrder] BadRequestException: 검색 키워드는 최소 1개 이상 필요합니다
[OrdersService.createOrder] BadRequestException: 사진은 최소 15장이 필요합니다 (현재: 10장)
```

← **이 메시지 한 줄을 반드시 확인 (원인 문자열 확보)**

**성공 케이스:**
```
[OrdersController.create] Order created: uuid-123, status: SUBMITTED
[GenerationQueue] Job added: gen:uuid-123:v1
```

---

## D) 폼/템플릿 상호작용 체크 (이번 리빌드 포인트)

### 📋 실행 단계

**1. 템플릿 적용 직후 필수 필드 확인**

**절차:**
1. 새 주문 생성 페이지 열기
2. 플레이스명 입력 (예: "테스트 업체")
3. 템플릿 드롭다운에서 템플릿 선택
4. 제출 직전 필드 상태 확인:
   - [ ] `place.name`: 채워져 있음
   - [ ] `searchKeywords`: 배열 길이 ≥ 1
   - [ ] 사진: 15~20장 유지 (템플릿 적용 후에도)

**2. 템플릿 적용이 사진 메타를 건드리지 않는지 확인**

**절차:**
1. 사진 15~20장 업로드
2. 템플릿 선택
3. 사진 배열 확인:
   - [ ] 사진 배열 길이: 15~20장 유지
   - [ ] 사진 메타데이터 유지
   - [ ] 템플릿 적용이 사진을 초기화하지 않음

**3. 드래프트 로딩→편집→제출 흐름 확인**

**절차:**
1. 임시 저장 주문 생성
2. 드래프트 주문 상세 페이지에서 "계속 작성" 클릭
3. 편집 후 제출
4. DevTools Network에서 요청 확인:
   - [ ] `PUT /agency/orders/:id` (POST가 아님)
   - [ ] `submitCount` 필드 없음

---

## E) 합격 기준 (최종)

### ✅ 검증문

1. [ ] **POST /orders 2xx + top-center 성공 토스트**
   - Status Code: 201 또는 200
   - Response Body: `{ id: "...", status: "SUBMITTED" }`
   - 프론트: 성공 토스트가 top-center에 표시

2. [ ] **DB에 상태 SUBMITTED로 생성되고, 큐의 waiting→active 변동이 관측된다**
   - DB 확인: `SELECT * FROM orders WHERE id = '...' ORDER BY created_at DESC LIMIT 1;`
   - 상태: `SUBMITTED`
   - 큐 상태: `/health`에서 `waiting` 또는 `active` 증가 확인

3. [ ] **사진/화이트리스트/필수값/타입/submitCount 규칙이 양쪽(프론트·서버)에서 모두 통과**
   - 사진: 15~20장, 확장자/용량/도메인 규칙
   - 필수값: place.name, searchKeywords ≥ 1
   - 타입: 숫자 필드는 숫자로 직렬화
   - submitCount: 새 접수만 1~5, 편집/임시저장에는 없음

---

## 🔍 추가 확인 사항

### 템플릿 저장 타이밍 확인
- [ ] 현재 구현 확인: `createOrder`에서 `if (!saveAsDraft)` 조건으로 최종 접수 시만 저장
- [ ] 요구사항: 임시 저장(DRAFT) 시에도 저장 필요
- [ ] 확인 필요: `updateOrder` 메서드에서도 템플릿 저장 확인
- [ ] 개선 필요: DRAFT 저장 시에도 템플릿 저장 로직 추가

### 드래프트 로딩→편집→제출 흐름
- [ ] 드래프트 주문 상세 페이지에서 "계속 작성" 버튼 동작 확인
- [ ] 편집 페이지에서 `draftId` 파라미터로 주문 로드 확인
- [ ] 제출 시 `PUT /agency/orders/:id`로 전송 확인
- [ ] `submitCount` 필드 전송 안 함 확인

---

## 🎯 우선 확인 순서 (10분 이내)

### 1단계: Network 캡처 (5분)
- [ ] Status Code 캡처
- [ ] Response Body.message 캡처
- [ ] Request Payload 요약 캡처
- [ ] Request Headers 캡처
- [ ] Timing 캡처

### 2단계: 가장 유력한 3가지 확인 (3분)
- [ ] 1순위: 사진 URL 화이트리스트 불일치 확인
- [ ] 2순위: 템플릿 적용 후 필드 누락 확인
- [ ] 3순위: 토큰/agencyId 확인

### 3단계: 서버 확인 (2분)
- [ ] /health 큐 상태 확인
- [ ] 서버 로그 BadRequestException 메시지 확인

---

## 📊 트리아지 리포트 템플릿

### 실패 사례 리포트 작성 시:

```
## 실패 사례 리포트

### 1. Status Code
400 Bad Request

### 2. Response Body.message
"유효하지 않은 사진 URL입니다. 허용 도메인: localhost, blob"

### 3. Request Payload 요약
- place.name: "테스트 업체" ✅
- guide.searchKeywords.length: 2 ✅
- photoMetas.length: 15 ✅
- submitCount: 1 ✅ (새 접수)

### 4. Request Headers
- Authorization: Bearer <token> ✅
- Content-Type: application/json ✅

### 5. Timing
- Preflight: 없음
- CORS: 정상
- Total: 120ms

### 6. 서버 로그
[OrdersService.createOrder] BadRequestException: 유효하지 않은 사진 URL입니다

### 7. /health 큐 상태
- 제출 전: waiting=0, active=0
- 제출 후: waiting=0, active=0 (변화 없음)

### 8. 원인 추정
1순위: 사진 URL 화이트리스트 불일치
- photos 배열의 URL 도메인: "blob:http://localhost:3000/..."
- 서버 ALLOWED_S3_DOMAINS: 확인 필요

### 9. 조치
- ALLOWED_S3_DOMAINS에 "blob" 또는 "localhost" 추가
- 서버 재시작 후 재테스트
```

