import { collectJobFromPageUrl } from "@/lib/jobs/collectors/page";
import {
  isClearlyUnrelatedRole,
  isExplicitSeniorOnly,
  shouldFetchJobListingLink
} from "@/lib/jobs/eligibility";
import type { JobCandidate } from "@/lib/jobs/types";

export type JobSearchSource = {
  name: string;
  url: string;
};

export type JobCollectionProgressEvent = {
  type: "source-started" | "source-completed" | "source-failed" | "detail-started" | "detail-completed" | "detail-failed";
  message: string;
};

export const JOB_SEARCH_KEYWORDS = [
  "통계",
  "통계 분석",
  "데이터 분석",
  "데이터 사이언스",
  "Data Scientist",
  "리서치",
  "시장조사",
  "AI",
  "ML",
  "머신러닝",
  "정량분석",
  "BI",
  "CRM 분석",
  "마케팅 분석",
  "마케팅 데이터",
  "데이터 마케팅",
  "마케팅 리서치",
  "고객 분석",
  "고객 데이터",
  "고객 인사이트",
  "사용자 분석",
  "유저 분석",
  "그로스 분석",
  "그로스 데이터",
  "Growth Analyst",
  "Growth Analytics",
  "Growth Data",
  "퍼포먼스 마케팅",
  "캠페인 분석",
  "퍼널 분석",
  "AB 테스트",
  "수요예측",
  "임상통계",
  "보건통계",
  "품질통계",
  "조사분석",
  "빅데이터",
  "연구원"
];

const JOB_ALIO_SEARCH_TYPES = [
  { suffix: "", value: "title" },
  { suffix: "elig", value: "elig" },
  { suffix: "pref", value: "pref_con" },
  { suffix: "treat", value: "treat_con" }
] as const;

function slugifyKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sourceKeywordUrl(
  site: "saramin" | "jobkorea" | "job-alio",
  keyword: string,
  options: { jobAlioSearchType?: string } = {}
): string {
  const encoded = encodeURIComponent(keyword);
  if (site === "saramin") {
    return `https://www.saramin.co.kr/zf_user/search/recruit?searchword=${encoded}&searchType=search`;
  }
  if (site === "job-alio") {
    return `https://job.alio.go.kr/recruit.do?search_type=${options.jobAlioSearchType ?? "title"}&keyword=${encoded}&ing=2`;
  }
  return `https://www.jobkorea.co.kr/Search/?stext=${encoded}`;
}

export function buildKeywordSearchSources(keywords = JOB_SEARCH_KEYWORDS): JobSearchSource[] {
  return keywords.flatMap((keyword) => {
    const slug = slugifyKeyword(keyword);
    return [
      {
        name: `saramin-${slug}`,
        url: sourceKeywordUrl("saramin", keyword)
      },
      {
        name: `jobkorea-${slug}`,
        url: sourceKeywordUrl("jobkorea", keyword)
      },
      ...JOB_ALIO_SEARCH_TYPES.map((searchType) => ({
        name: searchType.suffix ? `job-alio-${searchType.suffix}-${slug}` : `job-alio-${slug}`,
        url: sourceKeywordUrl("job-alio", keyword, { jobAlioSearchType: searchType.value })
      }))
    ];
  });
}

export const DEFAULT_JOB_SEARCH_SOURCES: JobSearchSource[] = [
  ...buildKeywordSearchSources(),
  {
    name: "hibrain-research",
    url: "https://www.hibrain.net/recruitment/recruits?sortType=SORTDTM&displayType=TIT&listType=ING&limit=25&siteid=1"
  },
  {
    name: "job-alio-public",
    url: "https://job.alio.go.kr/recruit.do"
  },
  { name: "official-sk", url: "https://www.skcareers.com/Recruit" },
  { name: "official-samsung", url: "https://www.samsungcareers.com/hr/" },
  { name: "official-lg", url: "https://careers.lg.com/apply" },
  { name: "official-kb", url: "https://careers.kbfg.com/apply" },
  { name: "official-cj", url: "https://recruit.cj.net/recruit/ko/recruit/recruit/list.fo" },
  { name: "official-posco", url: "https://recruit.posco.com/h22a01-front/H22A1000.html" },
  { name: "official-hanwha", url: "https://www.hanwhain.com/portal/apply/recruit" },
  { name: "official-hd", url: "https://recruit.hd.com/kr/mainLayout/apply" },
  { name: "official-naver", url: "https://recruit.navercorp.com/rcrt/list.do" },
  { name: "official-naver-cloud", url: "https://recruit.navercloudcorp.com/rcrt/list.do" },
  { name: "official-line", url: "https://careers.linecorp.com/ko/jobs/" },
  { name: "official-kakao", url: "https://careers.kakao.com/jobs" },
  { name: "official-kakao-bank", url: "https://recruit.kakaobank.com/jobs" },
  { name: "official-coupang", url: "https://www.coupang.jobs/kr/jobs/" },
  { name: "official-kt", url: "https://recruit.kt.com/careers" },
  { name: "official-woowa", url: "https://career.woowahan.com/" },
  { name: "official-hyundai-motor", url: "https://talent.hyundai.com/apply/applyList.hc" },
  { name: "official-kia", url: "https://career.kia.com/apply/applyList.kc" },
  { name: "official-lotte", url: "https://recruit.lotte.co.kr/apply/announcement/list" },
  { name: "official-shinsegae", url: "https://job.shinsegae.com/recruit_info/notice/notice01_list.jsp" },
  { name: "official-toss", url: "https://toss.im/career/jobs" },
  { name: "official-sgi", url: "https://sgi.incruit.com/hire/viewhire.asp?projectid=101" },
  { name: "official-shinhan-investment", url: "https://recruit.shinhaninvest.com/" },
  { name: "official-kcc", url: "https://recruit.kccworld.co.kr/recruit/recruitMain.do" }
];

