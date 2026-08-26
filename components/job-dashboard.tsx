"use client";

import { useMemo, useState, useTransition } from "react";
import { collectJobs } from "@/app/actions";

export type JobView = {
  id: string; title: string; company: string; source: string; sourcePostingId: string | null;
  url: string | null; location: string | null; experienceLevel: string | null; employmentType: string | null;
  deadline: string | null; collectedAt: string; description: string | null; tags: string[];
};

function dateLabel(value: string | null): string {
  return value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value)) : "마감일 미정";
}

export function JobDashboard({ initialJobs }: { initialJobs: JobView[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const sources = useMemo(() => Array.from(new Set(initialJobs.map((job) => job.source))).sort(), [initialJobs]);
  const jobs = useMemo(() => initialJobs.filter((job) => {
    const haystack = [job.title, job.company, job.location, job.description, ...job.tags].filter(Boolean).join(" ").toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (source === "all" || job.source === source);
  }), [initialJobs, query, source]);

  function runCollection() {
    startTransition(async () => {
      setMessage("수집 중입니다...");
      try { setMessage(await collectJobs()); } catch (error) { setMessage(error instanceof Error ? error.message : "수집에 실패했습니다."); }
    });
  }

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">JOB POSTING COLLECTOR</p><h1>채용 공고 대시보드</h1><p className="subtitle">공식 채용 페이지와 채용 포털에서 수집한 공고를 한 곳에서 확인합니다.</p></div>
      <button className="collect" onClick={runCollection} disabled={isPending}>{isPending ? "수집 중..." : "공고 수집"}</button>
    </header>
    <section className="toolbar" aria-label="공고 필터">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="회사, 직무, 키워드 검색" />
      <select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">모든 수집원</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <strong>{jobs.length}<span>건 표시</span></strong>
    </section>
    {message && <p className="notice" role="status">{message}</p>}
    <section className="grid">{jobs.map((job) => <article className="job" key={job.id}>
      <div className="job-head"><span className="source">{job.source}</span><span className="deadline">{dateLabel(job.deadline)}</span></div>
      <h2>{job.title}</h2><p className="company">{job.company}</p>
      <div className="meta"><span>{job.location || "지역 미정"}</span><span>{job.experienceLevel || "경력 조건 미정"}</span></div>
      <div className="tags">{job.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div>
      {job.url && <a href={job.url} target="_blank" rel="noreferrer">공고 상세 보기 <span>↗</span></a>}
    </article>)}</section>
    {!jobs.length && <div className="empty"><h2>표시할 공고가 없습니다.</h2><p>먼저 공고 수집을 실행하거나 검색 조건을 바꿔보세요.</p></div>}
  </main>;
}
