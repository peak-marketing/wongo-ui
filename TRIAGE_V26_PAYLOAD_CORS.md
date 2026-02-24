# 원고 접수 실패 (페이로드 과대 + 프리플라이트 실패) 보완 v2.6

## 🎯 목표
- 페이로드 크기 최소화 (메타만 전송, base64/preview 제거)
- 프리플라이트(CORS) 성공 확보
- 서버 바디 제한 상향 설정

---

## A) 먼저 확인 (DevTools → Network)

### 📋 실행 단계

**1. DevTools Network 탭 열기**
```
1. Chrome/Firefox: F12 또는 우클릭 → 검사
2. Network 탭 선택
3. 필터: "Fetch/XHR" 선택
4. "Preserve log" 체크
```

**2. 주문 제출 실행**
- 실패가 발생하는 시나리오 재현
- 제출 버튼 클릭

**3. OPTIONS /orders (프리플라이트) 확인**
- [ ] 요청 이름: `OPTIONS /orders` 또는 `OPTIONS /orders?`
- [ ] Status: `(failed) preflight` 또는 `200 OK` 또는 `204 No Content`
- [ ] Timing: Preflight 시간 확인

**4. POST /orders 확인**
- [ ] Status Code: 400/413/500 등
- [ ] Size: Request Payload 크기 확인 (KB 단위)
- [ ] Timing: Preflight/CORS 대기 시간 확인

**5. Request Payload 내용 확인**
- [ ] `photoMetas` 배열 내부 확인
- [ ] `base64`, `preview`, `thumbnail`, `data:image/...` 같은 긴 문자열 존재 여부
- [ ] 목표: 사진 메타는 `url`, `width`, `height`, `sizeKb` 숫자만 전송

**6. 확인 사항 기록**
```
OPTIONS /orders Status: [ ] (failed) preflight [ ] 200/204
POST /orders Status: [ ] 400 [ ] 413 [ ] 500
POST /orders Size: [ ] KB
페이로드 내 base64/preview: [ ] 있음 [ ] 없음
```

---

## B) 프런트 페이로드 다이어트 (필수)

### 📋 실행 단계

**1. 제출 직전 photoMetas 검증 (프론트엔드)**

**금지 항목 확인:**
- [ ] `base64` 미리보기 데이터 없음
- [ ] `Blob`/`ArrayBuffer` 직렬화 데이터 없음
- [ ] 원본 EXIF 덤프 데이터 없음
- [ ] 임의의 대용량 텍스트 없음

**허용 키만 유지:**
```javascript
photoMetas = [
  {
    url: "http://localhost:3000/uploads/photo1.jpg",  // ✅ 허용
    width: 1920,                                      // ✅ 허용
    height: 1080,                                     // ✅ 허용
    sizeKb: 245.6                                     // ✅ 허용
    // checksum: "abc123..." (필요시 1줄만)          // ✅ 허용
    // base64: "data:image/..."                      // ❌ 금지
    // preview: "data:image/..."                     // ❌ 금지
    // thumbnail: "data:image/..."                   // ❌ 금지
    // exif: { ... } (대용량)                        // ❌ 금지
  }
]
```

**2. 텍스트 필드 크기 제한**
- [ ] `hashtags`: 배열 길이 ≤ 5, 각 항목 ≤ 100자
- [ ] `searchKeywords`: 배열 길이 ≤ 20, 각 항목 ≤ 100자
- [ ] `notes`: ≤ 500자
- [ ] `referenceText`: ≤ 2000자
- [ ] 전체 페이로드 크기: ≤ 100KB (목표)

**3. 제출 직전 검증 코드 확인**
```javascript
// 제출 직전 검증 예시
const cleanPhotoMetas = photoMetas.map(photo => ({
  url: photo.url,
  width: photo.width,
  height: photo.height,
  sizeKb: photo.sizeKb
  // base64, preview, thumbnail 등 제거
}));

// 페이로드 크기 확인
const payloadSize = JSON.stringify(payload).length;
if (payloadSize > 100 * 1024) { // 100KB 초과
  toast.error('페이로드가 너무 큽니다. 불필요한 데이터를 제거해주세요.');
  return;
}
```

