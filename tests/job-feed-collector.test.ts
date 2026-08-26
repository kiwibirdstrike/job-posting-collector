import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildKeywordSearchSources,
  collectJobsFromSearchSources,
  DEFAULT_JOB_SEARCH_SOURCES,
  extractJobPageLinks,
  JOB_SEARCH_KEYWORDS,
  parseCjCareerListings,
  parseCoupangCareerListings,
  parseHanwhaCareerListings,
  parseHdCareerListings,
  parseHkmcCareerListings,
  parseKakaoCareerListings,
  parseKakaoBankCareerListings,
  parseKtCareerListings,
  parseKbCareerListings,
  parseLineCareerListings,
  parseLgCareerDetail,
  parseLgCareerListings,
  parsePoscoCareerListings,
  parseNaverCareerListings,
  parseSamsungCareerDetail,
  parseSamsungCareerListing,
  parseTossCareerJobGroups,
  parseWoowaCareerListings
} from "@/lib/jobs/collectors/feed";
import { shouldFetchJobListingLink } from "@/lib/jobs/eligibility";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

describe("job feed collector", () => {
  it("builds broad statistical and analytics search sources for Saramin and JobKorea", () => {
    const sources = buildKeywordSearchSources(["통계 분석", "Data Scientist"]);

    expect(sources).toEqual([
      {
        name: "saramin-통계-분석",
        url: "https://www.saramin.co.kr/zf_user/search/recruit?searchword=%ED%86%B5%EA%B3%84%20%EB%B6%84%EC%84%9D&searchType=search"
      },
      {
        name: "jobkorea-통계-분석",
        url: "https://www.jobkorea.co.kr/Search/?stext=%ED%86%B5%EA%B3%84%20%EB%B6%84%EC%84%9D"
      },
      {
        name: "job-alio-통계-분석",
        url: "https://job.alio.go.kr/recruit.do?search_type=title&keyword=%ED%86%B5%EA%B3%84%20%EB%B6%84%EC%84%9D&ing=2"
      },
      {
        name: "job-alio-elig-통계-분석",
        url: "https://job.alio.go.kr/recruit.do?search_type=elig&keyword=%ED%86%B5%EA%B3%84%20%EB%B6%84%EC%84%9D&ing=2"
      },
      {
        name: "job-alio-pref-통계-분석",
        url: "https://job.alio.go.kr/recruit.do?search_type=pref_con&keyword=%ED%86%B5%EA%B3%84%20%EB%B6%84%EC%84%9D&ing=2"
      },
      {
        name: "job-alio-treat-통계-분석",
        url: "https://job.alio.go.kr/recruit.do?search_type=treat_con&keyword=%ED%86%B5%EA%B3%84%20%EB%B6%84%EC%84%9D&ing=2"
      },
      {
        name: "saramin-data-scientist",
        url: "https://www.saramin.co.kr/zf_user/search/recruit?searchword=Data%20Scientist&searchType=search"
      },
      {
        name: "jobkorea-data-scientist",
        url: "https://www.jobkorea.co.kr/Search/?stext=Data%20Scientist"
      },
      {
        name: "job-alio-data-scientist",
        url: "https://job.alio.go.kr/recruit.do?search_type=title&keyword=Data%20Scientist&ing=2"
      },
      {
        name: "job-alio-elig-data-scientist",
        url: "https://job.alio.go.kr/recruit.do?search_type=elig&keyword=Data%20Scientist&ing=2"
      },
      {
        name: "job-alio-pref-data-scientist",
        url: "https://job.alio.go.kr/recruit.do?search_type=pref_con&keyword=Data%20Scientist&ing=2"
      },
      {
        name: "job-alio-treat-data-scientist",
        url: "https://job.alio.go.kr/recruit.do?search_type=treat_con&keyword=Data%20Scientist&ing=2"
      }
    ]);
  });

  it("uses every configured keyword across both broad job sites plus public-sector sources", () => {
    expect(DEFAULT_JOB_SEARCH_SOURCES).toHaveLength(JOB_SEARCH_KEYWORDS.length * 6 + 26);
    expect(JOB_SEARCH_KEYWORDS).toEqual(
      expect.arrayContaining([
        "통계",
        "임상통계",
        "보건통계",
        "품질통계",
        "수요예측",
        "Data Scientist",
        "마케팅 분석",
        "고객 분석",
        "그로스 분석",
        "Growth Analytics",
        "퍼포먼스 마케팅"
      ])
    );
    expect(DEFAULT_JOB_SEARCH_SOURCES).toEqual(
      expect.arrayContaining([
        {
          name: "job-alio-public",
          url: "https://job.alio.go.kr/recruit.do"
        },
        {
          name: "official-sk",
          url: "https://www.skcareers.com/Recruit"
        },
        {
          name: "official-samsung",
          url: "https://www.samsungcareers.com/hr/"
        },
        {
          name: "official-lg",
          url: "https://careers.lg.com/apply"
        },
        {
          name: "official-kb",
          url: "https://careers.kbfg.com/apply"
        },
        {
          name: "official-cj",
          url: "https://recruit.cj.net/recruit/ko/recruit/recruit/list.fo"
        },
        {
          name: "official-posco",
          url: "https://recruit.posco.com/h22a01-front/H22A1000.html"
        },
        {
          name: "official-hanwha",
          url: "https://www.hanwhain.com/portal/apply/recruit"
        },
        {
          name: "official-hd",
          url: "https://recruit.hd.com/kr/mainLayout/apply"
        },
        {
          name: "official-naver",
          url: "https://recruit.navercorp.com/rcrt/list.do"
        },
        {
          name: "official-naver-cloud",
          url: "https://recruit.navercloudcorp.com/rcrt/list.do"
        },
        {
          name: "official-line",
          url: "https://careers.linecorp.com/ko/jobs/"
        },
        {
          name: "official-kakao",
          url: "https://careers.kakao.com/jobs"
        },
        {
          name: "official-kakao-bank",
          url: "https://recruit.kakaobank.com/jobs"
        },
        {
          name: "official-coupang",
          url: "https://www.coupang.jobs/kr/jobs/"
        },
        {
          name: "official-kt",
          url: "https://recruit.kt.com/careers"
        },
        {
          name: "official-woowa",
          url: "https://career.woowahan.com/"
        },
        {
          name: "official-hyundai-motor",
          url: "https://talent.hyundai.com/apply/applyList.hc"
        },
        {
          name: "official-kia",
          url: "https://career.kia.com/apply/applyList.kc"
        },
        {
          name: "official-lotte",
          url: "https://recruit.lotte.co.kr/apply/announcement/list"
        },
        {
          name: "official-toss",
          url: "https://toss.im/career/jobs"
        }
      ])
    );
  });

  it("keeps generic open-recruitment listings for detail-level filtering", () => {
    expect(shouldFetchJobListingLink("2026 하반기 신입사원 공개채용", "https://www.jobkorea.co.kr/Search/")).toBe(true);
    expect(shouldFetchJobListingLink("2026 대졸 신입 채용연계형 인턴", "https://www.saramin.co.kr/zf_user/search/recruit")).toBe(true);
    expect(shouldFetchJobListingLink("정규_전담직 춘천지역 자재 및 행정업무 담당자 모집", "https://www.jobkorea.co.kr/Search/")).toBe(false);
  });

  it("extracts official group career detail links without relying on listing labels", () => {
    const html = `
      <a href="/hr/?no=21270">상세 보기</a>
      <a href="/Recruit/Detail/R261090">공고 확인</a>
      <a href="/apply/detail?id=1001883">지원하기</a>
      <a href="/career/job-detail?job_id=6085018003">포지션 보기</a>
    `;

    expect(extractJobPageLinks({ html, sourceUrl: "https://www.samsungcareers.com/hr/" })).toEqual([
      "https://www.samsungcareers.com/hr/?no=21270"
    ]);
    expect(extractJobPageLinks({ html, sourceUrl: "https://www.skcareers.com/Recruit" })).toEqual([
      "https://www.skcareers.com/Recruit/Detail/R261090"
    ]);
    expect(extractJobPageLinks({ html, sourceUrl: "https://careers.lg.com/apply" })).toEqual([
      "https://careers.lg.com/apply/detail?id=1001883"
    ]);
    expect(extractJobPageLinks({ html, sourceUrl: "https://toss.im/career/jobs" })).toEqual([
      "https://toss.im/career/job-detail?job_id=6085018003"
    ]);
  });

  it("extracts Lotte and Shinsegae official posting identifiers", () => {
    expect(
      extractJobPageLinks({
        html: '<a href="/apply/announcement/detail/21924489?compcd=?id=bookmark1000">채용 상세</a>',
        sourceUrl: "https://recruit.lotte.co.kr/apply/announcement/list"
      })
    ).toEqual(["https://recruit.lotte.co.kr/apply/announcement/detail/21924489"]);

    expect(
      extractJobPageLinks({
        html: '<a href="javascript:_moveView(\'9175\', \'연봉직경력\');">데이터 분석 채용</a>',
        sourceUrl: "https://job.shinsegae.com/recruit_info/notice/notice01_list.jsp"
      })
    ).toEqual(["https://job.shinsegae.com/recruit_info/notice/notice01_view.jsp?notino=9175"]);
  });

  it("collects every SK Careers posting from its official list API", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/Recruit/GetRecruitList")) {
        return new Response(
          JSON.stringify({
            success: true,
            list: [
              { noticeID: "R261710", title: "AI/DT 담당자" },
              { noticeID: "R261709", title: "Data Scientist" }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response('<html><title>Data Scientist</title></html>', { status: 200 });
    }) as typeof fetch;

    const result = await collectJobsFromSearchSources({
      sources: [{ name: "official-sk", url: "https://www.skcareers.com/Recruit" }],
      concurrency: 1,
      sourceConcurrency: 1
    });

    expect(result.map((candidate) => candidate.url)).toEqual([
      "https://www.skcareers.com/Recruit/Detail/R261710",
      "https://www.skcareers.com/Recruit/Detail/R261709"
    ]);
  });

  it("fetches a duplicated detail URL only once across search sources", async () => {
    const detailUrl = "https://example.com/jobs/123";
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url === detailUrl) {
        return new Response("<html><title>Data Scientist</title><body>SQL과 Python 데이터 분석</body></html>", { status: 200 });
      }
      return new Response(`<a href="${detailUrl}">데이터 분석가 채용</a>`, { status: 200 });
    }) as typeof fetch;

    const result = await collectJobsFromSearchSources({
      sources: [
        { name: "source-a", url: "https://example.com/search/a" },
        { name: "source-b", url: "https://example.com/search/b" }
      ],
      concurrency: 1,
      sourceConcurrency: 1
    });

    expect(result).toHaveLength(1);
    expect(vi.mocked(globalThis.fetch).mock.calls.filter(([input]) => String(input) === detailUrl)).toHaveLength(1);
  });

  it("expands Toss job groups into company-specific positions", () => {
    const candidates = parseTossCareerJobGroups({
      success: [
        {
          id: 6085018003,
          title: "Data Scientist",
          primary_job: { id: 1, title: "Data Scientist", metadata: [] },
          jobs: [
            {
              id: 1,
              title: "Data Scientist",
              location: { name: "Seoul" },
              metadata: [
                { name: "Employment_Type", value: "정규직" },
                { name: "포지션의 소속 자회사를 선택해 주세요.", value: "토스뱅크" },
                { name: "Job Description을 작성해 주세요.", value: "SQL과 Python으로 대출 모델을 개발해요." },
                { name: "외부 노출용 키워드를 입력해주세요.", value: "Data,ML" }
              ]
            },
            {
              id: 2,
              title: "ML Engineer",
              metadata: [
                { name: "포지션의 소속 자회사를 선택해 주세요.", value: "토스" },
                { name: "Job Description을 작성해 주세요.", value: "ML 모델을 서빙해요." }
              ]
            }
          ]
        }
      ]
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      source: "toss-careers",
      sourcePostingId: "1",
      title: "Data Scientist",
      company: "토스뱅크",
      employmentType: "정규직",
      location: "Seoul",
      tags: ["Data", "ML"]
    });
    expect(candidates[1]).toMatchObject({ sourcePostingId: "2", title: "ML Engineer", company: "토스" });
  });

  it("parses Samsung Careers listing fragments", () => {
    const listings = parseSamsungCareerListing(`
      <li><a href="/#none" data-value="22,787">
        <p class="company">삼성SDS</p>
        <h3 class="title">경력사원 채용(Data Scientist)</h3>
        <p class="info"><span>경력</span><span class="period">2026.07.31 ~ 2026.08.13</span></p>
      </a></li>
    `);

    expect(listings).toEqual([
      {
        noticeID: "22787",
        title: "경력사원 채용(Data Scientist)",
        corpName: "삼성SDS",
        recruitType: "경력",
        start: "2026.07.31",
        end: "2026.08.13",
        url: "https://www.samsungcareers.com/hr/?no=22787"
      }
    ]);
  });

  it("parses Samsung Careers detail API fields", () => {
    expect(
      parseSamsungCareerDetail(
        {
          success: true,
          data: {
            result: { title: "Data Scientist 채용", cmpNameKr: "삼성SDS", introKr: "AI와 데이터 분석 조직" },
            items: [
              {
                titleKr: "Data Scientist",
                taskKr: "통계 모델을 개발합니다.",
                qlfctKr: "SQL과 Python 역량이 필요합니다.",
                favorKr: "석사 우대",
                workPlaceKr: "서울"
              }
            ]
          }
        },
        { noticeID: "22787", url: "https://www.samsungcareers.com/hr/?no=22787" }
      )
    ).toMatchObject({
      source: "samsung-careers",
      sourcePostingId: "22787",
      title: "Data Scientist 채용",
      company: "삼성SDS",
      location: "서울",
      description: expect.stringContaining("SQL과 Python")
    });
  });

  it("parses LG Careers list and detail responses", () => {
    const [listing] = parseLgCareerListings({
      data: {
        jobNoticeList: [
          {
            jobNoticeId: 1002014,
            jobNoticeName: "AI 전문 RA 채용",
            companyName: "LG경영연구원",
            careerTypeName: "신입/경력",
            recEndDateTime: "2026.08.14 23:00"
          }
        ]
      }
    });
    expect(listing).toMatchObject({ jobNoticeId: 1002014, companyName: "LG경영연구원" });

    expect(
      parseLgCareerDetail(
        {
          data: {
            jobNoticesDetail: {
              jobNoticesDetail: { otherInfo: "<p>정규직</p>" },
              recList: [
                {
                  locationName: "서울",
                  detailContext: "<p>데이터 분석과 모델링</p>",
                  requiredItem: "<p>SQL, Python</p>",
                  preferredItem: "<p>석사 우대</p>"
                }
              ]
            }
          }
        },
        listing
      )
    ).toMatchObject({
      source: "lg-careers",
      sourcePostingId: "1002014",
      title: "AI 전문 RA 채용",
      company: "LG경영연구원",
      location: "서울",
      employmentType: "정규직",
      description: expect.stringContaining("SQL, Python")
    });
  });

  it("parses KB Financial Group official listings", () => {
    expect(
      parseKbCareerListings({
        result: {
          recruties: [
            {
              enggId: 872,
              affcomNm: "KB국민은행",
              enggTypNm: "계약직",
              carrTypNm: "경력",
              jbClsfiNm: "IT",
              enggTitl: "Back-end 개발 전문직무직원 채용",
              enggEddt: "2026-08-12",
              cn: "<p>서울에서 API와 데이터 서비스를 개발합니다.</p>"
            }
          ]
        }
      })
    ).toEqual([
      expect.objectContaining({
        source: "kb-careers",
        sourcePostingId: "872",
        url: "https://careers.kbfg.com/apply/872",
        title: "Back-end 개발 전문직무직원 채용",
        company: "KB국민은행",
        employmentType: "계약직",
        experienceLevel: "경력",
        deadline: "2026-08-12",
        description: "서울에서 API와 데이터 서비스를 개발합니다."
      })
    ]);
  });

  it("parses CJ official listings", () => {
    expect(
      parseCjCareerListings({
        ds_newRecruitList: [
          {
            zz_jo_num: "8634",
            gubun: "1",
            compnm: "CJ올리브영",
            location_cd_nm: "서울",
            zz_title: "데이터 분석가 채용",
            zz_end_dt_str: "2026.08.14",
            zz_jo_type: "정규직",
            zz_target_1: "경력",
            job_cd_nm: "데이터"
          }
        ]
      })
    ).toEqual([
      expect.objectContaining({
        noticeID: "8634",
        url: "https://recruit.cj.net/recruit/ko/recruit/recruit/detail.fo?zz_jo_num=8634",
        title: "데이터 분석가 채용",
        corpName: "CJ올리브영",
        workingArea: "서울",
        workingType: "정규직",
        recruitType: "경력",
        end: "2026.08.14"
      })
    ]);
  });

  it("parses POSCO official listings", () => {
    expect(
      parsePoscoCareerListings({
        recuList: [
          {
            HR_AFTC_MRG_ADOP_NTIC_ID: 676001,
            COMPANY_NAME: "포스코휴먼스",
            HR_AFTC_MRG_ADOP_NTIC_SUJX: "데이터 분석 신입사원 채용",
            HR_AFTC_MRG_ADOP_CLTA_TP_TP_NM: "신입사원",
            END_ACTIVE_DATE: "2026.08.05",
            RECU_FIELD: "데이터 분석"
          }
        ]
      })
    ).toEqual([
      expect.objectContaining({
        source: "posco-careers",
        sourcePostingId: "676001",
        url: "https://recruit.posco.com/h22a01-front/H22A1001.html?id=676001",
        title: "데이터 분석 신입사원 채용",
        company: "포스코휴먼스",
        experienceLevel: "신입사원",
        deadline: "2026.08.05",
        description: "데이터 분석"
      })
    ]);
  });

  it("parses Hanwha official listings", () => {
    expect(
      parseHanwhaCareerListings({
        data: {
          list: [
            {
              rtSeq: 19369,
              rtNm: "데이터 분석 담당자",
              sdNm: "한화시스템",
              rtAcptEndDttm: "2026-08-20 15:00",
              rtCarrYn: "Y",
              rtPermanentWorkYn: "Y",
              rtHopeWorkpl: "서울",
              tagList: ["AI", "데이터"]
            }
          ]
        }
      })
    ).toEqual([
      expect.objectContaining({
        source: "hanwha-careers",
        sourcePostingId: "19369",
        url: "https://www.hanwhain.com/portal/apply/recruit/detail?rtSeq=19369",
        title: "데이터 분석 담당자",
        company: "한화시스템",
        location: "서울",
        employmentType: "정규직",
        experienceLevel: "경력",
        deadline: "2026-08-20 15:00"
      })
    ]);
  });

  it("keeps only active HD Hyundai official listings", () => {
    expect(
      parseHdCareerListings(
        {
          data: [
            {
              recruitNoticeSn: 246280,
              recruitNoticeName: "AI 데이터 분석 채용",
              recruitTypeName: "신입",
              receiveEndDatetime: "2026-08-20T15:00:00",
              contents: "데이터 모델링 업무",
              recruitSectorList: [{ companyName: "HD현대", area: "서울", job: "데이터" }]
            },
            {
              recruitNoticeSn: 1,
              recruitNoticeName: "만료 공고",
              receiveEndDatetime: "2026-07-01T15:00:00",
              recruitSectorList: []
            }
          ]
        },
        new Date("2026-08-02T00:00:00+09:00")
      )
    ).toEqual([
      expect.objectContaining({
        source: "hd-careers",
        sourcePostingId: "246280",
        url: "https://recruit.hd.com/kr/mainLayout/applyDetail/246280",
        title: "AI 데이터 분석 채용",
        company: "HD현대",
        location: "서울",
        experienceLevel: "신입"
      })
    ]);
  });

  it("parses NAVER platform listings for each company site", () => {
    expect(
      parseNaverCareerListings(
        {
          list: [{
            annoId: 30005185,
            sysCompanyCdNm: "NAVER Cloud",
            annoSubject: "클라우드 AI 데이터 담당자",
            entTypeCdNm: "경력",
            empTypeCdNm: "정규",
            endYmdTime: "2026.08.12 17:00:00",
            annoKeyword: "클라우드,AI",
            classCdNm: "Tech",
            subJobCdNm: "Data",
            jobDetailLink: "https://recruit.navercloudcorp.com/rcrt/view.do?annoId=30005185"
          }]
        },
        "naver-cloud-careers"
      )
    ).toEqual([
      expect.objectContaining({
        source: "naver-cloud-careers",
        sourcePostingId: "30005185",
        title: "클라우드 AI 데이터 담당자",
        company: "NAVER Cloud",
        employmentType: "정규",
        experienceLevel: "경력",
        deadline: "2026.08.12 17:00:00"
      })
    ]);
  });

  it("keeps only public active LINE listings", () => {
    expect(
      parseLineCareerListings(
        {
          result: { data: { allStrapiJobs: { edges: [
            { node: { publish: true, is_public: true, is_filters_public: true, strapiId: 3034, title: "ML Engineer", until_filled: true, employment_type: [{ name: "Full-time" }], companies: [{ name: "LINE Plus" }], cities: [{ name: "Bundang" }], job_fields: [{ name: "Machine Learning" }] } },
            { node: { publish: true, is_public: true, is_filters_public: true, strapiId: 1, title: "만료 공고", end_date: "2026-07-01T00:00:00.000Z" } }
          ] } } }
        },
        new Date("2026-08-02T00:00:00+09:00")
      )
    ).toEqual([
      expect.objectContaining({
        source: "line-careers",
        sourcePostingId: "3034",
        url: "https://careers.linecorp.com/ko/jobs/3034/",
        title: "ML Engineer",
        company: "LINE Plus",
        location: "Bundang",
        employmentType: "Full-time"
      })
    ]);
  });

  it("parses Kakao listings with embedded job details", () => {
    expect(parseKakaoCareerListings({ jobList: [{ realId: "P-14472", jobOfferTitle: "AI Engineer", companyName: "카카오", locationName: "판교", employeeTypeName: "정규직", endDate: null, introduction: "AI 모델 연구", workContentDesc: "추론 효율화", qualification: "석사 우대", skillSetList: [{ skillSetName: "Algorithm/ML" }], closeFlag: false }] })).toEqual([
      expect.objectContaining({
        source: "kakao-careers",
        sourcePostingId: "P-14472",
        url: "https://careers.kakao.com/jobs/P-14472",
        title: "AI Engineer",
        company: "카카오",
        location: "판교",
        employmentType: "정규직",
        description: expect.stringContaining("석사 우대")
      })
    ]);
  });

  it("parses KakaoBank ongoing listings", () => {
    expect(parseKakaoBankCareerListings({ list: [{ recruitNoticeSn: 257469, recruitNoticeName: "데이터 사이언티스트", recruitTypeName: "일반채용", recruitClassName: "Tech", receiveEndDatetime: "2026-08-14 23:59:59" }] })).toEqual([
      expect.objectContaining({
        source: "kakao-bank-careers",
        sourcePostingId: "257469",
        url: "https://recruit.kakaobank.com/jobs/257469",
        title: "데이터 사이언티스트",
        company: "카카오뱅크",
        deadline: "2026-08-14 23:59:59"
      })
    ]);
  });

  it("parses Coupang Greenhouse listings with full descriptions", () => {
    expect(parseCoupangCareerListings({ jobs: [{ id: 8096053, title: "Data Scientist", company_name: "Coupang", absolute_url: "https://www.coupang.jobs/en/jobs/?gh_jid=8096053", location: { name: "Seoul, South Korea" }, application_deadline: "2026-08-30", content: "<p>SQL과 머신러닝 모델을 개발합니다.</p>", departments: [{ name: "Data Science" }] }] })).toEqual([
      expect.objectContaining({
        source: "coupang-careers",
        sourcePostingId: "8096053",
        title: "Data Scientist",
        company: "Coupang",
        location: "Seoul, South Korea",
        deadline: "2026-08-30",
        description: "SQL과 머신러닝 모델을 개발합니다."
      })
    ]);
  });

  it("excludes overseas Coupang listings", () => {
    expect(parseCoupangCareerListings({ jobs: [
      { id: 1, title: "Data Analyst", location: { name: "Taipei, Taiwan" } },
      { id: 2, title: "ML Engineer", location: { name: "Mountain View, USA" } }
    ] })).toEqual([]);
  });

  it("keeps only actively accepting KT listings", () => {
    expect(parseKtCareerListings({ data: [
      { recruitNoticeSn: 122775, recruitNoticeName: "AI 데이터 분석 채용", company: "kt", recruitTypeName: "경력", receiveEndDatetime: "2026-08-20 18:00:00", contents: "<p>데이터 모델링</p>", isInTime: true, isTimeOver: false, recruitSectorList: [{ area: "서울", job: "Data" }] },
      { recruitNoticeSn: 1, recruitNoticeName: "마감 공고", isInTime: false, isTimeOver: true }
    ] })).toEqual([
      expect.objectContaining({
        source: "kt-careers",
        sourcePostingId: "122775",
        url: "https://recruit.kt.com/careers/122775",
        title: "AI 데이터 분석 채용",
        company: "kt",
        location: "서울",
        experienceLevel: "경력",
        description: expect.stringContaining("데이터 모델링")
      })
    ]);
  });

  it("parses Woowa official listings", () => {
    expect(parseWoowaCareerListings({ data: { list: [{ recruitNumber: "R2607043", title: "데이터 사이언티스트", companyName: "우아한형제들", employmentTypeName: "정규직", careerTypeName: "경력", closingDate: "2026-08-20", jobGroupName: "데이터", workPlaceName: "서울" }] } })).toEqual([
      expect.objectContaining({
        source: "woowa-careers",
        sourcePostingId: "R2607043",
        url: "https://career.woowahan.com/recruitment/R2607043/detail",
        title: "데이터 사이언티스트",
        company: "우아한형제들",
        location: "서울",
        employmentType: "정규직",
        experienceLevel: "경력",
        deadline: "2026-08-20"
      })
    ]);
  });

  it("maps Woowa minimum career years", () => {
    expect(parseWoowaCareerListings({ data: { list: [{
      recruitNumber: "R2607038",
      recruitName: "데이터엔지니어링",
      careerRestrictionMinYears: 5,
      careerRestrictionMaxYears: 15
    }] } })[0]?.experienceLevel).toBe("경력 5년 이상");
  });

  it("parses Hyundai Motor Group platform listings", () => {
    expect(parseHkmcCareerListings({ data: { list: [{ recuYy: "2026", recuType: "A", recuCls: "001", recuNoticeNm: "Data Scientist 채용", applyEndDt: "20260820", applyEndTm: "1700", secCodeNm: "IT", fldCodeNm: "데이터", workPlaceCodeNm: "서울", jdRecuCateNm: "경력" }] } }, { company: "현대자동차", source: "hyundai-motor-careers", detailExtension: "hc", baseUrl: "https://talent.hyundai.com" })).toEqual([
      expect.objectContaining({
        source: "hyundai-motor-careers",
        sourcePostingId: "2026-A-001",
        url: "https://talent.hyundai.com/apply/applyView.hc?recuYy=2026&recuType=A&recuCls=001",
        title: "Data Scientist 채용",
        company: "현대자동차",
        location: "서울",
        experienceLevel: "경력",
        deadline: "20260820 1700",
        description: "IT 데이터"
      })
    ]);
  });

  it("extracts and normalizes job-like links from a listing page", () => {
    const html = `
      <a href="/jobs/123">데이터 분석가 채용</a>
      <a href="https://example.com/recruit/456">AI 연구원 모집</a>
      <a href="/about">회사소개</a>
      <a href="/jobs/123">중복 공고</a>
    `;

    expect(extractJobPageLinks({ html, sourceUrl: "https://example.com/search" })).toEqual([
      "https://example.com/jobs/123",
      "https://example.com/recruit/456"
    ]);
  });

  it("skips clearly unrelated listing links before fetching detail pages", () => {
    const html = `
      <a href="/jobs/bakery">제빵기능사 및 제과기능사 모집</a>
      <a href="/jobs/surgery">성형외과 수술팀 정규직 모집</a>
      <a href="/jobs/training">[취업연계/전액국비] 빅데이터 기반 AI서비스 개발자 교육</a>
      <a href="/jobs/kdt">[국비최대무료/기숙사무료/취업연계]AI/빅데이터/풀스택/KDT단기심화</a>
      <a href="/jobs/camp">[솔트룩스 취업연계 AI교육] AI에이전트 서비스개발 / LLM/ML엔지니어 캠프</a>
      <a href="/jobs/data">데이터 분석가 신입 채용</a>
      <a href="/jobs/stat">임상통계 데이터 매니저 모집</a>
      <a href="/jobs/marketing">퍼포먼스 마케팅 성과 분석 담당자</a>
      <a href="/jobs/content">콘텐츠 마케터 SNS 운영 담당자</a>
    `;

    expect(extractJobPageLinks({ html, sourceUrl: "https://example.com/search?stext=data" })).toEqual([
      "https://example.com/jobs/data",
      "https://example.com/jobs/stat",
      "https://example.com/jobs/marketing"
    ]);
  });

  it("limits extracted links per source", () => {
    const html = `
      <a href="/jobs/1">공고 1</a>
      <a href="/jobs/2">공고 2</a>
      <a href="/jobs/3">공고 3</a>
    `;

    expect(
      extractJobPageLinks({
        html,
        sourceUrl: "https://example.com/search",
        maxLinks: 2
      })
    ).toEqual(["https://example.com/jobs/1", "https://example.com/jobs/2"]);
  });

  it("extracts all matching listing links by default", () => {
    const html = Array.from({ length: 25 }, (_, index) => `<a href="/jobs/${index + 1}">공고 ${index + 1}</a>`).join("");

    expect(extractJobPageLinks({ html, sourceUrl: "https://example.com/search" })).toHaveLength(25);
  });

  it("canonicalizes JobKorea posting links and removes duplicate tracking URLs", () => {
    const html = `
      <a href="https://www.jobkorea.co.kr/Recruit/GI_Read/49353243?Oem_Code=C1&amp;listno=1">공고 A</a>
      <a href="https://www.jobkorea.co.kr/Recruit/GI_Read/49353243?Oem_Code=C1&amp;listno=2">공고 A 중복</a>
      <a href="/Recruit/GI_Read/49452718?Oem_Code=C1">공고 B</a>
    `;

    expect(
      extractJobPageLinks({
        html,
        sourceUrl: "https://www.jobkorea.co.kr/Search/?stext=data"
      })
    ).toEqual([
      "https://www.jobkorea.co.kr/Recruit/GI_Read/49353243",
      "https://www.jobkorea.co.kr/Recruit/GI_Read/49452718"
    ]);
  });

  it("canonicalizes Saramin posting links from rec_idx values", () => {
    const html = `
      <a href="/zf_user/jobs/relay/view?rec_idx=51234567&utm_source=search">공고 A</a>
      <button data-rec_idx="51234568">공고 B</button>
      rec_idx=51234567
    `;

    expect(
      extractJobPageLinks({
        html,
        sourceUrl: "https://www.saramin.co.kr/zf_user/search/recruit"
      })
    ).toEqual([
      "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=51234567",
      "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=51234568"
    ]);
  });

  it("ignores Saramin search and category pages even when their labels contain analytics keywords", () => {
    const html = `
      <a href="/zf_user/search/recruit?searchword=통계">통계 채용정보 | 총 3,414건의 검색결과 - 사람인</a>
      <a href="/zf_user/jobs/list/job-category?cat_kewd=82">데이터분석가 취업 | 직업별 채용정보 - 사람인</a>
      <a href="/zf_user/jobs/relay/view?rec_idx=51234569">데이터 분석가 신입 채용</a>
    `;

    expect(
      extractJobPageLinks({
        html,
        sourceUrl: "https://www.saramin.co.kr/zf_user/search/recruit?searchword=data"
      })
    ).toEqual(["https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=51234569"]);
  });

  it("canonicalizes Hibrain recruitment links and ignores navigation links", () => {
    const html = `
      <a href="/recruitment">채용 메인</a>
      <a href="/recruitment/categories/JOB/categories/PROF/recruits">교수</a>
      <a href="/recruitment/recruits/3587561?pagekey=3587561&listType=ING">경희사이버대학교 초빙</a>
      <a href="/recruitment/recruits/3587561?pagekey=duplicated">중복</a>
      <a href="/recruitment/recruits/3587644?pagekey=3587644">다른 공고</a>
    `;

    expect(
      extractJobPageLinks({
        html,
        sourceUrl: "https://www.hibrain.net/recruitment/recruits"
      })
    ).toEqual([
      "https://www.hibrain.net/recruitment/recruits/3587561",
      "https://www.hibrain.net/recruitment/recruits/3587644"
    ]);
  });

  it("canonicalizes Job-Alio public institution posting links", () => {
    const html = `
      <a href="/recruit.do">공공기관 채용정보</a>
      <a href="/recruitview.do?idx=302729" target="_blank">칠곡경북대학교병원 데이터 분석 담당자 채용공고</a>
      <a href="https://job.alio.go.kr/recruitview.do?idx=302729&pageNo=1">중복</a>
      <a href="/recruitview.do?idx=302730">콘텐츠 마케터 SNS 운영 담당자</a>
      <a href="http://www.publicjob.kr/">공공기관 채용정보박람회</a>
      <a href="https://www.gojobs.go.kr/">나라일터 채용</a>
      <a href="https://www.gojobs.go.kr/"><img src="/gojobs.gif" alt="나라일터" /></a>
    `;

    expect(
      extractJobPageLinks({
        html,
        sourceUrl: "https://job.alio.go.kr/recruit.do"
      })
    ).toEqual(["https://job.alio.go.kr/recruitview.do?idx=302729"]);
  });

  it("fetches Job-Alio detail matches even when the listing title is generic", () => {
    const html = `
      <a href="/recruitview.do?idx=302427">2026년 제7차 직원 채용 공고</a>
      <a href="/recruitview.do?idx=302730">콘텐츠 마케터 SNS 운영 담당자</a>
    `;

    expect(
      extractJobPageLinks({
        html,
        sourceUrl: "https://job.alio.go.kr/recruit.do?search_type=elig&keyword=%ED%86%B5%EA%B3%84&ing=2"
      })
    ).toEqual(["https://job.alio.go.kr/recruitview.do?idx=302427"]);

    expect(
      extractJobPageLinks({
        html,
        sourceUrl: "https://job.alio.go.kr/recruit.do?search_type=title&keyword=%ED%86%B5%EA%B3%84&ing=2"
      })
    ).toEqual([]);
  });

  it("collects listing sources and detail pages concurrently with a configurable limit", async () => {
    vi.useFakeTimers();
    const started: string[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      started.push(href);
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (href.includes("source-a")) {
        return new Response('<a href="https://example.com/jobs/a">A</a>', { status: 200 });
      }
      if (href.includes("source-b")) {
        return new Response('<a href="https://example.com/jobs/b">B</a>', { status: 200 });
      }
      return new Response(
        `<script type="application/ld+json">{"@type":"JobPosting","title":"${href.endsWith("/a") ? "A" : "B"}","hiringOrganization":{"name":"Acme"}}</script>`,
        { status: 200 }
      );
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const promise = collectJobsFromSearchSources({
      sources: [
        { name: "a", url: "https://example.com/source-a" },
        { name: "b", url: "https://example.com/source-b" }
      ],
      maxLinksPerSource: 1,
      concurrency: 2,
      requestTimeoutMs: 1000
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(started.slice(0, 2)).toEqual(["https://example.com/source-a", "https://example.com/source-b"]);
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("reports collection progress while fetching sources and detail pages", async () => {
    const events: string[] = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("source-a")) {
        return new Response('<a href="https://example.com/jobs/a">A</a>', { status: 200 });
      }
      return new Response(
        '<script type="application/ld+json">{"@type":"JobPosting","title":"A","hiringOrganization":{"name":"Acme"}}</script>',
        { status: 200 }
      );
    }) as typeof fetch;

    await collectJobsFromSearchSources({
      sources: [{ name: "a", url: "https://example.com/source-a" }],
      maxLinksPerSource: 1,
      concurrency: 1,
      requestTimeoutMs: 1000,
      onProgress: (event) => events.push(`${event.type}:${event.message}`)
    });

    expect(events).toEqual([
      "source-started:a 소스 조회 시작",
      "source-completed:a 소스 조회 완료: 1개 링크",
      "detail-started:상세 공고 1/1 파싱 시작",
      "detail-completed:상세 공고 1/1 파싱 완료"
    ]);
  });
});