const JOB_LINK_PATTERN =
  /(job|jobs|recruit|recruits|recruitment|posting|position|vacancy|wanted|zf_user\/jobs|Search\/GI_Read|채용|공고)/i;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeUrl(href: string, sourceUrl: string): string | null {
  try {
    const url = new URL(decodeHtmlEntities(href), sourceUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    url.hash = "";
    return canonicalizeJobUrl(url.href);
  } catch {
    return null;
  }
}

function canonicalizeJobUrl(value: string): string {
  const lotteMatch = value.match(/recruit\.lotte\.co\.kr\/apply\/announcement\/detail\/(\d+)/i);
  if (lotteMatch?.[1]) {
    return `https://recruit.lotte.co.kr/apply/announcement/detail/${lotteMatch[1]}`;
  }

  const jobkoreaMatch = value.match(/jobkorea\.co\.kr\/Recruit\/GI_Read\/(\d+)/i);
  if (jobkoreaMatch?.[1]) {
    return `https://www.jobkorea.co.kr/Recruit/GI_Read/${jobkoreaMatch[1]}`;
  }

  const hibrainMatch = value.match(/hibrain\.net\/recruitment\/recruits\/(\d+)/i);
  if (hibrainMatch?.[1]) {
    return `https://www.hibrain.net/recruitment/recruits/${hibrainMatch[1]}`;
  }

  const jobAlioMatch = value.match(/job\.alio\.go\.kr\/recruitview\.do\?[^#]*idx=(\d+)/i);
  if (jobAlioMatch?.[1]) {
    return `https://job.alio.go.kr/recruitview.do?idx=${jobAlioMatch[1]}`;
  }

  const saraminMatch = value.match(/(?:rec_idx=|rec_idx["'=:\\\s]+)(\d+)/i);
  if (saraminMatch?.[1]) {
    return `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${saraminMatch[1]}`;
  }

  return value;
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function looksLikeJobLink(url: string, label: string, sourceUrl: string): boolean {
  if (/samsungcareers\.com/i.test(sourceUrl)) {
    return /samsungcareers\.com\/hr\/\?[^#]*\bno=\d+/i.test(url);
  }
  if (/skcareers\.com/i.test(sourceUrl)) {
    return /skcareers\.com\/Recruit\/Detail\/R\d+/i.test(url);
  }
  if (/careers\.lg\.com/i.test(sourceUrl)) {
    return /careers\.lg\.com\/apply\/detail\?[^#]*\bid=\d+/i.test(url);
  }
  if (/toss\.im\/career/i.test(sourceUrl)) {
    return /toss\.im\/career\/job-detail\?[^#]*\bjob_id=\d+/i.test(url);
  }
  if (/job\.alio\.go\.kr/i.test(sourceUrl)) {
    return /job\.alio\.go\.kr\/recruitview\.do\?idx=\d+/i.test(url);
  }
  if (/hibrain\.net/i.test(url)) {
    return /\/recruitment\/recruits\/\d+/i.test(url);
  }
  if (/job\.alio\.go\.kr/i.test(url)) {
    return /\/recruitview\.do\?idx=\d+/i.test(url);
  }
  if (/jobkorea\.co\.kr/i.test(url)) {
    return /\/Recruit\/GI_Read\/\d+/i.test(url);
  }
  if (/saramin\.co\.kr/i.test(url)) {
    return /\/zf_user\/jobs\/relay\/view\?rec_idx=\d+/i.test(url);
  }
  return JOB_LINK_PATTERN.test(url) || JOB_LINK_PATTERN.test(label);
}

function isOfficialCareerSource(sourceUrl: string): boolean {
  return /(samsungcareers\.com|skcareers\.com|careers\.lg\.com|hanwhain\.com|recruit\.hd\.com|recruit\.lotte\.co\.kr|recruit\.cj\.net|recruit\.posco\.com|job\.shinsegae\.com|careers\.kbfg\.com|toss\.im\/career|sgi\.incruit\.com|recruit\.shinhaninvest\.com|recruit\.kccworld\.co\.kr)/i.test(
    sourceUrl
  );
}

function officialCareerSourceName(sourceUrl: string): string | null {
  if (/skcareers\.com/i.test(sourceUrl)) return "sk-careers";
  if (/recruit\.cj\.net/i.test(sourceUrl)) return "cj-careers";
  if (/recruit\.posco\.com/i.test(sourceUrl)) return "posco-careers";
  if (/recruit\.lotte\.co\.kr/i.test(sourceUrl)) return "lotte-careers";
  if (/job\.shinsegae\.com/i.test(sourceUrl)) return "shinsegae-careers";
  if (/sgi\.incruit\.com/i.test(sourceUrl)) return "sgi-careers";
  if (/recruit\.shinhaninvest\.com/i.test(sourceUrl)) return "shinhan-investment-careers";
  if (/recruit\.kccworld\.co\.kr/i.test(sourceUrl)) return "kcc-careers";
  return null;
}

function isJobAlioDetailSearchSource(sourceUrl: string): boolean {
  return /job\.alio\.go\.kr/i.test(sourceUrl) && /search_type=(?:elig|pref_con|treat_con)/i.test(sourceUrl);
}

function shouldFetchJobAlioDetailSearchLink(label: string): boolean {
  const searchableText = label.replace(/\s+/g, " ").trim();
  return !isClearlyUnrelatedRole(searchableText) && !isExplicitSeniorOnly(searchableText);
}

export function extractJobPageLinks({
  html,
  sourceUrl,
  maxLinks
}: {
  html: string;
  sourceUrl: string;
  maxLinks?: number;
}): string[] {
  const siteSpecificLinks = [
    ...(/job\.shinsegae\.com/i.test(sourceUrl)
      ? [...html.matchAll(/_moveView\(['"]?(\d+)/gi)].map(
          (match) => `https://job.shinsegae.com/recruit_info/notice/notice01_view.jsp?notino=${match[1]}`
        )
      : []),
    ...[...html.matchAll(/jobkorea\.co\.kr\/Recruit\/GI_Read\/(\d+)/gi)].map(
      (match) => `https://www.jobkorea.co.kr/Recruit/GI_Read/${match[1]}`
    ),
    ...[
      ...html.matchAll(/(?:hibrain\.net)?\/recruitment\/recruits\/(\d+)/gi)
    ].map((match) => `https://www.hibrain.net/recruitment/recruits/${match[1]}`),
    ...[...html.matchAll(/(?:rec_idx=|rec_idx["'=:\\\s]+)(\d+)/gi)].map(
      (match) => `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${match[1]}`
    )
  ];
  const anchorLinks = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const url = normalizeUrl(match[1] ?? "", sourceUrl);
      const label = stripTags(match[2] ?? "");
      const shouldFetchBySource = isJobAlioDetailSearchSource(sourceUrl)
        ? shouldFetchJobAlioDetailSearchLink(label)
        : isOfficialCareerSource(sourceUrl) || shouldFetchJobListingLink(label, sourceUrl);
      return url && looksLikeJobLink(url, label, sourceUrl) && shouldFetchBySource ? url : null;
    })
    .filter((url): url is string => Boolean(url));

  const links = Array.from(new Set([...siteSpecificLinks, ...anchorLinks]));
  return typeof maxLinks === "number" ? links.slice(0, maxLinks) : links;
}

export function sourcesFromEnv(value: string | undefined): JobSearchSource[] {
  const urls = (value ?? "")
    .split(/[\n,]/)
    .map((url) => url.trim())
    .filter(Boolean);

  return urls.map((url, index) => ({
    name: `custom-${index + 1}`,
    url
  }));
}

async function fetchHtmlWithTimeout(url: string, timeoutMs = 12000): Promise<string> {
  const origin = new URL(url).origin;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      Referer: `${origin}/`,
      "User-Agent": "Mozilla/5.0 personal-job-dashboard/0.1"
    },
    signal: controller.signal,
    next: { revalidate: 0 }
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`목록 페이지를 가져오지 못했습니다: ${response.status}`);
  }

  return response.text();
}

async function fetchJsonPost(url: string, body: Record<string, unknown>, timeoutMs = 12000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json;charset=UTF-8",
      "User-Agent": "Mozilla/5.0 personal-job-dashboard/0.1"
    },
    body: JSON.stringify(body),
    signal: controller.signal,
    next: { revalidate: 0 }
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`채용 API를 가져오지 못했습니다: ${response.status}`);
  }
  return response.json();
}

type ShinhanCareerListing = {
  ANNO_ID: number;
  ANNO_SUBJECT?: string;
  REQ_TYPE_NM?: string;
  WORK_STYLE_TEXT?: string;
  ACCEPT_STA_YMD?: string;
  ACCEPT_END_YMD?: string;
  OPEN_YN?: string;
  REMAIN_DAY?: number;
};

export function parseShinhanCareerListings(payload: unknown): ShinhanCareerListing[] {
  return Array.isArray(payload)
    ? (payload as ShinhanCareerListing[]).filter((listing) => listing.ANNO_ID && listing.OPEN_YN !== "N")
    : [];
}

function parseShinhanCareerDetail(html: string, listing: ShinhanCareerListing): JobCandidate {
  const title = stripTags(html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "") || listing.ANNO_SUBJECT || "신한투자증권 채용";
  return {
    source: "shinhan-investment-careers",
    sourcePostingId: String(listing.ANNO_ID),
    url: `https://recruit.shinhaninvest.com/recruit/view.do?annoId=${listing.ANNO_ID}`,
    title,
    company: "신한투자증권",
    employmentType: listing.WORK_STYLE_TEXT,
    experienceLevel: listing.REQ_TYPE_NM,
    deadline: listing.ACCEPT_END_YMD,
    postedAt: listing.ACCEPT_STA_YMD,
    description: stripTags(decodeHtmlEntities(html)),
    rawPayload: { officialListing: { jobRole: stripTags(decodeHtmlEntities(html)) } }
  };
}

async function fetchShinhanCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const listings = parseShinhanCareerListings(
    await fetchFormJson("https://recruit.shinhaninvest.com/recruit/mainList.do", { searchType: "A" }, timeoutMs)
  );
  return Promise.all(
    listings.map(async (listing) => {
      const html = await fetchFormHtml("https://recruit.shinhaninvest.com/recruit/view.do", { annoId: listing.ANNO_ID }, timeoutMs);
      return parseShinhanCareerDetail(html, listing);
    })
  );
}

type KccCareerListing = {
  SEQ_R_INFO: number;
  TITLE?: string;
  CAREER_ID?: string;
  EDU_BGR?: string;
  FROM_TO?: string;
};

export function parseKccCareerListings(payload: unknown): KccCareerListing[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return Array.isArray(root.recruitInfoList)
    ? (root.recruitInfoList as KccCareerListing[]).filter((listing) => listing.SEQ_R_INFO)
    : [];
}

function parseKccCareerDetail(payload: unknown, listing: KccCareerListing): JobCandidate {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const detail = root.recruitInfoDtl && typeof root.recruitInfoDtl === "object" ? (root.recruitInfoDtl as Record<string, unknown>) : {};
  const contents = typeof detail.CONTENTS === "string" ? decodeHtmlEntities(detail.CONTENTS) : "";
  const [postedAt, deadline] = (listing.FROM_TO ?? "").split("~").map((value) => value.trim());
  return {
    source: "kcc-careers",
    sourcePostingId: String(listing.SEQ_R_INFO),
    url: `https://recruit.kccworld.co.kr/recruit/recruitMain.do?SiteType=A&SEQ=${listing.SEQ_R_INFO}`,
    title: listing.TITLE ?? String(detail.TITLE ?? "KCC 채용 공고"),
    company: "KCC",
    employmentType: "정규직",
    experienceLevel: listing.CAREER_ID,
    deadline: deadline === "채용시까지" ? null : deadline,
    postedAt,
    description: stripTags(contents),
    rawPayload: { officialListing: { jobRole: stripTags(contents) } }
  };
}

async function fetchKccCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const payload = await fetchJsonPost("https://recruit.kccworld.co.kr/recruit/recruitInfoListAjax", { CORP: "1", TYPE: "" }, timeoutMs);
  const listings = parseKccCareerListings(payload);
  return Promise.all(
    listings.map(async (listing) => parseKccCareerDetail(
      await fetchJsonPost("https://recruit.kccworld.co.kr/recruit/recruitInfoDtlAjax", { SEQ_R_INFO: String(listing.SEQ_R_INFO) }, timeoutMs),
      listing
    ))
  );
}

async function fetchFormText(url: string, body: Record<string, unknown>, timeoutMs: number, accept: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: accept, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "Mozilla/5.0 personal-job-dashboard/0.1" },
    body: new URLSearchParams(Object.entries(body).map(([key, value]) => [key, String(value)])),
    signal: controller.signal,
    next: { revalidate: 0 }
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`채용 페이지를 가져오지 못했습니다: ${response.status}`);
  return response.text();
}

async function fetchFormJson(url: string, body: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  return JSON.parse(await fetchFormText(url, body, timeoutMs, "application/json"));
}

async function fetchFormHtml(url: string, body: Record<string, unknown>, timeoutMs: number): Promise<string> {
  return fetchFormText(url, body, timeoutMs, "text/html,application/xhtml+xml");
}

async function fetchSgiCareerJob(timeoutMs: number): Promise<JobCandidate> {
  const url = "https://sgi.incruit.com/hire/viewhire.asp?projectid=101";
  const fallbackUrl = "https://lab.incruit.com/jobs/2608130000326";
  let html: string;
  let fetchedFrom = url;
  try {
    html = await fetchHtmlWithTimeout(url, timeoutMs);
  } catch {
    // SGI's Incruit microsite currently loops redirects; the indexed detail page carries the same posting.
    html = await fetchHtmlWithTimeout(fallbackUrl, timeoutMs);
    fetchedFrom = fallbackUrl;
  }
  const text = stripTags(decodeHtmlEntities(html));
  const deadline = text.match(
    /접수기간[\s\S]*?(\d{4}[./-]\d{1,2}[./-]\d{1,2})[\s\S]*?(\d{4}[./-]\d{1,2}[./-]\d{1,2})/
  )?.[2];
  return {
    source: "sgi-careers",
    sourcePostingId: "2027-entry-level-4",
    url,
    title: text.match(/(2027년\s*신입사원\s*\(4급\)\s*채용)/)?.[1] ?? "SGI서울보증 신입사원 채용",
    company: "SGI서울보증",
    experienceLevel: "신입",
    deadline,
    description: text,
    rawPayload: { parser: "sgi-careers-html", fetchedFrom, officialUrl: url, officialListing: { jobRole: text } }
  };
}

type SkCareersListing = {
  noticeID: string;
  url?: string;
  title?: string;
  corpName?: string;
  jobRole?: string;
  recruitType?: string;
  workingType?: string;
  workingArea?: string;
  start?: string;
  end?: string;
};

export function parseSamsungCareerListing(html: string): SkCareersListing[] {
  return [...html.matchAll(/<a\s+[^>]*data-value=["']([\d,]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(
    (match) => {
      const noticeID = (match[1] ?? "").replace(/,/g, "");
      const body = match[2] ?? "";
      const company = body.match(/class=["']company["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1];
      const title = body.match(/class=["']title["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1];
      if (!noticeID || !title) {
        return [];
      }
      const info = body.match(/class=["']info["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "";
      const period = body.match(/class=["']period["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ?? "";
      const [start, end] = stripTags(period).split("~").map((value) => value.trim());
      const recruitType = stripTags(info.replace(/<span[^>]*class=["']period["'][\s\S]*$/i, ""));
      return [
        {
          noticeID,
          title: stripTags(title),
          corpName: company ? stripTags(company) : undefined,
          recruitType: recruitType || undefined,
          start: start || undefined,
          end: end || undefined,
          url: `https://www.samsungcareers.com/hr/?no=${noticeID}`
        }
      ];
    }
  );
}

async function fetchSamsungCareerListings(timeoutMs: number): Promise<SkCareersListing[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch("https://www.samsungcareers.com/hr/list.data", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Referer: "https://www.samsungcareers.com/hr/",
      "User-Agent": "Mozilla/5.0 personal-job-dashboard/0.1"
    },
    body: new URLSearchParams({
      currentPageNo: "1",
      intNo: "0",
      strVal: "",
      strTxt: "",
      strKey: "",
      strOrderBy: "",
      strEntity: ""
    }),
    signal: controller.signal,
    next: { revalidate: 0 }
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`Samsung Careers 목록을 가져오지 못했습니다: ${response.status}`);
  }
  return parseSamsungCareerListing(await response.text());
}

export function parseSamsungCareerDetail(payload: unknown, listing: SkCareersListing): JobCandidate {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : {};
  const result = data.result && typeof data.result === "object" ? (data.result as Record<string, unknown>) : {};
  const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
  const itemText = (key: string) => items.map((item) => text(item[key])).filter(Boolean) as string[];
  const description = [
    text(result.introKr),
    ...items.flatMap((item) =>
      ["titleKr", "taskKr", "qlfctKr", "favorKr", "explnKr", "memoKr"].map((key) => text(item[key])).filter(Boolean)
    ),
    text(result.qlfctKr),
    text(result.processKr),
    text(result.etcKr)
  ].filter(Boolean).join("\n\n");

  return {
    source: "samsung-careers",
    sourcePostingId: listing.noticeID,
    url: listing.url ?? `https://www.samsungcareers.com/hr/?no=${listing.noticeID}`,
    title: text(result.title) ?? listing.title ?? "삼성 채용 공고",
    company: text(result.cmpNameKr) ?? listing.corpName ?? "삼성",
    location: itemText("workPlaceKr").join(", ") || undefined,
    experienceLevel: listing.recruitType,
    deadline: listing.end,
    description: description || undefined,
    tags: ["official", "samsung"],
    rawPayload: { parser: "samsung-careers-api", listing, detail: data }
  };
}

async function fetchSamsungCareerDetail(listing: SkCareersListing, timeoutMs: number): Promise<JobCandidate> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(
    `https://www.samsungcareers.com/recruit/detail.data?seqno=${encodeURIComponent(listing.noticeID)}`,
    {
      headers: {
        Accept: "application/json",
        Referer: listing.url ?? "https://www.samsungcareers.com/hr/",
        "User-Agent": "Mozilla/5.0 personal-job-dashboard/0.1"
      },
      signal: controller.signal,
      next: { revalidate: 0 }
    }
  ).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`Samsung Careers 상세 공고를 가져오지 못했습니다: ${response.status}`);
  }
  return parseSamsungCareerDetail(await response.json(), listing);
}

type LgCareerListing = {
  jobNoticeId: number;
  jobNoticeName?: string;
  companyName?: string;
  careerTypeName?: string;
  recEndDateTime?: string;
};

export function parseLgCareerListings(payload: unknown): LgCareerListing[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : {};
  return Array.isArray(data.jobNoticeList)
    ? (data.jobNoticeList as LgCareerListing[]).filter((listing) => Number.isFinite(listing.jobNoticeId))
    : [];
}

export function parseLgCareerDetail(payload: unknown, listing: LgCareerListing): JobCandidate {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : {};
  const wrapper =
    data.jobNoticesDetail && typeof data.jobNoticesDetail === "object"
      ? (data.jobNoticesDetail as Record<string, unknown>)
      : {};
  const detail =
    wrapper.jobNoticesDetail && typeof wrapper.jobNoticesDetail === "object"
      ? (wrapper.jobNoticesDetail as Record<string, unknown>)
      : {};
  const recList = Array.isArray(wrapper.recList) ? (wrapper.recList as Array<Record<string, unknown>>) : [];
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? stripTags(value) : undefined);
  const locations = Array.from(new Set(recList.map((item) => text(item.locationName)).filter(Boolean)));
  const description = [
    ...recList.flatMap((item) =>
      ["orgName", "jobGroupName", "detailContext", "majorCodeName", "requiredItem", "preferredItem"].map((key) =>
        text(item[key])
      )
    ),
    ...["qualForAppInfo", "recProcessInfo", "submitMethodInfo", "otherInfo"].map((key) => text(detail[key]))
  ].filter(Boolean).join("\n\n");
  const otherInfo = text(detail.otherInfo);

  return {
    source: "lg-careers",
    sourcePostingId: String(listing.jobNoticeId),
    url: `https://careers.lg.com/apply/detail?id=${listing.jobNoticeId}`,
    title: listing.jobNoticeName ?? "LG 채용 공고",
    company: listing.companyName ?? "LG",
    location: locations.join(", ") || undefined,
    employmentType: otherInfo?.match(/(?:고용\s*형태\s*[:：]?\s*)?(정규직|계약직|인턴)/)?.[1],
    experienceLevel: listing.careerTypeName,
    deadline: listing.recEndDateTime,
    description: description || undefined,
    tags: ["official", "lg"],
    rawPayload: { parser: "lg-careers-api", listing, detail: wrapper }
  };
}

async function fetchLgCareerJobs(timeoutMs: number, maxJobs?: number): Promise<JobCandidate[]> {
  const headers = {
    "Content-Type": "application/json",
    Origin: "https://careers.lg.com",
    Referer: "https://careers.lg.com/apply",
    "User-Agent": "Mozilla/5.0 personal-job-dashboard/0.1"
  };
  const listResponse = await fetch("https://api.careers.lg.com/rmk/job/retrieveJobNoticesList", {
    method: "POST",
    headers,
    body: JSON.stringify({
      lnbSearch: "",
      hashTagText: "",
      recDate: "CREATION_DATE",
      order: "DESC",
      careerList: [],
      companyCodeList: [],
      desireLocList: [],
      jobGroupList: []
    }),
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 0 }
  });
  if (!listResponse.ok) {
    throw new Error(`LG Careers 목록을 가져오지 못했습니다: ${listResponse.status}`);
  }
  const allListings = parseLgCareerListings(await listResponse.json());
  const listings = typeof maxJobs === "number" ? allListings.slice(0, maxJobs) : allListings;
  return mapWithConcurrency(listings, 4, async (listing) => {
    const response = await fetch("https://api.careers.lg.com/rmk/job/retrieveJobNoticesDetail", {
      method: "POST",
      headers: { ...headers, Referer: `https://careers.lg.com/apply/detail?id=${listing.jobNoticeId}` },
      body: JSON.stringify({ jobNoticeId: listing.jobNoticeId }),
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: 0 }
    });
    if (!response.ok) {
      throw new Error(`LG Careers 상세 공고를 가져오지 못했습니다: ${response.status}`);
    }
    return parseLgCareerDetail(await response.json(), listing);
  });
}

type TossMetadata = { name?: string; value?: unknown };
type TossJob = { id?: number; title?: string; location?: { name?: string }; metadata?: TossMetadata[] };
type TossJobGroup = { id?: number; title?: string; primary_job?: TossJob; jobs?: TossJob[] };

function tossMetadataValue(metadata: TossMetadata[] | undefined, name: RegExp): unknown {
  return metadata?.find((item) => name.test(item.name ?? ""))?.value;
}

function tossMetadataText(metadata: TossMetadata[] | undefined, name: RegExp): string | undefined {
  const value = tossMetadataValue(metadata, name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseTossCareerJobGroups(payload: unknown): JobCandidate[] {
  const groups =
    payload && typeof payload === "object" && Array.isArray((payload as { success?: unknown }).success)
      ? ((payload as { success: TossJobGroup[] }).success ?? [])
      : [];

  return groups.flatMap((group) => {
    const jobs = group.jobs?.length ? group.jobs : group.primary_job ? [group.primary_job] : [];
    return jobs.flatMap((job) => {
      if (!job.id || !job.title) {
        return [];
      }
      const metadata = job.metadata ?? [];
      if (tossMetadataValue(metadata, /미노출/) === true) {
        return [];
      }
      const company = tossMetadataText(metadata, /소속 자회사/) ?? "토스";
      const keywords = tossMetadataText(metadata, /외부 노출용 키워드/);
      return [
        {
          source: "toss-careers",
          sourcePostingId: String(job.id),
          url: `https://toss.im/career/job-detail?job_id=${group.id ?? job.id}&company=${encodeURIComponent(company)}`,
          title: job.title,
          company,
          location: job.location?.name,
          employmentType: tossMetadataText(metadata, /^Employment_Type$/),
          deadline: tossMetadataText(metadata, /클로징 일자/),
          description: tossMetadataText(metadata, /^Job Description/),
          tags: keywords?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
          rawPayload: { parser: "toss-careers-api", groupId: group.id, job }
        } satisfies JobCandidate
      ];
    });
  });
}

async function fetchTossCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch("https://api-public.toss.im/api/v3/ipd-eggnog/career/job-groups", {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 personal-job-dashboard/0.1" },
    signal: controller.signal,
    next: { revalidate: 0 }
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`토스 채용 목록을 가져오지 못했습니다: ${response.status}`);
  }
  return parseTossCareerJobGroups(await response.json());
}

type KbCareerListing = {
  enggId?: number;
  affcomNm?: string;
  enggTypNm?: string;
  carrTypNm?: string;
  jbClsfiNm?: string;
  enggTitl?: string;
  enggEddt?: string;
  cn?: string;
};

export function parseKbCareerListings(payload: unknown): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const result = root.result && typeof root.result === "object" ? (root.result as Record<string, unknown>) : {};
  const listings = Array.isArray(result.recruties) ? (result.recruties as KbCareerListing[]) : [];
  return listings.flatMap((listing) =>
    listing.enggId && listing.enggTitl
      ? [{
          source: "kb-careers",
          sourcePostingId: String(listing.enggId),
          url: `https://careers.kbfg.com/apply/${listing.enggId}`,
          title: listing.enggTitl,
          company: listing.affcomNm ?? "KB금융그룹",
          employmentType: listing.enggTypNm,
          experienceLevel: listing.carrTypNm,
          deadline: listing.enggEddt,
          description: stripTags(listing.cn ?? "") || listing.jbClsfiNm,
          tags: ["official", "kb", listing.jbClsfiNm].filter(Boolean) as string[],
          rawPayload: { parser: "kb-careers-api", listing }
        } satisfies JobCandidate]
      : []
  );
}

type CjCareerListing = {
  zz_jo_num?: string;
  gubun?: string;
  compnm?: string;
  location_cd_nm?: string;
  zz_title?: string;
  many_lng_zz_title?: string;
  zz_end_dt_str?: string;
  zz_jo_type?: string;
  zz_target_1?: string;
  job_cd_nm?: string;
};

export function parseCjCareerListings(payload: unknown): SkCareersListing[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const listings = Array.isArray(root.ds_newRecruitList) ? (root.ds_newRecruitList as CjCareerListing[]) : [];
  return listings.flatMap((listing) => {
    const noticeID = listing.zz_jo_num?.trim();
    const title = listing.zz_title?.trim() || listing.many_lng_zz_title?.trim();
    if (!noticeID || !title) return [];
    const page = listing.gubun === "2" ? "bestDetail.fo?direct=N&" : "detail.fo?";
    return [{
      noticeID,
      url: `https://recruit.cj.net/recruit/ko/recruit/recruit/${page}zz_jo_num=${noticeID}`,
      title,
      corpName: listing.compnm,
      workingArea: listing.location_cd_nm,
      workingType: listing.zz_jo_type,
      recruitType: listing.zz_target_1,
      jobRole: listing.job_cd_nm,
      end: listing.zz_end_dt_str
    }];
  });
}

type PoscoCareerListing = {
  HR_AFTC_MRG_ADOP_NTIC_ID?: number;
  COMPANY_NAME?: string;
  HR_AFTC_MRG_ADOP_NTIC_SUJX?: string;
  HR_AFTC_MRG_ADOP_CLTA_TP_TP_NM?: string;
  END_ACTIVE_DATE?: string;
  RECU_FIELD?: string;
};

export function parsePoscoCareerListings(payload: unknown): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const listings = Array.isArray(root.recuList) ? (root.recuList as PoscoCareerListing[]) : [];
  return listings.flatMap((listing) => {
    const id = listing.HR_AFTC_MRG_ADOP_NTIC_ID;
    const title = listing.HR_AFTC_MRG_ADOP_NTIC_SUJX?.trim();
    return id && title
      ? [{
          source: "posco-careers",
          sourcePostingId: String(id),
          url: `https://recruit.posco.com/h22a01-front/H22A1001.html?id=${id}`,
          title,
          company: listing.COMPANY_NAME ?? "포스코그룹",
          experienceLevel: listing.HR_AFTC_MRG_ADOP_CLTA_TP_TP_NM,
          deadline: listing.END_ACTIVE_DATE,
          description: listing.RECU_FIELD,
          tags: ["official", "posco"],
          rawPayload: { parser: "posco-careers-api", listing }
        } satisfies JobCandidate]
      : [];
  });
}

async function fetchKbCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const response = await fetch("https://careers.kbfg.com/api/career/recruites?pageSize=100&totalCount=0", {
    headers: { Accept: "application/json", Referer: "https://careers.kbfg.com/apply" },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 0 }
  });
  if (!response.ok) throw new Error(`KB Careers 목록을 가져오지 못했습니다: ${response.status}`);
  return parseKbCareerListings(await response.json());
}

async function fetchCjCareerListings(timeoutMs: number): Promise<SkCareersListing[]> {
  const response = await fetch("https://recruit.cj.net/recruit/ko/recruit/recruit/searchNewGonggoList.fo", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Referer: "https://recruit.cj.net/recruit/ko/recruit/recruit/list.fo" },
    body: new URLSearchParams({ pageVal: "1", pageIndex: "200", orderDesc: "1", sch_title: "", schArea: "N" }),
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 0 }
  });
  if (!response.ok) throw new Error(`CJ Careers 목록을 가져오지 못했습니다: ${response.status}`);
  return parseCjCareerListings(await response.json());
}

async function fetchPoscoCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const response = await fetch("https://recruit.posco.com/h22a01-recruit/H22A1000/list?rowCount=100&pageSize=10&currPage=1&offset=0&SEARCH_TYPE=&SEARCH_ORDER=s2&SEARCH_COMP=&SEARCH_VALUE=", {
    headers: { Accept: "application/json", AJAX: "true", Referer: "https://recruit.posco.com/h22a01-front/H22A1000.html" },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 0 }
  });
  if (!response.ok) throw new Error(`POSCO Careers 목록을 가져오지 못했습니다: ${response.status}`);
  return parsePoscoCareerListings(await response.json());
}

