# 사진 업로드 완료 처리 보완 v2.7 - 빠른 참조

## 🚨 즉시 확인 (5분)

### 1. 현재 증상
- [ ] 화면 메시지: "사진 업로드가 아직 완료되지 않았습니다"
- [ ] 업로더 내부 상태: pending/uploading/failed 항목 확인
- [ ] 제출 버튼: 비활성화 여부

### 2. 상태 머신 확인
- [ ] 상태 전이: queued → uploading → uploaded | failed
- [ ] 제출 허용 조건 (AND 모두 충족):
  - 전체 항목 개수: 15~20
  - 모든 항목 uploaded (pending/uploading/failed 없음)
  - photoMetas.length = 업로드 성공 개수
  - photoMetas[i].url/width/height/sizeKb 모두 존재

### 3. 업로드 모드
- [ ] DEV 모드: 파일 선택 시 즉시 blob: 생성, uploaded 처리
- [ ] PROD 모드: 사전서명 URL로 PUT/POST 진행
- [ ] 서버 화이트리스트: blob: 허용

### 4. 레이스/동기화
- [ ] 제출 직전 가드: inFlightCount === 0 & every(status === uploaded)
- [ ] Promise.allSettled(uploadPromises) 완료 대기
- [ ] 템플릿 적용 시 사진 배열 보존

---

## ✅ 합격 기준

1. [ ] 모든 이미지 카드가 uploaded로 전이된 후 제출 버튼 활성화
2. [ ] POST /orders 2xx 성공
3. [ ] /health 큐 waiting/active 증가
4. [ ] 실패 시 서버 message 원문 top-center 표시
5. [ ] DEV 모드에서도 메타만 전송, 페이로드 과도하지 않음

---

## 🔧 조치 요약

### 상태 머신
- queued → uploading → uploaded | failed 명시
- 화면에 상태 뱃지/진행률 노출
- 제출 허용 조건 명확화 (AND 모두 충족)

### 제출 직전 가드
- inFlightCount === 0 & every(status === uploaded) 재검증
- Promise.allSettled(uploadPromises) 완료 대기

### 템플릿 적용
- 사진 배열 보존 (텍스트/체크만 교체)
- 템플릿 적용 후 업로드 상태/카운터 유지

### 실패/누락 UX
- failed 항목: 실패 아이콘/원인 표시 + 재시도/제거 버튼
- pending/uploading 항목: 상단 경고 + 진행률 표기
- 메타 누락: 빨간 배지 "메타 누락" 표시 + 제출 차단

### 진단용 표시/로그
- 개발 빌드: "업로드 현황: uploaded X / total Y, failed Z, in-flight N"
- 제출 차단 시: 한 줄 요약 토스트 (top-center)






