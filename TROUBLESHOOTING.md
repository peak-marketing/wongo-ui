# 원고 접수 실패 트리아지 가이드 v2.3

## 📋 빠른 체크리스트

### 1단계: Network 캡처 (5분)
- [ ] DevTools Network 탭 열기
- [ ] POST /orders 또는 PUT /agency/orders/:id 요청 선택
- [ ] Request/Response/Headers/Timing 캡처
- [ ] submitCount 존재 여부 확인

### 2단계: 헬스 체크 (1분)
- [ ] `curl http://localhost:3001/health` 실행
- [ ] `db: true`, `redis: true` 확인
- [ ] 제출 직후 `queue.waiting` 또는 `queue.active` 증가 확인

### 3단계: 사진 검증 (2분)
- [ ] 프론트 카운터: 15~20장
- [ ] Request Payload의 `photos` 배열 길이: 15~20장
- [ ] `photoMetas` 배열 길이 = `photos` 배열 길이
- [ ] 확장자: `.jpg`, `.jpeg`, `.png`, `.webp`
- [ ] 개별 파일: ≤10MB

### 4단계: 서버 로그 확인 (2분)
- [ ] 서버 콘솔에서 `[OrdersController.create]` 또는 `[OrdersService.createOrder]` 로그 확인
- [ ] BadRequestException 메시지 확인

---

## A. Network 캡처 확정 (프론트)

### ✅ 단계별 확인 절차

**1. DevTools Network 열기**
- Chrome/Firefox: F12 → Network 탭
- 필터: "Fetch/XHR" 선택

**2. 주문 제출 실행**
- 새 접수 또는 편집 모드에서 제출 버튼 클릭

**3. 요청 캡처 (5가지 항목)**

#### 3-1. Request URL / Status Code
```
새 접수: POST /orders → 201 Created (또는 200 OK)
편집 모드: PUT /agency/orders/:id → 200 OK
```
❌ 실패 시: 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 500 (Internal Server Error)

#### 3-2. Request Headers
```
Authorization: Bearer <JWT_TOKEN>  ← 필수
Content-Type: application/json      ← 필수
```
❌ Authorization 누락 시: 401 Unauthorized
❌ Content-Type 불일치 시: 400 Bad Request

#### 3-3. Request Payload (JSON)
```json
{
  "place": { "name": "업체명" },                    ← 필수
  "guide": { "searchKeywords": ["키워드1", ...] },  ← 배열 길이 ≥ 1
  "photos": ["url1", "url2", ...],                  ← 배열 길이 15~20
  "photoMetas": [...],                              ← photos와 동일 길이
  "submitCount": 1-5                                ← 새 접수만, 편집/임시저장에는 없어야 함
}
```
✅ 새 접수: `submitCount` 존재 (1~5)
❌ 편집/임시저장: `submitCount` 없어야 함

#### 3-4. Response Body
```json
// 성공
{ "id": "uuid", "status": "SUBMITTED" }
또는
{ "ids": ["uuid1", "uuid2"], "count": 2, "status": "SUBMITTED" }

// 실패
{ "message": "사진은 최소 15장이 필요합니다 (현재: 10장)" }
```
❌ 실패 시: 서버 메시지 원문 확인

#### 3-5. Timing
- **blocked**: 0ms (이상 시 방화벽/프록시 문제)
- **CORS**: preflight 지연 없음
- **Total**: < 2초 (이상 시 서버 응답 지연)

## B. /health 재확인 (백엔드)

### ✅ 단계별 확인 절차

**1. 헬스 체크 실행**
```bash
curl http://localhost:3001/health
```

**2. 예상 응답 확인**
```json
{
  "ok": true,        ← 필수: true
  "db": true,        ← 필수: true (false면 DB 연결 실패)
  "redis": true,     ← 필수: true (false면 Redis 연결 실패)
  "queue": {
    "waiting": 0,    ← 제출 전 값
    "active": 0,     ← 제출 전 값
    "failed": 0,
    "completed": 0,
    "delayed": 0
  }
}
```

**3. 제출 직후 재확인**
```bash
# 제출 전
curl http://localhost:3001/health | jq '.queue.waiting, .queue.active'
# 출력: 0, 0

# 제출 후 (5초 내)
curl http://localhost:3001/health | jq '.queue.waiting, .queue.active'
# 출력: 1, 0 (또는 0, 1) ← 변화가 있어야 함
```

❌ **문제 진단:**
- `db: false` → PostgreSQL 연결 실패, DB 서버 확인
- `redis: false` → Redis 연결 실패, Redis 서버 확인
- `queue.waiting/active` 변화 없음 → 컨트롤러/서비스 단계에서 400/500으로 막힘 (C, D 섹션 점검)

## C. 사진 메타·화이트리스트 규칙 (가장 흔한 실패)

### ✅ 단계별 확인 절차

**1. 사진 개수 검증**
- [ ] 프론트 카운터: 15~20장 표시
- [ ] Request Payload의 `photos` 배열 길이: `JSON.parse(payload).photos.length` = 15~20
- [ ] Request Payload의 `photoMetas` 배열 길이: `JSON.parse(payload).photoMetas.length` = `photos.length`

**2. 도메인 화이트리스트 확인**

**개발 환경 설정 (.env 파일):**
```env
# 옵션 1: 모두 허용 (개발 전용, 보안 취약)
ALLOWED_S3_DOMAINS=

# 옵션 2: 특정 도메인만 허용 (권장)
ALLOWED_S3_DOMAINS=localhost,127.0.0.1,blob,http://localhost:3000
```

