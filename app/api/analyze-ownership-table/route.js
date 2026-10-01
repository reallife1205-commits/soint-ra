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

const MEDIA_TYPE_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

// 여러 자료를 한 요청에 담으므로 합계로 제한한다(base64로 늘어나도 Claude 요청 상한 32MB 안쪽).
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const PROMPT = `당신은 토양환경보전법에 따른 토양정화자문위원회의 기술검토를 지원하는 보조자입니다.
첨부된 자료들은 대상부지의 "소유·점유 또는 운영" 이력을 보여주는 증빙 표(등기부등본, 토지대장,
팩토리온 공장등록 현황, 공유지연명부 등)입니다. 양식이나 항목 수는 자료마다 다를 수 있습니다.

검토의 핵심 목적은 모든 자료를 종합해 토양오염 원인자(정화책임자)가 누구일 가능성이 높은지
가려내는 것입니다. 아래 형식 그대로, 짧게 작성해주세요.

【자료 요약】 자료마다 "- 자료명: 어느 기간의 무엇을 담고 있는지"를 한 줄씩
【검토 포인트】 "- "로 시작하는 2~3개 항목, 각 항목은 짧은 한 문장으로.
여러 자료를 교차해서 본 결과를 쓰고, 정화책임자 판단에 직접 관련된 것만 오염 개연성이 높은 순서로 적기.
- 오염 발생 가능 시기(공장용지 지목 변경, 공장 건물 등재 등)에 소유·점유·운영한 자가 누구인지
- 그 자가 법인·공장 운영자로서 오염물질을 취급했을 개연성
- 현 소유자(공유자 포함)가 책임을 승계·부담할 여지가 있는지
자료 간 내용이 서로 다르면(소유자·기간 불일치 등) 그 점도 짧게 적기.
일반적인 서류 확인 사항(등기 재작성, 지분 표기 방식 등)은 정화책임자 판단과 무관하면 쓰지 않기.

작성 규칙:
- 마크다운 문법(**굵게**, #제목, 표, 코드블록 등)은 쓰지 말고 일반 텍스트로만 작성
- 위 두 항목 외의 서론·맺음말·부연 설명은 생략
- 이름·연도는 자료에 있는 그대로 쓰고, 불확실한 부분은 추정하지 말고 "확인 필요"라고 적기
- 책임자를 단정하지 말고 "가능성", "개연성"으로 표현하기
이 분석은 검토 보고서 초안 작성을 돕기 위한 참고용이며 최종 판단이 아님을 유념해주세요.`;

function mediaTypeOf(fileName) {
  const extMatch = fileName.match(/\.[^.]+$/);
  return MEDIA_TYPE_BY_EXT[extMatch ? extMatch[0].toLowerCase() : ""];
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
    const { data: docs } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("case_id", caseId)
      .eq("module_number", 3)
      .eq("category", "ownership_table")
      .order("uploaded_at", { ascending: true });

    const usable = (docs || []).filter((d) => mediaTypeOf(d.file_name));
    if (usable.length === 0) {
      return Response.json(
        { error: "분석할 자료가 없어요. 이미지(jpg/png/webp/gif) 또는 PDF를 먼저 올려주세요" },
        { status: 400 }
      );
    }

    const totalSize = usable.reduce((sum, d) => sum + (d.file_size || 0), 0);
    if (totalSize > MAX_TOTAL_BYTES) {
      return Response.json(
        { error: "자료 용량 합계가 너무 커서 분석할 수 없어요 (합계 20MB 이하로 줄여주세요)" },
        { status: 400 }
      );
    }

    const blobs = await Promise.all(
      usable.map((d) => supabaseAdmin.storage.from("documents").download(d.file_path))
    );

    const content = [];
    for (let i = 0; i < usable.length; i++) {
      const { data: blob, error: downloadError } = blobs[i];
      if (downloadError || !blob) {
        return Response.json({ error: `"${usable[i].file_name}" 파일을 불러오지 못했어요` }, { status: 500 });
      }
      const mediaType = mediaTypeOf(usable[i].file_name);
      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      content.push({ type: "text", text: `[자료 ${i + 1}] ${usable[i].file_name}` });
      content.push({
        type: mediaType === "application/pdf" ? "document" : "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
    }

    const { data: matchingRow } = await supabaseAdmin
      .from("module_rows")
      .select("row_data")
      .eq("case_id", caseId)
      .eq("module_number", 3)
      .contains("row_data", { category: "party_matching" })
      .maybeSingle();
    const matchingText = matchingRow?.row_data?.text?.trim();

    const prompt = matchingText
      ? `${PROMPT}

[검토자가 의견서·법인 서류로 확인한 업체–대표자 매칭]
${matchingText}
자료에 위 대표자와 같은 개인 이름이 나오면 "김OO(OO업체 대표자)"처럼 업체와 연결해서 쓰고,
개인 명의와 법인 명의는 법적으로 별개이므로 동일인 여부가 불확실하면 "확인 필요"를 붙이기.`
      : PROMPT;

    content.push({ type: "text", text: prompt });

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
        max_tokens: 1000,
        messages: [{ role: "user", content }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json();

    if (!res.ok) {
      return Response.json(
        { error: data?.error?.message || "AI 분석 중 문제가 발생했어요" },
        { status: 500 }
      );
    }

    let analysis = data.content?.map((c) => c.text || "").join("\n") || "";

    // 토큰 한도에 걸려 문장 중간에 끊긴 경우, 마지막 미완성 줄을 버리고 안내를 붙인다.
    if (data.stop_reason === "max_tokens") {
      const lines = analysis.trimEnd().split("\n");
      if (lines.length > 1) lines.pop();
      analysis = `${lines.join("\n").trimEnd()}\n\n(분석이 길어 일부가 생략되었어요. "다시 분석"을 눌러주세요.)`;
    }

    // 종합 분석 결과는 사건당 하나만 둔다(module_rows, category=ownership_table_analysis).
    const rowData = {
      category: "ownership_table_analysis",
      text: analysis,
      doc_ids: usable.map((d) => d.id),
      analyzed_at: new Date().toISOString(),
    };
    const { data: existing } = await supabaseAdmin
      .from("module_rows")
      .select("id")
      .eq("case_id", caseId)
      .eq("module_number", 3)
      .contains("row_data", { category: "ownership_table_analysis" })
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("module_rows")
        .update({ row_data: rowData, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("module_rows")
        .insert([{ case_id: caseId, module_number: 3, row_order: 0, row_data: rowData }]);
    }

    return Response.json({ analysis: rowData });
  } catch (e) {
    const message =
      e.name === "AbortError"
        ? "AI 분석이 너무 오래 걸려서 중단했어요. 자료 수를 줄이거나 다시 시도해주세요."
        : e.message || "AI 분석 중 문제가 발생했어요";
    return Response.json({ error: message }, { status: 500 });
  }
}
