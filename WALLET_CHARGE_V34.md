# 대행사 충전 관리 v3.4

## 🎯 목표
- 엑셀(XLSX) 내보내기로 교체 (CSV 한글 깨짐 해결)
- 거래내역 '내역(수량)' 컬럼 추가
- 연도-월-일 클릭 시 날짜 캘린더 표시
- 키워드 필터 제거

---

## 1. 엑셀(XLSX) 내보내기로 교체 (CSV 한글 깨짐 해결)

### 1-1. API 엔드포인트 확인

### 📋 실행 단계

### 1. GET /agency/transactions/export.xlsx 확인

**확인 항목:**
- [ ] 엔드포인트 신설: GET /agency/transactions/export.xlsx?type=&from=&to=&min=&max=&page=&pageSize=
- [ ] 라이브러리: exceljs (서버)
- [ ] 헤더:
  - [ ] Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  - [ ] Content-Disposition: attachment; filename="거래내역_YYYYMMDD_HHmm.xlsx"

**확인 방법:**
1. API 엔드포인트 확인:
   - [ ] `GET /agency/transactions/export.xlsx` 호출 확인
   - [ ] Query Parameters: type, from, to, min, max, page, pageSize 확인
2. 라이브러리 확인:
   - [ ] exceljs 라이브러리 설치 확인
   - [ ] 서버에서 exceljs 사용 확인
3. 헤더 확인:
   - [ ] Response Headers에 `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` 확인
   - [ ] Response Headers에 `Content-Disposition: attachment; filename="거래내역_YYYYMMDD_HHmm.xlsx"` 확인

**확인 체크리스트:**
- [ ] 엔드포인트 신설: GET /agency/transactions/export.xlsx?type=&from=&to=&min=&max=&page=&pageSize=
- [ ] 라이브러리: exceljs (서버)
- [ ] 헤더: Content-Type, Content-Disposition

---

### 1-2. 시트/컬럼 확인

### 📋 실행 단계

### 1. 시트/컬럼 형식 확인