**4. 확인 체크리스트**
- [ ] `photoMetas`에서 `base64` 제거됨
- [ ] `photoMetas`에서 `preview` 제거됨
- [ ] `photoMetas`에서 `thumbnail` 제거됨
- [ ] `photoMetas`에서 원본 EXIF 제거됨
- [ ] 텍스트 필드 크기 제한 적용됨
- [ ] 전체 페이로드 크기 ≤ 100KB

---

## C) 서버 바디 제한 상향 (운영 설정)

### 📋 실행 단계

**1. NestJS 부트스트랩 레벨 설정 확인**

**파일 위치:** `apps/api/src/main.ts` 또는 `apps/api/src/app.module.ts`

**현재 설정 확인:**
```typescript
// main.ts 예시
app.use(express.json({ limit: '1mb' }));  // 현재 설정 확인
app.use(express.urlencoded({ limit: '1mb', extended: true }));
```

**2. 바디 제한 상향 설정**
```typescript
// 목표: 최소 1-2MB
app.use(express.json({ limit: '2mb' }));  // 2MB로 상향
app.use(express.urlencoded({ limit: '2mb', extended: true }));
```

**3. Fastify 사용 시**
```typescript
// main.ts (Fastify)
app.register(require('@fastify/formbody'), {
  bodyLimit: 2 * 1024 * 1024, // 2MB
});
```

**4. 확인 체크리스트**
- [ ] JSON body limit: 1-2MB 이상
- [ ] urlencoded limit: 1-2MB 이상
- [ ] multipart limit: 1-2MB 이상 (파일 업로드 사용 시)
- [ ] 서버 재시작 후 적용 확인

**5. 목적**
- 사진 15-20장 메타만 실으면 수십 KB 수준
- 안전 마진을 두기 위해 1-2MB 설정

---

## D) 프리플라이트(CORS) 확정

### 📋 실행 단계

**1. CORS 설정 확인**

**파일 위치:** `apps/api/src/main.ts`

**현재 설정 확인:**
```typescript
app.enableCors({
  origin: process.env.WEB_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
});
```

**2. CORS 설정 확정**

**필수 항목:**
- [ ] `origin`: `WEB_URL` 환경변수 또는 정확한 프론트엔드 URL
- [ ] `methods`: `GET`, `POST`, `PUT`, `OPTIONS` 포함
- [ ] `allowedHeaders`: `Authorization`, `Content-Type` 포함
- [ ] `credentials`: `true` 유지

**3. 환경변수 확인**
```env
# .env 파일
WEB_URL=http://localhost:3000  # 개발 환경
# 또는
WEB_URL=https://yourdomain.com  # 운영 환경
```

**4. 프리플라이트 응답 확인**

**DevTools Network에서 확인:**
- [ ] `OPTIONS /orders` Status: `200 OK` 또는 `204 No Content`
- [ ] `OPTIONS /orders` Response Headers:
  - `Access-Control-Allow-Origin: <WEB_URL>`
  - `Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS`
  - `Access-Control-Allow-Headers: Authorization, Content-Type`
  - `Access-Control-Allow-Credentials: true`
- [ ] `(failed) preflight` 아님

**5. 확인 체크리스트**
- [ ] `OPTIONS /orders`가 `200/204`로 성공
- [ ] `(failed) preflight` 오류 없음
- [ ] CORS 헤더 정상 응답
- [ ] `origin`이 정확히 포함됨

---

## E) 사진 도메인 화이트리스트 (서버 검증)

### 📋 실행 단계

**1. 개발 단계 도메인 확인**

**서버 `.env` 파일 확인:**
```env
ALLOWED_S3_DOMAINS=localhost,127.0.0.1,blob,http://localhost:3000
```

