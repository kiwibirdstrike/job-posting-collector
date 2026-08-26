export type JobRegionFilter = "all" | string;

const regionPatterns: Array<[string, RegExp]> = [
  ["서울", /서울|seoul/i],
  ["경기", /경기|성남|분당|판교|pangyo/i],
  ["인천", /인천/i],
  ["부산", /부산/i],
  ["대구", /대구/i],
  ["대전", /대전/i],
  ["광주", /광주/i],
  ["울산", /울산/i],
  ["세종", /세종/i],
  ["강원", /강원/i],
  ["충북", /충북|청주/i],
  ["충남", /충남|천안|아산/i],
  ["전북", /전북|전주/i],
  ["전남", /전남/i],
  ["경북", /경북/i],
  ["경남", /경남/i],
  ["제주", /제주/i],
  ["원격", /remote|재택|원격/i]
];

export function normalizeJobRegion(location: string | null): string {
  if (!location?.trim()) {
    return "미확인";
  }

  const normalized = location.trim();
  return regionPatterns.find(([, pattern]) => pattern.test(normalized))?.[0] ?? normalized.split(/\s|,/)[0] ?? "미확인";
}

export function filterJobsByRegion<T extends { location: string | null }>(
  jobs: T[],
  filter: JobRegionFilter
): T[] {
  if (filter === "all") {
    return jobs;
  }

  return jobs.filter((job) => normalizeJobRegion(job.location) === filter);
}

export function jobRegionOptions<T extends { location: string | null }>(jobs: T[]): string[] {
  return Array.from(new Set(jobs.map((job) => normalizeJobRegion(job.location)))).sort((a, b) =>
    a === "미확인" ? 1 : b === "미확인" ? -1 : a.localeCompare(b, "ko-KR")
  );
}
