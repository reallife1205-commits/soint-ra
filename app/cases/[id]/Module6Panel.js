"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const FIELD_ITEMS_DEFAULT = [
  "위험물질·오염원 관련 시설의 설치 유무 확인 및 물질의 보관상태",
  "토양 표면상태, 시설 설치상태, 지하수 관측정 설치 유무 및 사용 여부",
  "오염 의심 누출 흔적",
  "악취·비산물질이 새어나거나 방치된 흔적 여부",
  "기타 오염 정황을 확인할 수 있는 현장 사항",
];

const INTERVIEW_ITEMS_DEFAULT = [
  "과거 및 현재의 부지 관리·이용 이력",
  "대상부지의 주요 시설 현황 및 배치, 이전 사정",
  "토양오염물질·유해화학물질 및 유류 등의 관리 상태",
  "오염사고 사례",
  "기타 부지환경 상태를 확인할 수 있는 사항",
];

const PHOTO_CATEGORIES = [
  "위험물질·오염원 관련 시설",
  "토양 표면, 지하수 관측정",
  "지하수 관측시설 설치 및 사용",
  "오염 식생·누출 흔적",
  "폐기물 방치·야적 상태",
  "기타",
];

export default function Module6Panel({ caseId }) {
  const [loading, setLoading] = useState(true);
  const [surveyDate, setSurveyDate] = useState("");
  const [fieldItems, setFieldItems] = useState(
    FIELD_ITEMS_DEFAULT.map((label) => ({ label, checked: false, answer: "" }))
  );
  const [interviewItems, setInterviewItems] = useState(
    INTERVIEW_ITEMS_DEFAULT.map((label) => ({ label, checked: false, answer: "" }))
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("field_surveys")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();

    if (data) {
      setSurveyDate(data.survey_date || "");
      if (data.field_items?.length) setFieldItems(data.field_items);
      if (data.interview_items?.length) setInterviewItems(data.interview_items);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  function updateFieldItem(index, patch) {
    setFieldItems((items) =>
      items.map((it, i) => (i === index ? { ...it, ...patch } : it))
    );
    setSavedMsg("");
  }

  function updateInterviewItem(index, patch) {
    setInterviewItems((items) =>
      items.map((it, i) => (i === index ? { ...it, ...patch } : it))
    );
    setSavedMsg("");
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from("field_surveys").upsert(
      {
        case_id: caseId,
        survey_date: surveyDate || null,
        field_items: fieldItems,
        interview_items: interviewItems,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_id" }
    );
    setSaving(false);
    setSavedMsg("저장했어요!");
  }

  if (loading) {
    return <div className="card">불러오는 중이에요...</div>;
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, marginRight: 10 }}>
          현장조사 일자
        </label>
        <input
          type="date"
          value={surveyDate}
          onChange={(e) => {
            setSurveyDate(e.target.value);
            setSavedMsg("");
          }}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
          }}
        />
      </div>

      <ChecklistCard
        title="현장조사"
        note="※ 오염원 단서, 관리상태, 노출 여부 등 확인"
        items={fieldItems}
        onChange={updateFieldItem}
      />

      <ChecklistCard
        title="청취조사"
        note="※ 대상부지 오염원, 관리이력, 정지기록, 지역 상황을 담당자로부터 청취조사"
        items={interviewItems}
        onChange={updateInterviewItem}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 24 }}>
        {savedMsg && <span style={{ fontSize: 13, color: "var(--color-primary)" }}>{savedMsg}</span>}
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : "체크리스트 저장"}
        </button>
      </div>

      <FieldPhotos caseId={caseId} />
    </div>
  );
}