**확인 방법:**
1. Request Payload의 `photos` 배열에서 URL 추출
2. URL 도메인 확인 (예: `blob:http://localhost:3000/...` → `localhost`)
3. 서버 `.env`의 `ALLOWED_S3_DOMAINS`에 포함되어 있는지 확인

**예시:**
```javascript
// Request Payload의 photos 예시
"photos": [
  "blob:http://localhost:3000/abc-123-def",
  "http://localhost:3000/uploads/photo1.jpg"
]

// 이 경우 ALLOWED_S3_DOMAINS에 "localhost" 또는 "blob"이 포함되어야 함
```

❌ **실패 원인:**
- `ALLOWED_S3_DOMAINS`가 비어있지 않은데 도메인이 포함되지 않음 → 400 "유효하지 않은 사진 URL입니다"
- 해결: `.env`에 도메인 추가 또는 `ALLOWED_S3_DOMAINS=`로 모두 허용

**운영 환경 설정:**
```env
ALLOWED_S3_DOMAINS=s3.amazonaws.com,your-bucket.s3.amazonaws.com
```

**3. 확장자/용량 검증**
- [ ] 확장자: `.jpg`, `.jpeg`, `.png`, `.webp` (대소문자 무관)
- [ ] 개별 파일: ≤10MB (프론트에서 `photoMetas[].sizeKb` 확인)
- [ ] 프론트에서 제출 직전 재확인 (PhotoUploader 컴포넌트)

❌ **실패 원인:**
- 확장자 불일치 → 400 "허용되지 않은 파일 형식입니다"
- 용량 초과 → 400 "사진 크기는 10MB를 초과할 수 없습니다"

## D. DTO 최소 요건·타입

### 필수값:
- `place.name`: 문자열 존재 (trim 후 길이 > 0)
- `guide.searchKeywords`: 배열 길이 ≥ 1
- `photos`: 배열 길이 15~20 (임시 저장 제외)

### 타입 오류 방지:
- `targetChars`: `[number, number]` (기본 [1500, 2000])
- `photoLimits`: `[number, number]` (기본 [15, 20])
- `submitCount`: `number` (1~5, 새 접수만)

### 해시태그 규칙:
- 최대 5개
- 프론트에서 제출 직전 차단

## E. 권한/역할·agencyId 매핑

### ✅ 단계별 확인 절차

**1. 토큰 확인**
- DevTools → Application → Local Storage → `token` 확인
- JWT 디코드 (https://jwt.io):
  ```json
  {
    "role": "AGENCY",  ← 필수
    "sub": "user-id",
    "email": "agency@example.com"
  }
  ```
❌ `role=ADMIN`으로 대행사 엔드포인트 호출 시 → 403 Forbidden

**2. agencyId 매핑 확인**
- 서버 로그에서 `[OrdersController.create]` 확인:
  ```
  [OrdersController.create] Order created: uuid, status: SUBMITTED
  ```
- 서버 코드 확인:
  ```typescript
  const agencyId = user?.agencyId || user?.id;
  if (!agencyId) {
    throw new BadRequestException('대행사 식별자가 필요합니다');
  }
  ```
❌ `agencyId`가 null/undefined → 400 "대행사 식별자가 필요합니다"

**3. place 생성/연결 확인**
- 같은 업체 재접수 시 기존 place 조회 또는 자동 생성
- 서버 로그에서 `ensurePlace` 호출 확인

## F. 임시 저장·편집 전용 규칙

### 편집 모드:
- 제출 경로: `PUT /agency/orders/:id` (업데이트)
- `submitCount` 필드: **포함하지 않음**
- UI 멀티 수량 뱃지/필드: 비활성

### 새 접수:
- `submitCount`: 1~5 전송
- 생략 시 서버 기본 1 적용

## G. 서버 로그 포인트

### 제출 시점 로그 확인:

**orders.controller / orders.service:**
```
[OrdersController.create] BadRequestException: 사진은 최소 15장이 필요합니다
[OrdersService.createOrder] BadRequestException: 허용되지 않은 도메인
```

**generation.processor:**
- 제출 후 `queue.waiting` → `queue.active` 변화 확인
- 변화 없으면 컨트롤러/서비스 단계 실패

## H. DB 제약 충돌 가능성

### 확인 항목:
- 최근 마이그레이션으로 NOT NULL/DEFAULT 제약 추가된 컬럼
- `placeId`/`agencyId` 외래키 무결성
- `completedAt` 컬럼 기본값 문제

## I. 실패 시 프론트 UX

### 에러 메시지:
- 서버 `message` 원문을 `top-center` 토스트로 노출
- 포괄적 문구 금지 (예: "주문 처리 실패" → 구체적 메시지)

### 제출 버튼:
- 중복 클릭 방지: `loading` 상태 + `disabled`
- 로딩 스피너 표시

## ✅ 검증문 (합격 기준)

1. ✅ DevTools Network에서 `POST /orders`가 실제 전송되고, 2xx면 성공 토스트가 `top-center`에 뜬다.
2. ✅ 서버가 400을 줄 경우 구체 메시지가 토스트로 그대로 보인다 (예: 도메인/확장자/개수/필수필드).
3. ✅ 새 접수/편집 모드에서 `submitCount` 포함/제외 규칙이 정확히 지켜진다.
4. ✅ 제출 직후 DB에 `SUBMITTED` 생성 및 `queue waiting→active` 변동이 관측된다.
5. ✅ 사진 15~20/확장자/용량/도메인 화이트리스트 규칙이 프론트·서버 양쪽에서 모두 충족된다.

