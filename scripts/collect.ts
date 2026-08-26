import { writeFile } from "node:fs/promises";
import {
  collectJobsFromSearchSources,
  DEFAULT_JOB_SEARCH_SOURCES,
  sourcesFromEnv
} from "@/lib/jobs/collectors/feed";

const outputPath = process.env.OUTPUT ?? "jobs.json";
const sources = sourcesFromEnv(process.env.JOB_SOURCES) ?? DEFAULT_JOB_SEARCH_SOURCES;

const jobs = await collectJobsFromSearchSources({
  sources,
  concurrency: Number(process.env.DETAIL_CONCURRENCY ?? 8),
  sourceConcurrency: Number(process.env.SOURCE_CONCURRENCY ?? 4),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 12000),
  onProgress: ({ message }) => console.error(`[collector] ${message}`)
});

await writeFile(outputPath, `${JSON.stringify(jobs, null, 2)}\n`, "utf8");
console.log(`수집 완료: ${jobs.length}개 공고 -> ${outputPath}`);