type HanwhaCareerListing = {
  rtSeq?: number;
  rtNm?: string;
  sdNm?: string;
  rtAcptEndDttm?: string;
  rtCarrYn?: string;
  rtNrcrtYn?: string;
  rtIntnYn?: string;
  rtPermanentWorkYn?: string;
  rtTempWorkYn?: string;
  rtHopeWorkpl?: string;
  tagList?: unknown[];
};

export function parseHanwhaCareerListings(payload: unknown): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : {};
  const listings = Array.isArray(data.list) ? (data.list as HanwhaCareerListing[]) : [];
  return listings.flatMap((listing) => {
    if (!listing.rtSeq || !listing.rtNm) return [];
    const experienceLevel = listing.rtCarrYn === "Y" ? "경력" : listing.rtNrcrtYn === "Y" ? "신입" : listing.rtIntnYn === "Y" ? "인턴" : undefined;
    const employmentType = listing.rtPermanentWorkYn === "Y" ? "정규직" : listing.rtTempWorkYn === "Y" ? "계약직" : undefined;
    return [{
      source: "hanwha-careers",
      sourcePostingId: String(listing.rtSeq),
      url: `https://www.hanwhain.com/portal/apply/recruit/detail?rtSeq=${listing.rtSeq}`,
      title: listing.rtNm,
      company: listing.sdNm ?? "한화그룹",
      location: listing.rtHopeWorkpl,
      employmentType,
      experienceLevel,
      deadline: listing.rtAcptEndDttm,
      tags: ["official", "hanwha", ...(listing.tagList ?? []).filter((tag): tag is string => typeof tag === "string")],
      rawPayload: { parser: "hanwha-careers-api", listing }
    } satisfies JobCandidate];
  });
}

