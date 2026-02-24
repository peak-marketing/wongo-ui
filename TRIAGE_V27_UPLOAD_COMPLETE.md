# 사진 업로드 완료 처리 보완 v2.7 (대행사 원고 접수)

## 🎯 목표
- 업로더 상태 머신 명시 (queued → uploading → uploaded | failed)
- 제출 허용 조건 명확화 (AND 모두 충족)
- 레이스/동기화 보완
- 실패/누락 상황별 UX 개선

---

## A) 현재 증상 정의 (화면 메시지 기준)

### 📋 실행 단계

**1. 화면 메시지 확인**
- [ ] 폼 상단 경고: "사진 업로드가 아직 완료되지 않았습니다. 업로드가 끝난 뒤 다시 시도해주세요."
- [ ] 경고 메시지가 표시되는 시점 확인
- [ ] 제출 버튼 상태 확인 (비활성화 여부)

**2. 업로더 내부 상태 확인**
- [ ] 업로더 컴포넌트 내부 상태 확인
- [ ] 각 항목의 상태: `pending`, `uploading`, `uploaded`, `failed` 확인
- [ ] 상태가 완료 상태(`uploaded`)로 수렴하지 않는 항목 확인

**3. 증상 기록**
```
현재 증상:
- [ ] 일부 항목이 pending 상태
- [ ] 일부 항목이 uploading 상태
- [ ] 일부 항목이 failed 상태
- [ ] 전체 상태가 완료되지 않음
```

---

## B) 업로더 상태 머신 명시 (필수)

### 📋 실행 단계

**1. 상태 머신 정의 확인**

**각 항목의 상태:**
- [ ] `queued`: 초기 상태, 업로드 대기 중
- [ ] `uploading`: 업로드 진행 중
- [ ] `uploaded`: 업로드 완료
- [ ] `failed`: 업로드 실패

**2. 화면 표시 확인**
- [ ] 각 항목에 상태 뱃지 표시
- [ ] 진행률 표시 (예: 12/15 완료)
- [ ] 실패 아이콘 표시 (failed 항목)

**3. 제출 허용 조건 확인 (AND 모두 충족)**

**조건 1: 전체 항목 개수**
- [ ] 전체 항목 개수 = 15~20

**조건 2: 모든 항목이 uploaded**
- [ ] `pending` 항목 없음
- [ ] `uploading` 항목 없음
- [ ] `failed` 항목 없음
- [ ] 모든 항목이 `uploaded` 상태

**조건 3: photoMetas.length 일치**
- [ ] `photoMetas.length` = 업로드 성공 개수
- [ ] `photoMetas.length` = 전체 항목 개수 (15~20)

**조건 4: 메타 필수 키 존재**
- [ ] `photoMetas[i].url` 존재
- [ ] `photoMetas[i].width` 존재
- [ ] `photoMetas[i].height` 존재
- [ ] `photoMetas[i].sizeKb` 존재

**4. 제출 버튼 비활성화 조건**
- [ ] 위 조건 중 하나라도 불충족 시 제출 버튼 비활성화
- [ ] 해당 이유(누락/실패 개수) 토스트 top-center 노출
- [ ] 예: "업로드 진행 중 2건" / "실패 1건 재시도 필요"

**5. 확인 체크리스트**
- [ ] 상태 머신 명시됨 (queued → uploading → uploaded | failed)
- [ ] 화면에 상태 뱃지/진행률 노출
- [ ] 제출 허용 조건 명확화
- [ ] 제출 버튼 비활성화 조건 적용
- [ ] 실패 시 토스트 메시지 표시

---

## C) 업로드 모드 분기 (개발/운영)

### 📋 실행 단계

**1. DEV 모드 확인 (사전서명 미연결)**

**파일 선택 시 처리:**
- [ ] 파일 선택 시 즉시 `objectURL` (`blob:`) 생성
- [ ] `uploaded`로 간주하고 메타 계산
- [ ] 메타 계산: `url`, `width`, `height`, `sizeKb`
- [ ] 큐 완료 처리

**서버 화이트리스트 확인:**
- [ ] 서버 화이트리스트에 `blob:` 허용
- [ ] 개발 전용으로 허용한 상태 유지

**2. PROD 모드 확인 (S3 사전서명)**

**업로드 흐름:**
- [ ] `queued` → `uploading` 시 사전서명 URL 요청
- [ ] 사전서명 URL로 PUT/POST 진행
- [ ] 성공 시 `uploaded` 전이
- [ ] 실패 시 `failed` 전이

**재시도 기능:**
- [ ] `failed` 항목에 재시도 버튼 노출
- [ ] 재시도 시 `uploading` → `uploaded` 또는 `failed` 전이

