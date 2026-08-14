"use client";

import { useEffect, useState } from "react";
import { useModuleRows } from "@/lib/useModuleRows";

const DEFAULT_FIELDS = [
  { key: "item", label: "구분" },
  { key: "content", label: "내용" },
  { key: "note", label: "비고" },
];

export default function GenericModuleTable({ caseId, moduleNumber }) {
  const { rows, loading, addRow, updateRow, deleteRow } = useModuleRows(
    caseId,
    moduleNumber
  );

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
      <div
        className="card"
        style={{
          background: "var(--color-badge-yellow-bg)",
          border: "1px solid var(--color-badge-yellow-bg)",
          marginBottom: 16,
          fontSize: 15,
        }}
      >
        이 모듈의 표 형태는 아직 정해지지 않아서, 자유롭게 항목을 적을 수 있는
        기본 표로 되어있어요. 정확한 항목이 정해지면 이 표를 그에 맞게 바꿔드릴게요.
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
          <thead>
            <tr style={{ background: "#f6f8f4" }}>
              {DEFAULT_FIELDS.map((f) => (
                <th
                  key={f.key}
                  style={{
                    textAlign: "left",
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--color-border)",
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
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
                <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
                  불러오는 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
                  항목을 추가하세요
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const localRow = localValues[row.id] || row.row_data;
                return (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {DEFAULT_FIELDS.map((f) => (
                    <td key={f.key} style={{ padding: "4px 6px" }}>
                      <input
                        value={localRow[f.key] || ""}
                        onChange={(e) => handleLocalChange(row.id, f.key, e.target.value)}
                        onBlur={() => handleBlurSave(row, f.key)}
                        style={{
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          padding: "6px 4px",
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

      <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => addRow({})}>
        + 항목 추가
      </button>
    </div>
  );
}
