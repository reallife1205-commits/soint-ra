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

모든 자료를 종합해 정화책임자(토양오염 원인자)가 누구인지 판단하는 데 필요한 내용만,
아래 형식 그대로 짧고 쉽게 작성해주세요.

【자료 요약】
- 자료명: 기간, 핵심 내용 (자료마다 한 줄, 20자 안팎)

【검토 포인트】
- 2~3개, 각각 한 문장. 정화책임자 판단에 중요한 순서로.
- 다룰 내용: 공장 운영 시기(공장용지 지목 변경, 공장 건물 등재 등)에 누가 소유·점유·운영했는지,
  그 자가 오염물질을 다뤘을 만한지, 현 소유자에게 책임이 이어지는지
- 자료끼리 소유자·기간이 서로 다르면 그 점을 한 문장으로

작성 규칙:
- 일반 텍스트로만 작성(**굵게**, #제목, 표 등 마크다운 금지), 서론·맺음말 없이 위 두 항목만
- 이름·연도는 자료에 있는 그대로 쓰기
- "추정", "확인 필요", "~로 보임", "~일 수 있음" 같은 애매한 표현은 쓰지 말고 자료에 나온 사실대로 단정해서 쓰기.
  자료로 알 수 없는 내용은 아예 쓰지 않기
- 정화책임자에 대한 결론만 "정화책임자 가능성 높음"처럼 표현
- 정화책임자 판단과 무관한 서류 형식 문제(등기 재작성, 지분 표기 방식 등)는 쓰지 않기`;

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

[검토자가 확인을 마친 업체–대표자 매칭]
${matchingText}
위 매칭은 이미 확인된 사실이므로 그대로 받아들이기. 자료에 위 대표자 이름이 나오면
"김OO(OO업체 대표자)"처럼 업체와 연결해서 쓰고, 동일인 여부에 "추정"이나 "확인 필요"를 붙이지 않기.`
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
        // claude-sonnet-5는 thinking을 생략하면 기본으로 켜져서, 자료가 많을 때 1000토큰을
        // 생각하는 데 다 쓰고 본문이 비어버린다. 짧은 요약 작업이라 꺼둔다.
        thinking: { type: "disabled" },
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

    let analysis = data.content?.map((c) => c.text || "").join("\n").trim() || "";

    if (!analysis) {
      return Response.json(
        { error: "AI가 분석 결과를 내지 못했어요. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }

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
