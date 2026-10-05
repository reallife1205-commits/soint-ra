"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ChecklistJudgmentForm({
  caseId,
  moduleNumber,
  category,
  checklistOptions,
  radioField,
  summaryLabel = "판단 내용",
  summaryPlaceholder = "",
  summaryRows = 4,
  headingPreview = false,
}) {
  const [rowId, setRowId] = useState(null);
  const [checked, setChecked] = useState({});
  const [otherText, setOtherText] = useState("");
  const [radioValue, setRadioValue] = useState(radioField?.options?.[0] || "");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("module_rows")
        .select("*")
        .eq("case_id", caseId)
        .eq("module_number", moduleNumber)
        .contains("row_data", { category })
        .maybeSingle();

      if (data) {
        setRowId(data.id);
        setChecked(data.row_data.checked || {});
        setOtherText(data.row_data.other_text || "");
        setSummary(data.row_data.summary || "");
        if (radioField) setRadioValue(data.row_data[radioField.key] || radioField.options[0]);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, moduleNumber, category]);

  async function save(overrides = {}) {
    setSaving(true);
    const newData = {
      category,
      checked,
      other_text: otherText,
      summary,
      ...(radioField ? { [radioField.key]: radioValue } : {}),
      ...overrides,
    };

    if (rowId) {
      await supabase
        .from("module_rows")
        .update({ row_data: newData, updated_at: new Date().toISOString() })
        .eq("id", rowId);
    } else {
      const { data } = await supabase
        .from("module_rows")
        .insert([{ case_id: caseId, module_number: moduleNumber, row_order: 0, row_data: newData }])
        .select()
        .single();
      if (data) setRowId(data.id);
    }
    setSaving(false);
  }

  function toggleCheck(key) {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    save({ checked: next });
  }

  if (loading) {
    return <div style={{ color: "var(--color-text-muted)" }}>불러오는 중...</div>;
  }

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    marginTop: 4,
    fontSize: 15,
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14 }}>
        {checklistOptions.map((opt) => (
          <label key={opt.key} style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={!!checked[opt.key]} onChange={() => toggleCheck(opt.key)} />
            {opt.label}
          </label>
        ))}
        <label style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={!!checked.other} onChange={() => toggleCheck("other")} />
          기타
        </label>
        {checked.other && (
          <input
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onBlur={() => save()}
            placeholder="기타 내용"
            style={{ ...inputStyle, marginTop: 0, width: 220 }}
          />
        )}
      </div>

      {radioField && (
        <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
          <span style={{ fontSize: 15, color: "var(--color-text-muted)" }}>{radioField.label}</span>
          {radioField.options.map((opt) => (
            <label key={opt} style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name={`${category}-${radioField.key}`}
                checked={radioValue === opt}
                onChange={() => {
                  setRadioValue(opt);
                  save({ [radioField.key]: opt });
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      <label style={{ fontSize: 14, color: "var(--color-text-muted)" }}>{summaryLabel}</label>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        onBlur={() => save()}
        placeholder={summaryPlaceholder}
        rows={summaryRows}
        style={{ ...inputStyle, resize: "vertical" }}
      />

      {/* textarea는 글자 일부만 굵게 할 수 없어서, 줄 맨 앞의 "(소제목)"을 굵게 보여주는 미리보기를 따로 둔다. */}
      {headingPreview && summary.trim() && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--color-surface-alt)",
            fontSize: 15,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}
        >
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 4 }}>미리보기</div>
          {summary.split("\n").map((line, i) => {
            const m = line.match(/^(\([^)]*\))(.*)$/);
            return (
              <div key={i} style={{ minHeight: "1.7em" }}>
                {m ? (
                  <>
                    <strong>{m[1]}</strong>
                    {m[2]}
                  </>
                ) : (
                  line
                )}
              </div>
            );
          })}
        </div>
      )}

      {saving && (
        <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 6 }}>
          저장 중...
        </div>
      )}
    </div>
  );
}