type HdCareerListing = {
  recruitNoticeSn?: number;
  recruitNoticeName?: string;
  recruitTypeName?: string;
  receiveEndDatetime?: string;
  contents?: string;
  recruitSectorList?: Array<{ companyName?: string; area?: string; job?: string; jobDetail?: string }>;
};

export function parseHdCareerListings(payload: unknown, now = new Date()): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const listings = Array.isArray(root.data) ? (root.data as HdCareerListing[]) : [];
  return listings.flatMap((listing) => {
    const id = listing.recruitNoticeSn;
    const deadline = listing.receiveEndDatetime;
    if (!id || !listing.recruitNoticeName || !deadline || new Date(deadline).getTime() <= now.getTime()) return [];
    const sectors = listing.recruitSectorList ?? [];
    const companies = Array.from(new Set(sectors.map((sector) => sector.companyName).filter(Boolean)));
    const locations = Array.from(new Set(sectors.map((sector) => sector.area).filter(Boolean)));
    const sectorText = sectors.flatMap((sector) => [sector.job, sector.jobDetail]).filter(Boolean).join(" ");
    return [{
      source: "hd-careers",
      sourcePostingId: String(id),
      url: `https://recruit.hd.com/kr/mainLayout/applyDetail/${id}`,
      title: listing.recruitNoticeName,
      company: companies.join(", ") || "HD현대",
      location: locations.join(", ") || undefined,
      experienceLevel: listing.recruitTypeName,
      deadline,
      description: [stripTags(listing.contents ?? ""), sectorText].filter(Boolean).join("\n") || undefined,
      tags: ["official", "hd-hyundai"],
      rawPayload: { parser: "hd-careers-api", listing }
    } satisfies JobCandidate];
  });
}

