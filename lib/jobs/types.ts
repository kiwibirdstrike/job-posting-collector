export const JOB_STATUSES = [
  "new",
  "interested",
  "applying",
  "applied",
  "interview",
  "offer",
  "rejected",
  "archived",
  "ignored"
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobCandidate = {
  source?: string;
  sourcePostingId?: string | null;
  url?: string | null;
  title: string;
  company: string;
  location?: string | null;
  employmentType?: string | null;
  experienceLevel?: string | null;
  deadline?: Date | string | null;
  postedAt?: Date | string | null;
  description?: string | null;
  tags?: string[];
  rawPayload?: unknown;
};

export type NormalizedJobPosting = {
  source: string;
  sourcePostingId: string | null;
  url: string | null;
  title: string;
  company: string;
  location: string | null;
  employmentType: string | null;
  experienceLevel: string | null;
  deadline: string | null;
  postedAt: string | null;
  collectedAt: string;
  description: string | null;
  tags: string[];
  status: JobStatus;
  checked: boolean;
  notes: string | null;
  rawPayload: unknown;
};

export type ExistingPostingSnapshot = {
  id: string;
  source: string;
  sourcePostingId: string | null;
  url: string | null;
  title?: string | null;
  company?: string | null;
  deadline?: Date | string | null;
};

export type IngestionSummary = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

export type PlannedJobCreate = {
  posting: NormalizedJobPosting;
};

export type PlannedJobUpdate = {
  id: string;
  posting: NormalizedJobPosting;
};

export type PlannedJobSkip = {
  candidate: JobCandidate;
  reason: string;
};

export type PlannedJobFailure = {
  candidate: JobCandidate;
  reason: string;
};

export type IngestionPlan = {
  creates: PlannedJobCreate[];
  updates: PlannedJobUpdate[];
  skips: PlannedJobSkip[];
  failures: PlannedJobFailure[];
  summary: IngestionSummary;
};
