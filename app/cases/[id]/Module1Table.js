"use client";

import { useEffect, useState } from "react";
import { useModuleRows } from "@/lib/useModuleRows";
import { SUBSTANCE_LABELS } from "@/lib/substances";

const FIELDS = [
  { key: "contaminant", label: "오염물질", width: 120 },
  { key: "depth", label: "심도", width: 80 },
  { key: "length", label: "길이(m)", width: 80 },
  { key: "concern_standard", label: "우려기준 초과", width: 110 },
  { key: "action_standard", label: "대책기준 초과", width: 110 },
  { key: "max_concentration", label: "최고농도(mg/kg)", width: 130 },
  { key: "area", label: "오염면적(m²)", width: 110 },
  { key: "volume", label: "오염량(m³)", width: 100 },
];

export default function Module1Table({ caseId }) {
  const { rows, loading, addRow, updateRow, deleteRow } = useModuleRows(caseId, 1);

  // 타이핑 중에는 화면에만 반영하고, 창고 저장은 나중에(포커스 벗어날 때) 하기 위한 임시 상태
  const [localValues, setLocalValues] = useState({});

  useEffect(() => {
    const next = {};
    rows.forEach((row) => {
      next[row.id] = { ...row.row_data };
    });
    setLocalValues(next);
  }, [rows]);

  function handleLocalChange(rowId, key, value) {
    setLocalValues((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [key]: value },
    }));
  }

  function handleBlurSave(row, key) {
    const newData = localValues[row.id] || row.row_data;
    if (JSON.stringify(newData) !== JSON.stringify(row.row_data)) {
      updateRow(row.id, newData);
    }
  }

  return (
    <div>
      <datalist id="substance-options">
        {SUBSTANCE_LABELS.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
          <thead>
            <tr style={{ background: "#f6f8f4" }}>
              {FIELDS.map((f) => (
                <th
                  key={f.key}
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--color-border)",
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.label}
                </th>
              ))}
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={FIELDS.length + 1} style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
                  불러오는 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={FIELDS.length + 1} style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
                  오염물질을 추가하세요
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const localRow = localValues[row.id] || row.row_data;
                const isConcernExceed = localRow.concern_standard;
                const isActionExceed = localRow.action_standard;
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {FIELDS.map((f) => (
                      <td key={f.key} style={{ padding: "4px 6px" }}>
                        <input
                          value={localRow[f.key] || ""}
                          onChange={(e) => handleLocalChange(row.id, f.key, e.target.value)}
                          onBlur={() => handleBlurSave(row, f.key)}
                          list={f.key === "contaminant" ? "substance-options" : undefined}
                          style={{
                            width: "100%",
                            border: "none",
                            background:
                              f.key === "concern_standard" && isConcernExceed
                                ? "var(--color-badge-yellow-bg)"
                                : f.key === "action_standard" && isActionExceed
                                ? "var(--color-badge-red-bg)"
                                : "transparent",
                            padding: "6px 4px",
                            borderRadius: 4,
                            fontSize: 15,
                          }}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        onClick={() => deleteRow(row.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--color-text-muted)",
                          cursor: "pointer",
                        }}
                        title="삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <button
        className="btn-secondary"
        style={{ marginTop: 12 }}
        onClick={() => addRow({})}
      >
        + 심도 행 추가
      </button>

      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 12 }}>
        셀 색상: <span className="badge badge-yellow" style={{ marginRight: 6 }}>우려기준 초과</span>
        <span className="badge badge-red">대책기준 초과</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
        오염면적(m²)은 각 심도별 중첩부분을 감안한 최대 넓이, 오염량(m³)은 심도별 오염량의 합이에요.
      </div>
    </div>
  );
}