**3. 모드 분기 확인**
- [ ] 환경변수 또는 설정으로 모드 분기
- [ ] DEV 모드: `blob:` 사용
- [ ] PROD 모드: S3 사전서명 사용

**4. 확인 체크리스트**
- [ ] DEV 모드: 파일 선택 시 즉시 `blob:` 생성, `uploaded` 처리
- [ ] PROD 모드: 사전서명 URL로 업로드 진행
- [ ] 서버 화이트리스트에 `blob:` 허용
- [ ] 실패 시 재시도 버튼 노출

---

## D) 레이스/동기화 보완 (중요)

### 📋 실행 단계

**1. 제출 직전 가드 확인**

**내부 상태 재검증:**
- [ ] `inFlightCount === 0` 확인
- [ ] `every(status === uploaded)` 확인
- [ ] 모든 항목이 `uploaded` 상태인지 재검증

**업로드 프로미스 완료 대기:**
- [ ] `Promise.allSettled(uploadPromises)` 완료 시점 확인
- [ ] 대기 중 차단 (업로드 진행 중 제출 불가)

**2. 템플릿 적용 영향 차단**

**템플릿 적용 시:**
- [ ] 사진 배열에는 손대지 않음
- [ ] 텍스트/체크만 교체
- [ ] 템플릿 적용 직후에도 업로드 상태/카운터가 변하지 않음

**확인 방법:**
1. 사진 15~20장 업로드
2. 템플릿 선택
3. 업로드 상태 확인:
   - [ ] 사진 배열 길이 유지 (15~20)
   - [ ] 업로드 상태 유지 (`uploaded`)
   - [ ] 카운터 변하지 않음

**3. 동기화 확인 체크리스트**
- [ ] 제출 직전 가드: `inFlightCount === 0` & `every(status === uploaded)`
- [ ] `Promise.allSettled(uploadPromises)` 완료 대기
- [ ] 템플릿 적용 시 사진 배열 보존
- [ ] 템플릿 적용 후 업로드 상태/카운터 유지

---

## E) 실패/누락 상황별 UX

### 📋 실행 단계

**1. failed ≥ 1 항목 처리**

**화면 표시:**
- [ ] 카드에 실패 아이콘 표시
- [ ] 실패 원인 표시 (용량/확장자/CORS)
- [ ] [재시도] 버튼 제공
- [ ] [제거] 버튼 제공

**예시:**
```
[사진 카드]
❌ 업로드 실패
원인: 파일 크기가 10MB를 초과합니다
[재시도] [제거]
```

**2. pending/uploading > 0 항목 처리**

**화면 표시:**
- [ ] 상단 경고 그대로 유지
- [ ] 진행률 합산 표기 (예: 12/15 완료)
- [ ] 업로드 중인 항목에 진행률 표시

**예시:**
```
⚠️ 사진 업로드가 아직 완료되지 않았습니다.
업로드 현황: 12/15 완료 (3건 진행 중)
```

**3. 메타 누락 항목 처리**

**화면 표시:**
- [ ] 특정 항목의 `url`/`width`/`height`/`sizeKb` 누락 시
- [ ] 해당 카드에 빨간 배지 "메타 누락" 표시
- [ ] 제출 차단

**확인 방법:**
- [ ] `photoMetas[i].url` 누락 확인
- [ ] `photoMetas[i].width` 누락 확인
- [ ] `photoMetas[i].height` 누락 확인
- [ ] `photoMetas[i].sizeKb` 누락 확인

**4. 확인 체크리스트**
- [ ] failed 항목: 실패 아이콘/원인 표시 + 재시도/제거 버튼
- [ ] pending/uploading 항목: 상단 경고 + 진행률 표기
- [ ] 메타 누락: 빨간 배지 "메타 누락" 표시 + 제출 차단

---

## F) CORS/프리플라이트 확인 (동시 처리)

### 📋 실행 단계

**1. DevTools Network 확인**

**OPTIONS /orders 확인:**
- [ ] `OPTIONS /orders` Status: `200 OK` 또는 `204 No Content`
- [ ] `(failed) preflight` 아님

**Response Headers 확인:**
- [ ] `Access-Control-Allow-Origin: http://localhost:3000` 포함
- [ ] `Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS` 포함
- [ ] `Access-Control-Allow-Headers: Authorization, Content-Type` 포함
- [ ] `Access-Control-Allow-Credentials: true` 포함

**2. CORS 설정 확인**

**서버 설정 확인:**
- [ ] `origin`: `http://localhost:3000` 포함
- [ ] `methods`: `GET`, `POST`, `PUT`, `OPTIONS` 포함
- [ ] `headers`: `Authorization`, `Content-Type` 포함
- [ ] `credentials`: `true` 유지