async function fetchHanwhaCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const response = await fetch("https://hwadm.hanwhain.com/new-backend/portal/api/rcRecruit/search-rcrt", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept-Language": "ko", Origin: "https://www.hanwhain.com", Referer: "https://www.hanwhain.com/portal/apply/recruit" },
    body: JSON.stringify({ langCd: "ko", searchText: "", sdSeqList: null, rtNrcrtYn: "", rtCarrYn: "", rtIntnYn: "", rtPermanentWorkYn: "", rtTempWorkYn: "", djSeqList: null, rjSeqList: null, page: 0, size: 200 }),
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 0 }
  });
  if (!response.ok) throw new Error(`Hanwha Careers 목록을 가져오지 못했습니다: ${response.status}`);
  return parseHanwhaCareerListings(await response.json());
}

async function fetchHdCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const response = await fetch("https://recruit.hd.com/api/v1/jobda/getRecruitNoticeList?isPost=true&LANG=KR", {
    headers: { Accept: "application/json", "X-User-Role": "FRONT", Referer: "https://recruit.hd.com/kr/mainLayout/apply" },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 0 }
  });
  if (!response.ok) throw new Error(`HD Hyundai Careers 목록을 가져오지 못했습니다: ${response.status}`);
  return parseHdCareerListings(await response.json());
}

type NaverCareerListing = {
  annoId?: number;
  sysCompanyCdNm?: string;
  annoSubject?: string;
  entTypeCdNm?: string;
  empTypeCdNm?: string;
  endYmdTime?: string;
  annoKeyword?: string;
  classCdNm?: string;
  subJobCdNm?: string;
  jobDetailLink?: string;
};

export function parseNaverCareerListings(payload: unknown, source = "naver-careers"): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const listings = Array.isArray(root.list) ? (root.list as NaverCareerListing[]) : [];
  return listings.flatMap((listing) => listing.annoId && listing.annoSubject ? [{
    source,
    sourcePostingId: String(listing.annoId),
    url: listing.jobDetailLink ?? `https://recruit.navercorp.com/rcrt/view.do?annoId=${listing.annoId}&lang=ko`,
    title: listing.annoSubject,
    company: listing.sysCompanyCdNm ?? "NAVER",
    employmentType: listing.empTypeCdNm,
    experienceLevel: listing.entTypeCdNm,
    deadline: listing.endYmdTime,
    description: [listing.annoKeyword, listing.classCdNm, listing.subJobCdNm].filter(Boolean).join(" ") || undefined,
    tags: ["official", "naver", listing.classCdNm, listing.subJobCdNm].filter(Boolean) as string[],
    rawPayload: { parser: "naver-careers-api", listing }
  } satisfies JobCandidate] : []);
}

type LineCareerListing = {
  publish?: boolean;
  is_public?: boolean;
  is_filters_public?: boolean;
  strapiId?: number;
  title?: string;
  end_date?: string;
  until_filled?: boolean;
  employment_type?: Array<{ name?: string }>;
  job_unit?: Array<{ name?: string }>;
  job_fields?: Array<{ name?: string }>;
  companies?: Array<{ name?: string }>;
  cities?: Array<{ name?: string }>;
};

