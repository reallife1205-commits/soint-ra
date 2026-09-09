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
  const [analyzingId, setAnalyzingId] = useState(null);
  const [error, setError] = useState("");

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

  async function handleAnalyze(doc) {
    setAnalyzingId(doc.id);
    setError("");
    try {
      const res = await fetch("/api/analyze-ownership-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, documentId: doc.id }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, analysis: data.analysis } : d)));
      }
    } catch (e) {
      setError("분석 중 문제가 발생했어요");
    }
    setAnalyzingId(null);
  }

  return (
    <div>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 10 }}>
        [표 4]~[표 6]처럼 정해진 양식이 없는 소유·점유 증빙 표(등기부등본, 팩토리온 공장등록,
        공유지연명부 등)를 사진/스캔 이미지나 PDF로 올려주세요. 올린 뒤 "AI 분석"을 누르면
        간단한 검토 포인트를 함께 정리해드려요.
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
                    className="btn-secondary"
                    onClick={() => handleAnalyze(doc)}
                    disabled={analyzingId === doc.id}
                    style={{ flexShrink: 0, fontSize: 14, padding: "6px 10px" }}
                  >
                    {analyzingId === doc.id ? "분석 중..." : doc.analysis ? "🔄 다시 분석" : "✨ AI 분석"}
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    style={{ border: "none", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", flexShrink: 0 }}
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
                {doc.analysis && (
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
                    {doc.analysis}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
