# 원고 접수 계속 실패 최종 트리아지 v2.4 체크리스트

## 🚨 긴급 체크리스트 (10분 이내)

### 1단계: Network 캡처 (5분)
- [ ] DevTools Network 탭에서 실패한 요청 선택
- [ ] Request URL / Status Code 확인
- [ ] Request Headers (Authorization 포함) 확인
- [ ] Request Payload 확인 (place.name, guide.searchKeywords[], photoMetas.length, submitCount 유무)
- [ ] Response Body.message 확인 (서버 원인 한 줄)
- [ ] Timing 확인 (Preflight/CORS 여부)

### 2단계: 사진/화이트리스트 규칙 (2분)
- [ ] photoMetas.length === 15~20 정확히 일치
- [ ] 확장자: jpg/jpeg/png/webp
- [ ] 용량: ≤10MB (개별)
- [ ] 도메인: 개발 환경 화이트리스트 확인

### 3단계: 서버 로그 확인 (2분)
- [ ] 서버 콘솔에서 BadRequestException 메시지 확인
- [ ] 성공 시 SUBMITTED INSERT + 큐 add 로그 확인

### 4단계: /health & 큐 변동 (1분)
- [ ] 제출 시점에 queue.waiting/active 값 증가 확인

---

## A. 네트워크/응답 메시지 확정 (필수 1회 캡처)

### 📝 요구사항
DevTools Network에서 실패한 요청 하나를 열고 아래 5가지 값을 캡처:

1. **Request URL / Status Code**
2. **Request Headers** (Authorization 포함)
3. **Request Payload** (특히: place.name, guide.searchKeywords[], photoMetas.length, submitCount 유무)
4. **Response Body.message** (서버가 내려준 한 줄 원인)
5. **Timing** (Preflight/CORS 여부 확인)

편집 제출 실패가 있다면 **PUT /agency/orders/:id**도 같은 방식으로 캡처.

### ✅ 확인 절차

**1. DevTools Network 열기**
- Chrome/Firefox: F12 → Network 탭
- 필터: "Fetch/XHR" 선택

**2. 주문 제출 실행**
- 실패가 발생하는 시나리오 재현

**3. 실패한 요청 선택**
- `POST /orders` 또는 `PUT /agency/orders/:id`
- Status Code가 4xx 또는 5xx인 요청

**4. 5가지 값 캡처**

#### Request URL / Status Code
```
새 접수: POST /orders → 400 Bad Request
편집 모드: PUT /agency/orders/:id → 400 Bad Request
```

#### Request Headers
```
Authorization: Bearer <JWT_TOKEN>  ← 필수 확인
Content-Type: application/json
```

#### Request Payload
```json
{
  "place": { "name": "업체명" },                    ← 확인
  "guide": { "searchKeywords": ["키워드1", ...] },  ← 배열 길이 ≥ 1 확인
  "photos": ["url1", "url2", ...],                  ← 배열 길이 확인
  "photoMetas": [...],                              ← 길이 = photos.length 확인
  "submitCount": 1-5                                ← 새 접수만, 편집에는 없어야 함
}
```

#### Response Body.message
```json
{
  "message": "사진은 최소 15장이 필요합니다 (현재: 10장)"
}
```
← **이 메시지를 캡처 (서버 원인 한 줄)**

#### Timing
- **Preflight (OPTIONS)**: CORS preflight 요청 여부
- **CORS**: 지연 시간 확인
- **Total**: 전체 요청 시간

**5. 스크린샷 또는 복사하여 저장**
- Request 탭 전체 스크린샷
- Response 탭 전체 스크린샷
- Payload JSON 복사

---

## B. 사진/화이트리스트 규칙 재확인 (서버 기준과 동일해야 통과)

### 📝 요구사항
- **개수:** `photoMetas.length === 15~20` 정확히 일치 (프론트 카운터와 서버 수치 불일치 금지)
- **확장자/용량:** jpg/jpeg/png/webp & ≤10MB (개별)
- **도메인:** 개발 단계에서는 현재 쓰는 업로드 도메인이 화이트리스트에 포함되어야 함
- **운영 이전까지:** 개발용 도메인 화이트리스트 유지 (미포함이면 400)

