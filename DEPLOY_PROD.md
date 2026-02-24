# 운영 배포(카페24 Ubuntu 22.04 + Docker Compose + Caddy HTTPS)

## 0) 로컬에서 ZIP 만들기 (.env 제외)

권장: **git 기준으로 ZIP 생성** (추가 파일/비밀키 제외하기 쉬움)

```powershell
# 리포 루트에서
git archive -o deploy.zip HEAD
```

만약 git archive를 못 쓰면, `.env*` 파일을 ZIP에 넣지 않도록 주의하세요.

## 1) 업로드

```powershell
scp .\deploy.zip root@175.125.21.30:/opt/
ssh root@175.125.21.30
```

## 2) 서버 기본 세팅

```bash
apt update -y
apt install -y ca-certificates curl git ufw unzip
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable
ufw status

apt install -y docker.io docker-compose-plugin
systemctl enable --now docker

docker --version
docker compose version
```

## 3) ZIP 풀기

```bash
mkdir -p /opt/wongo-ui
unzip -o /opt/deploy.zip -d /opt/wongo-ui
cd /opt/wongo-ui
ls -la
```

## 4) 서버용 .env 작성 (중요: 키는 서버에서 직접 입력)

```bash
cd /opt/wongo-ui
cp apps/api/.env.example .env
nano .env
```

필수로 채울 값:

- `JWT_SECRET`: 충분히 긴 랜덤 문자열
- `OPENAI_API_KEY`: (절대 외부 공유 금지)
- `OPENAI_MODEL_BASE`, `OPENAI_MODEL_PRO`: 기본 모델 지정 (예: gpt-4o-mini / gpt-4o)
- `DB_*`: compose 내부 postgres 기준이면 아래처럼 권장
  - `DB_HOST=postgres`
  - `DB_PORT=5432`
  - `DB_USER=postgres`
  - `DB_PASS=강한비밀번호`
  - `DB_NAME=manuscript`
- `REDIS_URL=redis://redis:6379`
- `WEB_URL=https://help-peak-ai.com,https://www.help-peak-ai.com`

## 5) 컨테이너 실행

```bash
cd /opt/wongo-ui
# prod compose 사용
docker compose -f docker-compose.prod.yml up -d --build

docker compose -f docker-compose.prod.yml ps

docker compose -f docker-compose.prod.yml logs -f api
```

> API는 `migrationsRun: true`라서, DB가 준비되면 자동으로 마이그레이션을 실행합니다.

## 6) 검증

- https://help-peak-ai.com 접속
- https://help-peak-ai.com/api/health (또는 /api/health) 응답 확인
- `docker compose -f docker-compose.prod.yml ps`에서 모두 `running`

## 7) 트러블슈팅

- Caddy 인증서 실패: DNS A레코드가 서버 IP로 정확히 들어갔는지 확인
- 502/504: `docker compose ... logs web`, `logs api`로 원인 확인
- DB 접속 에러: `.env`의 `DB_HOST=postgres`, `DB_PASS` 일치 확인