**3. 프리플라이트 실패 시 조치**
- [ ] `OPTIONS`가 `(failed) preflight`면 CORS 우선 해결
- [ ] `POST` 성공 불가 (프리플라이트 실패 시)

**4. 확인 체크리스트**
- [ ] `OPTIONS /orders`: `200/204` 성공
- [ ] CORS 헤더 정상 응답
- [ ] `origin`, `methods`, `headers`, `credentials` 확인

---

## G) 페이로드 다이어트 확인

### 📋 실행 단계

**1. Request Payload 확인**

**DevTools Network → Request Payload:**
- [ ] `photoMetas[]` 항목 확인
- [ ] `base64` 문자열 포함 여부 확인
- [ ] 미리보기 데이터 포함 여부 확인
- [ ] 원본 EXIF 덤프 포함 여부 확인

**2. 허용 키만 전송 확인**
- [ ] `url`: 존재
- [ ] `width`: 존재
- [ ] `height`: 존재
- [ ] `sizeKb`: 존재
- [ ] `checksum`: 필요 시 1줄만 (선택)
- [ ] `base64`: 없음
- [ ] `preview`: 없음
- [ ] `thumbnail`: 없음
- [ ] `exif`: 없음

**3. 페이로드 크기 확인**
- [ ] 전체 페이로드 크기: ≤ 100KB (목표)
- [ ] `photoMetas` 배열 크기 확인

**4. 확인 체크리스트**
- [ ] `photoMetas[]`에 `base64`/미리보기/원본 EXIF 없음
- [ ] 허용 키만 전송: `url`, `width`, `height`, `sizeKb`
- [ ] 페이로드 크기 ≤ 100KB

---

## H) 진단용 표시/로그 (일시)

### 📋 실행 단계

**1. 업로더 영역 하단 표시 (개발 빌드에서만)**

**표시 내용:**
- [ ] "업로드 현황: uploaded X / total Y, failed Z, in-flight N"
- [ ] 개발 빌드에서만 노출
- [ ] 운영 빌드에서는 숨김

**예시:**
```
업로드 현황: uploaded 15 / total 15, failed 0, in-flight 0
```

**2. 제출 차단 시 토스트 메시지**

**메시지 예시:**
- [ ] "업로드 진행 중 2건"
- [ ] "실패 1건 재시도 필요"
- [ ] "메타 누락 1건"
- [ ] "사진 개수 부족 (현재: 10장, 필요: 15~20장)"

**3. 토스트 위치 확인**
- [ ] top-center 위치
- [ ] 한 줄 요약 표시

**4. 확인 체크리스트**
- [ ] 개발 빌드: 업로드 현황 텍스트 표시
- [ ] 제출 차단 시: 한 줄 요약 토스트 표시
- [ ] 토스트 위치: top-center

---

## I) 합격 기준 (최종)

### ✅ 검증문

**1. 업로드 완료 후 제출 버튼 활성화**
- [ ] 모든 이미지 카드가 `uploaded`로 전이됨
- [ ] 제출 버튼이 활성화됨
- [ ] 상단 경고 메시지 사라짐

**2. 제출 성공 확인**
- [ ] DevTools Network: `POST /orders` Status: `2xx`
- [ ] `/health`: `queue.waiting`/`active` 증가
- [ ] Response Body: `{ id: "...", status: "SUBMITTED" }`

**3. 실패 처리 확인**
- [ ] 실패 시 서버 `message` 원문이 top-center에 그대로 표시됨
- [ ] 업로더 UI가 실패 항목을 명확히 지목함
- [ ] 실패 원인 표시 (용량/확장자/CORS)

**4. DEV 모드 확인**
- [ ] DEV 모드(`blob:`)에서도 메타만 전송됨
- [ ] 페이로드가 과도하지 않음 (≤ 100KB)
- [ ] `base64`/미리보기/원본 EXIF 없음

**5. 확인 체크리스트**
- [ ] 모든 이미지 카드 `uploaded` 전이 후 제출 버튼 활성화
- [ ] `POST /orders` `2xx` 성공
- [ ] `/health` 큐 `waiting`/`active` 증가
- [ ] 실패 시 서버 메시지 원문 top-center 표시
- [ ] DEV 모드에서도 메타만 전송, 페이로드 과도하지 않음

---

## 🎯 우선 확인 순서 (10분 이내)

### 1단계: 현재 증상 확인 (2분)
- [ ] 화면 메시지 확인
- [ ] 업로더 내부 상태 확인
- [ ] 증상 기록

### 2단계: 상태 머신 확인 (3분)
- [ ] 상태 머신 명시 확인 (queued → uploading → uploaded | failed)
- [ ] 제출 허용 조건 확인 (AND 모두 충족)
- [ ] 제출 버튼 비활성화 조건 확인

