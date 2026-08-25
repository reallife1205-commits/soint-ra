"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useModuleRows } from "@/lib/useModuleRows";
import CategorizedRowsTable from "./CategorizedRowsTable";

const PROGRESS_FIELDS = [
  { key: "date", label: "일자", type: "date" },
  { key: "description", label: "내용" },
];

export default function Module0Overview({ caseId }) {
  const [rowId, setRowId] = useState(null);
  const [form, setForm] = useState({
    application_number: "",
    investigation_start: "",
    investigation_end: "",
    sido_opinion: "",
    responsible_party_opinion_type: "의견서",
    responsible_party_opinion_other: "",
    responsible_party_opinion_text: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { rows: ownershipRows } = useModuleRows(caseId, 3);
  const currentOwners = ownershipRows
    .filter((r) => r.row_data.category === "ownership" && !r.row_data.disposed_date)
    .map((r) => r.row_data.owner_name)
    .filter(Boolean);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("module_rows")
        .select("*")
        .eq("case_id", caseId)
        .eq("module_number", 0)
        .contains("row_data", { category: "overview" })
        .maybeSingle();

      if (data) {
        setRowId(data.id);
        setForm((f) => ({ ...f, ...data.row_data }));
      }
      setLoading(false);
    }
    load();
  }, [caseId]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleBlurSave(overrides = {}) {
    setSaving(true);
    const newData = { category: "overview", ...form, ...overrides };

    if (rowId) {
      await supabase
        .from("module_rows")
        .update({ row_data: newData, updated_at: new Date().toISOString() })
        .eq("id", rowId);
    } else {
      const { data } = await supabase
        .from("module_rows")
        .insert([{ case_id: caseId, module_number: 0, row_order: 0, row_data: newData }])
        .select()
        .single();
      if (data) setRowId(data.id);
    }
    setSaving(false);
  }

  if (loading) {
    return <div style={{ color: "var(--color-text-muted)" }}>불러오는 중...</div>;
  }

  const labelStyle = { fontSize: 14, color: "var(--color-text-muted)" };
  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    marginTop: 4,
    fontSize: 15,
  };

  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>1.1 안건 개요</div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>신청서</label>
        <input
          value={form.application_number}
          onChange={(e) => updateField("application_number", e.target.value)}
          onBlur={() => handleBlurSave()}
          placeholder="예: 안산시청 산단환경과-10784 (2025.7.24.)"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>정밀조사 시기 (시작)</label>
          <input
            type="date"
            value={form.investigation_start}
            onChange={(e) => updateField("investigation_start", e.target.value)}
            onBlur={() => handleBlurSave()}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>정밀조사 시기 (종료)</label>
          <input
            type="date"
            value={form.investigation_end}
            onChange={(e) => updateField("investigation_end", e.target.value)}
            onBlur={() => handleBlurSave()}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>정화책임자 (챕터03 소유 이력의 현재 소유자 기준, 읽기전용)</label>
        <div
          style={{
            marginTop: 4,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "#f6f8f4",
            fontSize: 15,
            color: currentOwners.length ? "var(--color-text)" : "var(--color-text-muted)",
          }}
        >
          {currentOwners.length ? currentOwners.join(", ") : "챕터03 소유 이력에서 현재 소유자를 등록하면 여기 표시돼요"}
        </div>
      </div>

      <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid var(--color-border)" }} />

      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>1.2 추진 경과</div>
      <CategorizedRowsTable
        caseId={caseId}
        moduleNumber={0}
        category="progress"
        fields={PROGRESS_FIELDS}
        emptyText="추진 경과 없음 — 아래 버튼으로 추가하세요"
      />

      <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid var(--color-border)" }} />

      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
        1.3 정화책임자에 대한 시·도지사 검토의견서
      </div>
      <textarea
        value={form.sido_opinion}
        onChange={(e) => updateField("sido_opinion", e.target.value)}
        onBlur={() => handleBlurSave()}
        placeholder="시·도지사 또는 시·군·구의 검토의견을 입력하세요."
        rows={4}
        style={{ ...inputStyle, resize: "vertical" }}
      />

      <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid var(--color-border)" }} />

      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>1.4 정화책임자 의견</div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10 }}>
        <label style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="radio"
            name="responsible_party_opinion_type"
            checked={form.responsible_party_opinion_type === "의견서"}
            onChange={() => {
              updateField("responsible_party_opinion_type", "의견서");
              handleBlurSave({ responsible_party_opinion_type: "의견서" });
            }}
          />
          의견서
        </label>
        <label style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="radio"
            name="responsible_party_opinion_type"
            checked={form.responsible_party_opinion_type === "기타"}
            onChange={() => {
              updateField("responsible_party_opinion_type", "기타");
              handleBlurSave({ responsible_party_opinion_type: "기타" });
            }}
          />
          기타
        </label>
        {form.responsible_party_opinion_type === "기타" && (
          <input
            value={form.responsible_party_opinion_other}
            onChange={(e) => updateField("responsible_party_opinion_other", e.target.value)}
            onBlur={() => handleBlurSave()}
            placeholder="기타 내용"
            style={{ ...inputStyle, marginTop: 0, flex: 1 }}
          />
        )}
      </div>
      <textarea
        value={form.responsible_party_opinion_text}
        onChange={(e) => updateField("responsible_party_opinion_text", e.target.value)}
        onBlur={() => handleBlurSave()}
        placeholder="정화책임자 의견 내용을 입력하세요."
        rows={4}
        style={{ ...inputStyle, resize: "vertical" }}
      />

      {saving && (
        <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 10 }}>
          저장 중...
        </div>
      )}
    </div>
  );
}
