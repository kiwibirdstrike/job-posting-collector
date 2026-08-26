"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { collectJobsFromSearchSources, DEFAULT_JOB_SEARCH_SOURCES, sourcesFromEnv } from "@/lib/jobs/collectors/feed";
import { planIngestion } from "@/lib/jobs/ingest";
import { assertStatusTransition } from "@/lib/jobs/status";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/types";
import {
  appendJobCollectionRunLog,
  finishJobCollectionRun,
  findRecentJobCollectionRun,
  jobCollectionCooldownMs,
  startJobCollectionRun
} from "@/lib/jobs/collection-runs";

function asDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function collectJobsNow(onProgress?: (message: string) => void): Promise<string> {
  const configuredSources = sourcesFromEnv(process.env.JOB_SOURCE_URLS ?? process.env.JOB_SOURCES);
  const sources = configuredSources.length ? configuredSources : DEFAULT_JOB_SEARCH_SOURCES;
  const maxLinksPerSource = process.env.JOB_MAX_LINKS_PER_SOURCE
    ? Number(process.env.JOB_MAX_LINKS_PER_SOURCE)
    : undefined;
  onProgress?.(`검색 소스 ${sources.length}개 조회를 준비했습니다.`);
  const candidates = await collectJobsFromSearchSources({
    sources,
    ...(Number.isFinite(maxLinksPerSource) ? { maxLinksPerSource } : {}),
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 12000),
    sourceConcurrency: Number(process.env.SOURCE_CONCURRENCY ?? 4),
    onProgress: (event) => onProgress?.(event.message)
  });
  onProgress?.(`상세 파싱 후보 ${candidates.length}개를 확인했습니다.`);
  const existing = await prisma.jobPosting.findMany({
    select: { id: true, source: true, sourcePostingId: true, url: true, title: true, company: true, deadline: true }
  });
  const plan = planIngestion(candidates, existing);

  for (const item of plan.creates) {
    const p = item.posting;
    await prisma.jobPosting.create({
      data: {
        source: p.source, sourcePostingId: p.sourcePostingId, url: p.url, title: p.title, company: p.company,
        location: p.location, employmentType: p.employmentType, experienceLevel: p.experienceLevel,
        deadline: asDate(p.deadline), postedAt: asDate(p.postedAt), collectedAt: new Date(p.collectedAt),
        description: p.description, tags: JSON.stringify(p.tags), status: p.status, checked: p.checked,
        rawPayload: JSON.stringify(p.rawPayload)
      }
    });
  }

  for (const item of plan.updates) {
    const p = item.posting;
    await prisma.jobPosting.update({
      where: { id: item.id },
      data: {
        title: p.title, company: p.company, location: p.location, employmentType: p.employmentType,
        experienceLevel: p.experienceLevel, deadline: asDate(p.deadline), postedAt: asDate(p.postedAt),
        description: p.description, tags: JSON.stringify(p.tags), rawPayload: JSON.stringify(p.rawPayload)
      }
    });
  }

  revalidatePath("/");
  return `수집 완료: 신규 ${plan.creates.length}건, 갱신 ${plan.updates.length}건, 제외 ${plan.skips.length}건`;
}

async function runCollection(runId: string): Promise<void> {
  try {
    const summary = await collectJobsNow((message) => appendJobCollectionRunLog(runId, message));
    finishJobCollectionRun(runId, "completed", summary);
  } catch (error) {
    finishJobCollectionRun(runId, "failed", error instanceof Error ? error.message : "자동 수집에 실패했습니다.");
  }
}

export async function startCollection() {
  const recentRun = findRecentJobCollectionRun();
  if (recentRun) {
    const retryAt = new Date(Date.parse(recentRun.startedAt) + jobCollectionCooldownMs);
    return {
      runId: null,
      run: recentRun,
      message: `최근 12시간 안에 이미 실행했습니다. ${retryAt.toLocaleString("ko-KR")} 이후 다시 실행할 수 있습니다.`
    };
  }

  const run = startJobCollectionRun();
  void runCollection(run.id);
  return { runId: run.id, run, message: null };
}

export async function updateJobChecked(id: string, checked: boolean) {
  await prisma.jobPosting.update({ where: { id }, data: { checked, status: checked ? "interested" : "new" } });
  revalidatePath("/");
}

export async function updateJobStatus(id: string, nextStatus: JobStatus) {
  if (!JOB_STATUSES.includes(nextStatus)) throw new Error("Invalid job status");
  const posting = await prisma.jobPosting.findUniqueOrThrow({ where: { id }, select: { status: true } });
  const status = assertStatusTransition(posting.status as JobStatus, nextStatus);
  await prisma.jobPosting.update({ where: { id }, data: { status, checked: status !== "new" && status !== "ignored" } });
  revalidatePath("/");
}
