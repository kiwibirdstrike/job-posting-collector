import type { NormalizedJobPosting } from "./types";

export type JobEligibilityDecision = {
  eligible: boolean;
  reason: string | null;
  evidence: string | null;
};

const MIN_ANNUAL_SALARY_MANWON = 4000;
const EARLIEST_AVAILABLE_START = { year: 2026, month: 12 };
const TITLE_FILTERED_CAREER_SOURCES = new Set([
  "toss-careers",
  "cj-careers",
  "sk-careers",
  "posco-careers",
  "lg-careers",
  "line-careers",
  "kakao-careers",
  "kakao-bank-careers",
  "coupang-careers",
  "woowa-careers",
  "hyundai-motor-careers",
  "kia-careers",
  "kb-careers",
  "hanwha-careers",
  "hd-careers",
  "naver-careers",
  "naver-cloud-careers",
  "kt-careers",
  "sgi-careers",
  "shinhan-investment-careers",
  "kcc-careers"
]);

function rawPayloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function compactText(...values: Array<string | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function educationRequirementsFromPayload(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return [];
    }
    try {
      return educationRequirementsFromPayload(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value.flatMap(educationRequirementsFromPayload);
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const direct = ["educationRequirements", "education", "학력정보", "학력"]
    .map((key) => record[key])
    .filter((field): field is string => typeof field === "string");

  return [...direct, ...Object.values(record).flatMap(educationRequirementsFromPayload)];
}

function containsPostdoc(text: string): boolean {
  return /(post[\s-]?doc|포닥|박사\s*후\s*(?:연구원|연수\s*연구원)|박사후\s*(?:연구원|연수\s*연구원)|postdoctoral)/i.test(text);
}

function isAssociateDegreeMinimum(text: string): boolean {
  return (
    /(초대졸|전문대졸|전문\s*대졸|전문학사)\s*(?:이상|↑|부터)/i.test(text) ||
    /(대학졸업|대졸)\s*\(\s*2\s*,\s*3\s*년\s*\)\s*(?:이상|↑|부터)/i.test(text)
  );
}

function isTrainingRecruitment(text: string): boolean {
  return /(?:국비\s*(?:교육|지원|최대\s*무료|무료)?|전액\s*국비|정부\s*지원|국민\s*내일\s*배움|내일\s*배움|KDT|K-?디지털\s*트레이닝|K-?Digital\s*Training|취업\s*연계|취업연계|부트\s*캠프|부트캠프|교육생|훈련생|수강생|교육\s*과정|훈련\s*과정|AI\s*교육|캠프|단기\s*심화|계약\s*학과)/i.test(
    text
  );
}

function isBeforeEarliestAvailableStart(year: number, month: number): boolean {
  return (
    year < EARLIEST_AVAILABLE_START.year ||
    (year === EARLIEST_AVAILABLE_START.year && month < EARLIEST_AVAILABLE_START.month)
  );
}

function hasEarlyRequiredStart(text: string): boolean {
  if (/(즉시|바로)\s*(입사|출근|근무)|(?:채용|합격)\s*즉시\s*(입사|출근|근무)/i.test(text)) {
    return true;
  }

  const dateAfterStartKeyword =
    /(입사(?:예정일|예정|가능일|가능|일)?|출근|근무\s*시작|근무시작)[^,\n\r;]{0,24}?(\d{4})\s*(?:년|[.\-/])\s*(\d{1,2})/gi;
  const dateBeforeStartKeyword =
    /(\d{4})\s*(?:년|[.\-/])\s*(\d{1,2})\s*(?:월)?[^,\n\r;]{0,16}?(입사|출근|근무\s*시작|근무시작)/gi;

  for (const match of text.matchAll(dateAfterStartKeyword)) {
    const year = Number(match[2]);
    const month = Number(match[3]);
    if (isBeforeEarliestAvailableStart(year, month)) {
      return true;
    }
  }
  for (const match of text.matchAll(dateBeforeStartKeyword)) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (isBeforeEarliestAvailableStart(year, month)) {
      return true;
    }
  }
  return false;
}

function shouldApplyCareerRelevance(posting: NormalizedJobPosting): boolean {
  return !["manual", "mock", "wanted"].includes(posting.source);
}

function hasStandaloneLatinToken(text: string, token: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`, "i").test(text);
}

export function hasRelevantCareerSignal(text: string): boolean {
  const hasKoreanOrSpecificSignal =
    /(데이터\s*분석|데이터\s*사이언|데이터\s*엔지니어|데이터\s*플랫폼|데이터\s*거버넌스|데이터\s*마케팅|빅데이터|통계|임상\s*통계|보건\s*통계|품질\s*통계|조사\s*분석|시장\s*조사|리서치|정량\s*분석|수요\s*예측|머신러닝|기계학습|인공지능|딥러닝|CRM\s*분석|마케팅\s*(?:분석|데이터|리서치|인사이트)|고객\s*(?:분석|데이터|인사이트)|사용자\s*분석|유저\s*분석|캠페인\s*(?:성과\s*)?분석|퍼널\s*분석|그로스\s*(?:분석|데이터)|growth\s*(?:analytics?|data|analyst)|퍼포먼스\s*마케팅|AB\s*테스트|A\/B\s*테스트|분석가|애널리스트|생물정보|business\s*intelligence|data\s*science|data\s*scientist|data\s*analyst|data\s*engineer|machine\s*learning|research\s*analyst|statistician|statistics?)/i.test(
      text
    );
  const hasAiOrMlContext =
    (hasStandaloneLatinToken(text, "ai") || hasStandaloneLatinToken(text, "ml")) &&
    /(분석|데이터|머신러닝|기계학습|딥러닝|엔지니어|개발|연구|research|scientist|analyst|engineer|machine\s*learning)/i.test(text);
  const hasBiContext = /\bBI\s*(분석|데이터|개발|엔지니어|engineer|analyst)/i.test(text);

  return hasKoreanOrSpecificSignal || hasAiOrMlContext || hasBiContext;
}

export function isClearlyUnrelatedRole(text: string): boolean {
  return /(제빵|제과|베이커|베이커리|조리|조리사|주방|쉐프|셰프|홀\s*서빙|홀서빙|레스토랑|카페|떡볶이|냉면|한식|중식당|식품\s*소스\s*개발|수술팀|치료팀|간호조무사|전담간호사|피부관리|상담실장|온라인\s*MD|커머스\s*MD|상품\s*MD|콘텐츠\s*마케터|인플루언서|SNS|영상\s*기획|디자이너|2D\s*디자이너|해외\s*영업|영업\s*신입|영업\s*부|소싱|무역|생산직|단순\s*포장|판금|홀\s*신입|주방장|자재\s*(?:&|및)?\s*행정|행정\s*업무\s*담당)/i.test(
    text
  );
}

export function isEntryOpenRecruitment(title: string): boolean {
  return /공채|(?:상반기|하반기|그룹|대졸)\s*신입(?:사원)?(?:\s*수시)?\s*채용|(?:\d{4}년\s*)?신입사원\s*채용|채용\s*연계형\s*인턴|talent\s+hy-way\s+기술사무직\s+신입/i.test(title);
}

export function isOpenRecruitmentListing(title: string): boolean {
  return /공채|공개\s*채용|(?:상반기|하반기|그룹|대졸)\s*신입(?:사원)?(?:\s*수시)?\s*채용|(?:\d{4}년\s*)?신입사원\s*채용|채용\s*연계형\s*인턴|talent\s+hy-way\s+기술사무직\s+신입/i.test(title);
}

function isCareerRelevant(posting: NormalizedJobPosting, text: string): JobEligibilityDecision | null {
  if (!shouldApplyCareerRelevance(posting)) {
    return null;
  }
  const isOfficialCareer = posting.source.endsWith("-careers");
  if (isOfficialCareer && isEntryOpenRecruitment(posting.title)) {
    return null;
  }
  const officialRoleText = compactText(posting.title, ...posting.tags);
  const raw = rawPayloadRecord(posting.rawPayload);
  const listing = rawPayloadRecord(raw.officialListing ?? raw.listing);
  const structuredRoleText = compactText(
    posting.title,
    typeof listing.jobRole === "string" ? listing.jobRole : null,
    typeof listing.RECU_FIELD === "string" ? listing.RECU_FIELD : null
  );
  const hasStructuredRoleSignal =
    hasRelevantCareerSignal(structuredRoleText) ||
    /(?:digital\s+finance\s+researcher|research\s+assistant|\bRA\b|리스크\s*적합성\s*검증|학습\s*기반|talent\s+hy-way\s+기술사무직)/i.test(structuredRoleText);
  if (
    isClearlyUnrelatedRole(officialRoleText) ||
    (TITLE_FILTERED_CAREER_SOURCES.has(posting.source) && !hasStructuredRoleSignal) ||
    (!isOfficialCareer && !hasRelevantCareerSignal(text))
  ) {
    return {
      eligible: false,
      reason: "전공 관련성이 낮은 직무 제외",
      evidence: isClearlyUnrelatedRole(text) ? "unrelated-role-keyword" : "no-data-stat-ai-research-signal"
    };
  }
  return null;
}

export function isExplicitSeniorOnly(text: string): boolean {
  if (/(신입|경력\s*무관|경력무관|신입\s*[·\/&,-]\s*경력)/i.test(text)) {
    return false;
  }
  if (/(?:\[경력\]|\(경력\))|경력직|경력\s*(?:사원|채용)|경력\s*[:：]\s*경력/i.test(text)) {
    return true;
  }

  return text.split(/[\n.!?]/).some((sentence) => {
    const requirement = sentence.split(/(?:◆\s*)?우대\s*사항/i)[0] ?? sentence;
    if (/(우대|선호|좋아요|좋습니다|환영)/i.test(requirement)) return false;
    return /(?:경력|경험)[^\n]{0,30}?\d+\s*(?:~|-|∼|〜)?\s*\d*\s*년[^\n]{0,20}?(?:이상|필수|필요|보유)|\d+\s*년\s*이상(?:의)?[^\n]{0,80}?(?:경력|경험)/i.test(requirement);
  });
}

function isGenericListingLabel(label: string): boolean {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length <= 2) {
    return true;
  }
  return /^(공고|채용|상세|보기|지원|더보기|중복|new|\d+|[a-z])(?:\s|$)/i.test(normalized);
}

export function shouldFetchJobListingLink(label: string, sourceUrl = ""): boolean {
  const searchableText = label.replace(/\s+/g, " ").trim();
  if (/hibrain\.net/i.test(sourceUrl) || isGenericListingLabel(searchableText)) {
    return true;
  }
  if (
    containsPostdoc(searchableText) ||
    isTrainingRecruitment(searchableText) ||
    hasEarlyRequiredStart(searchableText) ||
    isExplicitSeniorOnly(searchableText) ||
    isClearlyUnrelatedRole(searchableText)
  ) {
    return false;
  }
  // 공채는 직무명이 제목에 없을 수 있으므로 상세 페이지에서만 관련성을 판정한다.
  if (isOpenRecruitmentListing(searchableText)) {
    return true;
  }
  return hasRelevantCareerSignal(searchableText);
}

function numberFromKoreanSalary(value: string): number | null {
  const normalized = value.replace(/,/g, "");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function annualSalaryMaxFromText(text: string): number | null {
  const annualMatch = text.match(/(?:연봉|年俸)[^,\n\r]{0,40}?(\d[\d,]*(?:\.\d+)?)\s*(?:~|-|부터|이상)?\s*(\d[\d,]*(?:\.\d+)?)?\s*만?\s*원?/i);
  if (annualMatch) {
    const first = numberFromKoreanSalary(annualMatch[1] ?? "");
    const second = numberFromKoreanSalary(annualMatch[2] ?? "");
    return second ?? first;
  }

  const monthlyMatch = text.match(/월급[^,\n\r]{0,40}?(\d[\d,]*(?:\.\d+)?)\s*(?:~|-|부터|이상)?\s*(\d[\d,]*(?:\.\d+)?)?\s*만?\s*원?/i);
  if (monthlyMatch) {
    const first = numberFromKoreanSalary(monthlyMatch[1] ?? "");
    const second = numberFromKoreanSalary(monthlyMatch[2] ?? "");
    const monthlyMax = second ?? first;
    return monthlyMax === null ? null : monthlyMax * 12;
  }

  return null;
}

function salaryNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value.replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function annualSalaryMaxFromJsonLd(rawPayload: unknown): number | null {
  const raw = rawPayloadRecord(rawPayload);
  const jsonLd = rawPayloadRecord(raw.jsonLd);
  const baseSalary = rawPayloadRecord(jsonLd.baseSalary);
  const value = rawPayloadRecord(baseSalary.value);
  const unitText = typeof value.unitText === "string" ? value.unitText.toUpperCase() : "";
  const maxValue = salaryNumber(value.maxValue) ?? salaryNumber(value.value) ?? salaryNumber(value.minValue);

  if (maxValue === null) {
    return null;
  }
  const salaryInManwon = maxValue >= 10000 ? maxValue / 10000 : maxValue;

  if (unitText.includes("MONTH")) {
    return salaryInManwon * 12;
  }
  if (unitText.includes("YEAR") || unitText === "") {
    return salaryInManwon;
  }
  return null;
}

function explicitAnnualSalaryMax(posting: NormalizedJobPosting): number | null {
  return (
    annualSalaryMaxFromJsonLd(posting.rawPayload) ??
    annualSalaryMaxFromText(compactText(posting.description, posting.title))
  );
}

export function evaluateJobEligibility(posting: NormalizedJobPosting): JobEligibilityDecision {
  const entryOpenRecruitment = isEntryOpenRecruitment(posting.title);
  const searchableText = compactText(
    posting.title,
    posting.company,
    posting.experienceLevel,
    posting.employmentType,
    posting.description,
    ...educationRequirementsFromPayload(posting.rawPayload)
  );

  if (containsPostdoc(searchableText)) {
    return {
      eligible: false,
      reason: "박사후연구원/포닥 공고 제외",
      evidence: "postdoc-keyword"
    };
  }

  if (isTrainingRecruitment(searchableText)) {
    return {
      eligible: false,
      reason: "국비교육/교육생 모집 제외",
      evidence: "training-recruitment"
    };
  }

  if (!entryOpenRecruitment && isAssociateDegreeMinimum(searchableText)) {
    return {
      eligible: false,
      reason: "초대졸 이상 공고 제외",
      evidence: "associate-degree-minimum"
    };
  }

  if (!entryOpenRecruitment && hasEarlyRequiredStart(searchableText)) {
    return {
      eligible: false,
      reason: "2026년 12월 이전 입사 공고 제외",
      evidence: "start-before-2026-12"
    };
  }

  const relevanceDecision = isCareerRelevant(posting, searchableText);
  if (relevanceDecision) {
    return relevanceDecision;
  }

  if (
    !isEntryOpenRecruitment(posting.title) &&
    ( /\b(?:sr\.?|senior|staff|principal|director|head|team\s*lead(?:er)?)\b|시니어|팀장급/i.test(posting.title) ||
      Boolean(posting.experienceLevel && /경력|experienced/i.test(posting.experienceLevel) && !/신입|무관/i.test(posting.experienceLevel)) ||
      isExplicitSeniorOnly(searchableText) )
  ) {
    return {
      eligible: false,
      reason: "명시 경력직 공고 제외",
      evidence: posting.experienceLevel ?? "career-years"
    };
  }

  const salaryMax = explicitAnnualSalaryMax(posting);
  if (salaryMax !== null && salaryMax <= MIN_ANNUAL_SALARY_MANWON) {
    return {
      eligible: false,
      reason: "명시 연봉 4000만원 이하 공고 제외",
      evidence: `${Math.round(salaryMax)}만원`
    };
  }

  return {
    eligible: true,
    reason: null,
    evidence: salaryMax === null ? "salary-not-disclosed" : `${Math.round(salaryMax)}만원`
  };
}
