import { describe, expect, it } from "vitest";
import { collectionProgress } from "@/lib/jobs/collection-progress";

describe("collectionProgress", () => {
  it("counts completed and failed sources against the prepared source total", () => {
    const progress = collectionProgress([
      "검색 소스 10개 조회를 준비했습니다.",
      "official-lg 소스 조회 완료: 91개 공고",
      "official-sgi 소스 조회 실패",
      "official-kt 소스 조회 시작"
    ]);

    expect(progress).toEqual({ total: 10, finished: 2, percent: 20 });
  });

  it("does not count detail parsing logs as completed sources", () => {
    const progress = collectionProgress([
      "검색 소스 4개 조회를 준비했습니다.",
      "official-lg 소스 조회 완료: 91개 공고",
      "상세 파싱 후보 50개를 확인했습니다."
    ]);

    expect(progress).toEqual({ total: 4, finished: 1, percent: 25 });
  });
});
