# 설정 가이드

## 초기 설정

### 1. 의존성 설치

```bash
pnpm install
```

### 2. Redis 설치 및 실행

BullMQ를 사용하므로 Redis가 필요합니다.

**Windows:**
- [Redis for Windows](https://github.com/microsoftarchive/redis/releases) 다운로드
- 또는 WSL2 사용

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

### 3. 환경 변수 설정

루트에 `.env` 파일 생성 (선택사항, 기본값 사용 가능):

```env
JWT_SECRET=your-secret-key
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# OpenAI (원고 생성/검수)
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL_BASE=gpt-4o-mini
OPENAI_MODEL_PRO=gpt-4o
```

#### OpenAI 키 정상 검증 (간단 호출)

키를 제대로 넣은 다음엔 API health를 확인하고, 주문 1건 생성/산출로 end-to-end를 보는 걸 권장합니다.

```bash
curl http://localhost:3001/health
```

### 4. 개발 서버 실행

```bash
pnpm dev
```

- API: http://localhost:3001
- Web: http://localhost:3002

## 초기 사용자 생성

시스템에 로그인하려면 먼저 사용자를 생성해야 합니다. API를 통해 직접 생성하거나, 데이터베이스를 수동으로 초기화할 수 있습니다.

### API를 통한 사용자 생성

```bash
# 대행사 사용자
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"agency@example.com","password":"password","role":"AGENCY","name":"대행사"}'

# 어드민 사용자
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password","role":"ADMIN","name":"어드민"}'
```

### 로그인

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agency@example.com","password":"password"}'
```

응답에서 `access_token`을 받아 프런트엔드에서 사용하세요.

## 프런트엔드에서 토큰 저장

현재 구현에서는 `localStorage`에 토큰을 저장합니다. 실제 프로덕션에서는 더 안전한 방법을 사용하세요.

브라우저 콘솔에서:
```javascript
localStorage.setItem('token', 'your-access-token-here');
```

## 테스트 시나리오

1. **대행사 주문 생성**
   - `/agency/orders/new` 접속
   - 주문 정보 입력 후 "원고 접수" 클릭

2. **어드민 배정 및 산출**
   - `/admin/intake` 접속
   - 주문에 페르소나 배정
   - "원고 산출" 클릭

3. **어드민 검수**
   - `/admin/orders/[id]` 접속
   - "검수 시작" 클릭
   - ValidationReport 확인 후 "통과" 또는 "반려" 클릭

4. **대행사 검수**
   - `/agency/orders/[id]` 접속
   - 원고 확인 후 "통과" 또는 "반려" 클릭
   - 반려 시 자동 재생성 시작

5. **빌링 테스트**
   - `/billing/wallet` 엔드포인트로 지갑 조회
   - 충전 후 주문 생성하여 reserve 확인

## 문제 해결

### Redis 연결 오류
- Redis가 실행 중인지 확인
- `REDIS_HOST`와 `REDIS_PORT` 환경 변수 확인

### 데이터베이스 오류
- `manuscript.db` 파일이 생성되는지 확인
- SQLite 파일 권한 확인

### 포트 충돌
- API 포트 변경: `.env`에서 `PORT=3001` 수정
- Web 포트 변경: `apps/web/package.json`의 `dev` 스크립트 수정

## 디버깅

VS Code에서 `.vscode/launch.json`을 사용하여 디버깅할 수 있습니다:

1. API 디버깅: "API (WATCH)" 실행
2. Web 디버깅: "WEB (NEXT)" 실행









