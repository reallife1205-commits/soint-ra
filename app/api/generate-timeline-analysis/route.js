import { createClient } from "@supabase/supabase-js";
import { FACILITY_LABEL } from "@/lib/facilityTypes";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fetchTimeline(caseId) {
  const { data: docs } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .eq("module_number", 4)
    .order("photo_year", { ascending: true, nullsFirst: false });

  const imageDocs = (docs || []).filter((d) => IMAGE_EXT_RE.test(d.file_name));

  const { data: tags } = await supabaseAdmin
    .from("aerial_photo_tags")
    .select("*")
    .eq("case_id", caseId);

  const tagsByDoc = {};
  (tags || []).forEach((t) => {
    if (!tagsByDoc[t.document_id]) tagsByDoc[t.document_id] = [];
    tagsByDoc[t.document_id].push(t);
  });

  return imageDocs.map((d) => ({
    year: d.photo_year || null,
    note: d.photo_note || null,
    tags: (tagsByDoc[d.id] || []).map((t) => ({
      type: FACILITY_LABEL[t.facility_type] || t.facility_type,
      note: t.note || null,
    })),
  }));
}

function buildPrompt(timeline) {
  const entries = timeline
    .map((item, i) => {
      const tagLines =
        item.tags.length > 0
          ? item.tags.map((t) => `  - ${t.type}${t.note ? ` (${t.note})` : ""}`).join("\n")
          : "  - 마킹된 시설 없음";
      return `[${i + 1}번째 시점: ${item.year ? `${item.year}년` : "연도 미상"}]
관찰 메모: ${item.note || "없음"}
마킹된 시설:
${tagLines}`;
    })
    .join("\n\n");

  return `당신은 토양환경보전법에 따른 토양정화자문위원회의 기술검토를 지원하는 보조자입니다.
아래는 대상부지의 항공사진 타임라인(시간 순 촬영 시점별 관찰 메모와 마킹된 시설 정보)입니다.
이 자료를 바탕으로 "항공사진 타임라인 종합의견" 초안을 작성해주세요.

[항공사진 타임라인]
${entries || "입력된 자료 없음"}

작성 지침:
- 아래와 같은 대괄호 소제목 형식으로 작성해주세요.
  【시간 흐름 개요】
  【주요 변곡점】
  【종합 의견】
- 【시간 흐름 개요】에서는 전체 시점을 훑으며 부지 이용 현황이 어떻게 변화해왔는지 간단히 정리해주세요.
- 【주요 변곡점】에서는 연속된 시점 사이에 업종/시설이 완전히 바뀌거나, 새로운 시설(저장탱크·주유소 등 오염 우려가 있는 시설)이 새로 생기거나 없어지는 등 의미 있는 변화가 있는 시점만 골라 "N번째 시점(연도)" 형식으로 명시하고, 무엇이 어떻게 바뀌었는지 구체적으로 설명해주세요. 특별한 변화가 없으면 그렇게 명시해주세요.
- 【종합 의견】에서는 위 변곡점들이 토양오염 개연성 판단에 어떤 의미를 가지는지 검토 보고서 톤으로 정리해주세요.
- 각 항목은 위에 제공된 자료에 근거해서만 작성하고, 자료가 부족하면 "관련 자료가 확인되지 않음"이라고 명확히 적어주세요.
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
    const timeline = await fetchTimeline(caseId);
    if (timeline.length === 0) {
      return Response.json(
        { error: "분석할 항공사진이 없어요. 먼저 사진을 업로드해주세요." },
        { status: 400 }
      );
    }
    const prompt = buildPrompt(timeline);

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
        { error: data?.error?.message || "AI 타임라인 분석 중 문제가 발생했어요" },
        { status: 500 }
      );
    }

    const text = data.content?.map((c) => c.text || "").join("\n") || "";
    return Response.json({ analysis: text });
  } catch (e) {
    const message =
      e.name === "AbortError"
        ? "AI 타임라인 분석이 너무 오래 걸려서 중단했어요. 다시 시도해주세요."
        : e.message || "AI 타임라인 분석 중 문제가 발생했어요";
    return Response.json({ error: message }, { status: 500 });
  }
}
