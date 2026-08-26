import { prisma } from "@/lib/db/prisma";
import { JobDashboard, type JobView } from "@/components/job-dashboard";

export const dynamic = "force-dynamic";

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const jobs = await prisma.jobPosting.findMany({
    where: { status: { not: "ignored" } },
    orderBy: [{ collectedAt: "desc" }, { deadline: "asc" }]
  });
  const views: JobView[] = jobs.map((job) => ({
    id: job.id, title: job.title, company: job.company, source: job.source,
    sourcePostingId: job.sourcePostingId, url: job.url, location: job.location,
    experienceLevel: job.experienceLevel, employmentType: job.employmentType,
    deadline: job.deadline?.toISOString() ?? null, collectedAt: job.collectedAt.toISOString(),
    description: job.description, tags: parseList(job.tags)
  }));
  return <JobDashboard initialJobs={views} />;
}
