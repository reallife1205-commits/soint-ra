"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;

export default function TimelinePanel({ caseId, onCountChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                  fontSize: 13,
                }}
              />
              {item.tagCount > 0 && (
                <span className="badge badge-blue">마킹됨 ({item.tagCount}점)</span>
              )}
              <span
                style={{
                  fontSize: 12,
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
                fontSize: 13,
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />

            <div
              style={{
                fontSize: 11,
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