### 3단계: 업로드 모드 확인 (2분)
- [ ] DEV 모드: `blob:` 즉시 생성, `uploaded` 처리
- [ ] PROD 모드: S3 사전서명 URL로 업로드
- [ ] 서버 화이트리스트 확인

### 4단계: 레이스/동기화 확인 (2분)
- [ ] 제출 직전 가드: `inFlightCount === 0` & `every(status === uploaded)`
- [ ] `Promise.allSettled(uploadPromises)` 완료 대기
- [ ] 템플릿 적용 시 사진 배열 보존

### 5단계: 실패/누락 UX 확인 (1분)
- [ ] failed 항목: 실패 아이콘/원인 표시 + 재시도/제거 버튼
- [ ] pending/uploading 항목: 상단 경고 + 진행률 표기
- [ ] 메타 누락: 빨간 배지 "메타 누락" 표시

---

## 📊 트리아지 리포트 템플릿

### 사진 업로드 완료 처리 실패 리포트 작성 시:

```
## 사진 업로드 완료 처리 실패 리포트

### 1. 현재 증상
- 화면 메시지: [ ] "사진 업로드가 아직 완료되지 않았습니다"
- 업로더 내부 상태: [ ] pending [ ] uploading [ ] failed
- 제출 버튼: [ ] 비활성화 [ ] 활성화

### 2. 상태 머신 확인
- 상태 전이: [ ] queued → uploading → uploaded [ ] failed
- 제출 허용 조건:
  - [ ] 전체 항목 개수: 15~20
  - [ ] 모든 항목 uploaded: [ ] 예 [ ] 아니오
  - [ ] photoMetas.length 일치: [ ] 예 [ ] 아니오
  - [ ] 메타 필수 키 존재: [ ] 예 [ ] 아니오

### 3. 업로드 모드
- 모드: [ ] DEV (blob:) [ ] PROD (S3 사전서명)
- DEV 모드: [ ] 즉시 blob: 생성 [ ] uploaded 처리
- PROD 모드: [ ] 사전서명 URL 요청 [ ] PUT/POST 진행

### 4. 레이스/동기화
- 제출 직전 가드: [ ] inFlightCount === 0 [ ] every(status === uploaded)
- Promise.allSettled: [ ] 완료 대기 [ ] 대기 없음
- 템플릿 적용: [ ] 사진 배열 보존 [ ] 사진 배열 변경됨

### 5. 실패/누락 상황
- failed 항목: [ ] 있음 (개수: __) [ ] 없음
- pending/uploading 항목: [ ] 있음 (개수: __) [ ] 없음
- 메타 누락: [ ] 있음 (개수: __) [ ] 없음

### 6. CORS/프리플라이트
- OPTIONS /orders: [ ] 200/204 [ ] (failed) preflight
- CORS 헤더: [ ] 정상 [ ] 누락

### 7. 페이로드 다이어트
- photoMetas[] 내부: [ ] base64 없음 [ ] base64 있음
- 허용 키만 전송: [ ] 예 [ ] 아니오
- 페이로드 크기: [ ] ≤ 100KB [ ] > 100KB

### 8. 원인 추정
1순위: [ ] 상태 머신 미수렴 (pending/uploading/failed 잔존)
2순위: [ ] 레이스/동기화 문제 (제출 직전 가드 미적용)
3순위: [ ] 메타 누락 (url/width/height/sizeKb 누락)

### 9. 조치
- [ ] 상태 머신 명시 (queued → uploading → uploaded | failed)
- [ ] 제출 허용 조건 명확화 (AND 모두 충족)
- [ ] 제출 직전 가드 적용 (inFlightCount === 0 & every(status === uploaded))
- [ ] 템플릿 적용 시 사진 배열 보존
- [ ] 실패/누락 상황별 UX 개선
- [ ] 진단용 표시/로그 추가 (개발 빌드)
```

---

## 🔧 추가 확인 사항

### 프론트엔드 코드 확인
- [ ] `PhotoUploader` 컴포넌트에서 상태 머신 구현 확인
- [ ] 제출 허용 조건 검증 로직 확인
- [ ] 제출 직전 가드 적용 확인
- [ ] 템플릿 적용 시 사진 배열 보존 확인
- [ ] 실패/누락 상황별 UX 구현 확인

### 서버 코드 확인
- [ ] CORS 설정 확인 (origin, methods, headers, credentials)
- [ ] 도메인 화이트리스트 확인 (blob: 허용)
- [ ] 바디 제한 설정 확인 (1-2MB)

### 환경변수 확인
- [ ] `WEB_URL` 환경변수 설정 확인
- [ ] `ALLOWED_S3_DOMAINS` 환경변수 설정 확인
- [ ] 개발/운영 모드 분기 확인






