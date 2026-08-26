import { isExplicitSeniorOnly } from "./eligibility";

export type JobExperienceFilter = "all" | "entry" | "career" | "unknown";

export function inferExperienceLevel(title: string | null | undefined, description: string | null | undefined): string | null {
  const text = `${title ?? ""} ${description ?? ""}`.replace(/\s+/g, " ");
  if (/경력\s*무관|경력\s*제한\s*없|경력과?\s*무관/i.test(text)) return "경력무관";
  if (/신입\s*[+/·,및또는]\s*경력|신입\s*(?:및|또는)\s*경력|경력\s*[+/·,및또는]\s*신입/i.test(text)) return "신입/경력";
  if (/신입|entry[ -]?level|new graduate|신입\s*(?:지원\s*)?가능/i.test(text)) return "신입";
  if (/\b(?:sr\.?|senior|staff|principal|director|head|team\s*lead(?:er)?)\b|시니어|팀장급/i.test(title ?? "")) return "경력";
  if (isExplicitSeniorOnly(text)) return "경력";
  return null;
}

function isEntryCompatible(value: string | null | undefined): boolean {
  return Boolean(value && /신입|경력\s*무관|\bentry\b|new graduate/i.test(value));
}

function isCareerOnly(value: string | null | undefined): boolean {
  return Boolean(value && /경력|experienced|\bmid\b|senior/i.test(value) && !isEntryCompatible(value));
}

export function filterJobsByExperience<T extends { experienceLevel: string | null }>(
  jobs: T[],
  filter: JobExperienceFilter
): T[] {
  if (filter === "all") return jobs;
  return jobs.filter((job) => {
    if (filter === "entry") return !isCareerOnly(job.experienceLevel);
    if (filter === "career") return isCareerOnly(job.experienceLevel);
    return !isEntryCompatible(job.experienceLevel) && !isCareerOnly(job.experienceLevel);
  });
}
