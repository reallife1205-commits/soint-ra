"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  SITE_CONTAMINATION_CATEGORY,
  SOURCE_OPTIONS,
  defaultSources,
  sourceCheckboxLine,
  buildSiteContaminationDraft,
} from "@/lib/siteContaminationDraft";

// 보고서 2.1 본문(그림 위): 자료 종류 체크 + 조사기간·결과 요약 문장.
// 1.1 개요와 같은 module_rows 0번에 category로 구분해 저장한다(2.1 오염현황 표는 1번 행을 전부
// 표 행으로 그리기 때문에 거기에 섞으면 빈 행이 생긴다).
export default function Module1Narrative({ caseId }) {
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

  async function fetchSources() {
    const [{ data: m0 }, { data: m1 }] = await Promise.all([
      supabase.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 0),
      supabase.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 1).order("row_order", { ascending: true }),
    ]);
    return {
      overview: (m0 || []).map((r) => r.row_data).find((d) => d.category === "overview") || {},
      contaminationRows: (m1 || []).map((r) => r.row_data),
    };
  }

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase
        .from("module_rows")
        .select("*")
        .eq("case_id", caseId)
        .eq("module_number", 0)
        .contains("row_data", { category: SITE_CONTAMINATION_CATEGORY })
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
        const { overview } = await fetchSources();
        next = { sources: defaultSources(overview), other_text: "", content: "" };
      }
      setSources(next.sources);
      setOtherText(next.other_text);
      setContent(next.content);
      lastSaved.current = row ? JSON.stringify(next) : null;
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  function save(next) {
    pending.current = pending.current.then(() => saveNow(next));
    return pending.current;
  }

  async function saveNow(next) {
    const key = JSON.stringify(next);
    if (key === lastSaved.current) return;
    setSaving(true);
    setError("");
    const row_data = { category: SITE_CONTAMINATION_CATEGORY, ...next };
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
        .insert([{ case_id: caseId, module_number: 0, row_order: 0, row_data, updated_at }])
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
    if (content.trim() && !window.confirm("지금 입력된 내용을 표 내용으로 만든 초안으로 바꿀까요?\n직접 고친 문장은 사라져요.")) {
      return;
    }
    const { overview, contaminationRows } = await fetchSources();
    const draft = buildSiteContaminationDraft({ contaminationRows, overview, sources });
    setContent(draft);
    save(current({ content: draft }));
  }

  if (loading) {
    return <div className="card">불러오는 중이에요...</div>;
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>보고서 본문 (그림 위 설명)</div>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>
        보고서 2.1의 &lt;그림&gt; 토양시료 채취 지점 위에 들어가요. 비워 두면 내보낼 때 표 내용으로 자동 작성돼요.
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>자료 종류</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", alignItems: "center", marginBottom: 6 }}>
        {SOURCE_OPTIONS.map((o) => (
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
        보고서 표시: {sourceCheckboxLine(sources, otherText)}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>내용</div>
        <button className="btn-secondary" onClick={makeDraft} style={{ fontSize: 14, padding: "6px 12px" }}>
          표 내용으로 초안 만들기
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => save(current())}
        placeholder={"ㅇ (조사기간) '24.6월 ~ '24.12월\n- 개황조사 및 상세조사 결과, TPH 및 아연 항목이 우려기준 및 대책기준을 초과하였으며 오염 면적은 234 ㎡, 오염량은 275 ㎥로 산정됨"}
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