### ✅ 확인 사항

**1. 사진 개수**
- [ ] 프론트 카운터: 15~20장 표시
- [ ] Request Payload의 `photos` 배열 길이: 15~20
- [ ] Request Payload의 `photoMetas` 배열 길이: `photos.length`와 일치
- [ ] 프론트와 서버 수치 불일치 없음

**2. 확장자/용량**
- [ ] 확장자: `.jpg`, `.jpeg`, `.png`, `.webp` (대소문자 무관)
- [ ] 개별 파일: ≤10MB (`photoMetas[].sizeKb` 확인)
- [ ] 프론트에서 제출 직전 재확인

**3. 도메인 화이트리스트**

**개발 환경 확인:**
```env
# .env 파일 확인
ALLOWED_S3_DOMAINS=localhost,127.0.0.1,blob
또는
ALLOWED_S3_DOMAINS=  # 비어있으면 모두 허용
```

**확인 방법:**
1. Request Payload의 `photos` 배열에서 URL 추출
2. URL 파싱하여 도메인 확인
3. 서버 `.env`의 `ALLOWED_S3_DOMAINS`에 포함되어 있는지 확인

**예시:**
```javascript
// Request Payload의 photos
"photos": [
  "blob:http://localhost:3000/abc-123-def",
  "http://localhost:3000/uploads/photo1.jpg"
]

// 도메인: "localhost"
// ALLOWED_S3_DOMAINS에 "localhost" 포함되어야 함
```

❌ **실패 원인:**
- `ALLOWED_S3_DOMAINS`가 비어있지 않은데 도메인이 포함되지 않음 → 400 "유효하지 않은 사진 URL입니다"

---

## C. DTO/타입/필수값

### 📝 요구사항
- `place.name` 문자열 존재
- `guide.searchKeywords.length ≥ 1`
- 해시태그 ≤ 5 (프론트 사전 차단)
- `targetChars`, `photoLimits`, `submitCount` 등 숫자 필드는 문자열이 아닌 숫자/숫자배열로 직렬화
- 새 접수만 `submitCount`(1~5) 전송, 편집/임시 저장 업데이트에는 포함 금지

### ✅ 확인 사항

**1. 필수값**
- [ ] `place.name`: 문자열 존재 (trim 후 길이 > 0)
- [ ] `guide.searchKeywords`: 배열 길이 ≥ 1
- [ ] 해시태그: ≤ 5개 (프론트에서 사전 차단)

**2. 타입 오류 방지**
- [ ] `targetChars`: `[number, number]` (문자열 배열 아님)
- [ ] `photoLimits`: `[number, number]` (문자열 배열 아님)
- [ ] `submitCount`: `number` (문자열 아님)

**확인 방법:**
```javascript
// Request Payload에서 확인
JSON.parse(payload).targetChars      // [1500, 2000] (숫자 배열)
JSON.parse(payload).photoLimits      // [15, 20] (숫자 배열)
JSON.parse(payload).submitCount      // 1-5 (숫자)
```

**3. submitCount 규칙**
- [ ] 새 접수: `submitCount` 존재 (1~5)
- [ ] 편집/임시저장: `submitCount` 없어야 함

---

## D. 권한/agencyId/Place 매핑

### 📝 요구사항
- 토큰 `role=AGENCY` 확인
- 서버에서 `agencyId`를 JWT에서 읽어 null/undefined면 즉시 400
- 동일 업체 재접수 시 place가 자동 생성 또는 기존 매핑으로 연결되는지 확인

### ✅ 확인 사항

**1. 토큰 확인**
- [ ] JWT 디코드: `role=AGENCY`
- [ ] Request Headers에 `Authorization: Bearer <token>` 포함

**2. agencyId 매핑**
- [ ] 서버 로그에서 "대행사 식별자가 필요합니다" 에러 없음
- [ ] 서버 코드: `user?.agencyId || user?.id` 확인
- [ ] null/undefined면 400 반환

**3. Place 매핑**
- [ ] 동일 업체 재접수 시 기존 place 조회 또는 자동 생성
- [ ] 서버 로그에서 `ensurePlace` 호출 확인

---

## E. /health & 큐 변동

