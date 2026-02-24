# 테스트 계정 생성 가이드

## 방법 1: API 서버가 실행 중일 때 (권장)

### HTTP 요청으로 생성

터미널에서 다음 명령어들을 실행하세요:

```bash
# 1. 어드민 계정 생성
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123","role":"ADMIN","name":"테스트 관리자"}'

# 2. 대행사 계정 1 생성
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"agency1@test.com","password":"agency123","role":"AGENCY","name":"테스트 대행사 1"}'

# 3. 대행사 계정 2 생성
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"agency2@test.com","password":"agency123","role":"AGENCY","name":"테스트 대행사 2"}'
```

또는 Node.js 스크립트 사용:

```bash
cd apps/api
node scripts/create-test-accounts-simple.js
```

## 방법 2: 데이터베이스 직접 생성 (API 서버 실행 불필요)

```bash
cd apps/api
pnpm create-test-accounts
```

또는

```bash
cd apps/api
npx ts-node -r tsconfig-paths/register scripts/create-test-accounts.ts
```

## 생성되는 테스트 계정

### 관리자 계정
- **이메일**: `admin@test.com`
- **비밀번호**: `admin123`
- **역할**: ADMIN

### 대행사 계정 1
- **이메일**: `agency1@test.com`
- **비밀번호**: `agency123`
- **역할**: AGENCY

### 대행사 계정 2
- **이메일**: `agency2@test.com`
- **비밀번호**: `agency123`
- **역할**: AGENCY

## 로그인 테스트

웹 애플리케이션 (`http://localhost:3000`)에서 위 계정들로 로그인하면:
- 어드민 계정: `/admin` 대시보드로 이동
- 대행사 계정: `/agency` 대시보드로 이동









