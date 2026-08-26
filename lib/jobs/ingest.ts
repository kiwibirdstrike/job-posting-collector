import { normalizeJobCandidate } from "./normalize";
import { evaluateJobEligibility } from "./eligibility";
import type {
  ExistingPostingSnapshot,
  IngestionPlan,
  IngestionSummary,
  JobCandidate,
  NormalizedJobPosting
} from "./types";

type IngestionOptions = {
  now?: Date;
};

type SourceLink = {
  source: string;
  sourcePostingId: string | null;
  url: string | null;
};

function sourceKey(posting: Pick<NormalizedJobPosting, "source" | "sourcePostingId">) {
  if (!posting.sourcePostingId) {
    return null;
  }

  return `${posting.source}:${posting.sourcePostingId}`;
}

function urlKey(posting: Pick<NormalizedJobPosting, "url">) {
  return posting.url ? posting.url : null;
}

function normalizedComparableText(value: string | null | undefined): string | null {
  const normalized = value
    ?.toLowerCase()
    .replace(/\(주\)|주식회사|\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
  return normalized ? normalized : null;
}

function dateKey(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function semanticKey(posting: {
  company: string | null | undefined;
  title: string | null | undefined;
  deadline: Date | string | null | undefined;
}) {
  const company = normalizedComparableText(posting.company);
  const title = normalizedComparableText(posting.title);
  const deadline = dateKey(posting.deadline);
  return company && title && deadline ? `${company}:${title}:${deadline}` : null;
}

function rawPayloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function sourceLink(posting: Pick<NormalizedJobPosting, "source" | "sourcePostingId" | "url">): SourceLink {
  return {
    source: posting.source,
    sourcePostingId: posting.sourcePostingId,
    url: posting.url
  };
}

function uniqueSourceLinks(links: SourceLink[]): SourceLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = [link.source, link.sourcePostingId, link.url].filter(Boolean).join(":");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mergedRawPayload(primary: NormalizedJobPosting, duplicate?: NormalizedJobPosting): unknown {
  const primaryPayload = rawPayloadRecord(primary.rawPayload);
  const duplicatePayload = duplicate ? rawPayloadRecord(duplicate.rawPayload) : {};
  const currentLinks = Array.isArray(primaryPayload.sourceLinks)
    ? (primaryPayload.sourceLinks.filter(
        (item): item is SourceLink => item && typeof item === "object"
      ) as SourceLink[])
    : [];
  const links = duplicate
    ? uniqueSourceLinks([...currentLinks, sourceLink(primary), sourceLink(duplicate)])
    : uniqueSourceLinks([...currentLinks, sourceLink(primary)]);
  const companyCareerUrl = primaryPayload.companyCareerUrl ?? duplicatePayload.companyCareerUrl;

  return {
    ...duplicatePayload,
    ...primaryPayload,
    ...(companyCareerUrl ? { companyCareerUrl } : {}),
    sourceLinks: links
  };
}

function mergePosting(primary: NormalizedJobPosting, duplicate: NormalizedJobPosting): NormalizedJobPosting {
  return {
    ...primary,
    location: primary.location ?? duplicate.location,
    employmentType: primary.employmentType ?? duplicate.employmentType,
    experienceLevel: primary.experienceLevel ?? duplicate.experienceLevel,
    postedAt: primary.postedAt ?? duplicate.postedAt,
    description: primary.description ?? duplicate.description,
    tags: Array.from(new Set([...primary.tags, ...duplicate.tags])),
    rawPayload: mergedRawPayload(primary, duplicate)
  };
}

export function planIngestion(
  candidates: JobCandidate[],
  existing: ExistingPostingSnapshot[],
  options: IngestionOptions = {}
): IngestionPlan {
  const existingBySource = new Map<string, ExistingPostingSnapshot>();
  const existingByUrl = new Map<string, ExistingPostingSnapshot>();
  const existingBySemantic = new Map<string, ExistingPostingSnapshot>();
  const seenCreateSources = new Set<string>();
  const seenCreateUrls = new Set<string>();
  const createBySemantic = new Map<string, number>();
  const updateById = new Map<string, number>();
  const creates: IngestionPlan["creates"] = [];
  const updates: IngestionPlan["updates"] = [];
  const skips: IngestionPlan["skips"] = [];
  const failures: IngestionPlan["failures"] = [];

  for (const posting of existing) {
    const bySource = sourceKey(posting);
    const byUrl = urlKey(posting);
    if (bySource) {
      existingBySource.set(bySource, posting);
    }
    if (byUrl) {
      existingByUrl.set(byUrl, posting);
    }
    const bySemantic = semanticKey({
      company: posting.company ?? null,
      title: posting.title ?? null,
      deadline: posting.deadline ?? null
    });
    if (bySemantic) {
      existingBySemantic.set(bySemantic, posting);
    }
  }

  for (const candidate of candidates) {
    try {
      const posting = normalizeJobCandidate(candidate, options);
      const eligibility = evaluateJobEligibility(posting);
      if (!eligibility.eligible) {
        skips.push({
          candidate,
          reason: `${eligibility.reason}${eligibility.evidence ? ` (${eligibility.evidence})` : ""}`
        });
        continue;
      }
      const bySource = sourceKey(posting);
      const byUrl = urlKey(posting);
      const bySemantic = semanticKey(posting);
      const match =
        (bySource ? existingBySource.get(bySource) : undefined) ??
        (byUrl ? existingByUrl.get(byUrl) : undefined) ??
        (bySemantic ? existingBySemantic.get(bySemantic) : undefined);

      if (match) {
        const updateIndex = updateById.get(match.id);
        const nextPosting = {
          ...posting,
          rawPayload: mergedRawPayload(posting)
        };
        if (updateIndex === undefined) {
          updateById.set(match.id, updates.length);
          updates.push({ id: match.id, posting: nextPosting });
        } else {
          updates[updateIndex] = {
            id: match.id,
            posting: mergePosting(updates[updateIndex].posting, nextPosting)
          };
          skips.push({ candidate, reason: "Duplicate candidate merged into existing posting update" });
        }
        continue;
      }

      if ((bySource && seenCreateSources.has(bySource)) || (byUrl && seenCreateUrls.has(byUrl))) {
        skips.push({ candidate, reason: "Duplicate candidate in import batch" });
        continue;
      }

      if (bySemantic !== null && createBySemantic.has(bySemantic)) {
        const createIndex = createBySemantic.get(bySemantic)!;
        creates[createIndex] = {
          posting: mergePosting(creates[createIndex].posting, posting)
        };
        skips.push({ candidate, reason: "Duplicate candidate merged by company, title, and deadline" });
        continue;
      }

      if (bySource) seenCreateSources.add(bySource);
      if (byUrl) seenCreateUrls.add(byUrl);
      if (bySemantic !== null) {
        createBySemantic.set(bySemantic, creates.length);
      }
      creates.push({
        posting: {
          ...posting,
          rawPayload: mergedRawPayload(posting)
        }
      });
    } catch (error) {
      failures.push({
        candidate,
        reason: error instanceof Error ? error.message : "Unknown ingestion error"
      });
    }
  }

  return {
    creates,
    updates,
    skips,
    failures,
    summary: {
      created: creates.length,
      updated: updates.length,
      skipped: skips.length,
      failed: failures.length
    }
  };
}

export function formatIngestionSummary(summary: IngestionSummary): string {
  return `Created ${summary.created}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}.`;
}