**2. 개발 단계 도메인 추가**

**필요한 도메인/스킴:**
- [ ] `blob:` (로컬 파일 업로드)
- [ ] `http://localhost:3000` (로컬 개발 서버)
- [ ] `http://127.0.0.1:3000` (로컬 IP)
- [ ] 개발용 S3 버킷 도메인 (예: `dev-bucket.s3.amazonaws.com`)

**3. 운영 전환 시 정리**

**운영 환경:**
- [ ] 개발용 도메인 제거
- [ ] 운영 S3 버킷 도메인만 남김
- [ ] 예: `ALLOWED_S3_DOMAINS=production-bucket.s3.amazonaws.com`

**4. 확인 체크리스트**
- [ ] 개발 단계 도메인 화이트리스트에 포함
- [ ] 서버 재시작 후 적용 확인
- [ ] 운영 전환 시 정리 계획 수립

---

## F) 인증/역할/스코프

### 📋 실행 단계

**1. Authorization 헤더 확인**

**DevTools Network → Request Headers:**
- [ ] `Authorization: Bearer <JWT_TOKEN>` 항상 포함됨
- [ ] 토큰이 유효함 (만료되지 않음)

**2. JWT 토큰 디코드 (https://jwt.io)**
```json
{
  "role": "AGENCY",  // ✅ 확인
  "sub": "user-id",
  "email": "agency@example.com",
  "agencyId": "agency-uuid"  // ✅ 확인 (null 아님)
}
```

**3. 서버 검증 확인**

**서버 로그 확인:**
- [ ] `user.agencyId`가 null이 아닌지 확인
- [ ] `agencyId` 누락 시 400 응답 확인
- [ ] 기본값 주입 금지 (명시적 에러 응답)

**4. 확인 체크리스트**
- [ ] Authorization 헤더 항상 포함
- [ ] `role=AGENCY` 확인
- [ ] `agencyId` null 아님
- [ ] 서버가 명시적 에러 응답 (기본값 주입 금지)

---

## G) 재검증 절차 (한 번만)

### 📋 실행 단계

**1. DevTools Network 확인**

**OPTIONS /orders:**
- [ ] Status: `200 OK` 또는 `204 No Content`
- [ ] `(failed) preflight` 아님
- [ ] CORS 헤더 정상 응답

**POST /orders:**
- [ ] Status: `201 Created` 또는 `200 OK` (2xx)
- [ ] Request Payload 크기: ≤ 100KB
- [ ] `base64`/`preview` 제거됨
- [ ] Response Body: `{ id: "...", status: "SUBMITTED" }`

**2. 프론트엔드 확인**

**성공 토스트:**
- [ ] top-center 위치에 성공 토스트 표시
- [ ] 메시지: "주문이 접수되었습니다" 또는 유사

**3. 서버 /health 확인**

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

**4. DB 확인**

**주문 상태 확인:**
```sql
SELECT id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 1;
-- status: SUBMITTED
```

**5. 확인 체크리스트**
- [ ] OPTIONS /orders: 200/204 성공
- [ ] POST /orders: 2xx 성공
- [ ] 페이로드 크기: ≤ 100KB
- [ ] base64/preview 제거됨
- [ ] top-center 성공 토스트 표시
- [ ] /health 큐 waiting/active 증가
- [ ] DB에 SUBMITTED 상태 생성

---

## H) 합격 기준 (최종)

### ✅ 검증문

**1. 프리플라이트 성공**
- [ ] `OPTIONS /orders` Status: `200 OK` 또는 `204 No Content`
- [ ] `(failed) preflight` 오류 없음
- [ ] CORS 헤더 정상 응답

**2. POST /orders 성공**
- [ ] Status Code: `201 Created` 또는 `200 OK` (2xx)
- [ ] Response Body: `{ id: "...", status: "SUBMITTED" }`

**3. 페이로드 최적화**
- [ ] 제출 페이로드가 **메타(짧은 키들)**만 담고 있음
- [ ] `url`, `width`, `height`, `sizeKb`만 포함
- [ ] `base64`, `preview`, `thumbnail`, 대용량 EXIF 제거됨
- [ ] 페이로드 크기: ≤ 100KB (목표)

**4. DB 및 큐 확인**
- [ ] DB에 상태 `SUBMITTED` 생성됨
- [ ] 큐 `waiting` → `active` 변동 관측됨
- [ ] `/health`에서 큐 상태 변화 확인

**5. 에러 처리**
- [ ] 실패 시 서버 `message` 원문이 top-center로 그대로 노출됨
- [ ] 일반적인 에러 메시지 없음

---

## 🎯 우선 확인 순서 (10분 이내)

### 1단계: Network 확인 (3분)
- [ ] OPTIONS /orders Status 확인
- [ ] POST /orders Status 및 Size 확인
- [ ] Request Payload 내 base64/preview 확인

### 2단계: 페이로드 다이어트 (3분)
- [ ] photoMetas에서 base64/preview 제거 확인
- [ ] 텍스트 필드 크기 제한 확인
- [ ] 전체 페이로드 크기 ≤ 100KB 확인

### 3단계: 서버 설정 확인 (2분)
- [ ] 서버 바디 제한 상향 확인
- [ ] CORS 설정 확인
- [ ] 도메인 화이트리스트 확인

### 4단계: 재검증 (2분)
- [ ] OPTIONS /orders 200/204 확인
- [ ] POST /orders 2xx 확인
- [ ] /health 큐 상태 확인

---

## 📊 트리아지 리포트 템플릿

### 페이로드 과대 + 프리플라이트 실패 리포트 작성 시:

```
## 페이로드 과대 + 프리플라이트 실패 리포트

### 1. OPTIONS /orders (프리플라이트)
- Status: [ ] (failed) preflight [ ] 200/204
- Response Headers: [ ] CORS 헤더 확인
- 원인: [ ] CORS 설정 누락 [ ] origin 불일치 [ ] methods 누락

### 2. POST /orders
- Status Code: [ ] 400 [ ] 413 [ ] 500
- Size: [ ] KB
- Response Body.message: [ ] 서버 원인 한 줄

### 3. Request Payload
- photoMetas 내부: [ ] base64 있음 [ ] preview 있음 [ ] 없음
- 전체 크기: [ ] KB (목표: ≤ 100KB)

### 4. 서버 설정
- JSON body limit: [ ] 현재 설정 확인
- CORS 설정: [ ] origin [ ] methods [ ] headers [ ] credentials
- 도메인 화이트리스트: [ ] 개발 도메인 포함 여부

### 5. 원인 추정
1순위: [ ] 프리플라이트 실패 (CORS 설정)
2순위: [ ] 페이로드 과대 (base64/preview 포함)
3순위: [ ] 서버 바디 제한 초과

### 6. 조치
- [ ] CORS 설정 확정 (origin, methods, headers, credentials)
- [ ] photoMetas에서 base64/preview 제거
- [ ] 서버 바디 제한 상향 (1-2MB)
- [ ] 도메인 화이트리스트에 개발 도메인 추가
- [ ] 서버 재시작 후 재테스트
```

---

## 🔧 추가 확인 사항

### 프론트엔드 코드 확인
- [ ] `PhotoUploader` 컴포넌트에서 base64/preview 제거 확인
- [ ] `handleSubmit` 함수에서 페이로드 정리 확인
- [ ] 텍스트 필드 크기 제한 적용 확인

### 서버 코드 확인
- [ ] `main.ts`에서 CORS 설정 확인
- [ ] `main.ts`에서 바디 제한 설정 확인
- [ ] `orders.service.ts`에서 도메인 화이트리스트 검증 확인

### 환경변수 확인
- [ ] `WEB_URL` 환경변수 설정 확인
- [ ] `ALLOWED_S3_DOMAINS` 환경변수 설정 확인
- [ ] 개발/운영 환경 분리 확인






