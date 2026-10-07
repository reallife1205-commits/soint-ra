"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// 5장은 기존 module_status 완료추적 번호(0~7)에 자리가 없어서, module_rows 저장용으로만
// 새 번호 8을 씀 (완료 토글/문서 업로드 사이드바는 CHAPTERS의 oldModuleNumbers가 비어있어 안 뜸).
const MODULE_NUMBER = 8;

export default function Module8ScientificAnalysis({ caseId }) {
  const [rowId, setRowId] = useState(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // 마지막으로 불러오거나 저장한 내용. 바뀐 게 없으면 저장하지 않는다 (다른 탭의 예전 내용으로 덮어쓰기 방지).
  const lastSaved = useRef(null);
  // 첫 저장(insert)이 끝나기 전에 또 저장하면 행이 두 개 생긴다 — 진행 중인 저장을 기다렸다가 이어서 한다.
  const pending = useRef(Promise.resolve());
  // saveText는 대기열에서 나중에 실행되므로, 그 시점의 최신 행 id를 ref로 읽는다.
  const rowIdRef = useRef(null);

  useEffect(() => {
    async function load() {
      // 예전에 행이 두 개 이상 생긴 안건이 있어서 maybeSingle()은 오류가 나고 빈 칸으로 보였다.
      // 가장 최근에 저장된 행 하나를 쓴다.
      const { data, error: loadError } = await supabase
        .from("module_rows")
        .select("*")
        .eq("case_id", caseId)
        .eq("module_number", MODULE_NUMBER)
        .contains("row_data", { category: "scientific_analysis" })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(1);
      if (loadError) setError(`불러오지 못했어요: ${loadError.message}`);
      const row = data?.[0];
      if (row) {
        rowIdRef.current = row.id;
        setRowId(row.id);
        setContent(row.row_data.content || "");
      }
      lastSaved.current = row?.row_data.content || "";
      setLoading(false);
    }
    load();
  }, [caseId]);

  function handleSave() {
    const text = content;
    pending.current = pending.current.then(() => saveText(text));
    return pending.current;
  }

  async function saveText(text) {
    if (text === lastSaved.current) return;
    setSaving(true);
    setError("");
    const row_data = { category: "scientific_analysis", content: text };
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
        .insert([{ case_id: caseId, module_number: MODULE_NUMBER, row_order: 0, row_data, updated_at }])
        .select()
        .single();
      saveError = insertError;
      if (data) {
        rowIdRef.current = data.id;
        setRowId(data.id);
      }
    }
    setSaving(false);
    if (saveError) {
      setError(`저장에 실패했어요: ${saveError.message}`);
      return;
    }
    lastSaved.current = text;
  }

  if (loading) {
    return <div className="card">불러오는 중이에요...</div>;
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
        5. 과학적 기법에 의한 오염원인 추정
      </div>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>
        ※ 고려 가능 시 작성. 해당 사항이 없으면 &quot;검토제외&quot;로 입력하세요.
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleSave}
        placeholder="예: 검토제외"
        rows={8}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 8,
          border: "1px solid var(--color-border)",
          fontSize: 15,
          fontFamily: "inherit",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
      {error && (
        <div style={{ fontSize: 14, color: "var(--color-badge-red-text)", marginTop: 8 }}>{error}</div>
      )}
      {!error && saving && (
        <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 8 }}>
          저장 중...
        </div>
      )}
    </div>
  );
}
