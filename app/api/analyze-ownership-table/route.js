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

아래 형식으로 짧게 작성해주세요.
【표 내용 요약】 이 표가 어떤 항목(기간·소유자·업종 등)으로 구성되어 있는지 1~2문장으로 요약
【검토 포인트】 소유·점유 이력 관점에서 눈에 띄는 점(오염물질 취급 개연성이 있는 업종, 소유·점유
기간이 겹치거나 비는 구간, 특이 변동 등)을 bullet(‑)로 2~5개 정리

표에서 읽을 수 없거나 불확실한 부분은 추정하지 말고 "확인 필요"라고 적어주세요.
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

    const isPdf = mediaType === "application/pdf";
    const content = [
      {
        type: isPdf ? "document" : "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      },
      { type: "text", text: PROMPT },
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

    const analysis = data.content?.map((c) => c.text || "").join("\n") || "";

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