export function parseLineCareerListings(payload: unknown, now = new Date()): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const result = root.result && typeof root.result === "object" ? (root.result as Record<string, unknown>) : {};
  const data = result.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : {};
  const jobs = data.allStrapiJobs && typeof data.allStrapiJobs === "object" ? (data.allStrapiJobs as Record<string, unknown>) : {};
  const edges = Array.isArray(jobs.edges) ? (jobs.edges as Array<{ node?: LineCareerListing }>) : [];
  return edges.flatMap(({ node: listing }) => {
    if (!listing?.publish || !listing.is_public || !listing.is_filters_public || !listing.strapiId || !listing.title) return [];
    if (!listing.until_filled && (!listing.end_date || new Date(listing.end_date).getTime() <= now.getTime())) return [];
    const names = (items: Array<{ name?: string }> | undefined): string[] =>
      Array.from(new Set((items ?? []).flatMap((item) => item.name ? [item.name] : [])));
    return [{
      source: "line-careers",
      sourcePostingId: String(listing.strapiId),
      url: `https://careers.linecorp.com/ko/jobs/${listing.strapiId}/`,
      title: listing.title.trim(),
      company: names(listing.companies).join(", ") || "LINE",
      location: names(listing.cities).join(", ") || undefined,
      employmentType: names(listing.employment_type).join(", ") || undefined,
      deadline: listing.until_filled ? undefined : listing.end_date,
      description: [...names(listing.job_unit), ...names(listing.job_fields)].join(" ") || undefined,
      tags: ["official", "line", ...names(listing.job_fields)],
      rawPayload: { parser: "line-careers-page-data", listing }
    } satisfies JobCandidate];
  });
}

type KakaoCareerListing = {
  realId?: string;
  jobOfferTitle?: string;
  companyName?: string;
  locationName?: string;
  employeeTypeName?: string;
  endDate?: string | null;
  introduction?: string;
  workContentDesc?: string;
  qualification?: string;
  closeFlag?: boolean;
  skillSetList?: Array<{ skillSetName?: string }>;
};

export function parseKakaoCareerListings(payload: unknown): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const listings = Array.isArray(root.jobList) ? (root.jobList as KakaoCareerListing[]) : [];
  return listings.flatMap((listing) => !listing.closeFlag && listing.realId && listing.jobOfferTitle ? [{
    source: "kakao-careers",
    sourcePostingId: listing.realId,
    url: `https://careers.kakao.com/jobs/${listing.realId}`,
    title: listing.jobOfferTitle,
    company: listing.companyName ?? "카카오",
    location: listing.locationName,
    employmentType: listing.employeeTypeName,
    deadline: listing.endDate ?? undefined,
    description: [listing.introduction, listing.workContentDesc, listing.qualification].map((value) => stripTags(value ?? "")).filter(Boolean).join("\n\n") || undefined,
    tags: ["official", "kakao", ...(listing.skillSetList ?? []).flatMap((item) => item.skillSetName ? [item.skillSetName] : [])],
    rawPayload: { parser: "kakao-careers-api", listing }
  } satisfies JobCandidate] : []);
}

type KakaoBankCareerListing = {
  recruitNoticeSn?: number;
  recruitNoticeName?: string;
  recruitTypeName?: string;
  recruitClassName?: string;
  receiveEndDatetime?: string;
};

export function parseKakaoBankCareerListings(payload: unknown): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const listings = Array.isArray(root.list) ? (root.list as KakaoBankCareerListing[]) : [];
  return listings.flatMap((listing) => listing.recruitNoticeSn && listing.recruitNoticeName ? [{
    source: "kakao-bank-careers",
    sourcePostingId: String(listing.recruitNoticeSn),
    url: `https://recruit.kakaobank.com/jobs/${listing.recruitNoticeSn}`,
    title: listing.recruitNoticeName,
    company: "카카오뱅크",
    experienceLevel: /신입|경력|인턴/i.test(listing.recruitTypeName ?? "") ? listing.recruitTypeName : undefined,
    deadline: listing.receiveEndDatetime,
    description: listing.recruitClassName,
    tags: ["official", "kakao-bank", listing.recruitClassName].filter(Boolean) as string[],
    rawPayload: { parser: "kakao-bank-careers-api", listing }
  } satisfies JobCandidate] : []);
}

async function fetchNaverCareerJobs(baseUrl: string, source: string, timeoutMs: number, companyCode?: string): Promise<JobCandidate[]> {
  const jobs: JobCandidate[] = [];
  for (let firstIndex = 0; ; firstIndex += 10) {
    const params = new URLSearchParams({ firstIndex: String(firstIndex) });
    if (companyCode) params.set("sysCompanyCdArr", companyCode);
    const response = await fetch(`${baseUrl}/rcrt/loadJobList.do?${params}`, { signal: AbortSignal.timeout(timeoutMs), next: { revalidate: 0 } });
    if (!response.ok) throw new Error(`NAVER Careers 목록을 가져오지 못했습니다: ${response.status}`);
    const payload = await response.json() as { totalSize?: number };
    jobs.push(...parseNaverCareerListings(payload, source));
    if (firstIndex + 10 >= (payload.totalSize ?? jobs.length)) break;
  }
  return jobs;
}

async function fetchLineCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const response = await fetch("https://careers.linecorp.com/page-data/ko/jobs/page-data.json", { signal: AbortSignal.timeout(timeoutMs), next: { revalidate: 0 } });
  if (!response.ok) throw new Error(`LINE Careers 목록을 가져오지 못했습니다: ${response.status}`);
  return parseLineCareerListings(await response.json());
}

async function fetchKakaoCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const jobs: JobCandidate[] = [];
  for (const part of ["TECHNOLOGY", "BUSINESS_SERVICES", "DESIGN", "STAFF"]) {
    for (let page = 1; ; page += 1) {
      const url = `https://careers.kakao.com/public/api/job-list?skillSet=&part=${part}&company=dk&keyword=&employeeType=&page=${page}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), next: { revalidate: 0 } });
      if (!response.ok) throw new Error(`Kakao Careers 목록을 가져오지 못했습니다: ${response.status}`);
      const payload = await response.json() as { totalPage?: number };
      jobs.push(...parseKakaoCareerListings(payload));
      if (page >= (payload.totalPage ?? 1)) break;
    }
  }
  return jobs;
}

async function fetchKakaoBankCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const response = await fetch("https://recruit.kakaobank.com/api/recruits", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://recruit.kakaobank.com/jobs" },
    body: JSON.stringify({ pageNumber: 1, pageSize: 100, receiptFilterType: "ONGOING" }),
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 0 }
  });
  if (!response.ok) throw new Error(`KakaoBank Careers 목록을 가져오지 못했습니다: ${response.status}`);
  return parseKakaoBankCareerListings(await response.json());
}

type CoupangCareerListing = {
  id?: number;
  title?: string;
  company_name?: string;
  absolute_url?: string;
  location?: { name?: string };
  application_deadline?: string;
  content?: string;
  departments?: Array<{ name?: string }>;
};

function isKoreanCoupangLocation(location: string | undefined): boolean {
  return !location || /south\s*korea|republic\s*of\s*korea|대한민국|서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주/i.test(location);
}

export function parseCoupangCareerListings(payload: unknown): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const listings = Array.isArray(root.jobs) ? (root.jobs as CoupangCareerListing[]) : [];
  return listings.flatMap((listing) => listing.id && listing.title && isKoreanCoupangLocation(listing.location?.name) ? [{
    source: "coupang-careers",
    sourcePostingId: String(listing.id),
    url: listing.absolute_url ?? `https://www.coupang.jobs/kr/jobs/?gh_jid=${listing.id}`,
    title: listing.title,
    company: listing.company_name ?? "Coupang",
    location: listing.location?.name,
    deadline: listing.application_deadline,
    description: stripTags(listing.content ?? "") || undefined,
    tags: ["official", "coupang", ...(listing.departments ?? []).flatMap((item) => item.name ? [item.name] : [])],
    rawPayload: { parser: "coupang-greenhouse-api", listing }
  } satisfies JobCandidate] : []);
}

type KtCareerListing = {
  recruitNoticeSn?: number;
  recruitNoticeName?: string;
  company?: string;
  recruitTypeName?: string;
  receiveEndDatetime?: string;
  contents?: string;
  isInTime?: boolean;
  isTimeOver?: boolean;
  recruitSectorList?: Array<{ area?: string; job?: string; jobDetail?: string; companyName?: string }>;
};

export function parseKtCareerListings(payload: unknown): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const listings = Array.isArray(root.data) ? (root.data as KtCareerListing[]) : [];
  return listings.flatMap((listing) => {
    if (!listing.isInTime || listing.isTimeOver || !listing.recruitNoticeSn || !listing.recruitNoticeName) return [];
    const sectors = listing.recruitSectorList ?? [];
    const locations = Array.from(new Set(sectors.flatMap((item) => item.area ? [item.area] : [])));
    const company = listing.company ?? sectors.find((item) => item.companyName)?.companyName ?? "KT";
    const sectorText = sectors.flatMap((item) => [item.job, item.jobDetail]).filter(Boolean).join(" ");
    return [{
      source: "kt-careers",
      sourcePostingId: String(listing.recruitNoticeSn),
      url: `https://recruit.kt.com/careers/${listing.recruitNoticeSn}`,
      title: listing.recruitNoticeName,
      company,
      location: locations.join(", ") || undefined,
      experienceLevel: listing.recruitTypeName,
      deadline: listing.receiveEndDatetime,
      description: [stripTags(listing.contents ?? ""), sectorText].filter(Boolean).join("\n") || undefined,
      tags: ["official", "kt"],
      rawPayload: { parser: "kt-careers-api", listing }
    } satisfies JobCandidate];
  });
}

