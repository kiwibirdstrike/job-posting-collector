import type { JobCandidate } from "@/lib/jobs/types";

type ParseJobPostingPageOptions = {
  html: string;
  url: string;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonRecord = Record<string, JsonValue>;
type ParseDiagnostics = {
  hasJobPostingJsonLd: boolean;
  hasMetaDescription: boolean;
  fieldSources: Record<string, string>;
  missingFields: string[];
  missingReasons: Record<string, string>;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? stripTags(value) : null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = cleanText(value);
    if (text) {
      return text;
    }
  }
  return null;
}

function recordValue(value: JsonValue | undefined): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function arrayValue(value: JsonValue | undefined): JsonValue[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function findMetaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta\\s+[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  return cleanText(pattern.exec(html)?.[1]);
}

function findTitle(html: string): string | null {
  return cleanText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]);
}

function normalizeUrl(href: string, sourceUrl: string): string | null {
  try {
    const url = new URL(decodeHtmlEntities(href), sourceUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function findCompanyCareerUrl(html: string, sourceUrl: string): string | null {
  const sourceHostname = hostnameFromUrl(sourceUrl);
  const anchors = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

  for (const anchor of anchors) {
    const label = stripTags(anchor[2] ?? "");
    const href = normalizeUrl(anchor[1] ?? "", sourceUrl);
    if (!href) {
      continue;
    }
    const hrefHostname = hostnameFromUrl(href);
    const looksLikeCareerLink = /(회사\s*)?(채용|지원|career|recruit|apply|입사)/i.test(label);
    const isExternal = hrefHostname !== sourceHostname && !isSamePlatformHost(sourceHostname, hrefHostname);

    if (looksLikeCareerLink && isExternal) {
      return href;
    }
  }

  return null;
}

function isSamePlatformHost(sourceHostname: string, hrefHostname: string): boolean {
  const platformDomains = ["saramin.co.kr", "jobkorea.co.kr", "hibrain.net"];
  const sourcePlatform = platformDomains.find(
    (domain) => sourceHostname === domain || sourceHostname.endsWith(`.${domain}`)
  );
  return Boolean(
    sourcePlatform && (hrefHostname === sourcePlatform || hrefHostname.endsWith(`.${sourcePlatform}`))
  );
}

function homepageUrlFromDescription(description: string | null): string | null {
  const raw = fieldFromDescription(description, "홈페이지");
  if (!raw) {
    return null;
  }
  const match = raw.match(/(?:https?:\/\/)?[^\s,]+/i);
  if (!match) {
    return null;
  }
  const url = match[0];
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function parseJsonLdBlocks(html: string): JsonRecord[] {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  return blocks.flatMap((match) => {
    try {
      const parsed = JSON.parse(match[1] ?? "") as JsonValue;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      return values.flatMap((value) => {
        const record = recordValue(value);
        const graph = recordValue(value)?.["@graph"];
        if (Array.isArray(graph)) {
          return graph.filter((item): item is JsonRecord => Boolean(recordValue(item)));
        }
        return record ? [record] : [];
      });
    } catch {
      return [];
    }
  });
}

function typeMatches(record: JsonRecord, typeName: string): boolean {
  const type = record["@type"];
  return arrayValue(type).some(
    (value) => typeof value === "string" && value.toLowerCase() === typeName.toLowerCase()
  );
}

function findJobPostingJsonLd(html: string): JsonRecord | null {
  return parseJsonLdBlocks(html).find((record) => typeMatches(record, "JobPosting")) ?? null;
}

function organizationName(value: JsonValue | undefined): string | null {
  const record = recordValue(value);
  return firstText(record?.name, value);
}

function locationName(value: JsonValue | undefined): string | null {
  const location = recordValue(arrayValue(value)[0]);
  const address = recordValue(location?.address);
  return [address?.streetAddress, address?.addressLocality, address?.addressRegion, address?.addressCountry]
    .map(cleanText)
    .filter(Boolean)
    .join(", ") || firstText(location?.name, value);
}

function employmentTypeName(value: JsonValue | undefined): string | null {
  const mapped = arrayValue(value)
    .map((item) => {
      const text = cleanText(item);
      if (!text) {
        return null;
      }
      const normalized = text.toUpperCase();
      const labels: Record<string, string> = {
        FULL_TIME: "정규직",
        PART_TIME: "파트타임",
        CONTRACTOR: "계약직",
        TEMPORARY: "임시직",
        INTERN: "인턴",
        VOLUNTEER: "자원봉사",
        PER_DIEM: "일용직",
        OTHER: "기타"
      };
      return labels[normalized] ?? text;
    })
    .filter(Boolean);
  return mapped.length > 0 ? Array.from(new Set(mapped)).join(", ") : null;
}

function hostnameFromUrl(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function pageIdFromUrl(value: string): string | null {
  try {
    return new URL(value).href;
  } catch {
    return null;
  }
}

function canonicalJobkoreaUrl(url: string): { id: string; url: string } | null {
  const match = url.match(/jobkorea\.co\.kr\/Recruit\/GI_Read\/(\d+)/i);
  return match?.[1]
    ? {
        id: match[1],
        url: `https://www.jobkorea.co.kr/Recruit/GI_Read/${match[1]}`
      }
    : null;
}

function canonicalSaraminUrl(url: string): { id: string; url: string } | null {
  const match = url.match(/rec_idx=(\d+)/i);
  return match?.[1]
    ? {
        id: match[1],
        url: `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${match[1]}`
      }
    : null;
}

function canonicalHibrainUrl(url: string): { id: string; url: string } | null {
  const match = url.match(/hibrain\.net\/recruitment\/recruits\/(\d+)/i);
  return match?.[1]
    ? {
        id: match[1],
        url: `https://www.hibrain.net/recruitment/recruits/${match[1]}`
      }
    : null;
}

function canonicalJobAlioUrl(url: string): { id: string; url: string } | null {
  const match = url.match(/job\.alio\.go\.kr\/recruitview\.do\?[^#]*idx=(\d+)/i);
  return match?.[1]
    ? {
        id: match[1],
        url: `https://job.alio.go.kr/recruitview.do?idx=${match[1]}`
      }
    : null;
}

function findEscapedJsonText(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`"${escaped}"\\s*:\\s*"([^"]+)"`, "i"),
    new RegExp(`\\\\?"${escaped}\\\\?"\\s*:\\s*\\\\?"([^"\\\\]+)\\\\?"`, "i")
  ];

  for (const pattern of patterns) {
    const text = cleanText(pattern.exec(html)?.[1]);
    if (text) {
      return text;
    }
  }
  return null;
}

function metaDescription(html: string): string | null {
  return firstText(findMetaContent(html, "description"), findMetaContent(html, "og:description"));
}

function dateFromKoreanDotDate(value: string | null): string | null {
  const match = value?.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function dateFromDashDate(value: string | null): string | null {
  const match = value?.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function dateFromAnyDate(value: string | null): string | null {
  return dateFromDashDate(value) ?? dateFromKoreanDotDate(value);
}

function hibrainApplicationDeadline(html: string): string | null {
  const text = stripTags(html);
  const match = text.match(
    /접수기간\s*:\s*\d{4}\.\d{1,2}\.\d{1,2}\s+\d{1,2}:\d{2}\s*~\s*(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})/
  );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00+09:00`;
}

function fieldFromTable(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rowMatch = html.match(
    new RegExp(`<tr[^>]*>[\\s\\S]*?<th[^>]*>\\s*${escaped}\\s*<\\/th>[\\s\\S]*?<td[^>]*>([\\s\\S]*?)<\\/td>[\\s\\S]*?<\\/tr>`, "i")
  );
  return cleanText(rowMatch?.[1]);
}

function visibleRows(html: string): string[] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => stripTags(match[1] ?? ""))
    .filter(Boolean);
}

function fieldFromVisibleRows(html: string, label: string): string | null {
  const stopLabels = [
    "표준직무\\(NCS\\)",
    "학력정보",
    "근무분야",
    "채용구분",
    "고용형태",
    "대체인력여부",
    "근무지",
    "급여정보",
    "채용인원",
    "우대조건",
    "채용기간",
    "등록일"
  ];
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s+(.+?)(?=\\s+(?:${stopLabels.join("|")})\\s|$)`);
  for (const row of visibleRows(html)) {
    const value = cleanText(row.match(pattern)?.[1]);
    if (value) {
      return value;
    }
  }
  return null;
}

function firstTableField(html: string, labels: string[]): string | null {
  for (const label of labels) {
    const value = fieldFromTable(html, label) ?? fieldFromVisibleRows(html, label);
    if (value) {
      return value;
    }
  }
  return null;
}

function firstHeadingText(html: string): string | null {
  const heading = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  return cleanText(heading?.[1]);
}

function htmlBlockByClass(html: string, className: string): string | null {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(`<([a-z0-9]+)[^>]*class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "i")
  );
  return match?.[2] ?? null;
}

function htmlBlockById(html: string, id: string): string | null {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<([a-z0-9]+)[^>]*id=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "i"));
  return match?.[2] ?? null;
}

function jobAlioTitle(html: string): string | null {
  const titleAttribute = html.match(/<p[^>]*class=["'][^"']*\btitleH2\b[^"']*["'][^>]*title=["']([^"']+)["'][^>]*>/i);
  const titleText = html.match(/<p[^>]*class=["'][^"']*\btitleH2\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
  return firstText(titleAttribute?.[1], titleText?.[1]);
}

function jobAlioDescription(html: string): string | null {
  const detail = htmlBlockByClass(html, "detailTxt");
  const mainDetail = htmlBlockById(html, "tab-1");
  return firstText([detail, mainDetail].filter(Boolean).map((block) => stripTags(block ?? "")).join(" "));
}

function dateRangeFromText(value: string | null): { start: string | null; end: string | null } {
  const dates = [...(value ?? "").matchAll(/(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})/g)].map((match) => {
    const year = match[1].length === 2 ? `20${match[1]}` : match[1];
    return `${year}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  });
  return {
    start: dates[0] ?? null,
    end: dates[1] ?? dates[0] ?? null
  };
}

function fieldFromDescription(description: string | null, label: string): string | null {
  const match = description?.match(new RegExp(`${label}\\s*:\\s*([^,]+)`, "i"));
  return cleanText(match?.[1]);
}

function firstDescriptionField(description: string | null, labels: string[]): string | null {
  for (const label of labels) {
    const value = fieldFromDescription(description, label);
    if (value) {
      return value;
    }
  }
  return null;
}

function sourceFor(value: string | null, source: string): string | null {
  return value ? source : null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function graduateEducationTagsFromText(...values: Array<string | null | undefined>): string[] {
  const text = values.filter(Boolean).join(" ");
  const tags: string[] = [];
  const hasMasterEligible =
    /(석사|박사|대학원|master|graduate)/i.test(text) &&
    /(학력\s*정보|학력정보|지원\s*자격|지원자격|응시\s*자격|응시자격|자격\s*요건|자격요건|석사\s*(?:이상|학위|졸업|수료)|박사\s*(?:이상|학위|졸업|수료)|master'?s?\s*(?:degree|required|eligible))/i.test(text);
  const hasMasterPreference =
    /(?:석사|박사|대학원|master|graduate)[^.\n\r,;]{0,40}(?:우대|가점|우선|preferred)|(?:우대|가점|우선|preferred)[^.\n\r,;]{0,40}(?:석사|박사|대학원|master|graduate)/i.test(
      text
    );

  if (hasMasterEligible) {
    tags.push("석사이상 지원가능");
  }
  if (hasMasterPreference) {
    tags.push("석사 우대");
  }
  return tags;
}

function decodeJsonStringLiteral(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return value;
  }
}

function scaleTagsFromText(value: string | null): string[] {
  if (!value) {
    return [];
  }
  const decoded = decodeJsonStringLiteral(value);
  const tags: string[] = [];
  if (/대기업/.test(decoded)) {
    tags.push("대기업");
  }
  if (/중견기업/.test(decoded)) {
    tags.push("중견기업");
  }
  if (/중소기업/.test(decoded)) {
    tags.push("중소기업");
  }
  if (/스타트업/.test(decoded)) {
    tags.push("스타트업");
  }
  return uniqueStrings(tags);
}

function companyScaleTagsFromJobkoreaHtml(html: string): string[] {
  const plainText = stripTags(html);
  const companyInfoMatch = plainText.match(/기업구분\s*([^🏢⭐📜💵🧳🌃🧧\n]{0,80})/);
  const chipMatches = [...plainText.matchAll(/(?:^|\s)(대기업|중견기업|중소기업|스타트업)(?:\s|$|\()/g)].map(
    (match) => match[1] ?? ""
  );
  return uniqueStrings([...scaleTagsFromText(companyInfoMatch?.[1] ?? null), ...chipMatches.flatMap(scaleTagsFromText)]);
}

function companyScaleTagsFromSaraminHtml(html: string, postingId: string): string[] {
  const escapedPostingId = postingId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const objectPatterns = [
    new RegExp(`\\{[^{}]*"rec_idx"\\s*:\\s*"${escapedPostingId}"[^{}]*\\}`, "g"),
    new RegExp(`\\{[^{}]*\\\\"rec_idx\\\\"\\s*:\\s*\\\\"${escapedPostingId}\\\\"[^{}]*\\}`, "g")
  ];
  const objects = objectPatterns.flatMap((pattern) => [...html.matchAll(pattern)].map((match) => match[0]));
  const values = objects.flatMap((candidate) => [
    ...[...candidate.matchAll(/"scale"\s*:\s*"([^"]+)"/g)].map((match) => match[1] ?? ""),
    ...[...candidate.matchAll(/\\"scale\\"\s*:\s*\\"([^"\\]+)\\"/g)].map((match) => match[1] ?? ""),
    ...[...candidate.matchAll(/"display_rec_tag"\s*:\s*"([^"]+)"/g)].map((match) => match[1] ?? ""),
    ...[...candidate.matchAll(/\\"display_rec_tag\\"\s*:\s*\\"([^"\\]+)\\"/g)].map((match) => match[1] ?? "")
  ]);

  return uniqueStrings(values.flatMap(scaleTagsFromText));
}

function buildParseDiagnostics({
  jsonLd,
  description,
  fieldSources,
  trackedFields
}: {
  jsonLd: JsonRecord | null;
  description: string | null;
  fieldSources: Record<string, string | null>;
  trackedFields: string[];
}): ParseDiagnostics {
  const cleanFieldSources = Object.fromEntries(
    Object.entries(fieldSources).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
  const missingFields = trackedFields.filter((field) => !cleanFieldSources[field]);

  return {
    hasJobPostingJsonLd: Boolean(jsonLd),
    hasMetaDescription: Boolean(description),
    fieldSources: cleanFieldSources,
    missingFields,
    missingReasons: Object.fromEntries(
      missingFields.map((field) => [field, "not-found-in-supported-source"])
    )
  };
}

function detailFieldNames(): string[] {
  return ["location", "employmentType", "experienceLevel", "deadline", "postedAt"];
}

function cleanJobkoreaTitle(title: string | null, company: string | null): string | null {
  if (!title) {
    return null;
  }
  let cleaned = title.replace(/\s*\|\s*잡코리아\s*$/i, "").trim();
  if (company) {
    cleaned = cleaned
      .replace(new RegExp(`^${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*채용\\s*-\\s*`), "")
      .replace(new RegExp(`^${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-\\s*`), "");
  }
  return cleanText(cleaned);
}

function cleanSaraminTitle(title: string | null, company: string | null): string | null {
  if (!title) {
    return null;
  }
  let cleaned = title
    .replace(/\s*[-|]\s*사람인\s*$/i, "")
    .replace(/\(D-\d+\)\s*$/i, "")
    .trim();
  if (company) {
    const escapedCompany = company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned
      .replace(new RegExp(`^${escapedCompany}\\s*채용\\s*-\\s*`), "")
      .replace(new RegExp(`^\\[${escapedCompany}\\]\\s*`), "");
  }
  return cleanText(cleaned);
}

function parseJobkoreaPage(html: string, url: string): JobCandidate | null {
  const canonical = canonicalJobkoreaUrl(url);
  if (!canonical) {
    return null;
  }
  const jsonLd = findJobPostingJsonLd(html);
  const description = metaDescription(html);
  const rawTitle = firstText(findMetaContent(html, "og:title"), findTitle(html));
  const company = firstText(organizationName(jsonLd?.hiringOrganization), findEscapedJsonText(html, "companyName"), rawTitle?.split(" 채용")[0]);
  const companyCareerUrl = homepageUrlFromDescription(description) ?? findCompanyCareerUrl(html, url);
  const locationFromDescription = firstDescriptionField(description, ["지역", "근무지역", "근무지"]);
  const locationFromJsonLd = locationName(jsonLd?.jobLocation);
  const employmentTypeFromDescription = firstDescriptionField(description, ["근무형태", "고용형태"]);
  const employmentTypeFromJsonLd = employmentTypeName(jsonLd?.employmentType);
  const experienceFromDescription = fieldFromDescription(description, "경력");
  const experienceFromJsonLd = firstText(jsonLd?.experienceRequirements, jsonLd?.qualifications);
  const deadlineFromDescription = dateFromKoreanDotDate(fieldFromDescription(description, "마감일"));
  const deadlineFromJsonLd = firstText(jsonLd?.validThrough);
  const postedAt = firstText(jsonLd?.datePosted);
  const parsedDescription = firstText(jsonLd?.description, description);
  const companyScaleTags = companyScaleTagsFromJobkoreaHtml(html);
  const graduateTags = graduateEducationTagsFromText(rawTitle, description, parsedDescription, experienceFromDescription, experienceFromJsonLd);

  return {
    source: "jobkorea",
    sourcePostingId: canonical.id,
    url: canonical.url,
    title: cleanJobkoreaTitle(rawTitle, company) ?? rawTitle ?? "제목 미확인 공고",
    company: company ?? "잡코리아",
    location: locationFromDescription ?? locationFromJsonLd,
    employmentType: employmentTypeFromDescription ?? employmentTypeFromJsonLd,
    experienceLevel: experienceFromDescription ?? experienceFromJsonLd,
    deadline: deadlineFromDescription ?? deadlineFromJsonLd,
    postedAt,
    description: parsedDescription,
    tags: uniqueStrings(["jobkorea", "url-parsed", ...companyScaleTags, ...graduateTags]),
    rawPayload: {
      parser: "jobkorea-html",
      ...(companyCareerUrl ? { companyCareerUrl } : {}),
      ...(companyScaleTags.length > 0 ? { companyScaleTags } : {}),
      jsonLd,
      parseDiagnostics: buildParseDiagnostics({
        jsonLd,
        description,
        trackedFields: detailFieldNames(),
        fieldSources: {
          location: sourceFor(locationFromDescription, "meta.description:지역/근무지역/근무지") ?? sourceFor(locationFromJsonLd, "jsonLd.jobLocation"),
          employmentType: sourceFor(employmentTypeFromDescription, "meta.description:근무형태/고용형태") ?? sourceFor(employmentTypeFromJsonLd, "jsonLd.employmentType"),
          experienceLevel: sourceFor(experienceFromDescription, "meta.description:경력") ?? sourceFor(experienceFromJsonLd, "jsonLd.experienceRequirements"),
          deadline: sourceFor(deadlineFromDescription, "meta.description:마감일") ?? sourceFor(deadlineFromJsonLd, "jsonLd.validThrough"),
          postedAt: sourceFor(postedAt, "jsonLd.datePosted")
        }
      }),
      url: canonical.url
    }
  };
}

function parseSaraminPage(html: string, url: string): JobCandidate | null {
  const canonical = canonicalSaraminUrl(url);
  if (!canonical) {
    return null;
  }
  const jsonLd = findJobPostingJsonLd(html);
  const description = metaDescription(html);
  const rawTitle = firstText(findMetaContent(html, "og:title"), findTitle(html));
  const companyFromTitle = rawTitle?.match(/^\[([^\]]+)\]/)?.[1] ?? rawTitle?.split(" 채용")[0];
  const company = firstText(organizationName(jsonLd?.hiringOrganization), description?.split(",")[0], companyFromTitle, findEscapedJsonText(html, "company_nm"));
  const companyCareerUrl = homepageUrlFromDescription(description) ?? findCompanyCareerUrl(html, url);
  const locationFromDescription = firstDescriptionField(description, ["지역", "근무지역", "근무지"]);
  const locationFromJsonLd = locationName(jsonLd?.jobLocation);
  const employmentTypeFromDescription = firstDescriptionField(description, ["근무형태", "고용형태"]);
  const employmentTypeFromJsonLd = employmentTypeName(jsonLd?.employmentType);
  const experienceFromDescription = fieldFromDescription(description, "경력");
  const experienceFromJsonLd = firstText(jsonLd?.experienceRequirements, jsonLd?.qualifications);
  const deadlineFromDescription = dateFromAnyDate(fieldFromDescription(description, "마감일"));
  const deadlineFromJsonLd = firstText(jsonLd?.validThrough);
  const postedAt = firstText(jsonLd?.datePosted);
  const parsedDescription = firstText(jsonLd?.description, description);
  const companyScaleTags = companyScaleTagsFromSaraminHtml(html, canonical.id);
  const graduateTags = graduateEducationTagsFromText(rawTitle, description, parsedDescription, experienceFromDescription, experienceFromJsonLd);

  return {
    source: "saramin-page",
    sourcePostingId: canonical.id,
    url: canonical.url,
    title: cleanSaraminTitle(rawTitle, company) ?? rawTitle ?? "제목 미확인 공고",
    company: company ?? "사람인",
    location: locationFromDescription ?? locationFromJsonLd,
    employmentType: employmentTypeFromDescription ?? employmentTypeFromJsonLd,
    experienceLevel: experienceFromDescription ?? experienceFromJsonLd,
    deadline: deadlineFromDescription ?? deadlineFromJsonLd,
    postedAt,
    description: parsedDescription,
    tags: uniqueStrings(["saramin", "url-parsed", ...companyScaleTags, ...graduateTags]),
    rawPayload: {
      parser: "saramin-html",
      ...(companyCareerUrl ? { companyCareerUrl } : {}),
      ...(companyScaleTags.length > 0 ? { companyScaleTags } : {}),
      jsonLd,
      parseDiagnostics: buildParseDiagnostics({
        jsonLd,
        description,
        trackedFields: detailFieldNames(),
        fieldSources: {
          location: sourceFor(locationFromDescription, "meta.description:지역/근무지역/근무지") ?? sourceFor(locationFromJsonLd, "jsonLd.jobLocation"),
          employmentType: sourceFor(employmentTypeFromDescription, "meta.description:근무형태/고용형태") ?? sourceFor(employmentTypeFromJsonLd, "jsonLd.employmentType"),
          experienceLevel: sourceFor(experienceFromDescription, "meta.description:경력") ?? sourceFor(experienceFromJsonLd, "jsonLd.experienceRequirements"),
          deadline: sourceFor(deadlineFromDescription, "meta.description:마감일") ?? sourceFor(deadlineFromJsonLd, "jsonLd.validThrough"),
          postedAt: sourceFor(postedAt, "jsonLd.datePosted")
        }
      }),
      url: canonical.url
    }
  };
}

function parseHibrainPage(html: string, url: string): JobCandidate | null {
  const canonical = canonicalHibrainUrl(url);
  if (!canonical) {
    return null;
  }
  const jsonLd = findJobPostingJsonLd(html);
  const rawTitle = firstText(jsonLd?.title, findMetaContent(html, "og:title"), findTitle(html));
  const title = cleanText(rawTitle?.replace(/\s*-\s*고급두뇌를 위한 하이브레인넷\(hibrain\.net\)\s*$/i, ""));
  const companyCareerUrl = findCompanyCareerUrl(html, url);
  const location = locationName(jsonLd?.jobLocation);
  const employmentType = employmentTypeName(jsonLd?.employmentType);
  const experienceLevel = firstText(jsonLd?.experienceRequirements, jsonLd?.qualifications);
  const deadline = firstText(jsonLd?.validThrough) ?? hibrainApplicationDeadline(html);
  const postedAt = firstText(jsonLd?.datePosted);
  const description = firstText(jsonLd?.description, metaDescription(html));
  const graduateTags = graduateEducationTagsFromText(rawTitle, description, experienceLevel);

  return {
    source: "hibrain",
    sourcePostingId: canonical.id,
    url: canonical.url,
    title: title ?? rawTitle ?? "제목 미확인 공고",
    company: firstText(organizationName(jsonLd?.hiringOrganization), findMetaContent(html, "og:site_name")) ?? "하이브레인넷",
    location,
    employmentType,
    experienceLevel,
    deadline,
    postedAt,
    description,
    tags: uniqueStrings(["hibrain", "url-parsed", ...graduateTags]),
    rawPayload: {
      parser: "hibrain-html",
      ...(companyCareerUrl ? { companyCareerUrl } : {}),
      jsonLd,
      parseDiagnostics: buildParseDiagnostics({
        jsonLd,
        description: metaDescription(html),
        trackedFields: detailFieldNames(),
        fieldSources: {
          location: sourceFor(location, "jsonLd.jobLocation"),
          employmentType: sourceFor(employmentType, "jsonLd.employmentType"),
          experienceLevel: sourceFor(experienceLevel, "jsonLd.experienceRequirements"),
          deadline: sourceFor(firstText(jsonLd?.validThrough), "jsonLd.validThrough") ?? sourceFor(deadline, "visible:접수기간"),
          postedAt: sourceFor(postedAt, "jsonLd.datePosted")
        }
      }),
      url: canonical.url
    }
  };
}

function parseJobAlioPage(html: string, url: string): JobCandidate | null {
  const canonical = canonicalJobAlioUrl(url);
  if (!canonical) {
    return null;
  }
  const jsonLd = findJobPostingJsonLd(html);
  const headings = [...html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map((match) => cleanText(match[1]))
    .filter((heading): heading is string => Boolean(heading));
  const ignoredHeadingPattern =
    /건너뛰기영역|전자정부|홈페이지 주메뉴|공공기관 채용정보|에서 진행중인 채용공고|응시자격|결격사유|우대내용|전형절차\/방법/i;
  const company =
    firstTableField(html, ["기관명", "기관"]) ??
    headings.find((heading) => !ignoredHeadingPattern.test(heading));
  const headingTitle = headings.find(
    (heading) =>
      !ignoredHeadingPattern.test(heading) &&
      heading !== company
  );
  const title = firstText(jobAlioTitle(html), headingTitle, findMetaContent(html, "og:title"), metaDescription(html));
  const location = firstTableField(html, ["근무지", "근무지역", "지역"]);
  const employmentType = firstTableField(html, ["고용형태", "근무형태"]);
  const education = firstTableField(html, ["학력정보", "학력"]);
  const experienceLevel = firstTableField(html, ["채용구분", "응시자격", "자격요건", "지원자격"]);
  const period = firstTableField(html, ["공고기간", "접수기간", "채용기간"]);
  const postedAt = firstTableField(html, ["등록일"]);
  const dates = dateRangeFromText(period);
  const description = jobAlioDescription(html) ?? stripTags(html);
  const graduateTags = graduateEducationTagsFromText(education, description);

  return {
    source: "job-alio",
    sourcePostingId: canonical.id,
    url: canonical.url,
    title: title ?? (company ? `${company} 채용공고` : "제목 미확인 공고"),
    company: company ?? "잡알리오",
    location,
    employmentType,
    experienceLevel,
    deadline: dates.end,
    postedAt: dateFromAnyDate(postedAt) ?? dates.start,
    description,
    tags: uniqueStrings(["job-alio", "url-parsed", "공공기관", ...graduateTags]),
    rawPayload: {
      parser: "job-alio-html",
      jsonLd,
      parseDiagnostics: buildParseDiagnostics({
        jsonLd,
        description: metaDescription(html),
        trackedFields: detailFieldNames(),
        fieldSources: {
          location: sourceFor(location, "visible-table:근무지/근무지역/지역"),
          employmentType: sourceFor(employmentType, "visible-table:고용형태/근무형태"),
          experienceLevel: sourceFor(experienceLevel, "visible-table:응시자격/자격요건/지원자격"),
          deadline: sourceFor(dates.end, "visible-table:공고기간/접수기간"),
          postedAt: sourceFor(dates.start, "visible-table:공고기간/접수기간")
        }
      }),
      url: canonical.url
    }
  };
}

export function parseJobPostingPage({ html, url }: ParseJobPostingPageOptions): JobCandidate {
  const siteSpecific =
    parseJobkoreaPage(html, url) ?? parseSaraminPage(html, url) ?? parseHibrainPage(html, url) ?? parseJobAlioPage(html, url);
  if (siteSpecific) {
    return siteSpecific;
  }

  const jsonLd = findJobPostingJsonLd(html);
  const title = firstText(
    jsonLd?.title,
    findMetaContent(html, "og:title"),
    findMetaContent(html, "twitter:title"),
    findTitle(html)
  );
  const company = firstText(
    organizationName(jsonLd?.hiringOrganization),
    findMetaContent(html, "og:site_name"),
    hostnameFromUrl(url)
  );
  const companyCareerUrl = findCompanyCareerUrl(html, url);
  const location = locationName(jsonLd?.jobLocation);
  const employmentType = employmentTypeName(jsonLd?.employmentType);
  const experienceLevel = firstText(jsonLd?.experienceRequirements, jsonLd?.qualifications);
  const deadline = firstText(jsonLd?.validThrough);
  const postedAt = firstText(jsonLd?.datePosted);
  const description = firstText(
    jsonLd?.description,
    findMetaContent(html, "description"),
    findMetaContent(html, "og:description")
  );
  const graduateTags = graduateEducationTagsFromText(title, description, experienceLevel);

  return {
    source: "page",
    sourcePostingId: pageIdFromUrl(url),
    url,
    title: title ?? "제목 미확인 공고",
    company: company ?? hostnameFromUrl(url),
    location,
    employmentType,
    experienceLevel,
    deadline,
    postedAt,
    description,
    tags: uniqueStrings(["url-parsed", ...graduateTags]),
    rawPayload: {
      parser: "generic-html",
      ...(companyCareerUrl ? { companyCareerUrl } : {}),
      jsonLd,
      parseDiagnostics: buildParseDiagnostics({
        jsonLd,
        description: metaDescription(html),
        trackedFields: detailFieldNames(),
        fieldSources: {
          location: sourceFor(location, "jsonLd.jobLocation"),
          employmentType: sourceFor(employmentType, "jsonLd.employmentType"),
          experienceLevel: sourceFor(experienceLevel, "jsonLd.experienceRequirements"),
          deadline: sourceFor(deadline, "jsonLd.validThrough"),
          postedAt: sourceFor(postedAt, "jsonLd.datePosted")
        }
      }),
      url
    }
  };
}

export async function collectJobFromPageUrl(
  url: string,
  options: { timeoutMs?: number } = {}
): Promise<JobCandidate[]> {
  const origin = new URL(url).origin;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
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
    throw new Error(`공고 페이지를 가져오지 못했습니다: ${response.status}`);
  }

  const html = await response.text();
  return [parseJobPostingPage({ html, url })];
}
