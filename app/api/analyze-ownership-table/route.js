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

const MAX_BYTES = 15 * 1024 * 1024; // Claude 요청 페이로드 부담을 고려한 상한

const PROMPT = `당신은 토양환경보전법에 따른 토양정화자문위원회의 기술검토를 지원하는 보조자입니다.
첨부된 자료는 대상부지의 "소유·점유 또는 운영" 이력을 보여주는 증빙 표(등기부등본, 팩토리온
공장등록 현황, 공유지연명부 등)입니다. 양식이나 항목 수는 자료마다 다를 수 있습니다.

검토의 핵심 목적은 토양오염 원인자(정화책임자)가 누구일 가능성이 높은지 가려내는 것입니다.
아래 형식 그대로, 짧게 작성해주세요.

【표 내용 요약】 어떤 자료이고 어느 기간의 무엇을 담고 있는지 2문장 이내로
【검토 포인트】 "- "로 시작하는 2~3개 항목, 각 항목은 짧은 한 문장으로.
정화책임자 판단에 직접 관련된 것만 쓰고, 오염 개연성이 높은 순서로 적기.
- 오염 발생 가능 시기(공장용지 지목 변경, 공장 건물 등재 등)에 소유·점유·운영한 자가 누구인지
- 그 자가 법인·공장 운영자로서 오염물질을 취급했을 개연성
- 현 소유자(공유자 포함)가 책임을 승계·부담할 여지가 있는지
일반적인 서류 확인 사항(등기 재작성, 지분 표기 방식 등)은 정화책임자 판단과 무관하면 쓰지 않기.

작성 규칙:
- 마크다운 문법(**굵게**, #제목, 표, 코드블록 등)은 쓰지 말고 일반 텍스트로만 작성
- 위 두 항목 외의 서론·맺음말·부연 설명은 생략
- 이름·연도는 표에 있는 그대로 쓰고, 불확실한 부분은 추정하지 말고 "확인 필요"라고 적기
- 책임자를 단정하지 말고 "가능성", "개연성"으로 표현하기
이 분석은 검토 보고서 초안 작성을 돕기 위한 참고용이며 최종 판단이 아님을 유념해주세요.`;

export async function POST(req) {
  const { caseId, documentId } = await req.json();
  if (!caseId || !documentId) {
    return Response.json({ error: "caseId와 documentId가 필요해요" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Claude API 키가 설정되지 않았어요" }, { status: 500 });
  }

  try {
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("case_id", caseId)
      .single();

    if (docError || !doc) {
      return Response.json({ error: "문서를 찾을 수 없어요" }, { status: 404 });
    }

    const extMatch = doc.file_name.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0].toLowerCase() : "";
    const mediaType = MEDIA_TYPE_BY_EXT[ext];
    if (!mediaType) {
      return Response.json(
        { error: "이미지(jpg/png/webp/gif) 또는 PDF 파일만 분석할 수 있어요" },
        { status: 400 }
      );
    }

    if (doc.file_size && doc.file_size > MAX_BYTES) {
      return Response.json(
        { error: "파일이 너무 커서 분석할 수 없어요 (15MB 이하로 올려주세요)" },
        { status: 400 }
      );
    }

    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from("documents")
      .download(doc.file_path);

    if (downloadError || !blob) {
      return Response.json({ error: "파일을 불러오지 못했어요" }, { status: 500 });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = buffer.toString("base64");

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
표에 위 대표자와 같은 개인 이름이 나오면 "김OO(OO업체 대표자)"처럼 업체와 연결해서 쓰고,
개인 명의와 법인 명의는 법적으로 별개이므로 동일인 여부가 불확실하면 "확인 필요"를 붙이기.`
      : PROMPT;

    const isPdf = mediaType === "application/pdf";
    const content = [
      {
        type: isPdf ? "document" : "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      },
      { type: "text", text: prompt },
    ];

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

    await supabaseAdmin.from("documents").update({ analysis }).eq("id", documentId);

    return Response.json({ analysis });
  } catch (e) {
    const message =
      e.name === "AbortError"
        ? "AI 분석이 너무 오래 걸려서 중단했어요. 다시 시도해주세요."
        : e.message || "AI 분석 중 문제가 발생했어요";
    return Response.json({ error: message }, { status: 500 });
  }
}
