"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const CATEGORY = "ownership_table";
const MODULE_NUMBER = 3;

function isImageFile(fileName) {
  return /\.(png|jpe?g|gif|webp)$/i.test(fileName || "");
}

export default function OwnershipTableUpload({ caseId }) {
  const [docs, setDocs] = useState([]);
  const [urlMap, setUrlMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [matchingText, setMatchingText] = useState("");
  const [matchingRowId, setMatchingRowId] = useState(null);
  const [matchingSaving, setMatchingSaving] = useState(false);

  useEffect(() => {
    async function loadMatching() {
      const { data } = await supabase
        .from("module_rows")
        .select("*")
        .eq("case_id", caseId)
        .eq("module_number", MODULE_NUMBER)
        .contains("row_data", { category: "party_matching" })
        .maybeSingle();
      if (data) {
        setMatchingRowId(data.id);
        setMatchingText(data.row_data?.text || "");
      }
    }
    async function loadAnalysis() {
      const { data } = await supabase
        .from("module_rows")
        .select("row_data")
        .eq("case_id", caseId)
        .eq("module_number", MODULE_NUMBER)
        .contains("row_data", { category: "ownership_table_analysis" })
        .maybeSingle();
      setAnalysis(data?.row_data || null);
    }
    loadMatching();
    loadAnalysis();
  }, [caseId]);

  async function saveMatching() {
    setMatchingSaving(true);
    const newData = { category: "party_matching", text: matchingText };
    if (matchingRowId) {
      await supabase
        .from("module_rows")
        .update({ row_data: newData, updated_at: new Date().toISOString() })
        .eq("id", matchingRowId);
    } else {
      const { data } = await supabase
        .from("module_rows")
        .insert([{ case_id: caseId, module_number: MODULE_NUMBER, row_order: 0, row_data: newData }])
        .select()
        .single();
      if (data) setMatchingRowId(data.id);
    }
    setMatchingSaving(false);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("case_id", caseId)
      .eq("module_number", MODULE_NUMBER)
      .eq("category", CATEGORY)
      .order("uploaded_at", { ascending: false });
    setDocs(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchUrls() {
      if (docs.length === 0) {
        setUrlMap({});
        return;
      }
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrls(
          docs.map((d) => d.file_path),
          3600
        );
      if (cancelled || !data) return;
      const map = {};
      data.forEach((r, i) => {
        if (r.signedUrl) map[docs[i].id] = r.signedUrl;
      });
      setUrlMap(map);
    }
    fetchUrls();
    return () => {
      cancelled = true;
    };
  }, [docs]);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(png|jpe?g|gif|webp|pdf)$/i.test(file.name)) {
      setError("이미지(jpg/png/webp/gif) 또는 PDF 파일만 올릴 수 있어요.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setError("");

    const extMatch = file.name.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : "";
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = `${caseId}/module${MODULE_NUMBER}/${CATEGORY}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      setError(`업로드에 실패했어요: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("documents").insert([
      {
        case_id: caseId,
        module_number: MODULE_NUMBER,
        category: CATEGORY,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
      },
    ]);

    if (insertError) {
      await supabase.storage.from("documents").remove([filePath]);
      setError(`업로드에 실패했어요: ${insertError.message}`);
      setUploading(false);
      return;
    }

    setUploading(false);
    e.target.value = "";
    load();
  }

  async function handleDelete(doc) {
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    load();
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/analyze-ownership-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setAnalysis(data.analysis);
      }
    } catch (e) {
      setError("분석 중 문제가 발생했어요");
    }
    setAnalyzing(false);
  }

  // 분석 이후 자료를 추가·삭제했으면 결과가 지금 자료 목록과 다르다는 걸 알려준다.
  const analysisStale =
    analysis &&
    [...(analysis.doc_ids || [])].sort().join(",") !== docs.map((d) => d.id).sort().join(",");

  return (
    <div>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 10 }}>
        [표 4]~[표 6]처럼 정해진 양식이 없는 소유·점유 증빙 표(등기부등본, 팩토리온 공장등록,
        공유지연명부 등)를 사진/스캔 이미지나 PDF로 올려주세요. 자료를 모두 올린 뒤 아래
        &quot;AI 분석&quot;을 누르면 전체 자료를 종합해 검토 포인트를 정리해드려요.
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          업체–대표자 매칭 {matchingSaving && <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>저장 중...</span>}
        </div>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 6 }}>
          의견서·법인 서류로 확인한 업체명과 대표자를 한 줄에 하나씩 적어주세요. AI 분석 시 토지대장·등기부의
          개인 이름을 이 목록과 연결해서 봐요. (적은 뒤 &quot;다시 분석&quot;을 눌러야 반영돼요)
        </div>
        <textarea
          value={matchingText}
          onChange={(e) => setMatchingText(e.target.value)}
          onBlur={saveMatching}
          rows={4}
          placeholder={"예) (주)OO산업 = 홍길동 (2005~2015 대표)\n(주)△△테크 = 김철수"}
          style={{ width: "100%", fontSize: 14 }}
        />
      </div>

      <label
        className="btn-secondary"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
      >
        {uploading ? "업로드 중..." : "+ 표 이미지/PDF 선택"}
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ display: "none" }}
        />
      </label>

      {error && (
        <div style={{ color: "var(--color-badge-red-text)", fontSize: 14, marginTop: 8 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>불러오는 중...</div>
        ) : docs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 12px", color: "var(--color-text-muted)", fontSize: 15 }}>
            업로드된 표 없음
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {docs.map((doc) => (
              <div key={doc.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isImageFile(doc.file_name) && urlMap[doc.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urlMap[doc.id]}
                      alt={doc.file_name}
                      style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{ fontSize: 28, flexShrink: 0 }}>
                      {isImageFile(doc.file_name) ? "🖼️" : "📄"}
                    </span>
                  )}
                  <a
                    href={urlMap[doc.id] || "#"}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--color-primary)",
                      fontSize: 15,
                    }}
                    title={doc.file_name}
                  >
                    {doc.file_name}
                  </a>
                  <button
                    onClick={() => handleDelete(doc)}
                    style={{ border: "none", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", flexShrink: 0 }}
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {docs.length > 0 && (
        <div className="card" style={{ padding: 12, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>종합 AI 분석 (자료 {docs.length}건)</div>
            <button
              className="btn-secondary"
              onClick={handleAnalyze}
              disabled={analyzing}
              style={{ flexShrink: 0, fontSize: 14, padding: "6px 10px" }}
            >
              {analyzing ? "분석 중..." : analysis ? "🔄 다시 분석" : "✨ AI 분석"}
            </button>
          </div>
          {analysisStale && !analyzing && (
            <div style={{ fontSize: 13, color: "var(--color-badge-red-text)", marginTop: 8 }}>
              분석 이후 자료가 바뀌었어요. &quot;다시 분석&quot;을 눌러주세요.
            </div>
          )}
          {analysis?.text && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: "var(--color-surface-alt)",
                borderRadius: 8,
                fontSize: 14,
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {analysis.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
