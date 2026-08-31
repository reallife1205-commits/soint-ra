import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// supabase-js 내부 fetch는 Next.js App Router의 dynamic = "force-dynamic"으로 캐시가
// 무효화되지 않아 배포가 바뀌어도 예전 데이터 스냅샷이 계속 서빙될 수 있다(export-report에서
// 실제로 겪은 문제). fetch를 명시적으로 no-store로 강제한다.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }) } }
);

async function fetchCaseContext(caseId) {
  const [{ data: caseInfo }, { data: m1 }, { data: m3 }, { data: survey }, { data: mapping }, { data: surrounding }] =
    await Promise.all([
      supabaseAdmin.from("cases").select("*").eq("id", caseId).single(),
      supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 1),
      supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 3),
      supabaseAdmin.from("field_surveys").select("*").eq("case_id", caseId).maybeSingle(),
      supabaseAdmin.from("pollution_mappings").select("*").eq("case_id", caseId),
      supabaseAdmin.from("surrounding_impacts").select("*").eq("case_id", caseId),
    ]);

  return { caseInfo, m1: m1 || [], m3: m3 || [], survey, mapping: mapping || [], surrounding: surrounding || [] };
}

function buildPrompt(ctx) {
  const { caseInfo, m1, m3, survey, mapping, surrounding } = ctx;

  const contamLines = m1
    .map((r) => r.row_data)
    .filter((d) => d.contaminant)
    .map(
      (d) =>
        `- ${d.contaminant}: 최고농도 ${d.max_concentration || "-"}mg/kg, 우려기준초과 ${d.concern_standard ? "예" : "아니오"}, 대책기준초과 ${d.action_standard ? "예" : "아니오"}`
    )
    .join("\n");

  const ownerLines = m3
    .map((r) => r.row_data)
    .filter((d) => d.category === "ownership")
    .map((d) => `- 소유자 ${d.owner_name} (${d.acquired_date || "?"} ~ ${d.disposed_date || "현재"}), 업종: ${d.business_type || "미상"}`)
    .join("\n");

  const leaseLines = m3
    .map((r) => r.row_data)
    .filter((d) => d.category === "lease")
    .map((d) => `- 임차인 ${d.tenant_name} (${d.lease_start || "?"} ~ ${d.lease_end || "?"}), 업종: ${d.business_type || "미상"}`)
    .join("\n");

  const fieldLines = (survey?.field_items || [])
    .filter((i) => i.checked || i.answer)
    .map((i) => `- ${i.label}: ${i.answer || "확인함"}`)
    .join("\n");

  const interviewLines = (survey?.interview_items || [])
    .filter((i) => i.checked || i.answer)
    .map((i) => `- ${i.label}: ${i.answer || "확인함"}`)
    .join("\n");

  const mappingLines = mapping
    .filter((m) => m.level && m.level !== "판단불가")
    .map((m) => `- ${m.company_name} × ${m.substance}: 연관성 ${m.level}${m.note ? ` (${m.note})` : ""}`)
    .join("\n");

  const surroundingLines = surrounding
    .map(
      (s) =>
        `- ${s.substance}: 대상부지 최고 ${s.target_max ?? "-"}mg/kg, 주변부지 최고 ${s.surrounding_max ?? "-"}mg/kg, 비율 ${s.ratio ? s.ratio.toFixed(2) : "-"}, 판정 ${s.verdict}${s.note ? ` (${s.note})` : ""}`
    )
    .join("\n");

  return `당신은 토양환경보전법에 따른 토양정화자문위원회의 기술검토를 지원하는 보조자입니다.
아래 자료를 바탕으로, 위원회에 제출할 "종합 검토 의견" 초안을 작성해주세요.

[대상부지 정보]
주소: ${caseInfo?.address || "미상"}

[챕터 01: 대상부지 오염현황]
${contamLines || "입력된 자료 없음"}

[챕터 03: 소유 이력]
${ownerLines || "입력된 자료 없음"}

[챕터 03: 임대차 이력]
${leaseLines || "입력된 자료 없음"}

[챕터 06: 현장조사 결과]
${fieldLines || "입력된 자료 없음"}

[챕터 06: 청취조사 결과]
${interviewLines || "입력된 자료 없음"}

[챕터 07: 오염물질 × 기업 연관성]
${mappingLines || "입력된 자료 없음"}

[챕터 07: 주변부지 영향 판단]
${surroundingLines || "입력된 자료 없음"}

작성 지침:
- 아래와 같은 대괄호 소제목 형식으로 작성해주세요.
  【오염물질의 기여도 판단】
  【소유·점유·운영 이력 분석】
  【현장조사 및 청취조사 종합】
  【주변부지 영향 검토】
  【종합 의견】
- 각 항목은 위에 제공된 자료에 근거해서만 작성하고, 자료가 없는 항목은 "관련 자료가 확인되지 않음"이라고 명확히 적어주세요.
- 추정이나 단정적 표현은 피하고, "~로 판단됨", "~확인이 필요함" 같은 검토 보고서 톤을 사용해주세요.
- 이 초안은 위원회 검토를 위한 참고 자료이며, 최종 판단이 아님을 유념해서 작성해주세요.`;
}

export async function POST(req) {
  const { caseId } = await req.json();
  if (!caseId) {
    return Response.json({ error: "caseId가 필요해요" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Claude API 키가 설정되지 않았어요" }, { status: 500 });
  }

  try {
    const ctx = await fetchCaseContext(caseId);
    const prompt = buildPrompt(ctx);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json();

    if (!res.ok) {
      return Response.json(
        { error: data?.error?.message || "AI 초안 생성 중 문제가 발생했어요" },
        { status: 500 }
      );
    }

    const text = data.content?.map((c) => c.text || "").join("\n") || "";
    return Response.json({ draft: text });
  } catch (e) {
    const message =
      e.name === "AbortError"
        ? "AI 초안 생성이 너무 오래 걸려서 중단했어요. 다시 시도해주세요."
        : e.message || "AI 초안 생성 중 문제가 발생했어요";
    return Response.json({ error: message }, { status: 500 });
  }
}