function ChecklistCard({ title, note, items, onChange }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 14 }}>
        {note}
      </div>

      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: "10px 0",
            borderBottom: i < items.length - 1 ? "1px solid var(--color-border)" : "none",
          }}
        >
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) => onChange(i, { checked: e.target.checked })}
              style={{ marginTop: 3 }}
            />
            <span>{item.label}</span>
          </label>
          <input
            value={item.answer}
            onChange={(e) => onChange(i, { answer: e.target.value })}
            placeholder="확인 내용을 입력하세요 (예: 없음, 확인되지 않음 등)"
            style={{
              width: "100%",
              marginTop: 6,
              marginLeft: 24,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function FieldPhotos({ caseId }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState("");
  const [error, setError] = useState("");
  const [captionInput, setCaptionInput] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("case_id", caseId)
      .eq("module_number", 6)
      .order("uploaded_at", { ascending: false });
    setDocs(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function uploadFile(file, caption, key) {
    setUploadingKey(key);
    setError("");

    const extMatch = file.name.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : "";
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = `${caseId}/module6/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      setError(`업로드에 실패했어요: ${uploadError.message}`);
      setUploadingKey("");
      return;
    }

    await supabase.from("documents").insert([
      {
        case_id: caseId,
        module_number: 6,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        photo_note: caption,
      },
    ]);

    setUploadingKey("");
    load();
  }

  async function handleDelete(doc) {
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    load();
  }

  function docForCategory(category) {
    return docs.find((d) => d.photo_note === category);
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>현장 사진</div>
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 14 }}>
        항목별로 사진을 찍거나 앨범에서 선택해서 올려주세요.
      </div>

      {error && (
        <div style={{ color: "var(--color-badge-red-text)", fontSize: 12, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {PHOTO_CATEGORIES.map((category) => {
          const doc = docForCategory(category);
          const busy = uploadingKey === category;
          return (
            <div
              key={category}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: 110,
                  background: "#eef1eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {doc ? (
                  <PhotoThumb doc={doc} />
                ) : (
                  <span style={{ fontSize: 28, color: "var(--color-text-muted)" }}>📷</span>
                )}
              </div>
              <div style={{ padding: 10 }}>
                <div
                  style={{
                    fontSize: 12,
                    textAlign: "center",
                    marginBottom: 8,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {category}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <UploadButton
                    label={busy ? "..." : "📷 촬영"}
                    capture
                    disabled={busy}
                    onSelect={(file) => uploadFile(file, category, category)}
                  />
                  <UploadButton
                    label={busy ? "..." : "🖼 앨범"}
                    disabled={busy}
                    onSelect={(file) => uploadFile(file, category, category)}
                  />
                </div>
                {doc && (
                  <button
                    onClick={() => handleDelete(doc)}
                    style={{
                      marginTop: 6,
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      color: "var(--color-badge-red-text)",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <input
          value={captionInput}
          onChange={(e) => setCaptionInput(e.target.value)}
          placeholder="사진 설명 (예: 배관 부식 상태)"
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
          }}
        />
        <UploadButton
          label={uploadingKey === "extra" ? "업로드 중..." : "+ 추가 사진 업로드"}
          disabled={uploadingKey === "extra"}
          onSelect={(file) => uploadFile(file, captionInput || file.name, "extra")}
        />
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>불러오는 중...</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 12,
          }}
        >
          {docs
            .filter((d) => !PHOTO_CATEGORIES.includes(d.photo_note))
            .map((doc) => (
              <div key={doc.id} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-border)" }}>
                <div style={{ height: 100, background: "#eef1eb" }}>
                  <PhotoThumb doc={doc} />
                </div>
                <div style={{ padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.photo_note || doc.file_name}
                  </span>
                  <button
                    onClick={() => handleDelete(doc)}
                    style={{ border: "none", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function UploadButton({ label, capture, disabled, onSelect }) {
  return (
    <label
      className="btn-secondary"
      style={{
        flex: 1,
        textAlign: "center",
        fontSize: 12,
        padding: "6px 8px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
      <input
        type="file"
        accept="image/*"
        capture={capture ? "environment" : undefined}
        disabled={disabled}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function PhotoThumb({ doc }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl || null);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.file_path]);

  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={doc.photo_note || doc.file_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
}
