"use client";

import { useEffect, useState } from "react";
import { useModuleRows } from "@/lib/useModuleRows";

export default function CategorizedRowsTable({ caseId, moduleNumber, category, fields, emptyText }) {
  const { rows: allRows, loading, addRow, updateRow, deleteRow } = useModuleRows(
    caseId,
    moduleNumber
  );
  const rows = allRows.filter((r) => r.row_data.category === category);

  const [localValues, setLocalValues] = useState({});

  useEffect(() => {
    const next = {};
    rows.forEach((row) => {
      next[row.id] = { ...row.row_data };
    });
    setLocalValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows]);

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
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            tableLayout: fields.some((f) => f.width) ? "fixed" : "auto",
            borderCollapse: "collapse",
            fontSize: 15,
          }}
        >
          <thead>
            <tr style={{ background: "#f6f8f4" }}>
              {fields.map((f) => (
                <th
                  key={f.key}
                  style={{
                    width: f.width,
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
                <td colSpan={fields.length + 1} style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
                  불러오는 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={fields.length + 1} style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)" }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const localRow = localValues[row.id] || row.row_data;
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {fields.map((f) => (
                      <td key={f.key} style={{ padding: "4px 6px" }}>
                        {f.type === "date" ? (
                          <input
                            type="date"
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
                        ) : (
                          <input
                            value={localRow[f.key] || ""}
                            onChange={(e) => handleLocalChange(row.id, f.key, e.target.value)}
                            onBlur={() => handleBlurSave(row, f.key)}
                            placeholder={f.placeholder || ""}
                            style={{
                              width: "100%",
                              border: "none",
                              background: "transparent",
                              padding: "6px 4px",
                              fontSize: 15,
                            }}
                          />
                        )}
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
        onClick={() => addRow({ category })}
      >
        + 행 추가
      </button>
    </div>
  );
}