type WoowaCareerListing = {
  recruitNumber?: string;
  recruitName?: string;
  title?: string;
  companyName?: string;
  employmentTypeName?: string;
  careerTypeName?: string;
  closingDate?: string;
  recruitEndDate?: string;
  jobGroupName?: string;
  workPlaceName?: string;
  careerRestrictionMinYears?: number;
  careerRestrictionMaxYears?: number;
};

export function parseWoowaCareerListings(payload: unknown): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : {};
  const listings = Array.isArray(data.list) ? (data.list as WoowaCareerListing[]) : [];
  return listings.flatMap((listing) => {
    const title = listing.recruitName ?? listing.title;
    if (!listing.recruitNumber || !title) return [];
    return [{
      source: "woowa-careers",
      sourcePostingId: listing.recruitNumber,
      url: `https://career.woowahan.com/recruitment/${listing.recruitNumber}/detail`,
      title,
      company: listing.companyName ?? "우아한형제들",
      location: listing.workPlaceName,
      employmentType: listing.employmentTypeName,
      experienceLevel: listing.careerRestrictionMinYears
        ? `경력 ${listing.careerRestrictionMinYears}년 이상`
        : listing.careerTypeName,
      deadline: listing.closingDate ?? listing.recruitEndDate,
      description: listing.jobGroupName,
      tags: ["official", "woowa", listing.jobGroupName].filter(Boolean) as string[],
      rawPayload: { parser: "woowa-careers-api", listing }
    } satisfies JobCandidate];
  });
}

async function fetchCoupangCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const response = await fetch("https://boards-api.greenhouse.io/v1/boards/coupang/jobs?content=true", { signal: AbortSignal.timeout(timeoutMs), next: { revalidate: 0 } });
  if (!response.ok) throw new Error(`Coupang Careers 목록을 가져오지 못했습니다: ${response.status}`);
  return parseCoupangCareerListings(await response.json());
}

async function fetchKtCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const response = await fetch("https://recruit.kt.com/api/recruit?isPost=1&isInprogress=1&isContainsContents=1", { signal: AbortSignal.timeout(timeoutMs), next: { revalidate: 0 } });
  if (!response.ok) throw new Error(`KT Careers 목록을 가져오지 못했습니다: ${response.status}`);
  return parseKtCareerListings(await response.json());
}

async function fetchWoowaCareerJobs(timeoutMs: number): Promise<JobCandidate[]> {
  const response = await fetch("https://career.woowahan.com/w1/recruits?page=0&size=100&sort=updateDate,desc", { signal: AbortSignal.timeout(timeoutMs), next: { revalidate: 0 } });
  if (!response.ok) throw new Error(`Woowa Careers 목록을 가져오지 못했습니다: ${response.status}`);
  return parseWoowaCareerListings(await response.json());
}

type HkmcCareerListing = {
  recuYy?: string;
  recuType?: string;
  recuCls?: string;
  recuNoticeNm?: string;
  applyEndDt?: string;
  applyEndTm?: string;
  secCodeNm?: string;
  fldCodeNm?: string;
  workPlaceCodeNm?: string;
  jdRecuCateNm?: string;
  channelCodeNm?: string;
  hashTag?: string;
};

type HkmcCareerConfig = {
  company: string;
  source: string;
  detailExtension: "hc" | "kc";
  baseUrl: string;
};

export function parseHkmcCareerListings(payload: unknown, config: HkmcCareerConfig): JobCandidate[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : {};
  const listings = Array.isArray(data.list) ? (data.list as HkmcCareerListing[]) : [];
  return listings.flatMap((listing) => {
    if (!listing.recuYy || !listing.recuType || !listing.recuCls || !listing.recuNoticeNm) return [];
    const query = new URLSearchParams({ recuYy: listing.recuYy, recuType: listing.recuType, recuCls: listing.recuCls });
    return [{
      source: config.source,
      sourcePostingId: `${listing.recuYy}-${listing.recuType}-${listing.recuCls}`,
      url: `${config.baseUrl}/apply/applyView.${config.detailExtension}?${query}`,
      title: listing.recuNoticeNm,
      company: config.company,
      location: listing.workPlaceCodeNm,
      experienceLevel:
        listing.channelCodeNm ??
        (/신입|경력|인턴/i.test(listing.jdRecuCateNm ?? "") ? listing.jdRecuCateNm : undefined),
      deadline: [listing.applyEndDt, listing.applyEndTm].filter(Boolean).join(" ") || undefined,
      description: [listing.secCodeNm, listing.fldCodeNm, listing.hashTag].filter(Boolean).join(" ") || undefined,
      tags: ["official", config.company, listing.secCodeNm, listing.fldCodeNm].filter(Boolean) as string[],
      rawPayload: { parser: "hkmc-careers-api", listing }
    } satisfies JobCandidate];
  });
}

async function fetchHkmcCareerJobs(kind: "hyundai" | "kia", timeoutMs: number): Promise<JobCandidate[]> {
  const isHyundai = kind === "hyundai";
  const baseUrl = isHyundai ? "https://talent.hyundai.com" : "https://career.kia.com";
  const extension = isHyundai ? "hc" : "kc";
  const listUrl = `${baseUrl}/apply/applyList.${extension}`;
  const sessionResponse = await fetch(listUrl, {
    headers: { "User-Agent": "Mozilla/5.0 personal-job-dashboard/0.1" },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 0 }
  });
  if (!sessionResponse.ok) throw new Error(`${kind} Careers 세션을 만들지 못했습니다: ${sessionResponse.status}`);
  const cookie = (sessionResponse.headers.get("set-cookie") ?? "")
    .split(/,(?=[^;,]+=)/)
    .map((value) => value.split(";", 1)[0]?.trim())
    .filter(Boolean)
    .join("; ");
  const params = new URLSearchParams(isHyundai
    ? { hgrCd: "1", lang: "ko", page: "1", pageblock: "100", searchFieldList: "", searchOccupList: "", searchPlaceList: "", searchSectorList: "", searchText: "", jdSec: "", srcOrd: "", intnsvYn: "" }
    : { hgrCd: "2", lang: "ko", page: "1", pageblock: "100", searchSectorList: "", searchSecList: "", searchPlaceList: "", searchText: "" });
  const endpoint = isHyundai ? "AP-HM-FO-02700" : "AP-KM-FO-02700";
  const response = await fetch(`${baseUrl}/api/rec/${endpoint}?${params}`, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-HKMC-SERVICE": isHyundai ? "HM" : "KM",
      ...(isHyundai ? {} : { "X-HKMC-TOKEN": "null", "X-HKMC-EMP-TOKEN": "null" }),
      Cookie: cookie,
      Referer: listUrl,
      "User-Agent": "Mozilla/5.0 personal-job-dashboard/0.1"
    },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 0 }
  });
  if (!response.ok) throw new Error(`${kind} Careers 목록을 가져오지 못했습니다: ${response.status}`);
  return parseHkmcCareerListings(await response.json(), {
    company: isHyundai ? "현대자동차" : "기아",
    source: isHyundai ? "hyundai-motor-careers" : "kia-careers",
    detailExtension: extension,
    baseUrl
  });
}

