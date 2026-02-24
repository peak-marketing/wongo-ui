# "최근 템플릿 가져오기" 복구 v2.3 - 빠른 참조

## 🚨 즉시 확인 (5분)

### 1. 저장 시점
- [ ] 임시 저장(DRAFT) 성공 직후 저장 트리거
- [ ] 최종 접수(SUBMITTED) 성공 직후 저장 트리거
- [ ] 텍스트/체크 항목만 저장 (사진 제외)

### 2. 식별 키/중복 규칙
- [ ] 키: (agencyId, placeNameNormalized)
- [ ] 정규화 규칙: 앞뒤 공백 제거, 연속 공백 1개로 축약, 대소문자 무시
- [ ] 템플릿은 최신순 N=5개까지만 유지

### 3. 읽기(불러오기) 트리거
- [ ] placeName 입력이 2자 이상이 되면 디바운스 400ms 후 요청
- [ ] 입력이 비면 목록 숨김
- [ ] 요청 중에는 로딩 인디케이터 표시

### 4. API 계약
- [ ] GET /agency/order-templates?place=<rawPlaceName>
- [ ] POST /agency/order-templates 본문: { placeName, snapshot }
- [ ] 서버는 agencyId 스코프에서 placeNameNormalized로 매칭

### 5. 적용(덮어쓰기) 동작
- [ ] 텍스트/체크 필드만 완전 덮어쓰기
- [ ] 사진 카운터/업로드 상태 변경하지 않음
- [ ] 적용 즉시, 해시태그 5개 초과/필수 항목 누락 여부 즉석 검증

### 6. 권한/보안
- [ ] 템플릿 API는 AGENCY 역할만 접근
- [ ] 서버는 항상 JWT에서 agencyId를 바인딩
- [ ] 쿼리 파라미터의 agencyId는 무시 (스푸핑 차단)

### 7. 실패 원인 트리아지
- [ ] placeName 정규화 미스매치 확인
- [ ] 저장 시점 누락 확인 (Network 캡처)
- [ ] 스코프 누락 확인
- [ ] 디바운스 미적용/과도 확인
- [ ] 빈 목록 처리 확인

---

## ✅ 합격 기준

1. [ ] 임시 저장(DRAFT) 성공 직후 저장 트리거
2. [ ] 최종 접수(SUBMITTED) 성공 직후 저장 트리거
3. [ ] placeName 입력이 2자 이상이 되면 디바운스 400ms 후 요청
4. [ ] 텍스트/체크 필드만 완전 덮어쓰기 (사진 제외)
5. [ ] 적용 즉시, 해시태그 5개 초과/필수 항목 누락 여부 즉석 검증
6. [ ] 템플릿 API는 AGENCY 역할만 접근
7. [ ] 서버는 항상 JWT에서 agencyId를 바인딩

---

## 🔧 조치 요약

### 저장 시점
- 임시 저장(DRAFT) 성공 직후 저장 트리거
- 최종 접수(SUBMITTED) 성공 직후 저장 트리거
- 텍스트/체크 항목만 저장 (사진 제외)

### 식별 키/중복 규칙
- 키: (agencyId, placeNameNormalized)
- 정규화 규칙: 앞뒤 공백 제거, 연속 공백 1개로 축약, 대소문자 무시
- 템플릿은 최신순 N=5개까지만 유지

### 읽기(불러오기) 트리거
- placeName 입력이 2자 이상이 되면 디바운스 400ms 후 요청
- 입력이 비면 목록 숨김
- 요청 중에는 로딩 인디케이터 표시

### API 계약
- GET /agency/order-templates?place=<rawPlaceName>
- POST /agency/order-templates 본문: { placeName, snapshot }
- 서버는 agencyId 스코프에서 placeNameNormalized로 매칭

### 적용(덮어쓰기) 동작
- 텍스트/체크 필드만 완전 덮어쓰기
- 사진 카운터/업로드 상태 변경하지 않음
- 적용 즉시, 해시태그 5개 초과/필수 항목 누락 여부 즉석 검증

### 권한/보안
- 템플릿 API는 AGENCY 역할만 접근
- 서버는 항상 JWT에서 agencyId를 바인딩
- 쿼리 파라미터의 agencyId는 무시 (스푸핑 차단)

### 실패 원인 트리아지
- placeName 정규화 미스매치: 프론트/백엔드 정규화 규칙 일치 확인
- 저장 시점 누락: Network 캡처로 POST /agency/order-templates 호출 확인
- 스코프 누락: 백엔드가 agencyId 스코프로 필터링 확인
- 디바운스 미적용/과도: placeName 변경 후 400ms 대기 확인
- 빈 목록 처리: 서버가 200+빈 배열을 보낼 때 "템플릿 없음" 안내 확인






