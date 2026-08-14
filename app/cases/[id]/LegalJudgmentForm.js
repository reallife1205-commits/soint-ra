"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LegalJudgmentForm({ caseId }) {
  const [rowId, setRowId] = useState(null);
  const [form, setForm] = useState({
    pollution_period: "",
    responsible_party: "",
    summary: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("module_rows")
        .select("*")
        .eq("case_id", caseId)
        .eq("module_number", 3)
        .contains("row_data", { category: "legal" })
        .maybeSingle();

      if (data) {
        setRowId(data.id);
        setForm({
          pollution_period: data.row_data.pollution_period || "",
          responsible_party: data.row_data.responsible_party || "",
          summary: data.row_data.summary || "",
        });
      }
      setLoading(false);
    }
    load();
  }, [caseId]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleBlurSave() {
    setSaving(true);
    const newData = { category: "legal", ...form };

    if (rowId) {
      await supabase
        .from("module_rows")
        .update({ row_data: newData, updated_at: new Date().toISOString() })
        .eq("id", rowId);
    } else {
      const { data } = await supabase
        .from("module_rows")
        .insert([{ case_id: caseId, module_number: 3, row_order: 0, row_data: newData }])
        .select()
        .single();
      if (data) setRowId(data.id);
    }
    setSaving(false);
  }

  if (loading) {
    return <div style={{ color: "var(--color-text-muted)" }}>불러오는 중...</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
            오염 예상 기간
          </label>
          <input
            value={form.pollution_period}
            onChange={(e) => updateField("pollution_period", e.target.value)}
            onBlur={handleBlurSave}
            placeholder="예: 1990년대 ~ 2005년"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              marginTop: 4,
              fontSize: 15,
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
            주요 책임자 추정
          </label>
          <input
            value={form.responsible_party}
            onChange={(e) => updateField("responsible_party", e.target.value)}
            onBlur={handleBlurSave}
            placeholder="예: 홍길동 (전 소유자, 주유소 운영)"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              marginTop: 4,
              fontSize: 15,
            }}
          />
        </div>
      </div>

      <label style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
        판단 요약
      </label>
      <textarea
        value={form.summary}
        onChange={(e) => updateField("summary", e.target.value)}
        onBlur={handleBlurSave}
        placeholder="소유 이력과 임대차 이력을 바탕으로 한 판단 요약을 입력하세요."
        rows={5}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--color-border)",
          marginTop: 4,
          fontSize: 15,
          resize: "vertical",
        }}
      />

      {saving && (
        <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 6 }}>
          저장 중...
        </div>
      )}
    </div>
  );
}
