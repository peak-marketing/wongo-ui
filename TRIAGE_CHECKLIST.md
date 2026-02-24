# 원고 접수 실패 트리아지 체크리스트 v2.3

## 🚨 긴급 체크리스트 (5분 이내)

### 1. Network 요청 확인
- [ ] DevTools Network 탭에서 요청이 실제로 전송되었는지 확인
- [ ] Status Code: 2xx (성공) 또는 4xx/5xx (실패)
- [ ] Response Body의 `message` 필드 확인

### 2. submitCount 규칙 확인
- [ ] 새 접수: Request Payload에 `submitCount` 존재 (1~5)
- [ ] 편집/임시저장: Request Payload에 `submitCount` 없음

### 3. 필수 필드 확인
- [ ] `place.name`: 문자열 존재
- [ ] `guide.searchKeywords`: 배열 길이 ≥ 1
- [ ] `photos`: 배열 길이 15~20

### 4. 서버 로그 확인
- [ ] 서버 콘솔에서 `[OrdersController.create]` 또는 `[OrdersService.createOrder]` 로그 확인
- [ ] BadRequestException 메시지 확인

---

## 📊 상세 진단 체크리스트

### A. Network 캡처 (프론트)

**Request URL / Status Code:**
- [ ] 새 접수: `POST /orders` → 201/200
- [ ] 편집 모드: `PUT /agency/orders/:id` → 200

**Request Headers:**
- [ ] `Authorization: Bearer <token>` 존재
- [ ] `Content-Type: application/json` 존재

**Request Payload:**
- [ ] `submitCount`: 새 접수에는 1~5, 편집/임시저장에는 없음
- [ ] `place.name`: 문자열 존재
- [ ] `guide.searchKeywords`: 배열 길이 ≥ 1
- [ ] `photos`: 배열 길이 15~20
- [ ] `photoMetas`: `photos`와 동일 길이

**Response Body:**
- [ ] 성공: `{ id: "...", status: "SUBMITTED" }`
- [ ] 실패: `{ message: "구체적 에러 메시지" }`

**Timing:**
- [ ] blocked: 0ms
- [ ] CORS/preflight 지연 없음

---

### B. /health 재확인 (백엔드)

**헬스 체크:**
- [ ] `db: true`
- [ ] `redis: true`
- [ ] 제출 직후 `queue.waiting` 또는 `queue.active` 증가 확인

**명령어:**
```bash
curl http://localhost:3001/health | jq '.db, .redis, .queue.waiting, .queue.active'
```

---

### C. 사진 메타·화이트리스트 규칙

**사진 개수:**
- [ ] 프론트 카운터: 15~20장
- [ ] Request Payload `photos` 배열: 15~20장
- [ ] Request Payload `photoMetas` 배열: `photos`와 일치

**도메인 화이트리스트:**
- [ ] `.env` 파일의 `ALLOWED_S3_DOMAINS` 확인
- [ ] 개발 환경: `localhost`, `blob` 포함 또는 비어있음
- [ ] Request Payload의 `photos` URL 도메인이 화이트리스트에 포함

**확장자/용량:**
- [ ] 확장자: `.jpg`, `.jpeg`, `.png`, `.webp`
- [ ] 개별 파일: ≤10MB

---

### D. DTO 최소 요건·타입

**필수값:**
- [ ] `place.name`: 문자열 존재 (trim 후 길이 > 0)
- [ ] `guide.searchKeywords`: 배열 길이 ≥ 1
- [ ] `photos`: 배열 길이 15~20 (임시 저장 제외)

**타입:**
- [ ] `targetChars`: `[number, number]` (기본 [1500, 2000])
- [ ] `photoLimits`: `[number, number]` (기본 [15, 20])
- [ ] `submitCount`: `number` (1~5, 새 접수만)

**해시태그:**
- [ ] 최대 5개
- [ ] 프론트에서 제출 직전 차단

---

### E. 권한/역할·agencyId 매핑

**토큰:**
- [ ] `role=AGENCY` (JWT 디코드 확인)

**agencyId:**
- [ ] 서버에서 `user.agencyId` 또는 `user.id` 읽기
- [ ] 서버 로그에서 "대행사 식별자가 필요합니다" 에러 없음

**place:**
- [ ] 같은 업체 재접수 시 기존 place 조회 또는 자동 생성

---

### F. 임시 저장·편집 전용 규칙

**편집 모드:**
- [ ] 제출 경로: `PUT /agency/orders/:id`
- [ ] Request Payload에 `submitCount` 없음
- [ ] UI 멀티 수량 뱃지/필드 비활성

**새 접수:**
- [ ] `submitCount`: 1~5 전송
- [ ] 생략 시 서버 기본 1 적용

---

### G. 서버 로그 포인트

**로그 확인:**
- [ ] `[OrdersController.create]` 로그 존재
- [ ] `[OrdersService.createOrder]` 로그 존재
- [ ] BadRequestException 메시지 구체적

**큐 상태:**
- [ ] 제출 후 `queue.waiting` → `queue.active` 변화 확인
- [ ] 변화 없으면 컨트롤러/서비스 단계 실패

---

### H. DB 제약 충돌 가능성

**확인 항목:**
- [ ] 최근 마이그레이션으로 NOT NULL/DEFAULT 제약 추가된 컬럼
- [ ] `placeId`/`agencyId` 외래키 무결성
- [ ] `completedAt` 컬럼 기본값 문제

---

### I. 실패 시 프론트 UX

**에러 메시지:**
- [ ] 서버 `message` 원문을 `top-center` 토스트로 노출
- [ ] 포괄적 문구 금지

**제출 버튼:**
- [ ] 중복 클릭 방지: `loading` 상태 + `disabled`
- [ ] 로딩 스피너 표시

---

## ✅ 검증문 (합격 기준)

1. [ ] DevTools Network에서 `POST /orders`가 실제 전송되고, 2xx면 성공 토스트가 `top-center`에 뜬다.
2. [ ] 서버가 400을 줄 경우 구체 메시지가 토스트로 그대로 보인다 (예: 도메인/확장자/개수/필수필드).
3. [ ] 새 접수/편집 모드에서 `submitCount` 포함/제외 규칙이 정확히 지켜진다.
4. [ ] 제출 직후 DB에 `SUBMITTED` 생성 및 `queue waiting→active` 변동이 관측된다.
5. [ ] 사진 15~20/확장자/용량/도메인 화이트리스트 규칙이 프론트·서버 양쪽에서 모두 충족된다.