### 📝 요구사항
제출 시점에 `/health` 응답의 `queue.waiting/active` 값이 증가/변동하는지 확인.
변동이 없으면 컨트롤러/서비스 레이어에서 4xx/5xx로 막힌 것 — 위 B/C/D 항목 우선 재점검.

### ✅ 확인 절차

**1. 제출 전 헬스 체크**
```bash
curl http://localhost:3001/health | jq '.queue.waiting, .queue.active'
# 출력: 0, 0
```

**2. 주문 제출 실행**

**3. 제출 후 헬스 체크 (5초 내)**
```bash
curl http://localhost:3001/health | jq '.queue.waiting, .queue.active'
# 출력: 1, 0 (또는 0, 1) ← 변화가 있어야 함
```

❌ **문제 진단:**
- `queue.waiting/active` 변화 없음 → 컨트롤러/서비스 레이어에서 4xx/5xx로 막힘
- B/C/D 섹션 우선 재점검

---

## F. 서버 로그 포인트 (원인 문자열 확보)

### 📝 요구사항
- `orders.controller/orders.service`의 `BadRequestException` 메시지를 콘솔에서 확인 (서버 원인 한 줄 확보)
- 성공 시 SUBMITTED로 INSERT 후 큐 add 로그가 남아야 함

### ✅ 확인 절차

**1. 서버 콘솔 열기**
- 백엔드 터미널 또는 로그 파일

**2. 제출 시점 로그 확인**

**실패 케이스:**
```
[OrdersController.create] BadRequestException: 플레이스명은 필수입니다
[OrdersService.createOrder] BadRequestException: 검색 키워드는 최소 1개 이상 필요합니다
[OrdersService.createOrder] BadRequestException: 사진은 최소 15장이 필요합니다 (현재: 10장)
[OrdersService.createOrder] BadRequestException: 허용되지 않은 파일 형식입니다
[OrdersService.createOrder] BadRequestException: 유효하지 않은 사진 URL입니다
```
← **이 메시지를 캡처 (서버 원인 한 줄)**

**성공 케이스:**
```
[OrdersController.create] Order created: uuid-123, status: SUBMITTED
[GenerationQueue] Job added: gen:uuid-123:v1
```

---

## G. 프론트 UX

### 📝 요구사항
- 실패 시 서버 `message` 원문을 top-center 토스트로 그대로 띄우는지 확인 (포괄 문구 금지)
- 제출 중 버튼 disabled/로딩으로 중복 제출 방지가 동작 중인지 확인

### ✅ 확인 사항
- [ ] 실패 시 토스트 위치: top-center
- [ ] 실패 메시지: 서버 `message` 원문 그대로 표시
- [ ] 포괄적 문구 금지 (예: "주문 처리 실패" → "사진은 최소 15장이 필요합니다")
- [ ] 제출 중 버튼: `disabled` 상태
- [ ] 제출 중 로딩 스피너 표시
- [ ] 중복 제출 방지 동작

---

## H. 합격 기준 (최종)

### ✅ 검증문

1. [ ] 신규 접수에서 2xx 응답 + 성공 토스트(top-center) 확인
2. [ ] DB에 상태 **SUBMITTED**로 저장되고, 큐 waiting→active 변동이 관측된다
3. [ ] 사진/확장자/용량/도메인/필수값/타입 규칙이 프론트·서버 양쪽에서 모두 만족한다
4. [ ] 편집 제출은 업데이트 경로로만 나가고, submitCount를 절대 포함하지 않는다

---

## 📊 트리아지 리포트 템플릿

### 실패 사례 리포트 작성 시 포함할 정보:

1. **Request URL / Status Code:** `POST /orders → 400 Bad Request`
2. **Request Headers:** `Authorization: Bearer <token>`
3. **Request Payload 요약:**
   - `place.name`: 존재 여부
   - `guide.searchKeywords.length`: N
   - `photoMetas.length`: N
   - `submitCount`: 존재 여부 (새 접수/편집 모드)
4. **Response Body.message:** "서버 원인 한 줄"
5. **Timing:** Preflight/CORS 여부
6. **서버 로그:** `[OrdersService.createOrder] BadRequestException: ...`
7. **/health 큐 상태:** 제출 전/후 비교







