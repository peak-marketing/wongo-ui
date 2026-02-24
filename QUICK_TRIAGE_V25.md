# 원고 접수 실패 최종 점검 v2.5 - 빠른 참조

## 🚨 가장 유력한 3가지 원인 (우선 확인)

### 1순위: 사진 URL 화이트리스트 불일치 ⚠️
**확인:** Request Payload의 `photos` 배열 URL 도메인 vs 서버 `.env`의 `ALLOWED_S3_DOMAINS`
**조치:** 개발용 도메인 추가 (예: `ALLOWED_S3_DOMAINS=localhost,blob`)

### 2순위: 템플릿 적용 후 필드 누락
**확인:** 템플릿 선택 후 제출 직전 필드 상태 (place.name, searchKeywords, 사진 개수)
**조치:** 템플릿 적용 후 필드 검증 강화

### 3순위: 토큰/agencyId 불일치
**확인:** Request Headers의 Authorization 토큰, JWT role=AGENCY
**조치:** 재로그인 후 재시도

---

## 📋 5분 체크리스트

### Network 캡처 (필수)
- [ ] Status Code: 400/401/403/404/413/500
- [ ] Response Body.message: 서버 원인 한 줄
- [ ] Request Payload: place.name, searchKeywords.length, photoMetas.length, submitCount 유무
- [ ] Request Headers: Authorization, Content-Type
- [ ] Timing: Preflight/CORS 여부

### 즉시 확인 (가장 흔한 7가지)
1. [ ] 사진 URL 화이트리스트: URL 도메인 vs ALLOWED_S3_DOMAINS
2. [ ] 사진 개수: 프론트 카운터 = photoMetas.length = 15~20
3. [ ] 권한/agencyId: Authorization 헤더, role=AGENCY, agencyId null 아님
4. [ ] DTO 필수값: place.name, searchKeywords ≥ 1, hashtags ≤ 5
5. [ ] submitCount 규칙: 새 접수만 1~5, 편집/임시저장에는 없음
6. [ ] 413 Payload Too Large: 메타 크기 확인
7. [ ] 라우트/가드: POST /orders (신규), PUT /agency/orders/:id (편집)

### 서버 확인
- [ ] /health: 제출 후 queue.waiting/active 증가 확인
- [ ] 서버 로그: BadRequestException 메시지 한 줄 확인

---

## ✅ 합격 기준
1. POST /orders 2xx + top-center 성공 토스트
2. DB에 SUBMITTED 생성 + 큐 waiting→active 변동
3. 사진/화이트리스트/필수값/타입/submitCount 규칙 양쪽(프론트·서버) 통과







