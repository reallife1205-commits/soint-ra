"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import HeadedTextEditor from "./HeadedTextEditor";

export default function ChecklistJudgmentForm({
  caseId,
  moduleNumber,
  category,
  checklistOptions,
  radioField,
  summaryLabel = "판단 내용",
  summaryPlaceholder = "",
  summaryRows = 4,
  headingBold = false,
}) {
  const [rowId, setRowId] = useState(null);
  const [checked, setChecked] = useState({});
  const [otherText, setOtherText] = useState("");
  const [radioValue, setRadioValue] = useState(radioField?.options?.[0] || "");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // 마지막으로 불러오거나 저장한 내용. 바뀐 게 없으면 저장하지 않는다 — 같은 화면이 다른 탭에 예전
  // 내용으로 열려 있을 때, 그 탭에서 입력칸을 눌렀다 나오기만 해도 예전 내용으로 덮어써지던 문제 방지.
  const lastSaved = useRef(null);

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
        lastSaved.current = JSON.stringify(
          buildData({
            checked: data.row_data.checked || {},
            other_text: data.row_data.other_text || "",
            summary: data.row_data.summary || "",
            ...(radioField ? { [radioField.key]: data.row_data[radioField.key] || radioField.options[0] } : {}),
          })
        );
      } else {
        lastSaved.current = JSON.stringify(buildData({ checked: {}, other_text: "", summary: "" }));
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, moduleNumber, category]);

  function buildData(overrides = {}) {
    return {
      category,
      checked,
      other_text: otherText,
      summary,
      ...(radioField ? { [radioField.key]: radioValue } : {}),
      ...overrides,
    };
  }

  async function save(overrides = {}) {
    const newData = buildData(overrides);
    const snapshot = JSON.stringify(newData);
    if (snapshot === lastSaved.current) return;
    setSaving(true);

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
    lastSaved.current = snapshot;
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
      {headingBold ? (
        <HeadedTextEditor
          value={summary}
          onChange={setSummary}
          onBlur={() => save()}
          placeholder={summaryPlaceholder}
          rows={summaryRows}
          style={inputStyle}
        />
      ) : (
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={() => save()}
          placeholder={summaryPlaceholder}
          rows={summaryRows}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      )}

      {saving && (
        <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 6 }}>
          저장 중...
        </div>
      )}
    </div>
  );
}
