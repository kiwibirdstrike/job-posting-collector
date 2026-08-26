import type { JobCandidate, NormalizedJobPosting } from "./types";
import { companyScaleTagsForCandidate } from "./company-scale";
import { inferExperienceLevel } from "./experience-filter";
import { isEntryOpenRecruitment } from "./eligibility";

type NormalizeOptions = {
  now?: Date;
};

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function cleanJobDescription(
  value: string | null | undefined,
  maxLength?: number
): string | null {
  const text = (value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(?:p|div|li|ul|ol|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return null;
  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

function cleanDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function normalizeJobCandidate(
  candidate: JobCandidate,
  options: NormalizeOptions = {}
): NormalizedJobPosting {
  const title = cleanText(candidate.title);
  const company = cleanText(candidate.company);

  if (!title) {
    throw new Error("Job title is required");
  }

  if (!company) {
    throw new Error("Company is required");
  }

  const tags = Array.from(
    new Set(
      [
        ...(candidate.tags ?? []),
        ...companyScaleTagsForCandidate(candidate),
        ...(isEntryOpenRecruitment(title) ? ["공채"] : [])
      ]
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  );

  return {
    source: cleanText(candidate.source) ?? "mock",
    sourcePostingId: cleanText(candidate.sourcePostingId ?? null),
    url: cleanText(candidate.url ?? null),
    title,
    company,
    location: cleanText(candidate.location ?? null),
    employmentType: cleanText(candidate.employmentType ?? null),
    experienceLevel: cleanText(candidate.experienceLevel ?? null) ?? inferExperienceLevel(title, candidate.description),
    deadline: cleanDate(candidate.deadline),
    postedAt: cleanDate(candidate.postedAt),
    collectedAt: (options.now ?? new Date()).toISOString(),
    description: cleanJobDescription(candidate.description),
    tags,
    status: "new",
    checked: false,
    notes: null,
    rawPayload: candidate.rawPayload ?? candidate
  };
}
