"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;

export default function TimelinePanel({ caseId, onCountChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const [analysisContent, setAnalysisContent] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisGenerating, setAnalysisGenerating] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisSavedMsg, setAnalysisSavedMsg] = useState("");

  async function load() {
    setLoading(true);

    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .eq("case_id", caseId)
      .eq("module_number", 4)
      .order("uploaded_at", { ascending: false });

    const imageDocs = (docs || []).filter((d) => IMAGE_EXT_RE.test(d.file_name));

    const { data: tags } = await supabase
      .from("aerial_photo_tags")
      .select("document_id")
      .eq("case_id", caseId);

    const tagCounts = {};
    (tags || []).forEach((t) => {
      tagCounts[t.document_id] = (tagCounts[t.document_id] || 0) + 1;
    });

    const withUrls = await Promise.all(
      imageDocs.map(async (doc) => {
        const { data } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.file_path, 3600);
        return {
          ...doc,
          signedUrl: data?.signedUrl || null,
          tagCount: tagCounts[doc.id] || 0,
        };
      })
    );

    withUrls.sort((a, b) => {
      if (a.photo_year && b.photo_year) return a.photo_year - b.photo_year;
      if (a.photo_year) return -1;
      if (b.photo_year) return 1;
      return new Date(a.uploaded_at) - new Date(b.uploaded_at);
    });

    setItems(withUrls);
    setLoading(false);
    if (onCountChange) onCountChange(withUrls.length);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    async function loadAnalysis() {
      setAnalysisLoading(true);
      const { data } = await supabase
        .from("timeline_analyses")
        .select("*")
        .eq("case_id", caseId)
        .maybeSingle();
      if (!cancelled) {
        setAnalysisContent(data?.content || "");
        setAnalysisLoading(false);
      }
    }
    loadAnalysis();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  async function handleSaveAnalysis(newContent) {
    await supabase.from("timeline_analyses").upsert(
      {
        case_id: caseId,
        content: newContent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_id" }
    );
    setAnalysisSavedMsg("저장했어요");
    setTimeout(() => setAnalysisSavedMsg(""), 2000);
  }

  async function handleGenerateAnalysis() {
    if (
      analysisContent.trim() &&
      !confirm("기존에 작성된 분석 내용이 있어요. AI 분석 결과로 덮어쓸까요?")
    ) {
      return;
    }
    setAnalysisGenerating(true);
    setAnalysisError("");
    try {
      const res = await fetch("/api/generate-timeline-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalysisError(data.error || "AI 타임라인 분석에 실패했어요.");
      } else {
        setAnalysisContent(data.analysis);
        await handleSaveAnalysis(data.analysis);
      }
    } catch (e) {
      setAnalysisError("AI 타임라인 분석 중 문제가 발생했어요.");
    }
    setAnalysisGenerating(false);
  }

  function updateLocal(id, field, value) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  async function saveField(id, field, value) {
    setSavingId(id);
    await supabase
      .from("documents")
      .update({ [field]: value })
      .eq("id", id);
    setSavingId(null);
  }

  async function handleDelete(item) {
    if (!confirm(`"${item.file_name}" 사진을 삭제할까요? 태그도 함께 삭제돼요.`)) return;
    await supabase.storage.from("documents").remove([item.file_path]);
    await supabase.from("documents").delete().eq("id", item.id);
    load();
  }

  if (loading) {
    return <div className="card">불러오는 중이에요...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        아직 등록된 항공사진이 없어요. &apos;사진 업로드&apos; 탭에서 먼저 사진을
        올려주세요.
      </div>
    );
  }

  const markedCount = items.filter((i) => i.tagCount > 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 4,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>✨ AI 타임라인 분석 (Sonnet 5)</div>
            <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              마킹 {markedCount}/{items.length}장
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={handleGenerateAnalysis}
            disabled={analysisGenerating || analysisLoading}
          >
            {analysisGenerating ? "분석 중..." : "✨ 분석 실행"}
          </button>
        </div>

        {analysisError && (
          <div style={{ color: "var(--color-badge-red-text)", fontSize: 14, margin: "10px 0" }}>
            {analysisError}
          </div>
        )}

        {analysisLoading ? (
          <div style={{ fontSize: 15, color: "var(--color-text-muted)", marginTop: 16 }}>
            불러오는 중...
          </div>
        ) : (
          <>
            <textarea
              value={analysisContent}
              onChange={(e) => setAnalysisContent(e.target.value)}
              onBlur={() => handleSaveAnalysis(analysisContent)}
              placeholder="위 '분석 실행' 버튼을 누르면 AI가 타임라인의 변곡점을 짚어가며 종합의견을 작성해요."
              rows={10}
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
              {analysisSavedMsg}
            </div>
          </>
        )}
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className="card"
          style={{ display: "flex", gap: 16, alignItems: "flex-start" }}
        >
          <div
            style={{
              width: 120,
              height: 90,
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--color-surface-alt)",
              flexShrink: 0,
            }}
          >
            {item.signedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.signedUrl}
                alt={item.file_name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <input
                type="number"
                placeholder="연도"
                value={item.photo_year || ""}
                onChange={(e) => updateLocal(item.id, "photo_year", e.target.value)}
                onBlur={(e) =>
                  saveField(
                    item.id,
                    "photo_year",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                style={{
                  width: 90,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  fontSize: 15,
                }}
              />
              {item.tagCount > 0 && (
                <span className="badge badge-blue">마킹됨 ({item.tagCount}점)</span>
              )}
              <span
                style={{
                  fontSize: 14,
                  color: "var(--color-text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={item.file_name}
              >
                {item.file_name}
              </span>
            </div>

            <textarea
              placeholder="관찰 내용 메모 (예: 공장 건물 존재, 주유소 확인 등)"
              value={item.photo_note || ""}
              onChange={(e) => updateLocal(item.id, "photo_note", e.target.value)}
              onBlur={(e) => saveField(item.id, "photo_note", e.target.value)}
              rows={2}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                fontSize: 15,
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />

            <div
              style={{
                fontSize: 13,
                color: "var(--color-text-muted)",
                marginTop: 6,
              }}
            >
              업로드: {new Date(item.uploaded_at).toLocaleDateString("ko-KR")}
              {savingId === item.id ? " · 저장 중..." : ""}
            </div>
          </div>

          <button
            onClick={() => handleDelete(item)}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              flexShrink: 0,
            }}
            title="삭제"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
