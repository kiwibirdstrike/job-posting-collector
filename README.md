# Job Posting Collector

채용 포털과 기업 공식 채용 페이지에서 공고를 수집해 JSON으로 저장하는 독립 수집기입니다.
데이터베이스, 개인 정보, 대시보드는 포함하지 않습니다.

## 실행

```bash
npm install
npm run collect
```

결과는 기본적으로 `jobs.json`에 저장됩니다. 수집 진행 로그는 터미널에 표시됩니다.

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
