"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function isImageFile(fileName) {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName || "");
}

export default function DocumentUpload({ caseId, moduleNumber }) {
  const [docs, setDocs] = useState([]);
  const [urlMap, setUrlMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("case_id", caseId)
      .eq("module_number", moduleNumber)
      .is("category", null)
      .order("uploaded_at", { ascending: false });
    setDocs(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, moduleNumber]);

  useEffect(() => {
    let cancelled = false;
    async function fetchUrls() {
      const imageDocs = docs.filter((d) => isImageFile(d.file_name));
      if (imageDocs.length === 0) {
        setUrlMap({});
        return;
      }
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrls(
          imageDocs.map((d) => d.file_path),
          3600
        );
      if (cancelled || !data) return;
      const map = {};
      data.forEach((r, i) => {
        if (r.signedUrl) map[imageDocs[i].id] = r.signedUrl;
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
    setUploading(true);
    setError("");

    // 파일 경로(내부 저장용 이름)는 영어/숫자만 남기고, 화면에 보여줄 이름은 원본 그대로 유지
    const extMatch = file.name.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : "";
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = `${caseId}/module${moduleNumber}/${safeName}`;

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
        module_number: moduleNumber,
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

  async function handleDownload(doc) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
        참고 문서 업로드
      </div>

      <label
        className="btn-secondary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
        }}
      >
        {uploading ? "업로드 중..." : "+ 파일 선택"}
        <input
          type="file"
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
            업로드된 문서 없음
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {docs.map((doc) => {
              const isImage = isImageFile(doc.file_name);
              return (
                <li
                  key={doc.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--color-border)",
                    fontSize: 15,
                    gap: 6,
                  }}
                >
                  <button
                    onClick={() =>
                      isImage && urlMap[doc.id]
                        ? setPreviewDoc(doc)
                        : handleDownload(doc)
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      border: "none",
                      background: "transparent",
                      color: "var(--color-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                      padding: 0,
                      overflow: "hidden",
                      minWidth: 0,
                    }}
                    title={doc.file_name}
                  >
                    {isImage ? (
                      urlMap[doc.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={urlMap[doc.id]}
                          alt={doc.file_name}
                          style={{
                            width: 32,
                            height: 32,
                            objectFit: "cover",
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <span style={{ flexShrink: 0 }}>🖼️</span>
                      )
                    ) : (
                      <span style={{ flexShrink: 0 }}>📄</span>
                    )}
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {doc.file_name}
                    </span>
                  </button>
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
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {previewDoc && (
        <div
          onClick={() => setPreviewDoc(null)}
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
              <div style={{ fontWeight: 700, fontSize: 16 }}>{previewDoc.file_name}</div>
              <button
                onClick={() => setPreviewDoc(null)}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 19 }}
              >
                ✕
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlMap[previewDoc.id]}
              alt={previewDoc.file_name}
              style={{ maxWidth: "100%", maxHeight: "75vh", display: "block" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
