"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// 5장은 기존 module_status 완료추적 번호(0~7)에 자리가 없어서, module_rows 저장용으로만
// 새 번호 8을 씀 (완료 토글/문서 업로드 사이드바는 CHAPTERS의 oldModuleNumbers가 비어있어 안 뜸).
const MODULE_NUMBER = 8;

export default function Module8ScientificAnalysis({ caseId }) {
  const [rowId, setRowId] = useState(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("module_rows")
        .select("*")
        .eq("case_id", caseId)
        .eq("module_number", MODULE_NUMBER)
        .contains("row_data", { category: "scientific_analysis" })
        .maybeSingle();
      if (data) {
        setRowId(data.id);
        setContent(data.row_data.content || "");
      }
      setLoading(false);
    }
    load();
  }, [caseId]);

  async function handleSave() {
    setSaving(true);
    const row_data = { category: "scientific_analysis", content };
    if (rowId) {
      await supabase
        .from("module_rows")
        .update({ row_data, updated_at: new Date().toISOString() })
        .eq("id", rowId);
    } else {
      const { data } = await supabase
        .from("module_rows")
        .insert([{ case_id: caseId, module_number: MODULE_NUMBER, row_order: 0, row_data }])
        .select()
        .single();
      if (data) setRowId(data.id);
    }
    setSaving(false);
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
      {saving && (
        <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 8 }}>
          저장 중...
        </div>
      )}
    </div>
  );
}
