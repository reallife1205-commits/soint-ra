import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// supabase-js 내부 fetch가 캐시되어 예전 데이터가 서빙되는 문제 방지(analyze-ownership-table과 동일).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }) } }
);

const MEDIA_TYPE_BY_EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const MAX_SITE_PLAN_IMAGES = 3;

// 3.4 "토양오염이 발생한 토지로의 출입 가능성 또는 용이성" 초안. 지침(제16조 제2항 제7호,
// 제17조)에 맞춰 "오염 발생 당시 출입 가능성"을 중심으로, "정화 시 출입 용이성"을 한두 줄 덧붙인다.
const PROMPT = `당신은 토양환경보전법에 따른 토양정화자문위원회의 기술검토를 지원하는 보조자입니다.
아래 [사건 자료]와 첨부 이미지(배치도·위치도 등)만 근거로, 기술검토 보고서 "3.4 토양오염이 발생한
토지로의 출입 가능성 또는 용이성" 항목의 본문을 작성해주세요.

형식(반드시 이 형식 그대로, 두 단락 사이에 빈 줄 하나):
(오염 발생 당시 출입 가능성) 본문

(정화 시 출입 용이성) 본문

작성 내용:
- (오염 발생 당시 출입 가능성): 오염이 확인된 부지·필지, 그 부지를 시기별로 소유·점유·운영한 자와
  기간·업종, 항공사진·배치도로 확인되는 시설 배치(공장동, 통로, 야적 구역 등)와 오염 지점의 위치 관계를
  시간 순서로 쓰기. 오염 지점이 어느 점유자의 사용 구역에 해당하는지 자료로 확인되면 그 사실을 쓰기
- (정화 시 출입 용이성): 현재 그 부지를 소유·사용하는 자와, 정화를 위한 출입이 용이한지 1~2문장.
  배치도·위치도에서 보이는 현재 상태(건물로 덮여 있음 등)가 있으면 덧붙이기

작성 규칙:
- 자료에 있는 사실만 객관적으로 쓰기. 자료로 알 수 없는 내용(추정, 가능성, 의도)은 쓰지 않기.
  "추정", "~로 보임", "~일 수 있음", "확인 필요" 같은 표현 금지
- "정화책임자로 판단", "책임이 있음" 같은 판단·결론 표현 금지(판단은 위원회 몫)
- 이미지(배치도·위치도)는 "배치도상 ~로 표시됨", "위치도상 ~로 덮여 있음"처럼 보이는 그대로만 쓰고,
  "접근이 제한됨", "~용도로 사용됨" 같은 해석은 쓰지 않기
- 업체는 "업체명(대표자 OOO)" 형식, "주식회사"·"(주)"는 빼고 나머지 글자는 자료 그대로
- 이름·연도·지번은 자료 표기 그대로. 가려진 이름(예: 허*필)은 "*"까지 그대로 쓰기
- 연도와 기간은 "(1989~2014, 아연도금)"처럼 괄호로 간결하게
- 문장 끝은 "~확인됨", "~운영하였음", "~용이함"처럼 개조식 서술체로
- 일반 텍스트만(마크다운 금지), 서론·맺음말 없이 위 두 단락만
- 오염 발생 당시 단락은 3~6문장, 정화 시 단락은 1~2문장`;

function line(label, value) {
  const v = typeof value === "string" ? value.trim() : value;
  return v ? `${label}: ${v}` : null;
}

function rowsText(rows, fields) {
  return rows
    .map((r) =>
      fields
        .map(([key, label]) => (r[key] ? `${label} ${r[key]}` : null))
        .filter(Boolean)
        .join(", ")
    )
    .filter(Boolean)
    .map((s) => `- ${s}`)
    .join("\n");
}

