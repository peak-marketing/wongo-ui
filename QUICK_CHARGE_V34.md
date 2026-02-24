# 대행사 충전 관리 v3.4 - 빠른 참조

## 🚨 즉시 확인 (5분)

### 1. 엑셀(XLSX) 내보내기로 교체
1. [ ] API 엔드포인트 신설: GET /agency/transactions/export.xlsx?type=&from=&to=&min=&max=&page=&pageSize=
2. [ ] 라이브러리: exceljs (서버)
3. [ ] 헤더: Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, Content-Disposition: attachment; filename="거래내역_YYYYMMDD_HHmm.xlsx"
4. [ ] 시트/컬럼 (한글 라벨, 폭/서식 포함): 일시, 유형, 내역, 금액, 메모·참조, 상태, 거래ID
5. [ ] 첫 행 고정, 자동 줄바꿈 (메모), 통화열 우측 정렬
6. [ ] 필터/정렬/기간 조건은 프런트와 동일 파라미터 그대로 적용
7. [ ] "CSV 내보내기" → "엑셀로 받기(XLSX)" 버튼으로 교체
8. [ ] 한글/원화 포맷을 정확히 유지

### 2. 거래내역 '내역(수량)' 컬럼 추가
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

### 3. 연도-월-일 클릭 시 날짜 캘린더 표시
1. [ ] 라이브러리: react-day-picker 또는 @headlessui/react+커스텀 팝오버 (현재 UI 톤에 맞춤)
2. [ ] 필드: 시작일 / 종료일 2개 인풋 (placeholder: 연도-월-일)
3. [ ] 클릭 시 달력 팝오버 노출 → 선택 후 즉시 쿼리 반영
4. [ ] 포맷: YYYY-MM-DD (Asia/Seoul 기준)
5. [ ] 적용 버튼 없이 선택 즉시 from=YYYY-MM-DD&to=YYYY-MM-DD로 재조회
6. [ ] 서버: from은 00:00:00 KST, to는 23:59:59 KST까지 포함해 조회
7. [ ] 타임존: Asia/Seoul로 고정 계산 (UTC 저장 시 변환 주의)

### 4. 키워드 필터 제거
1. [ ] 프런트 거래내역 상단에서 키워드 입력란 제거
2. [ ] 서버 listTransactions()에서 q 파라미터 처리 삭제 또는 무시

---

## ✅ 합격 기준

### 1. 엑셀(XLSX) 내보내기로 교체
1. [ ] "엑셀로 받기(XLSX)" 버튼 클릭 시 엑셀 파일 다운로드
2. [ ] 한글/원화 포맷 정확히 유지
3. [ ] 필터/정렬/기간 조건이 프런트 리스트와 일치

### 2. 거래내역 '내역(수량)' 컬럼 추가
1. [ ] 거래내역 테이블에 '내역' 컬럼 표시
2. [ ] RESERVE → "예약 {units}건" 표시
3. [ ] CAPTURE → "사용 {units}건" 표시
4. [ ] RELEASE → "해제 {units}건" 표시

### 3. 연도-월-일 클릭 시 날짜 캘린더 표시
1. [ ] 시작일/종료일 인풋 클릭 시 달력 팝오버 노출
2. [ ] 선택 후 즉시 쿼리 반영
3. [ ] 서버에서 from은 00:00:00 KST, to는 23:59:59 KST까지 포함해 조회

### 4. 키워드 필터 제거
1. [ ] 거래내역 상단에서 키워드 입력란 제거
2. [ ] "유형/기간/금액" 필터만 유지

---

## 🔧 조치 요약

### 1. 엑셀(XLSX) 내보내기로 교체
- API 엔드포인트 신설: GET /agency/transactions/export.xlsx
- 라이브러리: exceljs (서버)
- 헤더: Content-Type, Content-Disposition
- 시트/컬럼 (한글 라벨, 폭/서식 포함)
- 필터/정렬/기간 조건은 프런트와 동일 파라미터 그대로 적용
- "CSV 내보내기" → "엑셀로 받기(XLSX)" 버튼으로 교체

### 2. 거래내역 '내역(수량)' 컬럼 추가
- DB/도메인: billing_transactions에 units (INT, DEFAULT 0) 컬럼 추가
- 서비스 훅 보강: reserve()/capture()/release() 호출부에서 units도 같이 기록
- 프런트 표기: 거래내역 테이블에 '내역' 컬럼 추가, 라벨 규칙 (한글)

### 3. 연도-월-일 클릭 시 날짜 캘린더 표시
- 라이브러리: react-day-picker 또는 @headlessui/react+커스텀 팝오버
- 필드: 시작일 / 종료일 2개 인풋
- 클릭 시 달력 팝오버 노출 → 선택 후 즉시 쿼리 반영
- 서버 타임존: Asia/Seoul로 고정 계산

### 4. 키워드 필터 제거
- 프런트 거래내역 상단에서 키워드 입력란 제거
- 서버 listTransactions()에서 q 파라미터 처리 삭제 또는 무시

---

## 🎯 주요 포인트

### 1. 엑셀(XLSX) 내보내기로 교체
- 목표: "CSV 내보내기" → "엑셀로 받기(XLSX)" 버튼으로 교체하고, 한글/원화 포맷을 정확히 유지
- API: GET /agency/transactions/export.xlsx
- 라이브러리: exceljs (서버)
- 시트/컬럼: 한글 라벨, 폭/서식 포함

### 2. 거래내역 '내역(수량)' 컬럼 추가
- 목표: 사용/예약/해제 시 몇 건이었는지 한눈에 보이도록
- DB: billing_transactions에 units (INT, DEFAULT 0) 컬럼 추가
- 라벨 규칙: RESERVE → 예약 {units}건, CAPTURE → 사용 {units}건, RELEASE → 해제 {units}건

### 3. 연도-월-일 클릭 시 날짜 캘린더 표시
- 목표: 기간 필터가 직관적으로 동작
- 라이브러리: react-day-picker 또는 @headlessui/react+커스텀 팝오버
- 적용 버튼 없이 선택 즉시 from=YYYY-MM-DD&to=YYYY-MM-DD로 재조회
- 서버: from은 00:00:00 KST, to는 23:59:59 KST까지 포함해 조회

### 4. 키워드 필터 제거
- 목표: 단순화 — "유형/기간/금액" + "엑셀 받기"만 유지
- 프런트 거래내역 상단에서 키워드 입력란 제거
- 서버 listTransactions()에서 q 파라미터 처리 삭제 또는 무시

---

## 📋 API 엔드포인트 요약

### 엑셀 내보내기
- `GET /agency/transactions/export.xlsx?type=&from=&to=&min=&max=&page=&pageSize=` → 엑셀 파일 다운로드

### 거래내역
- `GET /agency/transactions?type=&from=&to=&min=&max=&page=&pageSize=` → units 포함





