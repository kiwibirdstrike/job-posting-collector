"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { collectJobsFromSearchSources, DEFAULT_JOB_SEARCH_SOURCES, sourcesFromEnv } from "@/lib/jobs/collectors/feed";
import { planIngestion } from "@/lib/jobs/ingest";

function asDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function collectJobs(): Promise<string> {
  const candidates = await collectJobsFromSearchSources({
    sources: sourcesFromEnv(process.env.JOB_SOURCES).length ? sourcesFromEnv(process.env.JOB_SOURCES) : DEFAULT_JOB_SEARCH_SOURCES,
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 12000),
    sourceConcurrency: Number(process.env.SOURCE_CONCURRENCY ?? 4)
  });
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
