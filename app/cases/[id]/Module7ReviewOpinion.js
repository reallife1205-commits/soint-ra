"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const PLACEHOLDER = `위쪽 "AI 초안 생성" 버튼을 누르거나, 직접 의견을 입력하세요.

예시:
【오염물질의 기여도 판단】
...

【소유·점유·운영 이력 분석】
...`;

export default function ReviewOpinionTab({ caseId }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("review_opinions")
        .select("*")
        .eq("case_id", caseId)
        .maybeSingle();
      if (!cancelled) {
        setContent(data?.content || "");
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  async function handleSave(newContent) {
    await supabase.from("review_opinions").upsert(
      {
        case_id: caseId,
        content: newContent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_id" }
    );
    setSavedMsg("저장했어요");
    setTimeout(() => setSavedMsg(""), 2000);
  }

  async function handleGenerate() {
    if (content.trim() && !confirm("기존에 작성하신 내용이 있어요. AI 초안으로 덮어쓸까요?")) {
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "AI 초안 생성에 실패했어요.");
      } else {
        setContent(data.draft);
        await handleSave(data.draft);
      }
    } catch (e) {
      setError("AI 초안 생성 중 문제가 발생했어요.");
    }
    setGenerating(false);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>종합 검토 의견</div>
          <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
            전 모듈 데이터를 검토해 의견을 작성하세요. AI로 초안을 만든 뒤 직접 다듬으셔도 돼요.
          </div>
        </div>
        <button className="btn-primary" onClick={handleGenerate} disabled={generating || loading}>
          {generating ? "AI가 작성 중..." : "✨ AI 초안 생성"}
        </button>
      </div>

      {error && (
        <div style={{ color: "var(--color-badge-red-text)", fontSize: 14, margin: "10px 0" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 15, color: "var(--color-text-muted)", marginTop: 16 }}>불러오는 중...</div>
      ) : (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={() => handleSave(content)}
            placeholder={PLACEHOLDER}
            rows={16}
            style={{
              width: "100%",
              marginTop: 14,
              padding: 14,
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: 15,
              fontFamily: "inherit",
              lineHeight: 1.6,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
          <div style={{ fontSize: 14, color: "var(--color-primary)", marginTop: 6, minHeight: 16 }}>
            {savedMsg}
          </div>
        </>
      )}
    </div>
  );
}
