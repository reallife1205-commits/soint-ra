"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DocumentUpload({ caseId, moduleNumber }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("case_id", caseId)
      .eq("module_number", moduleNumber)
      .order("uploaded_at", { ascending: false });
    setDocs(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, moduleNumber]);

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

    await supabase.from("documents").insert([
      {
        case_id: caseId,
        module_number: moduleNumber,
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
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
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
        <div style={{ color: "var(--color-badge-red-text)", fontSize: 12, marginTop: 8 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>불러오는 중...</div>
        ) : docs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 12px",
              color: "var(--color-text-muted)",
              fontSize: 13,
            }}
          >
            업로드된 문서 없음
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {docs.map((doc) => (
              <li
                key={doc.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--color-border)",
                  fontSize: 13,
                }}
              >
                <button
                  onClick={() => handleDownload(doc)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--color-primary)",
                    cursor: "pointer",
                    textAlign: "left",
                    padding: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 160,
                  }}
                  title={doc.file_name}
                >
                  📄 {doc.file_name}
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--color-text-muted)",
                    cursor: "pointer",
                  }}
                  title="삭제"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