async function fetchSkCareersListings(timeoutMs: number): Promise<SkCareersListing[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch("https://www.skcareers.com/Recruit/GetRecruitList", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: "https://www.skcareers.com/Recruit",
      "User-Agent": "Mozilla/5.0 personal-job-dashboard/0.1"
    },
    body: new URLSearchParams({
      sort: "1",
      searchText: "",
      corpCode: "",
      jobRole: "",
      recruitType: "",
      workingType: "",
      workingRegion: ""
    }),
    signal: controller.signal,
    next: { revalidate: 0 }
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`SK Careers 목록을 가져오지 못했습니다: ${response.status}`);
  }
  const parsed = (await response.json()) as { success?: boolean; list?: SkCareersListing[] };
  if (!parsed.success || !Array.isArray(parsed.list)) {
    throw new Error("SK Careers 목록 응답 형식이 올바르지 않습니다.");
  }
  return parsed.list.filter((posting) => posting.noticeID);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, values.length));

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function collectJobsFromSearchSources({
  sources,
  maxLinksPerSource,
  concurrency = 8,
  sourceConcurrency = 8,
  requestTimeoutMs = 12000,
  onProgress
}: {
  sources: JobSearchSource[];
  maxLinksPerSource?: number;
  concurrency?: number;
  sourceConcurrency?: number;
  requestTimeoutMs?: number;
  onProgress?: (event: JobCollectionProgressEvent) => void;
}): Promise<JobCandidate[]> {
  const candidates: JobCandidate[] = [];

  const sourceResults = await mapWithConcurrency(sources, sourceConcurrency, async (source) => {
    try {
      onProgress?.({ type: "source-started", message: `${source.name} 소스 조회 시작` });
      if (/samsungcareers\.com\/hr\/?$/i.test(source.url)) {
        const listings = await fetchSamsungCareerListings(requestTimeoutMs);
        const selectedListings = typeof maxLinksPerSource === "number" ? listings.slice(0, maxLinksPerSource) : listings;
        const links = selectedListings.flatMap((listing) => (listing.url ? [listing.url] : []));
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${links.length}개 링크` });
        return { source, links, listings: selectedListings };
      }
      if (/skcareers\.com\/Recruit\/?$/i.test(source.url)) {
        const listings = await fetchSkCareersListings(requestTimeoutMs);
        const selectedListings = typeof maxLinksPerSource === "number" ? listings.slice(0, maxLinksPerSource) : listings;
        const links = selectedListings.map(
          (listing) => `https://www.skcareers.com/Recruit/Detail/${listing.noticeID}`
        );
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${links.length}개 링크` });
        return { source, links, listings: selectedListings };
      }
      if (/toss\.im\/career\/jobs\/?$/i.test(source.url)) {
        const allCandidates = await fetchTossCareerJobs(requestTimeoutMs);
        const directCandidates =
          typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({
          type: "source-completed",
          message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고`
        });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/careers\.lg\.com\/apply\/?$/i.test(source.url)) {
        const directCandidates = await fetchLgCareerJobs(requestTimeoutMs, maxLinksPerSource);
        onProgress?.({
          type: "source-completed",
          message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고`
        });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/careers\.kbfg\.com\/apply\/?$/i.test(source.url)) {
        const allCandidates = await fetchKbCareerJobs(requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/recruit\.cj\.net\/recruit\/ko\/recruit\/recruit\/list\.fo$/i.test(source.url)) {
        const allListings = await fetchCjCareerListings(requestTimeoutMs);
        const listings = typeof maxLinksPerSource === "number" ? allListings.slice(0, maxLinksPerSource) : allListings;
        const links = listings.flatMap((listing) => listing.url ? [listing.url] : []);
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${links.length}개 링크` });
        return { source, links, listings };
      }
      if (/recruit\.posco\.com\/h22a01-front\/H22A1000\.html$/i.test(source.url)) {
        const allCandidates = await fetchPoscoCareerJobs(requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/hanwhain\.com\/portal\/apply\/recruit\/?$/i.test(source.url)) {
        const allCandidates = await fetchHanwhaCareerJobs(requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/recruit\.hd\.com\/kr\/mainLayout\/apply\/?$/i.test(source.url)) {
        const allCandidates = await fetchHdCareerJobs(requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/recruit\.navercorp\.com\/rcrt\/list\.do$/i.test(source.url)) {
        const allCandidates = await fetchNaverCareerJobs("https://recruit.navercorp.com", "naver-careers", requestTimeoutMs, "KR");
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/recruit\.navercloudcorp\.com\/rcrt\/list\.do$/i.test(source.url)) {
        const allCandidates = await fetchNaverCareerJobs("https://recruit.navercloudcorp.com", "naver-cloud-careers", requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/careers\.linecorp\.com\/ko\/jobs\/?$/i.test(source.url)) {
        const allCandidates = await fetchLineCareerJobs(requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/careers\.kakao\.com\/jobs\/?$/i.test(source.url)) {
        const allCandidates = await fetchKakaoCareerJobs(requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/recruit\.kakaobank\.com\/jobs\/?$/i.test(source.url)) {
        const allCandidates = await fetchKakaoBankCareerJobs(requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/coupang\.jobs\/kr\/jobs\/?$/i.test(source.url)) {
        const allCandidates = await fetchCoupangCareerJobs(requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/recruit\.kt\.com\/careers\/?$/i.test(source.url)) {
        const allCandidates = await fetchKtCareerJobs(requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/career\.woowahan\.com\/?$/i.test(source.url)) {
        const allCandidates = await fetchWoowaCareerJobs(requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/talent\.hyundai\.com\/apply\/applyList\.hc$/i.test(source.url)) {
        const allCandidates = await fetchHkmcCareerJobs("hyundai", requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/career\.kia\.com\/apply\/applyList\.kc$/i.test(source.url)) {
        const allCandidates = await fetchHkmcCareerJobs("kia", requestTimeoutMs);
        const directCandidates = typeof maxLinksPerSource === "number" ? allCandidates.slice(0, maxLinksPerSource) : allCandidates;
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/sgi\.incruit\.com\/hire\/viewhire\.asp/i.test(source.url)) {
        const directCandidates = [await fetchSgiCareerJob(requestTimeoutMs)];
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/recruit\.shinhaninvest\.com\/?$/i.test(source.url)) {
        const directCandidates = await fetchShinhanCareerJobs(requestTimeoutMs);
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      if (/recruit\.kccworld\.co\.kr\/recruit\/recruitMain\.do/i.test(source.url)) {
        const directCandidates = await fetchKccCareerJobs(requestTimeoutMs);
        onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${directCandidates.length}개 공고` });
        return { source, links: [], listings: [] as SkCareersListing[], directCandidates };
      }
      const html = await fetchHtmlWithTimeout(source.url, requestTimeoutMs);
      const links = extractJobPageLinks({
        html,
        sourceUrl: source.url,
        maxLinks: maxLinksPerSource
      });
      onProgress?.({ type: "source-completed", message: `${source.name} 소스 조회 완료: ${links.length}개 링크` });
      return {
        source,
        links,
        listings: [] as SkCareersListing[],
        directCandidates: [] as JobCandidate[]
      };
    } catch {
      onProgress?.({ type: "source-failed", message: `${source.name} 소스 조회 실패` });
      return {
        source,
        links: [],
        listings: [] as SkCareersListing[],
        directCandidates: [] as JobCandidate[]
      };
    }
  });

  candidates.push(...sourceResults.flatMap((result) => result.directCandidates ?? []));

  const rawDetailTargets = sourceResults.flatMap(({ source, links, listings }) =>
    links.map((link) => ({
      source,
      link,
      listing: listings.find((item) => item.url === link || link.endsWith(`/${item.noticeID}`))
    }))
  );
  const detailTargets = Array.from(new Map(rawDetailTargets.map((target) => [target.link, target])).values());

  const totalDetails = detailTargets.length;
  const detailResults = await mapWithConcurrency(detailTargets, concurrency, async ({ source, link, listing }, index) => {
    try {
      onProgress?.({ type: "detail-started", message: `상세 공고 ${index + 1}/${totalDetails} 파싱 시작` });
      if (listing && /samsungcareers\.com/i.test(source.url)) {
        const candidate = await fetchSamsungCareerDetail(listing, requestTimeoutMs);
        onProgress?.({ type: "detail-completed", message: `상세 공고 ${index + 1}/${totalDetails} 파싱 완료` });
        return [candidate];
      }
      const result = await collectJobFromPageUrl(link, { timeoutMs: requestTimeoutMs });
      onProgress?.({ type: "detail-completed", message: `상세 공고 ${index + 1}/${totalDetails} 파싱 완료` });
      return listing
        ? result.map((candidate) => ({
            ...candidate,
            source: officialCareerSourceName(source.url) ?? candidate.source,
            title: listing.title ?? candidate.title,
            company: listing.corpName ?? candidate.company,
            location: listing.workingArea ?? candidate.location,
            employmentType: listing.workingType ?? candidate.employmentType,
            experienceLevel:
              /recruit\.cj\.net/i.test(source.url) && listing.recruitType === "B"
                ? "경력"
                : /신입|경력|인턴|experienced/i.test(listing.recruitType ?? "")
                  ? listing.recruitType
                  : candidate.experienceLevel,
            rawPayload: {
              ...(candidate.rawPayload && typeof candidate.rawPayload === "object" ? candidate.rawPayload : {}),
              officialListing: listing
            }
          }))
        : result;
    } catch {
      onProgress?.({ type: "detail-failed", message: `상세 공고 ${index + 1}/${totalDetails} 파싱 실패` });
      return [
        {
          source: "page",
          sourcePostingId: link,
          url: link,
          title: "파싱 실패 공고",
          company: new URL(link).hostname.replace(/^www\./, ""),
          tags: ["parse-failed", source.name],
          rawPayload: {
            source: source.name,
            url: link,
            parser: "search-source"
          }
        } satisfies JobCandidate
      ];
    }
  });

  candidates.push(...detailResults.flat());

  return candidates;
}
