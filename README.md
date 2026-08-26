# Job Posting Collector

채용 포털과 기업 공식 채용 페이지에서 공고를 수집해 SQLite DB에 저장하고,
브라우저 대시보드에서 확인하는 독립 수집기입니다. 개인 정보와 기존 DB 데이터는 포함하지 않습니다.

## 실행

```bash
npm install
npm run db:push
npm run dev
```

브라우저에서 `http://localhost:3000`을 열고 `공고 수집` 버튼을 누르면 됩니다.
수집 결과는 로컬 `dev.db`에 저장됩니다.

JSON 파일로만 저장하려면 다음 명령을 사용할 수 있습니다.

```bash
OUTPUT=latest.json npm run collect
```

특정 URL만 수집할 때는 `JOB_SOURCES`에 쉼표로 구분한 URL을 지정합니다.

```bash
JOB_SOURCES='https://careers.lg.com/apply,https://recruit.kt.com/careers' npm run collect
```

## 검증

```bash
npm run typecheck
npm test
```
