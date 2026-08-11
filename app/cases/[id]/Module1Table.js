"use client";

import { useModuleRows } from "@/lib/useModuleRows";

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

  function handleCellChange(row, key, value) {
    updateRow(row.id, { ...row.row_data, [key]: value });
  }

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
                const isConcernExceed = row.row_data.concern_standard;
                const isActionExceed = row.row_data.action_standard;
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {FIELDS.map((f) => (
                      <td key={f.key} style={{ padding: "4px 6px" }}>
                        <input
                          value={row.row_data[f.key] || ""}
                          onChange={(e) => handleCellChange(row, f.key, e.target.value)}
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
                            fontSize: 13,
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

      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 12 }}>
        셀 색상: <span className="badge badge-yellow" style={{ marginRight: 6 }}>우려기준 초과</span>
        <span className="badge badge-red">대책기준 초과</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
        오염면적(m²)은 각 심도별 중첩부분을 감안한 최대 넓이, 오염량(m³)은 심도별 오염량의 합이에요.
      </div>
    </div>
  );
}