**확인 항목:**
- [ ] 시트/컬럼 (한글 라벨, 폭/서식 포함):
  - [ ] 일시 (yyyy-mm-dd HH:mm:ss)
  - [ ] 유형 (한글)
  - [ ] 내역 (예: 사용 10건)
  - [ ] 금액 (#,##0"원")
  - [ ] 메모·참조
  - [ ] 상태 (한글)
  - [ ] 거래ID
- [ ] 첫 행 고정, 자동 줄바꿈 (메모), 통화열 우측 정렬

**확인 방법:**
1. 엑셀 파일 다운로드 확인:
   - [ ] 엑셀 파일 다운로드 확인
   - [ ] 시트 열기 확인
2. 컬럼 확인:
   - [ ] 일시 컬럼: yyyy-mm-dd HH:mm:ss 형식 확인
   - [ ] 유형 컬럼: 한글 라벨 확인
   - [ ] 내역 컬럼: 예: 사용 10건 확인
   - [ ] 금액 컬럼: #,##0"원" 형식 확인
   - [ ] 메모·참조 컬럼 확인
   - [ ] 상태 컬럼: 한글 라벨 확인
   - [ ] 거래ID 컬럼 확인
3. 서식 확인:
   - [ ] 첫 행 고정 확인
   - [ ] 자동 줄바꿈 (메모) 확인
   - [ ] 통화열 우측 정렬 확인

**확인 체크리스트:**
- [ ] 시트/컬럼 (한글 라벨, 폭/서식 포함): 일시, 유형, 내역, 금액, 메모·참조, 상태, 거래ID
- [ ] 첫 행 고정, 자동 줄바꿈 (메모), 통화열 우측 정렬

---

### 1-3. 필터/정렬/기간 조건 확인

### 📋 실행 단계

### 1. 필터/정렬/기간 조건 적용 확인

**확인 항목:**
- [ ] 필터/정렬/기간 조건은 프런트와 동일 파라미터 그대로 적용 (보이는 리스트와 맞춤)

**확인 방법:**
1. 필터 적용 확인:
   - [ ] 프런트에서 필터 적용 후 엑셀 다운로드
   - [ ] 엑셀 파일 내용이 프런트 리스트와 일치 확인
2. 정렬 적용 확인:
   - [ ] 프런트에서 정렬 적용 후 엑셀 다운로드
   - [ ] 엑셀 파일 내용이 프런트 리스트와 일치 확인
3. 기간 조건 적용 확인:
   - [ ] 프런트에서 기간 조건 적용 후 엑셀 다운로드
   - [ ] 엑셀 파일 내용이 프런트 리스트와 일치 확인

**확인 체크리스트:**
- [ ] 필터/정렬/기간 조건은 프런트와 동일 파라미터 그대로 적용 (보이는 리스트와 맞춤)

---

### 1-4. 프런트 버튼 교체 확인

### 📋 실행 단계

### 1. "CSV 내보내기" → "엑셀로 받기(XLSX)" 버튼 교체 확인

**확인 항목:**
- [ ] "CSV 내보내기" → "엑셀로 받기(XLSX)" 버튼으로 교체
- [ ] 한글/원화 포맷을 정확히 유지

**확인 방법:**
1. 버튼 확인:
   - [ ] "CSV 내보내기" 버튼 제거 확인
   - [ ] "엑셀로 받기(XLSX)" 버튼 추가 확인
2. 다운로드 확인:
   - [ ] "엑셀로 받기(XLSX)" 버튼 클릭
   - [ ] 엑셀 파일 다운로드 확인
   - [ ] 한글/원화 포맷 정확히 유지 확인

**확인 체크리스트:**
- [ ] "CSV 내보내기" → "엑셀로 받기(XLSX)" 버튼으로 교체
- [ ] 한글/원화 포맷을 정확히 유지

---

## 2. 거래내역 '내역(수량)' 컬럼 추가

### 2-1. DB/도메인 확인

### 📋 실행 단계

### 1. billing_transactions에 units 컬럼 추가 확인

**확인 항목:**
- [ ] DB/도메인 (권장): billing_transactions에 units (INT, DEFAULT 0) 컬럼 추가
- [ ] RESERVE: 주문의 submitCount 저장 (예: 5)
- [ ] CAPTURE (사용): 주문의 submitCount 저장 (예: 10)
- [ ] RELEASE (해제): 주문의 submitCount 저장 (예: 5)
- [ ] 부호는 항상 양수로 저장하고, UI에서 유형별로 문구 처리

**확인 방법:**
1. DB 확인:
   - [ ] billing_transactions 테이블에 units 컬럼 추가 확인
   - [ ] units 컬럼 타입: INT, DEFAULT 0 확인
2. 데이터 저장 확인:
   - [ ] RESERVE 시 주문의 submitCount 저장 확인 (예: 5)
   - [ ] CAPTURE 시 주문의 submitCount 저장 확인 (예: 10)
   - [ ] RELEASE 시 주문의 submitCount 저장 확인 (예: 5)
   - [ ] 부호는 항상 양수로 저장 확인

**확인 체크리스트:**
- [ ] DB/도메인 (권장): billing_transactions에 units (INT, DEFAULT 0) 컬럼 추가
- [ ] RESERVE: 주문의 submitCount 저장 (예: 5)
- [ ] CAPTURE (사용): 주문의 submitCount 저장 (예: 10)
- [ ] RELEASE (해제): 주문의 submitCount 저장 (예: 5)
- [ ] 부호는 항상 양수로 저장하고, UI에서 유형별로 문구 처리

---

### 2-2. 서비스 훅 보강 확인

### 📋 실행 단계

### 1. reserve()/capture()/release() 호출부에서 units 기록 확인

**확인 항목:**
- [ ] 서비스 훅 보강 (서버): reserve()/capture()/release() 호출부에서 units도 같이 기록
- [ ] 엑셀/리스트 응답에 units 포함

**확인 방법:**
1. 서비스 훅 확인:
   - [ ] reserve() 호출부에서 units 기록 확인
   - [ ] capture() 호출부에서 units 기록 확인
   - [ ] release() 호출부에서 units 기록 확인
2. 응답 확인:
   - [ ] 엑셀 응답에 units 포함 확인
   - [ ] 리스트 응답에 units 포함 확인

**확인 체크리스트:**
- [ ] 서비스 훅 보강 (서버): reserve()/capture()/release() 호출부에서 units도 같이 기록
- [ ] 엑셀/리스트 응답에 units 포함

---

### 2-3. 프런트 표기 확인

### 📋 실행 단계

### 1. 거래내역 테이블에 '내역' 컬럼 추가 확인

**확인 항목:**
- [ ] 거래내역 테이블에 '내역' 컬럼 추가
- [ ] 라벨 규칙 (한글):
  - [ ] RESERVE → 예약 {units}건
  - [ ] CAPTURE → 사용 {units}건
  - [ ] RELEASE → 해제 {units}건
- [ ] 금액은 기존처럼 원화 포맷 (1,234원)

**확인 방법:**
1. 테이블 확인:
   - [ ] 거래내역 테이블에 '내역' 컬럼 추가 확인
2. 라벨 확인:
   - [ ] RESERVE → "예약 {units}건" 표시 확인
   - [ ] CAPTURE → "사용 {units}건" 표시 확인
   - [ ] RELEASE → "해제 {units}건" 표시 확인
3. 금액 포맷 확인:
   - [ ] 금액은 기존처럼 원화 포맷 (1,234원) 확인

**확인 체크리스트:**
- [ ] 거래내역 테이블에 '내역' 컬럼 추가
- [ ] 라벨 규칙 (한글): RESERVE → 예약 {units}건, CAPTURE → 사용 {units}건, RELEASE → 해제 {units}건
- [ ] 금액은 기존처럼 원화 포맷 (1,234원)

---

## 3. 연도-월-일 클릭 시 날짜 캘린더 표시

### 3-1. 프론트 날짜 캘린더 확인

### 📋 실행 단계

### 1. 날짜 캘린더 라이브러리 확인

**확인 항목:**
- [ ] 라이브러리: react-day-picker 또는 @headlessui/react+커스텀 팝오버 (현재 UI 톤에 맞춤)
- [ ] 필드: 시작일 / 종료일 2개 인풋 (placeholder: 연도-월-일)
- [ ] 클릭 시 달력 팝오버 노출 → 선택 후 즉시 쿼리 반영
- [ ] 포맷: YYYY-MM-DD (Asia/Seoul 기준)
- [ ] 적용 버튼 없이 선택 즉시 from=YYYY-MM-DD&to=YYYY-MM-DD로 재조회

**확인 방법:**
1. 라이브러리 확인:
   - [ ] react-day-picker 또는 @headlessui/react+커스텀 팝오버 설치 확인
   - [ ] 현재 UI 톤에 맞춤 확인
2. 필드 확인:
   - [ ] 시작일 인풋 확인 (placeholder: 연도-월-일)
   - [ ] 종료일 인풋 확인 (placeholder: 연도-월-일)
3. 동작 확인:
   - [ ] 클릭 시 달력 팝오버 노출 확인
   - [ ] 선택 후 즉시 쿼리 반영 확인
   - [ ] 포맷: YYYY-MM-DD (Asia/Seoul 기준) 확인
   - [ ] 적용 버튼 없이 선택 즉시 from=YYYY-MM-DD&to=YYYY-MM-DD로 재조회 확인

**확인 체크리스트:**
- [ ] 라이브러리: react-day-picker 또는 @headlessui/react+커스텀 팝오버 (현재 UI 톤에 맞춤)
- [ ] 필드: 시작일 / 종료일 2개 인풋 (placeholder: 연도-월-일)
- [ ] 클릭 시 달력 팝오버 노출 → 선택 후 즉시 쿼리 반영
- [ ] 포맷: YYYY-MM-DD (Asia/Seoul 기준)
- [ ] 적용 버튼 없이 선택 즉시 from=YYYY-MM-DD&to=YYYY-MM-DD로 재조회

---

### 3-2. 서버 타임존 처리 확인

### 📋 실행 단계

### 1. 서버 타임존 처리 확인

**확인 항목:**
- [ ] 서버: from은 00:00:00 KST, to는 23:59:59 KST까지 포함해 조회
- [ ] 타임존: Asia/Seoul로 고정 계산 (UTC 저장 시 변환 주의)

**확인 방법:**
1. 서버 처리 확인:
   - [ ] from은 00:00:00 KST로 변환 확인
   - [ ] to는 23:59:59 KST로 변환 확인
   - [ ] 타임존: Asia/Seoul로 고정 계산 확인
   - [ ] UTC 저장 시 변환 주의 확인

**확인 체크리스트:**
- [ ] 서버: from은 00:00:00 KST, to는 23:59:59 KST까지 포함해 조회
- [ ] 타임존: Asia/Seoul로 고정 계산 (UTC 저장 시 변환 주의)

---

## 4. 키워드 필터 제거

### 4-1. 프런트 키워드 필터 제거 확인

### 📋 실행 단계

### 1. 프런트 거래내역 상단에서 키워드 입력란 제거 확인

**확인 항목:**
- [ ] 프런트 거래내역 상단에서 키워드 입력란 제거

**확인 방법:**
1. UI 확인:
   - [ ] 거래내역 상단에서 키워드 입력란 제거 확인
   - [ ] "유형/기간/금액" 필터만 유지 확인

**확인 체크리스트:**
- [ ] 프런트 거래내역 상단에서 키워드 입력란 제거

---

### 4-2. 서버 키워드 필터 처리 삭제 확인

### 📋 실행 단계

### 1. 서버 listTransactions()에서 q 파라미터 처리 삭제 확인

**확인 항목:**
- [ ] 서버 listTransactions()에서 q 파라미터 처리 삭제 또는 무시

**확인 방법:**
1. 서버 코드 확인:
   - [ ] listTransactions()에서 q 파라미터 처리 삭제 확인
   - [ ] 또는 q 파라미터 무시 확인

**확인 체크리스트:**
- [ ] 서버 listTransactions()에서 q 파라미터 처리 삭제 또는 무시

---

## 📊 종합 검증 체크리스트

### ✅ 1. 엑셀(XLSX) 내보내기로 교체
1. [ ] API 엔드포인트 신설: GET /agency/transactions/export.xlsx
2. [ ] 라이브러리: exceljs (서버)
3. [ ] 헤더: Content-Type, Content-Disposition
4. [ ] 시트/컬럼 (한글 라벨, 폭/서식 포함): 일시, 유형, 내역, 금액, 메모·참조, 상태, 거래ID
5. [ ] 첫 행 고정, 자동 줄바꿈 (메모), 통화열 우측 정렬
6. [ ] 필터/정렬/기간 조건은 프런트와 동일 파라미터 그대로 적용
7. [ ] "CSV 내보내기" → "엑셀로 받기(XLSX)" 버튼으로 교체
8. [ ] 한글/원화 포맷을 정확히 유지

### ✅ 2. 거래내역 '내역(수량)' 컬럼 추가
1. [ ] DB/도메인: billing_transactions에 units (INT, DEFAULT 0) 컬럼 추가
2. [ ] RESERVE: 주문의 submitCount 저장 (예: 5)
3. [ ] CAPTURE (사용): 주문의 submitCount 저장 (예: 10)
4. [ ] RELEASE (해제): 주문의 submitCount 저장 (예: 5)
5. [ ] 부호는 항상 양수로 저장하고, UI에서 유형별로 문구 처리
6. [ ] 서비스 훅 보강: reserve()/capture()/release() 호출부에서 units도 같이 기록
7. [ ] 엑셀/리스트 응답에 units 포함
8. [ ] 거래내역 테이블에 '내역' 컬럼 추가
9. [ ] 라벨 규칙 (한글): RESERVE → 예약 {units}건, CAPTURE → 사용 {units}건, RELEASE → 해제 {units}건
10. [ ] 금액은 기존처럼 원화 포맷 (1,234원)

### ✅ 3. 연도-월-일 클릭 시 날짜 캘린더 표시
1. [ ] 라이브러리: react-day-picker 또는 @headlessui/react+커스텀 팝오버 (현재 UI 톤에 맞춤)
2. [ ] 필드: 시작일 / 종료일 2개 인풋 (placeholder: 연도-월-일)
3. [ ] 클릭 시 달력 팝오버 노출 → 선택 후 즉시 쿼리 반영
4. [ ] 포맷: YYYY-MM-DD (Asia/Seoul 기준)
5. [ ] 적용 버튼 없이 선택 즉시 from=YYYY-MM-DD&to=YYYY-MM-DD로 재조회
6. [ ] 서버: from은 00:00:00 KST, to는 23:59:59 KST까지 포함해 조회
7. [ ] 타임존: Asia/Seoul로 고정 계산 (UTC 저장 시 변환 주의)

### ✅ 4. 키워드 필터 제거
1. [ ] 프런트 거래내역 상단에서 키워드 입력란 제거
2. [ ] 서버 listTransactions()에서 q 파라미터 처리 삭제 또는 무시

---

## 🔧 트리아지 리포트 템플릿

### 대행사 충전 관리 v3.4 실패 리포트 작성 시:

```
## 대행사 충전 관리 v3.4 실패 리포트

### 1. 엑셀(XLSX) 내보내기로 교체
- API 엔드포인트: [ ] GET /agency/transactions/export.xlsx [ ] 오류
- 라이브러리: [ ] exceljs (서버) [ ] 오류
- 헤더: [ ] Content-Type, Content-Disposition [ ] 오류
- 시트/컬럼: [ ] 한글 라벨, 폭/서식 포함 [ ] 오류
- 필터/정렬/기간 조건: [ ] 프런트와 동일 파라미터 그대로 적용 [ ] 오류
- 버튼 교체: [ ] "CSV 내보내기" → "엑셀로 받기(XLSX)" [ ] 오류
- 한글/원화 포맷: [ ] 정확히 유지 [ ] 오류

### 2. 거래내역 '내역(수량)' 컬럼 추가
- DB/도메인: [ ] billing_transactions에 units 컬럼 추가 [ ] 오류
- 데이터 저장: [ ] RESERVE/CAPTURE/RELEASE 시 submitCount 저장 [ ] 오류
- 서비스 훅: [ ] reserve()/capture()/release() 호출부에서 units 기록 [ ] 오류
- 응답: [ ] 엑셀/리스트 응답에 units 포함 [ ] 오류
- 프런트 표기: [ ] 거래내역 테이블에 '내역' 컬럼 추가 [ ] 오류
- 라벨 규칙: [ ] RESERVE → 예약 {units}건, CAPTURE → 사용 {units}건, RELEASE → 해제 {units}건 [ ] 오류

### 3. 연도-월-일 클릭 시 날짜 캘린더 표시
- 라이브러리: [ ] react-day-picker 또는 @headlessui/react+커스텀 팝오버 [ ] 오류
- 필드: [ ] 시작일 / 종료일 2개 인풋 [ ] 오류
- 동작: [ ] 클릭 시 달력 팝오버 노출 → 선택 후 즉시 쿼리 반영 [ ] 오류
- 포맷: [ ] YYYY-MM-DD (Asia/Seoul 기준) [ ] 오류
- 서버 타임존: [ ] from은 00:00:00 KST, to는 23:59:59 KST까지 포함해 조회 [ ] 오류

### 4. 키워드 필터 제거
- 프런트: [ ] 거래내역 상단에서 키워드 입력란 제거 [ ] 오류
- 서버: [ ] listTransactions()에서 q 파라미터 처리 삭제 또는 무시 [ ] 오류

### 5. 원인 추정
1순위: [ ] 엑셀(XLSX) 내보내기 오류
2순위: [ ] 거래내역 '내역(수량)' 컬럼 추가 오류
3순위: [ ] 날짜 캘린더 표시 오류

### 6. 조치
- [ ] 엑셀(XLSX) 내보내기 확인/수정
- [ ] 거래내역 '내역(수량)' 컬럼 추가 확인/수정
- [ ] 날짜 캘린더 표시 확인/수정
- [ ] 키워드 필터 제거 확인/수정
```





