# 원고 UI - 원고 생성 및 관리 시스템

## 개요

대행사가 주문을 생성하고, 어드민이 페르소나를 배정하여 원고를 생성하는 시스템입니다.

## 기술 스택

- **Monorepo**: Turborepo
- **Backend**: NestJS, TypeORM, SQLite, BullMQ (Redis)
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Package Manager**: pnpm

## 프로젝트 구조

```
.
├── apps/
│   ├── api/          # NestJS 백엔드
│   └── web/          # Next.js 프런트엔드
├── packages/         # 공유 패키지 (필요시)
└── package.json      # 루트 패키지 설정
```

## 설치 및 실행

### 필수 요구사항

- Node.js 18+
- pnpm 8+
- Redis (BullMQ용)

### 설치

```bash
pnpm install
```

### 환경 변수

`.env` 파일 생성 (각 앱별로 필요시):

```env
# API
JWT_SECRET=your-secret-key
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3001

# Web
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 실행

**개발 모드 (모든 앱 병렬 실행):**
```bash
pnpm dev
```

**개별 실행:**

```bash
# API만
cd apps/api
pnpm dev

# Web만
cd apps/web
pnpm dev
```

### 빌드

```bash
pnpm build
```

## 기능

### 대행사

1. **주문 생성** (`/agency/orders/new`)
   - 플레이스 정보 입력
   - 가이드 체크리스트 (키워드, 필수/강조, 링크/지도, 해시태그)
   - 임시 저장 (DRAFT) 또는 원고 접수 (SUBMITTED)
   - **페르소나/AI 관련 요소 노출 금지**

2. **주문 조회** (`/agency/orders`)
   - 주문 목록 및 필터 (주문완료 포함)
   - 상태별 필터링

3. **주문 상세** (`/agency/orders/[id]`)
   - **원고 본문은 AGENCY_REVIEW 또는 COMPLETE 상태에서만 노출**
   - 통과/반려 기능
   - 반려 시 자동 재생성 (대행사 비공개 유지)

### 어드민

1. **접수함** (`/admin/intake`)
   - SUBMITTED 상태 주문 목록
   - 페르소나 배정
   - 원고 산출 버튼 (reserve → GENERATING)

2. **주문 상세** (`/admin/orders/[id]`)
   - 원고 미리보기
   - 자동 검수 리포트 (ValidationReport)
   - 검수 시작 (GENERATED → ADMIN_REVIEW)
   - 통과/반려/수정요청 (재생성 트리거)

## 상태 기계

```
DRAFT → SUBMITTED → ADMIN_INTAKE → GENERATING → GENERATED → ADMIN_REVIEW → AGENCY_REVIEW → COMPLETE
                                                                    ↓
                                                            AGENCY_REJECTED → REGEN_QUEUED → (루프)
```

- **대행사 반려**: AGENCY_REJECTED → REGEN_QUEUED → GENERATING → GENERATED → ADMIN_REVIEW (자동 루프)
- **어드민 반려/수정요청**: ADMIN_REJECTED/REVISION_REQUESTED → REGEN_QUEUED → GENERATING → ...

## 검수 규칙

- 글자수: 1,500~2,000자
- 해시태그: 최대 5개
- 필수 키워드: 모두 포함
- 강조 키워드: 모두 포함
- 링크/지도: 플래그와 일치 여부

## 빌링 시스템

- **Reserve**: 원고 산출 시 1크레딧 예약
- **Capture**: 대행사 APPROVE → COMPLETE 시 확정
- **Release**: 취소/종료 시 해제
- **자동 재생성**: 추가 과금 없음 (기존 예약 유지)

## VS Code 디버깅

`.vscode/launch.json` 파일이 포함되어 있습니다:

- **API (WATCH)**: 포트 9229로 Node attach
- **WEB (NEXT)**: pnpm으로 Next.js 실행

## API 엔드포인트

### 대행사
- `POST /agency/orders` - 주문 생성
- `GET /agency/orders` - 주문 목록
- `GET /agency/orders/:id` - 주문 조회
- `POST /agency/orders/:id/submit` - 제출
- `POST /agency/orders/:id/review` - 리뷰 (APPROVE/REJECT)

### 어드민
- `GET /admin/orders` - 주문 목록
- `GET /admin/orders/:id` - 주문 상세 + validationReport
- `POST /admin/orders/:id/assign-persona` - 페르소나 배정
- `POST /admin/orders/:id/generate` - 원고 산출
- `POST /admin/orders/:id/start-review` - 검수 시작
- `POST /admin/orders/:id/review` - 리뷰 (PASS/FAIL/REVISION)

### 빌링
- `GET /billing/wallet` - 지갑 조회
- `POST /billing/topups` - 충전
- `POST /billing/reserve` - 예약 (어드민 전용)
- `POST /billing/capture` - 확정
- `POST /billing/release` - 해제

## 주의사항

1. **페르소나 비노출**: 대행사 화면에서는 페르소나/AI 관련 정보가 절대 노출되지 않습니다.
2. **원고 비공개**: 대행사는 AGENCY_REVIEW 또는 COMPLETE 상태에서만 원고를 볼 수 있습니다.
3. **자동 재생성**: 대행사 반려 시 서버가 자동으로 재생성 루프를 진행합니다.
4. **상태 표시**: COMPLETE 상태는 UI에서 **"주문완료"**로 표시됩니다.

## 개발 가이드

### ESLint
```bash
pnpm lint
```

### 포맷팅
```bash
pnpm format
```

## 라이선스

MIT





