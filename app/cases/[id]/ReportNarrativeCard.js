"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// 보고서 본문(그림 위 설명) 입력 카드 — 2.1/2.2 공용. 자료 종류 체크 + 본문 + [초안 만들기].
// module_rows(moduleNumber)에 category로 구분한 행 하나({sources, other_text, content})로 저장한다.
// 초안 규칙은 lib/*Draft.js에 있고 보고서 내보내기도 같은 걸 써서, 비워 두면 내보낼 때 자동 작성된다.
export default function ReportNarrativeCard({
  caseId,
  moduleNumber,
  category,
  title,
  description,
  sourceOptions, // [{ key, label }] — key "other"는 자료명 입력칸이 붙는다
  checkboxLine, // (sources, otherText) => 보고서에 들어갈 □/☑ 줄
  getDefaultSources, // async () => 저장된 값이 없을 때의 기본 체크
  buildDraft, // async (sources) => 초안 문자열
  draftButtonLabel,
  draftDisabledReason, // 초안을 만들 수 없을 때 이유(버튼 비활성 + 안내)
}) {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState([]);
  const [otherText, setOtherText] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const rowIdRef = useRef(null);
  const lastSaved = useRef(null);
  // 첫 저장(insert)이 끝나기 전에 또 저장하면 행이 두 개 생긴다 — 순서대로 처리한다(5장과 같은 방식).
  const pending = useRef(Promise.resolve());

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase
        .from("module_rows")
        .select("*")
        .eq("case_id", caseId)
        .eq("module_number", moduleNumber)
        .contains("row_data", { category })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(1);
      if (loadError) setError(`불러오지 못했어요: ${loadError.message}`);
      const row = data?.[0];
      let next;
      if (row) {
        rowIdRef.current = row.id;
        next = {
          sources: row.row_data.sources || [],
          other_text: row.row_data.other_text || "",
          content: row.row_data.content || "",
        };
      } else {
        next = { sources: await getDefaultSources(), other_text: "", content: "" };
      }
      setSources(next.sources);
      setOtherText(next.other_text);
      setContent(next.content);
      lastSaved.current = row ? JSON.stringify(next) : null;
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, moduleNumber, category]);

  function save(next) {
    pending.current = pending.current.then(() => saveNow(next));
    return pending.current;
  }

  async function saveNow(next) {
    const key = JSON.stringify(next);
    if (key === lastSaved.current) return;
    setSaving(true);
    setError("");
    const row_data = { category, ...next };
    const updated_at = new Date().toISOString();
    let saveError;
    if (rowIdRef.current) {
      ({ error: saveError } = await supabase
        .from("module_rows")
        .update({ row_data, updated_at })
        .eq("id", rowIdRef.current));
    } else {
      const { data, error: insertError } = await supabase
        .from("module_rows")
        .insert([{ case_id: caseId, module_number: moduleNumber, row_order: 0, row_data, updated_at }])
        .select()
        .single();
      saveError = insertError;
      if (data) rowIdRef.current = data.id;
    }
    setSaving(false);
    if (saveError) {
      setError(`저장에 실패했어요: ${saveError.message}`);
      return;
    }
    lastSaved.current = key;
  }

  const current = (overrides = {}) => ({ sources, other_text: otherText, content, ...overrides });

  function toggleSource(key) {
    const nextSources = sources.includes(key) ? sources.filter((k) => k !== key) : [...sources, key];
    setSources(nextSources);
    save(current({ sources: nextSources }));
  }

  async function makeDraft() {
    if (content.trim() && !window.confirm("지금 입력된 내용을 새 초안으로 바꿀까요?\n직접 고친 문장은 사라져요.")) {
      return;
    }
    const draft = await buildDraft(sources);
    setContent(draft);
    save(current({ content: draft }));
  }

  if (loading) {
    return <div className="card" style={{ marginBottom: 16 }}>불러오는 중이에요...</div>;
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>{description}</div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>자료 종류</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", alignItems: "center", marginBottom: 6 }}>
        {sourceOptions.map((o) => (
          <label key={o.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 15, cursor: "pointer" }}>
            <input type="checkbox" checked={sources.includes(o.key)} onChange={() => toggleSource(o.key)} />
            {o.label}
            {o.key === "other" && (
              <input
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                onBlur={() => save(current())}
                placeholder="자료명"
                style={{
                  width: 140,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              />
            )}
          </label>
        ))}
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 14 }}>
        보고서 표시: {checkboxLine(sources, otherText)}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>내용</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {draftDisabledReason && (
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{draftDisabledReason}</span>
          )}
          <button
            className="btn-secondary"
            onClick={makeDraft}
            disabled={!!draftDisabledReason}
            style={{ fontSize: 14, padding: "6px 12px" }}
          >
            {draftButtonLabel}
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => save(current())}
        placeholder={`아직 작성 안 됨 — [${draftButtonLabel}]를 누르면 문장이 채워지고, 여기서 고칠 수 있어요.`}
        rows={5}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 8,
          border: "1px solid var(--color-border)",
          fontSize: 15,
          lineHeight: 1.7,
          fontFamily: "inherit",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
      {error && <div style={{ fontSize: 14, color: "var(--color-badge-red-text)", marginTop: 8 }}>{error}</div>}
      {!error && saving && <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 8 }}>저장 중...</div>}
    </div>
  );
}
