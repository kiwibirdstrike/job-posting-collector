import { describe, expect, it } from "vitest";
import { parseJobPostingPage } from "@/lib/jobs/collectors/page";

describe("job page parser", () => {
  it("prefers JSON-LD JobPosting fields when available", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Data Analyst",
              "description": "<p>Analyze customer data.</p>",
              "datePosted": "2026-07-01",
              "validThrough": "2026-08-01T23:59:59+09:00",
              "employmentType": "FULL_TIME",
              "hiringOrganization": { "name": "Acme" },
              "jobLocation": {
                "address": {
                  "addressLocality": "Seoul",
                  "addressRegion": "KR"
                }
              }
            }
          </script>
        </head>
      </html>
    `;

    expect(parseJobPostingPage({ html, url: "https://jobs.example/acme" })).toMatchObject({
      source: "page",
      url: "https://jobs.example/acme",
      title: "Data Analyst",
      company: "Acme",
      location: "Seoul, KR",
      employmentType: "정규직",
      deadline: "2026-08-01T23:59:59+09:00",
      postedAt: "2026-07-01",
      description: "Analyze customer data."
    });
  });

  it("falls back to metadata and hostname when structured data is missing", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="AI Research Intern - Example Labs" />
          <meta name="description" content="Build research prototypes." />
        </head>
      </html>
    `;

    expect(parseJobPostingPage({ html, url: "https://example-labs.com/jobs/1" })).toMatchObject({
      source: "page",
      title: "AI Research Intern - Example Labs",
      company: "example-labs.com",
      description: "Build research prototypes."
    });
  });

  it("parses JobKorea specific metadata from posting pages", () => {
    const html = `
      <html>
        <head>
          <title>다고테크 채용 - IT Helpdesk 엔지니어 채용 (용인,이천) | 잡코리아</title>
          <meta name="description" content="경력 : 경력 2년이상, 학력 : 초대졸↑, 급여 : 연봉 3,000~4,000만원(면접 후 결정), 마감일 : 2026.08.10" />
        </head>
        <body>
          <script>window.__DATA__ = {\\"companyName\\":\\"다고테크\\"}</script>
        </body>
      </html>
    `;

    expect(
      parseJobPostingPage({
        html,
        url: "https://www.jobkorea.co.kr/Recruit/GI_Read/49353243?Oem_Code=C1"
      })
    ).toMatchObject({
      source: "jobkorea",
      sourcePostingId: "49353243",
      url: "https://www.jobkorea.co.kr/Recruit/GI_Read/49353243",
      title: "IT Helpdesk 엔지니어 채용 (용인,이천)",
      company: "다고테크",
      experienceLevel: "경력 2년이상",
      deadline: "2026-08-10"
    });
  });

  it("fills JobKorea location and employment type from JobPosting JSON-LD", () => {
    const html = `
      <html>
        <head>
          <title>삼성서울병원 채용 - 삼성서울병원 내분비외과 계약직 전담간호사(수술) 채용 | 잡코리아</title>
          <meta name="description" content="경력 : 경력 3년이상, 학력 : 대졸↑, 급여 : 월급 400~400만원, 마감일 : 2026.07.07" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "삼성서울병원 내분비외과 계약직 전담간호사(수술) 채용",
              "description": "삼성서울병원에서 계약직 경력 채용을 진행합니다. 근무지는 서울 강남구 일원로 81 (일원동, 삼성서울병원)입니다.",
              "datePosted": "2026-07-01",
              "validThrough": "2026-07-07T09:00",
              "employmentType": "CONTRACTOR",
              "experienceRequirements": "경력",
              "hiringOrganization": { "name": "삼성서울병원" },
              "jobLocation": {
                "address": {
                  "streetAddress": "서울 강남구 일원로 81 (일원동, 삼성서울병원)"
                }
              }
            }
          </script>
        </head>
      </html>
    `;

    expect(
      parseJobPostingPage({
        html,
        url: "https://www.jobkorea.co.kr/Recruit/GI_Read/49491607"
      })
    ).toMatchObject({
      location: "서울 강남구 일원로 81 (일원동, 삼성서울병원)",
      employmentType: "계약직",
      experienceLevel: "경력 3년이상",
      postedAt: "2026-07-01",
      description: "삼성서울병원에서 계약직 경력 채용을 진행합니다. 근무지는 서울 강남구 일원로 81 (일원동, 삼성서울병원)입니다."
    });
  });

  it("adds JobKorea company scale chips to tags", () => {
    const html = `
      <html>
        <head>
          <title>SK텔레콤 채용 - 통계 및 서무 담당자 | 잡코리아</title>
          <meta name="description" content="경력 : 신입, 학력 : 초대졸↑, 마감일 : 2026.08.02" />
        </head>
        <body>
          <span>⭐ 9432명 이상 찜한 기업</span>
          <span>🏢 대기업</span>
          <section id="company-section">
            <span>기업구분</span>
            <div>대기업 (코스피)</div>
          </section>
        </body>
      </html>
    `;

    expect(
      parseJobPostingPage({
        html,
        url: "https://www.jobkorea.co.kr/Recruit/GI_Read/49511377"
      }).tags
    ).toEqual(expect.arrayContaining(["jobkorea", "url-parsed", "대기업"]));
  });

  it("adds graduate education advantage tags from generic posting descriptions", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Data Analyst",
              "description": "지원자격: 석사 이상 지원 가능. 우대사항: 통계학 석사 학위 소지자 우대.",
              "hiringOrganization": { "name": "Acme" }
            }
          </script>
        </head>
      </html>
    `;

    expect(parseJobPostingPage({ html, url: "https://jobs.example/acme" }).tags).toEqual(
      expect.arrayContaining(["석사이상 지원가능", "석사 우대"])
    );
  });

  it("records parser diagnostics for filled and missing fields", () => {
    const html = `
      <html>
        <head>
          <title>삼성서울병원 채용 - 분석가 채용 | 잡코리아</title>
          <meta name="description" content="경력 : 경력 3년이상, 마감일 : 2026.07.07" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "분석가 채용",
              "employmentType": "CONTRACTOR",
              "hiringOrganization": { "name": "삼성서울병원" },
              "jobLocation": {
                "address": { "streetAddress": "서울 강남구 일원로 81" }
              }
            }
          </script>
        </head>
      </html>
    `;

    expect(
      parseJobPostingPage({
        html,
        url: "https://www.jobkorea.co.kr/Recruit/GI_Read/49491607"
      }).rawPayload
    ).toMatchObject({
      parseDiagnostics: {
        hasJobPostingJsonLd: true,
        hasMetaDescription: true,
        fieldSources: {
          location: "jsonLd.jobLocation",
          employmentType: "jsonLd.employmentType",
          experienceLevel: "meta.description:경력",
          deadline: "meta.description:마감일"
        },
        missingFields: ["postedAt"],
        missingReasons: {
          postedAt: "not-found-in-supported-source"
        }
      }
    });
  });

  it("keeps company career links found on posting pages", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Data Analyst",
              "hiringOrganization": { "name": "Acme" }
            }
          </script>
        </head>
        <body>
          <a href="https://careers.acme.com/jobs/da-1">회사 채용 홈페이지 지원</a>
          <a href="https://jobs.example/acme">공고 원문</a>
        </body>
      </html>
    `;

    expect(parseJobPostingPage({ html, url: "https://jobs.example/acme" }).rawPayload).toMatchObject({
      companyCareerUrl: "https://careers.acme.com/jobs/da-1"
    });
  });

  it("parses Saramin metadata before noisy embedded recommendation data", () => {
    const html = `
      <html>
        <head>
          <title>[기아(주)] [계약직] 웹/앱 고객행동 데이터 분석 솔루션 관리(D-3) - 사람인</title>
          <meta name="description" content="기아(주), [계약직] 웹/앱 고객행동 데이터 분석 솔루션 관리, 경력:경력무관, 학력:대학교졸업(4년)이상, 면접 후 결정, 마감일:2026-07-08, 홈페이지:https://career.kia.com/main/main.kc" />
        </head>
        <body>
          <a href="https://billing.saramin.co.kr/products">채용 상품 안내</a>
          <script>window.__RECOMMEND__ = {\\"company_nm\\":\\"엉뚱한 추천 회사\\"}</script>
        </body>
      </html>
    `;

    expect(
      parseJobPostingPage({
        html,
        url: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=51234567&utm_source=search"
      })
    ).toMatchObject({
      source: "saramin-page",
      sourcePostingId: "51234567",
      url: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=51234567",
      title: "[계약직] 웹/앱 고객행동 데이터 분석 솔루션 관리",
      company: "기아(주)",
      experienceLevel: "경력무관",
      deadline: "2026-07-08",
      rawPayload: expect.objectContaining({
        companyCareerUrl: "https://career.kia.com/main/main.kc"
      })
    });
  });

  it("adds Saramin company scale data to tags when the page script exposes it", () => {
    const html = `
      <html>
        <head>
          <title>[쿠팡(주)] CS 데이터 분석 담당자(D-3) - 사람인</title>
          <meta name="description" content="쿠팡(주), CS 데이터 분석 담당자, 경력:경력 2년이상, 마감일:2026-07-30" />
        </head>
        <body>
          <script>
            var recruit = {"rec_idx":"51234567","company_nm":"쿠팡(주)","scale":"대기업,1000대기업","display_rec_tag":"com_130||대기업|*|com_154||매출액 1조 기업"};
          </script>
        </body>
      </html>
    `;

    expect(
      parseJobPostingPage({
        html,
        url: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=51234567"
      }).tags
    ).toEqual(expect.arrayContaining(["saramin", "url-parsed", "대기업"]));
  });

  it("does not use Saramin recommended posting scales for the current posting", () => {
    const html = `
      <html>
        <head>
          <title>[기아(주)] 데이터 분석(D-3) - 사람인</title>
          <meta name="description" content="기아(주), 데이터 분석, 경력:경력무관, 마감일:2026-07-08" />
        </head>
        <body>
          <script>
            var recruit_idxs = [{"rec_idx":"51234567"},{"rec_idx":"99999999"}];
            var recruit_list = [{"rec_idx":"99999999","scale":"대기업,1000대기업","display_rec_tag":"com_130||대기업"}];
          </script>
        </body>
      </html>
    `;

    expect(
      parseJobPostingPage({
        html,
        url: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=51234567"
      }).tags
    ).toEqual(["saramin", "url-parsed"]);
  });

  it("parses Hibrain recruitment pages from JSON-LD and visible application period", () => {
    const html = `
      <html>
        <head>
          <title>경희사이버대학교 2026학년도 전임교원 초빙 - 고급두뇌를 위한 하이브레인넷(hibrain.net)</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "경희사이버대학교 2026학년도 전임교원 초빙",
              "description": "경희사이버대학교 전임교원 초빙 공고입니다.",
              "datePosted": "2026-06-26",
              "validThrough": "",
              "employmentType": "교수",
              "hiringOrganization": { "name": "경희사이버대학교" },
              "jobLocation": {
                "address": {
                  "addressRegion": "서울",
                  "addressCountry": "한국"
                }
              }
            }
          </script>
        </head>
        <body>접수기간 : 2026.06.26 00:00 ~ 2026.07.11 17:00</body>
      </html>
    `;

    expect(
      parseJobPostingPage({
        html,
        url: "https://www.hibrain.net/recruitment/recruits/3587561?pagekey=3587561&listType=ING"
      })
    ).toMatchObject({
      source: "hibrain",
      sourcePostingId: "3587561",
      url: "https://www.hibrain.net/recruitment/recruits/3587561",
      title: "경희사이버대학교 2026학년도 전임교원 초빙",
      company: "경희사이버대학교",
      location: "서울, 한국",
      employmentType: "교수",
      deadline: "2026-07-11T17:00:00+09:00",
      postedAt: "2026-06-26"
    });
  });

  it("parses Job-Alio public institution detail pages from visible fields", () => {
    const html = `
      <html>
        <head>
          <title>공공기관 채용정보시스템</title>
          <meta name="description" content="한국데이터산업진흥원 데이터 기반 정책지원 담당자 채용" />
        </head>
        <body>
          <h4>한국데이터산업진흥원 데이터 기반 정책지원 담당자 채용</h4>
          <table>
            <tr><th>기관명</th><td>한국데이터산업진흥원</td></tr>
            <tr><th>채용분야</th><td>사업관리, 정보통신</td></tr>
            <tr><th>고용형태</th><td>정규직</td></tr>
            <tr><th>근무지</th><td>서울</td></tr>
            <tr><th>공고기간</th><td>2026.07.15 ~ 2026.07.30</td></tr>
            <tr><th>응시자격</th><td>데이터 분석 및 지표 관리 경험</td></tr>
          </table>
        </body>
      </html>
    `;

    expect(
      parseJobPostingPage({
        html,
        url: "https://job.alio.go.kr/recruitview.do?idx=302729"
      })
    ).toMatchObject({
      source: "job-alio",
      sourcePostingId: "302729",
      url: "https://job.alio.go.kr/recruitview.do?idx=302729",
      title: "한국데이터산업진흥원 데이터 기반 정책지원 담당자 채용",
      company: "한국데이터산업진흥원",
      location: "서울",
      employmentType: "정규직",
      deadline: "2026-07-30",
      postedAt: "2026-07-15",
      description: expect.stringContaining("데이터 분석 및 지표 관리 경험"),
      tags: ["job-alio", "url-parsed", "공공기관"]
    });
  });

  it("parses real Job-Alio combined field rows", () => {
    const html = `
      <html>
        <head><title>공공기관 채용정보시스템</title></head>
        <body>
          <h3>공공기관 채용정보</h3>
          <h4>(재)한국통계진흥원</h4>
          <h4>'(재)한국통계진흥원' 에서 진행중인 채용공고 (최근 1개월 이전 공고)</h4>
          <h4>응시자격</h4>
          <table>
            <tr><td>표준직무(NCS) 경영.회계.사무 학력정보 학력무관,대졸(4년)</td></tr>
            <tr><td>근무분야 일반직,계약직 채용구분 신입+경력</td></tr>
            <tr><td>고용형태 비정규직,정규직 대체인력여부 아니오</td></tr>
            <tr><td>근무지 서울,대전 급여정보 신입 / 평균</td></tr>
            <tr><td>채용인원 5명 우대조건 해당분야 업무 경험자</td></tr>
            <tr><td>채용기간 26.07.07 ~ 26.07.21 등록일 2026.07.07</td></tr>
            <tr><td>통계자료관리부(기간제)</td></tr>
          </table>
        </body>
      </html>
    `;

    expect(
      parseJobPostingPage({
        html,
        url: "https://job.alio.go.kr/recruitview.do?idx=302427"
      })
    ).toMatchObject({
      source: "job-alio",
      sourcePostingId: "302427",
      title: "(재)한국통계진흥원 채용공고",
      company: "(재)한국통계진흥원",
      location: "서울,대전",
      employmentType: "비정규직,정규직",
      experienceLevel: "신입+경력",
      deadline: "2026-07-21",
      postedAt: "2026-07-07",
      description: expect.stringContaining("통계자료관리부")
    });
  });

  it("adds Job-Alio graduate tags from education and preference fields", () => {
    const html = `
      <html>
        <head><title>공공기관 채용정보시스템</title></head>
        <body>
          <div id="txt">
            <div class="topInfo">
              <h2>국립중앙의료원</h2>
              <p class="titleH2" title="연구직 일반연구원(데이터기반정책연구팀) 채용 공고">연구직 일반연구원(데이터기반정책연구팀) 채용 공고</p>
            </div>
            <div class="detailTxt">
              <table>
                <tr><th>표준직무(NCS)</th><td>보건.의료,연구</td><th>학력정보</th><td>석사,박사</td></tr>
                <tr><th>고용형태</th><td>정규직</td><th>대체인력여부</th><td>아니오</td></tr>
                <tr><th>근무지</th><td>서울</td><th>급여정보</th><td>신입 / 평균</td></tr>
                <tr><th>채용기간</th><td>26.07.03 ~ 26.07.20</td><th>등록일</th><td>2026.07.03</td></tr>
              </table>
            </div>
            <div id="tab-1">
              <h4>우대내용</h4>
              <p>보건통계 또는 역학 분야 석사 학위 소지자 우대</p>
            </div>
          </div>
        </body>
      </html>
    `;

    expect(
      parseJobPostingPage({
        html,
        url: "https://job.alio.go.kr/recruitview.do?idx=302358"
      }).tags
    ).toEqual(expect.arrayContaining(["job-alio", "공공기관", "석사이상 지원가능", "석사 우대"]));
  });

  it("keeps Job-Alio descriptions scoped to the posting body", () => {
    const html = `
      <html>
        <head><title>공공기관 채용정보시스템</title></head>
        <body>
          <script>function mobileCheck(){ window.location.href="/mobile2021/home.do"; }</script>
          <div id="header">홈페이지 주메뉴 로그인 전체메뉴</div>
          <div id="txt">
            <h3>공공기관 채용정보</h3>
            <div class="topInfo">
              <h2>(재)한국통계진흥원</h2>
              <p class="titleH2" title="2026년 제7차 한국통계진흥원 직원 채용 공고">
                2026년 제7차 한국통계진흥원 직원 채용 공고
              </p>
            </div>
            <div class="detailTxt">
              <table>
                <tr><th>고용형태</th><td>정규직</td><th>대체인력여부</th><td>아니오</td></tr>
                <tr><th>근무지</th><td>서울</td><th>급여정보</th><td>신입 / 평균</td></tr>
                <tr><th>채용기간</th><td>26.07.07 ~ 26.07.21</td><th>등록일</th><td>2026.07.07</td></tr>
              </table>
            </div>
            <div id="tab-1" class="tab-content current">
              <h4>응시자격</h4>
              <p>□ 통계자료관리부(기간제)<br/>○ 진흥원의 업무를 수행할 수 있는 지식과 역량을 갖춘 자</p>
              <h4>우대내용</h4>
              <p>○ 해당분야 업무 경험자</p>
              <h4>전형절차/방법</h4>
              <p>○ 서류전형<br/>- 정량적·정성적으로 평가</p>
            </div>
          </div>
          <div id="footer">알리오포털 개인정보처리방침</div>
        </body>
      </html>
    `;

    const parsed = parseJobPostingPage({
      html,
      url: "https://job.alio.go.kr/recruitview.do?idx=302427"
    });

    expect(parsed).toMatchObject({
      title: "2026년 제7차 한국통계진흥원 직원 채용 공고",
      company: "(재)한국통계진흥원"
    });
    expect(parsed.description).toContain("고용형태 정규직");
    expect(parsed.description).toContain("응시자격");
    expect(parsed.description).toContain("정량적·정성적으로 평가");
    expect(parsed.description).not.toContain("mobileCheck");
    expect(parsed.description).not.toContain("홈페이지 주메뉴");
    expect(parsed.description).not.toContain("개인정보처리방침");
  });
});
