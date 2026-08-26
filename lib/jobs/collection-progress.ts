export function collectionProgress(messages: string[]): { total: number; finished: number; percent: number } {
  const total = Number(messages.find((message) => /검색 소스 \d+개/.test(message))?.match(/검색 소스 (\d+)개/)?.[1] ?? 0);
  const finishedSources = new Set(
    messages.flatMap((message) => message.match(/^(.+?) 소스 조회 (?:완료|실패)/)?.[1] ?? [])
  );
  const finished = finishedSources.size;
  return { total, finished, percent: total ? Math.min(100, Math.round((finished / total) * 100)) : 0 };
}
