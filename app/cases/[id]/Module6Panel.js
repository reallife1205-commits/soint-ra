"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { shrinkImageForUpload, uploadBlockReason, friendlyUploadError } from "@/lib/shrinkImage";
import { PasteZone, RenameButton, RenameInput, splitExt, withOriginalExt } from "./UploadHelpers";
import { PHOTO_CATEGORIES } from "@/lib/fieldPhotos";

const FIELD_ITEMS_DEFAULT = [
  "특정토양오염관리대상시설의 설치장소 확인 및 물질의 보관상태",
  "토양 표면상태, 식물 생장상태, 지하수 관측정 설치장소 및 사용 유무",
  "오염지역의 누출흔적",
  "각종 폐기물의 매립 또는 방치 여부",
  "오염개연성 관련 사항",
];

const INTERVIEW_ITEMS_DEFAULT = [
  "과거 및 현재의 부지용도 및 이력",
  "대상부지의 주요 시설현황 및 폐쇄 또는 이전 사항",
  "토양오염물질, 유해화학물질 및 유독물 등의 관리 상태",
  "오염사고 사례",
  "기타 부지환경 상태를 확인할 수 있는 사항",
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
  const [saveError, setSaveError] = useState("");
  // 마지막으로 불러오거나 저장한 내용. 바뀐 게 없으면 저장하지 않는다 (다른 탭의 예전 내용으로 덮어쓰기 방지).
  const lastSaved = useRef(null);

  function snapshotOf(date, field, interview) {
    return JSON.stringify({ survey_date: date || null, field_items: field, interview_items: interview });
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("field_surveys")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();

    let date = "";
    let field = fieldItems;
    let interview = interviewItems;
    if (data) {
      date = data.survey_date || "";
      if (data.field_items?.length) field = data.field_items;
      if (data.interview_items?.length) interview = data.interview_items;
      setSurveyDate(date);
      setFieldItems(field);
      setInterviewItems(interview);
    }
    lastSaved.current = snapshotOf(date, field, interview);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // 입력칸에서 나올 때, 체크박스·날짜를 바꿀 때 자동 저장한다 (다른 장과 같은 방식).
  async function save(overrides = {}) {
    const date = overrides.surveyDate ?? surveyDate;
    const field = overrides.fieldItems ?? fieldItems;
    const interview = overrides.interviewItems ?? interviewItems;
    const snapshot = snapshotOf(date, field, interview);
    if (snapshot === lastSaved.current) return true;

    setSaving(true);
    setSaveError("");
    const { error } = await supabase.from("field_surveys").upsert(
      {
        case_id: caseId,
        survey_date: date || null,
        field_items: field,
        interview_items: interview,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_id" }
    );
    setSaving(false);
    if (error) {
      setSaveError(`저장에 실패했어요: ${error.message}`);
      return false;
    }
    lastSaved.current = snapshot;
    return true;
  }

  function updateFieldItem(index, patch, { saveNow = false } = {}) {
    const next = fieldItems.map((it, i) => (i === index ? { ...it, ...patch } : it));
    setFieldItems(next);
    if (saveNow) save({ fieldItems: next });
  }

  function updateInterviewItem(index, patch, { saveNow = false } = {}) {
    const next = interviewItems.map((it, i) => (i === index ? { ...it, ...patch } : it));
    setInterviewItems(next);
    if (saveNow) save({ interviewItems: next });
  }

  if (loading) {
    return <div className="card">불러오는 중이에요...</div>;
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 15, fontWeight: 600, marginRight: 10 }}>
          현장조사 일자
        </label>
        <input
          type="date"
          value={surveyDate}
          onChange={(e) => {
            setSurveyDate(e.target.value);
            save({ surveyDate: e.target.value });
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
        note="※ 오염개연시설 존부, 오염물질 누출 등 현장 확인"
        items={fieldItems}
        onChange={updateFieldItem}
        onBlur={() => save()}
      />

      <ChecklistCard
        title="청취조사"
        note="※ 대상부지 소유자, 관리자, 근무자, 지역 공무원 등 직접 방문 또는 전화 인터뷰 등 실시"
        items={interviewItems}
        onChange={updateInterviewItem}
        onBlur={() => save()}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 24, minHeight: 20 }}>
        {saveError && <span style={{ fontSize: 15, color: "var(--color-badge-red-text)" }}>{saveError}</span>}
        {!saveError && saving && <span style={{ fontSize: 15, color: "var(--color-text-muted)" }}>저장 중...</span>}
      </div>

      <FieldPhotos caseId={caseId} />
    </div>
  );
}

