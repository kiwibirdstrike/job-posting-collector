"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startCollection, updateJobChecked, updateJobStatus } from "@/app/actions";
import { filterJobsByCompanyScale, type CompanyScaleFilter } from "@/lib/jobs/company-scale";
import { filterJobsByExperience, type JobExperienceFilter } from "@/lib/jobs/experience-filter";
import { filterJobsByRegion, jobRegionOptions, type JobRegionFilter } from "@/lib/jobs/location-filter";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/types";

export type JobView = {
  id: string; title: string; company: string; source: string; sourcePostingId: string | null;
  url: string | null; location: string | null; experienceLevel: string | null; employmentType: string | null;
  deadline: string | null; collectedAt: string; description: string | null; tags: string[];
  status: string; checked: boolean;
};

type CollectionRun = {
  id: string;
  status: "running" | "completed" | "failed";
  summary: string | null;
  logs: Array<{ id: string; message: string; at: string }>;
};

function dateLabel(value: string | null): string {
  return value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value)) : "마감일 미정";
}

const statusLabels: Record<string, string> = {
  new: "새 공고", interested: "관심", applying: "지원 예정", applied: "지원 완료",
  interview: "면접", offer: "합격", rejected: "불합격", archived: "보관", ignored: "무시"
};

export function JobDashboard({ initialJobs }: { initialJobs: JobView[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [scale, setScale] = useState<CompanyScaleFilter>("all");
  const [experience, setExperience] = useState<JobExperienceFilter>("all");
  const [region, setRegion] = useState<JobRegionFilter>("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"collected" | "deadline">("collected");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [run, setRun] = useState<CollectionRun | null>(null);
  const router = useRouter();
  const sources = useMemo(() => Array.from(new Set(initialJobs.map((job) => job.source))).sort(), [initialJobs]);
  const regions = useMemo(() => jobRegionOptions(initialJobs), [initialJobs]);
  const jobs = useMemo(() => {
    const searched = initialJobs.filter((job) => {
      const haystack = [job.title, job.company, job.location, job.description, ...job.tags].filter(Boolean).join(" ").toLowerCase();
      return (!query || haystack.includes(query.toLowerCase())) && (source === "all" || job.source === source) &&
        (status === "all" || job.status === status);
    });
    const filtered = filterJobsByCompanyScale(searched, scale);
    const experienced = filterJobsByExperience(filtered, experience);
    const regional = filterJobsByRegion(experienced, region);
    return [...regional].sort((a, b) => sort === "collected"
      ? Date.parse(b.collectedAt) - Date.parse(a.collectedAt)
      : (Date.parse(a.deadline ?? "9999-12-31") - Date.parse(b.deadline ?? "9999-12-31")));
  }, [initialJobs, query, source, scale, experience, region, status, sort]);

  useEffect(() => {
    if (!run?.id || run.status !== "running") return;
    const poll = async () => {
      const response = await fetch(`/api/collection-runs/${run.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const nextRun = await response.json() as CollectionRun;
      setRun(nextRun);
      if (nextRun.status !== "running") {
        setMessage(nextRun.summary ?? "수집이 종료되었습니다.");
        router.refresh();
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 800);
    return () => window.clearInterval(timer);
  }, [run?.id, run?.status, router]);

  function runCollection() {
    startTransition(async () => {
      setMessage("수집 중입니다...");
      try {
        const result = await startCollection();
        setMessage(result.message ?? "수집을 시작했습니다.");
        setRun(result.run as CollectionRun);
      } catch (error) { setMessage(error instanceof Error ? error.message : "수집에 실패했습니다."); }
    });
  }

  function toggleStar(job: JobView) {
    startTransition(async () => { await updateJobChecked(job.id, !job.checked); router.refresh(); });
  }

  function ignoreJob(job: JobView) {
    startTransition(async () => { await updateJobStatus(job.id, "ignored"); router.refresh(); });
  }

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">JOB POSTING COLLECTOR</p><h1>채용 공고 대시보드</h1><p className="subtitle">공식 채용 페이지와 채용 포털에서 수집한 공고를 한 곳에서 확인합니다.</p></div>
      <button className="collect" onClick={runCollection} disabled={isPending}>{isPending ? "수집 중..." : "공고 수집"}</button>
    </header>
    <section className="toolbar" aria-label="공고 필터">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="회사, 직무, 키워드 검색" />
      <select value={scale} onChange={(event) => setScale(event.target.value as CompanyScaleFilter)}><option value="all">기업 규모 전체</option><option value="large-mid">대기업·중견기업</option><option value="public">공공기관·공기업</option><option value="other">기타</option></select>
      <select value={experience} onChange={(event) => setExperience(event.target.value as JobExperienceFilter)}><option value="all">경력 전체</option><option value="entry">신입 가능</option><option value="career">경력직</option><option value="unknown">조건 미확인</option></select>
      <select value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">지역 전체</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">모든 수집원</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">상태 전체</option>{JOB_STATUSES.filter((item) => item !== "ignored").map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select>
      <select value={sort} onChange={(event) => setSort(event.target.value as "collected" | "deadline")}><option value="collected">수집일순</option><option value="deadline">마감일순</option></select>
      <strong>{jobs.length}<span>건 표시</span></strong>
    </section>
    {message && <p className="notice" role="status">{message}</p>}
    {run?.status === "running" && <section className="progress" aria-live="polite">
      <div className="progress-head"><strong>수집 진행 중</strong><span>로그 {run.logs.length}건</span></div>
      <div className="progress-log">{run.logs.slice(-8).map((log) => <p key={log.id}>{log.message}</p>)}</div>
    </section>}
    <section className="grid">{jobs.map((job) => <article className="job" key={job.id}>
      <div className="job-head"><span className="source">{job.source}</span><span className="deadline">{dateLabel(job.deadline)}</span></div>
      <div className="job-title"><button className="star" onClick={() => toggleStar(job)} aria-label={job.checked ? "관심 해제" : "관심 공고로 저장"}>{job.checked ? "★" : "☆"}</button><h2>{job.title}</h2></div><p className="company">{job.company}</p>
      <div className="meta"><span>{job.location || "지역 미정"}</span><span>{job.experienceLevel || "경력 조건 미정"}</span></div>
      <div className="tags">{job.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div>
      <div className="job-actions">{job.url && <a href={job.url} target="_blank" rel="noreferrer">공고 상세 보기 <span>↗</span></a>}<select value={job.status} onChange={(event) => startTransition(async () => { await updateJobStatus(job.id, event.target.value as JobStatus); router.refresh(); })} aria-label="공고 상태"><option value={job.status}>{statusLabels[job.status] ?? job.status}</option>{JOB_STATUSES.filter((item) => item !== job.status).map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select><button className="ignore" onClick={() => ignoreJob(job)}>무시</button></div>
    </article>)}</section>
    {!jobs.length && <div className="empty"><h2>표시할 공고가 없습니다.</h2><p>먼저 공고 수집을 실행하거나 검색 조건을 바꿔보세요.</p></div>}
  </main>;
}
