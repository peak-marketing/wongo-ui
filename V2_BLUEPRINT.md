# V2 청사진 (사내망 전용)

## 전제(확정)
- 배포 형태: 인터넷 공개 없음, 사내 인원만 사내망에서 사용
- 과금: **최종 승인 시 Capture(차감 확정)**
- 동영상: 원고 내에 `동영상 1` 같은 **플레이스홀더 라인**만 있으면 충분

## 목표
- 영업자/대행사가 주문 접수 시점에 **페르소나를 직접 배정**
- 어드민은 **수량/상태/정산 모니터링 및 예외 처리** 위주(페르소나 배정 권한은 기본적으로 제거)
- 페르소나 시스템을 **OpenAPI + API Key** 기반으로 분리(키 발급/회전/로그)
- 원고 품질/운영 개선(1~6 요구사항)

## V2 권장 아키텍처
- Web: 기존 Next.js를 유지하되, `v2` 플로우(권한/화면 동작)를 분리
- API: 기존 NestJS에 `/v2/*`를 추가(기존 v1 엔드포인트/로직은 유지)
- Persona Service(사내): 별도 서비스(또는 모듈)로 분리
  - OpenAPI 제공
  - API Key 발급/회전/폐기
  - 요청 로그(누가/언제/어떤 persona를 발급/조회)

## 권한/역할(안)
- SALES/AGENCY
  - 주문 생성/접수
  - 페르소나 선택/확정
  - 생성 결과 미리보기 및 1차 수정요청(정책 범위 내)
- ADMIN
  - 수량 확인(대시보드)
  - 생성 큐/실패 건 재처리
  - 정산/리포트
  - (선택) 페르소나 수정 권한은 예외 플래그로만 허용

## 상태머신(안)
핵심은 **Capture 타이밍을 최종 승인으로 이동**하는 것.
- 접수: `SUBMITTED`(또는 `READY`) 상태에서 **Reserve(예약)**
- 생성: `GENERATING` → `GENERATED`
- 영업자 확인/수정요청: `SALES_REVIEW`(신설 가능)에서 수정요청은 정책 기반으로 무료/제한
- 최종 승인: `COMPLETE`에서 **Capture(차감 확정)**
- 취소/만료: Reserve 해제(Release)

## 페르소나 OpenAPI(초안)
- `POST /personas/issue`
  - 입력: ageRange, genderHint, personality, tone, optional constraints
  - 출력: personaId, personaSnapshot, styleGuide(Do/Don't), signaturePhrases(optional)
- `GET /personas/{personaId}`
- `POST /api-keys` / `DELETE /api-keys/{id}` / `POST /api-keys/{id}/rotate`

서버 측 통합 방식
- 주문에 `personaId/personaSnapshot/personaVersion/styleGuideHash`를 저장(스냅샷 고정)
- 생성 프롬프트에는 snapshot + styleGuide를 넣고, 결과 검증에서 persona 준수 여부를 확인

## 원고 개선 요구사항(1~6) 구현 포인트
1) 해시태그 기본값 자동채움 제거
- 사용자가 1~5개 입력하면 그대로 사용
- 0개일 때만 기본값 채움

2) 사진 순서 고정
- 업로드/선택 순서대로 `photoIndex`를 고정 저장
- 프롬프트/캡션/매칭은 항상 index 기준 정렬

3) 사진-원고 매칭 검증 + 수정 가능
- 생성 결과에 "사진 i" 블록별 tags 근거 표시(내부용)
- 영업자 확인 후 수정요청 가능(무료/횟수 제한)
- 최종 승인 전까지 Capture 금지(Reserve 유지)

4) 키워드 반복 최소 1회 → 정책화
- 강조 키워드: 최소 2~3회 등 정책 선택 가능
- 후처리 검증으로 부족 시 2차 보정(교정 프롬프트) 수행

5) 다운로드 파일명
- `대표키워드_업체명`으로 저장
- 윈도우 금지문자 제거 및 길이 제한

6) 동영상 1 플레이스홀더
- 주문 입력에 videoCount(또는 videoUrls) 추가
- 결과 조립 시 `동영상 1` 라인을 표준 포맷으로 append

## 단계별 작업 순서(MVP)
1) /v2 API 라우팅 + 권한(영업자 페르소나 배정 / 어드민 제한)
2) Capture 타이밍 변경(Complete 시 capture) + Reserve/Release 정합
3) 사진 순서 고정(index 계약) + 미리보기(내부용 최소)
4) 해시태그 자동채움 정책 변경
5) 키워드 반복 정책 및 검증/교정 2패스
6) 다운로드 파일명 변경
7) 동영상 플레이스홀더
8) Persona OpenAPI + API Key 관리 + v2 통합

---

원하는 경우, 위 청사진을 기반으로 `/v2`부터 실제 코드 작업을 시작할 수 있음.
