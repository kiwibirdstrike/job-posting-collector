export type CompanyScaleFilter = "all" | "large-mid" | "public" | "other";

export const COMPANY_SCALE_TAGS = ["대기업", "중견기업", "중소기업", "스타트업"] as const;
export const PUBLIC_ORGANIZATION_TAGS = ["공공기관", "공기업", "공공재단"] as const;

const largeMidScaleTags = new Set(["대기업", "중견기업"]);
const publicOrganizationTags = new Set<string>(PUBLIC_ORGANIZATION_TAGS);

const largeCompanySources = new Set([
  "samsung-careers", "lg-careers", "kb-careers", "posco-careers", "hanwha-careers", "hd-careers",
  "naver-careers", "naver-cloud-careers", "line-careers", "kakao-careers", "kakao-bank-careers",
  "coupang-careers", "kt-careers", "hyundai-motor-careers", "kia-careers"
]);
const midCompanySources = new Set(["toss-careers", "woowa-careers"]);
const largeCompanyDomains = new Set([
  "samsungcareers.com", "skcareers.com", "careers.lg.com", "careers.kbfg.com", "recruit.cj.net",
  "recruit.posco.com", "hanwhain.com", "recruit.hd.com", "recruit.lotte.co.kr", "job.shinsegae.com",
  "recruit.navercorp.com", "recruit.navercloudcorp.com", "careers.linecorp.com", "careers.kakao.com",
  "recruit.kakaobank.com", "coupang.jobs", "recruit.kt.com", "talent.hyundai.com", "career.kia.com"
]);
const midCompanyDomains = new Set(["toss.im", "career.woowahan.com"]);

function matchingDomain(url: string | null | undefined, domains: Set<string>): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return Array.from(domains).some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function companyScaleTagsForCandidate(candidate: { source?: string | null; url?: string | null }): string[] {
  const source = candidate.source?.trim() ?? "";
  if (largeCompanySources.has(source) || matchingDomain(candidate.url, largeCompanyDomains)) return ["대기업"];
  if (midCompanySources.has(source) || matchingDomain(candidate.url, midCompanyDomains)) return ["중견기업"];
  return [];
}

export function isLargeMidCompanyByTags(tags: string[]): boolean {
  return tags.some((tag) => largeMidScaleTags.has(tag));
}

export function isPublicOrganizationByTags(tags: string[]): boolean {
  return tags.some((tag) => publicOrganizationTags.has(tag));
}

export function filterJobsByCompanyScale<T extends { tags: string[] }>(
  jobs: T[],
  filter: CompanyScaleFilter
): T[] {
  if (filter === "all") {
    return jobs;
  }

  return jobs.filter((job) => {
    const isLargeMid = isLargeMidCompanyByTags(job.tags);
    const isPublic = isPublicOrganizationByTags(job.tags);
    if (filter === "large-mid") {
      return isLargeMid;
    }
    if (filter === "public") {
      return isPublic;
    }
    return !isLargeMid && !isPublic;
  });
}
