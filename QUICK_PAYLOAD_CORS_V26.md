# 페이로드 과대 + 프리플라이트 실패 보완 v2.6 - 빠른 참조

## 🚨 즉시 확인 (5분)

### 1. Network 확인
- [ ] OPTIONS /orders Status: `(failed) preflight` 또는 `200/204`
- [ ] POST /orders Status: `400/413/500`
- [ ] POST /orders Size: `[ ] KB`
- [ ] Request Payload 내 `base64`/`preview` 존재 여부

### 2. 페이로드 다이어트
- [ ] `photoMetas`에서 `base64`, `preview`, `thumbnail`, EXIF 제거
- [ ] 허용 키만: `url`, `width`, `height`, `sizeKb`
- [ ] 전체 페이로드 크기: ≤ 100KB

### 3. 서버 설정
- [ ] JSON body limit: 1-2MB 이상
- [ ] CORS 설정: `origin`, `methods`, `headers`, `credentials`
- [ ] 도메인 화이트리스트: 개발 도메인 포함

---

## ✅ 합격 기준

1. [ ] OPTIONS /orders: `200/204` 성공
2. [ ] POST /orders: `2xx` 성공
3. [ ] 페이로드: 메타만, 크기 ≤ 100KB
4. [ ] DB: `SUBMITTED` 생성
5. [ ] 큐: `waiting` → `active` 변동

---

## 🔧 조치 요약

### 프론트엔드
- `photoMetas`에서 `base64`/`preview` 제거
- 텍스트 필드 크기 제한 적용
- 페이로드 크기 ≤ 100KB 확인

### 서버
- JSON body limit: 1-2MB 상향
- CORS 설정 확정 (origin, methods, headers, credentials)
- 도메인 화이트리스트에 개발 도메인 추가






