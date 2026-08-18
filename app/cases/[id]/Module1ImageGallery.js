"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Module1ImageGallery({ caseId, category, title }) {
  const [docs, setDocs] = useState([]);
  const [urlMap, setUrlMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("case_id", caseId)
      .eq("module_number", 1)
      .eq("category", category)
      .order("uploaded_at", { ascending: false });
    setDocs(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, category]);

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
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드할 수 있어요.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setError("");

    const extMatch = file.name.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : "";
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = `${caseId}/module1/${category}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      setError(`업로드에 실패했어요: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    await supabase.from("documents").insert([
      {
        case_id: caseId,
        module_number: 1,
        category,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
      },
    ]);

    setUploading(false);
    e.target.value = "";
    load();
  }

  async function handleDelete(doc) {
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    if (selectedDoc?.id === doc.id) setSelectedDoc(null);
    load();
  }

  return (
    <div className="card">
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{title}</div>

      <label
        className="btn-secondary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
        }}
      >
        {uploading ? "업로드 중..." : "+ 이미지 선택"}
        <input
          type="file"
          accept="image/*"
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
          <div
            style={{
              textAlign: "center",
              padding: "32px 12px",
              color: "var(--color-text-muted)",
              fontSize: 15,
            }}
          >
            업로드된 이미지 없음
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {docs.map((doc) => (
              <div key={doc.id} style={{ width: 140 }}>
                <button
                  onClick={() => setSelectedDoc(doc)}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    padding: 0,
                    width: 140,
                    height: 140,
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "var(--color-badge-blue-bg)",
                    display: "block",
                  }}
                  title={doc.file_name}
                >
                  {urlMap[doc.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urlMap[doc.id]}
                      alt={doc.file_name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--color-text-muted)",
                        fontSize: 24,
                      }}
                    >
                      🖼️
                    </div>
                  )}
                </button>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 4,
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={doc.file_name}
                  >
                    {doc.file_name}
                  </span>
                  <button
                    onClick={() => handleDelete(doc)}
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
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDoc && (
        <div
          onClick={() => setSelectedDoc(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 10,
              padding: 16,
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedDoc.file_name}</div>
              <button
                onClick={() => setSelectedDoc(null)}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 19 }}
              >
                ✕
              </button>
            </div>
            {urlMap[selectedDoc.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urlMap[selectedDoc.id]}
                alt={selectedDoc.file_name}
                style={{ maxWidth: "100%", maxHeight: "75vh", display: "block" }}
              />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
                불러오는 중...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