function ChecklistCard({ title, note, items, onChange, onBlur }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 14 }}>
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
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 15 }}>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) => onChange(i, { checked: e.target.checked }, { saveNow: true })}
              style={{ marginTop: 3 }}
            />
            <span>{item.label}</span>
          </label>
          <input
            value={item.answer}
            onChange={(e) => onChange(i, { answer: e.target.value })}
            onBlur={onBlur}
            placeholder="확인 내용을 입력하세요 (예: 없음, 확인되지 않음 등)"
            style={{
              width: "100%",
              marginTop: 6,
              marginLeft: 24,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: 15,
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
  const [renamingId, setRenamingId] = useState(null);

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

  async function uploadFile(picked, caption, key) {
    const blocked = uploadBlockReason(picked);
    if (blocked) {
      setError(blocked);
      return;
    }
    setUploadingKey(key);
    setError("");
    const file = await shrinkImageForUpload(picked); // 큰 사진은 줄여서(용량 한도 초과 방지)

    const extMatch = file.name.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : "";
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = `${caseId}/module6/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      setError(friendlyUploadError(uploadError.message));
      setUploadingKey("");
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("documents")
      .insert([
        {
          case_id: caseId,
          module_number: 6,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          photo_note: caption,
        },
      ])
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from("documents").remove([filePath]);
      setError(`업로드에 실패했어요: ${insertError.message}`);
      setUploadingKey("");
      return;
    }

    setUploadingKey("");
    await load();
    return inserted;
  }

  // 추가 사진은 화면에 보이는 이름이 사진 설명(photo_note)이라 그걸 바꾼다. 파일 이름도 같이 맞춘다.
  async function saveRename(doc, draft) {
    setRenamingId(null);
    const { error: renameError } = await supabase
      .from("documents")
      .update({ photo_note: draft, file_name: withOriginalExt(doc.file_name, draft) })
      .eq("id", doc.id);
    if (renameError) {
      setError(`이름을 바꾸지 못했어요: ${renameError.message}`);
      return;
    }
    load();
  }

  // 캡처를 붙여넣은 추가 사진: 설명 칸을 비워 뒀으면 올린 뒤 바로 이름(설명) 칸을 연다
  async function pasteExtra(file) {
    const inserted = await uploadFile(file, captionInput || file.name, "extra");
    if (inserted && !captionInput) setRenamingId(inserted.id);
  }

  async function handleDelete(doc) {
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    load();
  }

  // 항목 칸 사진의 보고서 제목(documents.caption, sql/027). 칸 이름(photo_note)은 칸 구분용이라 그대로 둔다.
  async function saveCaption(doc, value) {
    const caption = value.trim() || null;
    if (caption === (doc.caption || null)) return;
    const { error: captionError } = await supabase.from("documents").update({ caption }).eq("id", doc.id);
    if (captionError) {
      setError(`제목을 저장하지 못했어요: ${captionError.message}`);
      return;
    }
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, caption } : d)));
  }

  function docForCategory(category) {
    return docs.find((d) => d.photo_note === category);
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>현장 사진</div>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 14 }}>
        항목별로 사진을 찍거나 앨범에서 선택해서 올려주세요.
      </div>

      {error && (
        <div style={{ color: "var(--color-badge-red-text)", fontSize: 14, marginBottom: 10 }}>
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
                  background: "var(--color-surface-alt)",
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
                {doc && (
                  <input
                    key={doc.id}
                    defaultValue={doc.caption || ""}
                    onBlur={(e) => saveCaption(doc, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && e.target.blur()}
                    placeholder="보고서 사진 제목 (비우면 빈칸)"
                    title="보고서의 사진 아래에 들어갈 제목이에요. 비워 두면 보고서에도 빈칸으로 들어가요."
                    style={{
                      width: "100%",
                      marginBottom: 8,
                      padding: "6px 8px",
                      fontSize: 13,
                      borderRadius: 6,
                      border: "1px solid var(--color-border)",
                    }}
                  />
                )}
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
                <PasteZone
                  compact
                  onFile={(file) => uploadFile(file, category, category)}
                  onError={setError}
                  style={{ marginTop: 6, fontSize: 12 }}
                />
                {doc && (
                  <button
                    onClick={() => handleDelete(doc)}
                    style={{
                      marginTop: 6,
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      color: "var(--color-badge-red-text)",
                      fontSize: 14,
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
        <PasteZone compact onFile={pasteExtra} onError={setError} style={{ flexShrink: 0 }} />
      </div>

      {loading ? (
        <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>불러오는 중...</div>
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
                <div style={{ height: 100, background: "var(--color-surface-alt)" }}>
                  <PhotoThumb doc={doc} />
                </div>
                <div style={{ padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                  {renamingId === doc.id ? (
                    <RenameInput
                      initial={doc.photo_note || splitExt(doc.file_name).base}
                      onSave={(draft) => saveRename(doc, draft)}
                      onCancel={() => setRenamingId(null)}
                      style={{ flex: 1, fontSize: 13 }}
                    />
                  ) : (
                    <span style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.photo_note || doc.file_name}
                    </span>
                  )}
                  <span style={{ marginLeft: "auto" }} />
                  <RenameButton onClick={() => setRenamingId(doc.id)} />
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
        fontSize: 14,
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