export async function POST(req) {
  const { caseId } = await req.json();
  if (!caseId) return Response.json({ error: "caseId가 필요해요" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Claude API 키가 설정되지 않았어요" }, { status: 500 });

  try {
    const [
      { data: caseInfo },
      { data: m0Rows },
      { data: m1Rows },
      { data: m3Rows },
      { data: m5Rows },
      { data: aerialDocs },
      { data: timeline },
      { data: fieldSurvey },
      { data: sitePlanDocs },
    ] = await Promise.all([
      supabaseAdmin.from("cases").select("*").eq("id", caseId).single(),
      supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 0),
      supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 1),
      supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 3),
      supabaseAdmin.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 5),
      supabaseAdmin.from("documents").select("file_name, photo_year, photo_note").eq("case_id", caseId).eq("module_number", 4),
      supabaseAdmin.from("timeline_analyses").select("content").eq("case_id", caseId).maybeSingle(),
      supabaseAdmin.from("field_surveys").select("*").eq("case_id", caseId).maybeSingle(),
      supabaseAdmin
        .from("documents")
        .select("file_name, file_path")
        .eq("case_id", caseId)
        .eq("module_number", 3)
        .eq("category", "site_plan")
        .order("uploaded_at", { ascending: true })
        .limit(MAX_SITE_PLAN_IMAGES),
    ]);

    if (!caseInfo) return Response.json({ error: "해당 안건을 찾을 수 없어요" }, { status: 404 });

    const m0 = (m0Rows || []).map((r) => r.row_data);
    const m3 = (m3Rows || []).map((r) => r.row_data);
    const overview = m0.find((d) => d.category === "overview") || {};
    const contamination = (m1Rows || []).map((r) => r.row_data).filter((d) => d.contaminant);
    const ownership = m3.filter((d) => d.category === "ownership");
    const lease = m3.filter((d) => d.category === "lease");
    const ownershipAnalysis = m3.find((d) => d.category === "ownership_table_analysis")?.text;
    const ownershipSummary = m3.find((d) => d.category === "ownership_lease")?.summary;
    const legalSummary = m3.find((d) => d.category === "legal")?.summary;
    const partyMatching = m3.find((d) => d.category === "party_matching")?.text;
    const factoryHistory = (m5Rows || []).map((r) => r.row_data).filter((d) => d.category === "factory_history_item");
    const aerialNotes = (aerialDocs || [])
      .filter((d) => d.photo_year || d.photo_note)
      .sort((a, b) => (a.photo_year || 9999) - (b.photo_year || 9999))
      .map((d) => `- ${d.photo_year || "연도 미지정"}년: ${d.photo_note || "(메모 없음)"}`)
      .join("\n");
    const fieldItems = [...(fieldSurvey?.field_items || []), ...(fieldSurvey?.interview_items || [])]
      .filter((i) => i?.answer?.trim())
      .map((i) => `- ${i.label}: ${i.answer.trim()}`)
      .join("\n");

    const sections = [
      ["안건", [line("주소(자문대상)", overview.advisory_subject || caseInfo.address), line("안건명", caseInfo.title)].filter(Boolean).join("\n")],
      ["오염 현황", rowsText(contamination, [["contaminant", "오염물질"], ["depth", "심도"], ["max_concentration", "최고농도(mg/kg)"], ["area", "면적"], ["note", "비고"]])],
      ["소유 이력(3.1 표)", rowsText(ownership, [["owner_name", "소유자"], ["acquired_date", "취득"], ["disposed_date", "처분"], ["acquisition_reason", "원인"], ["business_type", "업종"], ["note", "비고"]])],
      ["임대차 이력(3.1 표)", rowsText(lease, [["tenant_name", "임차인"], ["business_type", "업종"], ["lease_start", "시작"], ["lease_end", "종료"], ["lease_type", "유형"], ["note", "비고"]])],
      ["업체–대표자 매칭", partyMatching],
      ["증빙 표 종합 AI 분석(3.1)", ownershipAnalysis],
      ["3.1 판단 내용", ownershipSummary],
      ["법적 검토 요약", legalSummary],
      ["공장 등록·운영 이력(5장)", factoryHistory.map((d) => `- ${JSON.stringify({ ...d, category: undefined })}`).join("\n")],
      ["항공사진 연도별 메모", aerialNotes],
      ["항공사진 타임라인 종합의견", timeline?.content],
      ["현장·청취조사(4장)", fieldItems],
      ["시·도지사 검토의견", overview.sido_opinion],
      ["정화책임자 의견", overview.responsible_party_opinion_text],
    ]
      .filter(([, body]) => body && String(body).trim())
      .map(([title, body]) => `【${title}】\n${String(body).trim()}`);

    if (sections.length <= 1 && !sitePlanDocs?.length) {
      return Response.json(
        { error: "초안을 쓸 자료가 없어요. 3.1 소유 이력이나 항공사진 메모 등을 먼저 입력해주세요" },
        { status: 400 }
      );
    }

    const content = [];
    for (const d of sitePlanDocs || []) {
      const ext = (d.file_name.match(/\.([^.]+)$/)?.[1] || "").toLowerCase();
      const mediaType = MEDIA_TYPE_BY_EXT[ext];
      if (!mediaType) continue;
      const { data: blob } = await supabaseAdmin.storage.from("documents").download(d.file_path);
      if (!blob) continue;
      content.push({ type: "text", text: `[배치도·위치도] ${d.file_name}` });
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: Buffer.from(await blob.arrayBuffer()).toString("base64") },
      });
    }
    content.push({ type: "text", text: `${PROMPT}\n\n[사건 자료]\n${sections.join("\n\n")}` });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1500,
        // 기본으로 켜지는 thinking이 토큰을 다 쓰면 본문이 비므로 끈다(analyze-ownership-table 참고).
        thinking: { type: "disabled" },
        messages: [{ role: "user", content }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data?.error?.message || "AI 초안 작성 중 문제가 발생했어요" }, { status: 500 });
    }

    const draft = (data.content?.map((c) => c.text || "").join("\n") || "")
      .replace(/\*\*/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!draft) {
      return Response.json({ error: "AI가 초안을 만들지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }
    return Response.json({ draft });
  } catch (e) {
    const message =
      e.name === "AbortError"
        ? "AI 초안 작성이 너무 오래 걸려서 중단했어요. 다시 시도해주세요."
        : e.message || "AI 초안 작성 중 문제가 발생했어요";
    return Response.json({ error: message }, { status: 500 });
  }
}
