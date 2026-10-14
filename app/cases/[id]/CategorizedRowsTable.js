"use client";

import { useEffect, useState } from "react";
import { useModuleRows } from "@/lib/useModuleRows";
import { parsePastedTable } from "@/lib/pasteTable";

// pasteImport: true면 "붙여넣기로 추가" — 다른 화면(예: 팩토리온 조회 결과)의 표를 복사해 붙이면
// fields의 label/aliases로 칸을 맞춰 한 번에 행을 추가한다.
export default function CategorizedRowsTable({ caseId, moduleNumber, category, fields, emptyText, pasteImport = false }) {
  const { rows: allRows, loading, addRow, addRows, updateRow, deleteRow } = useModuleRows(
    caseId,
    moduleNumber
  );
  const rows = allRows.filter((r) => r.row_data.category === category);

  const [localValues, setLocalValues] = useState({});
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteMessage, setPasteMessage] = useState("");

  const pastePreview = pasteText.trim() ? parsePastedTable(pasteText, fields) : { rows: [], headerFound: false };

  async function handlePasteAdd() {
    if (!pastePreview.rows.length) return;
    const { error } = await addRows(pastePreview.rows.map((d) => ({ category, ...d })));
    if (error) {
      setPasteMessage(`추가하지 못했어요: ${error.message}`);
      return;
    }
    setPasteMessage(`${pastePreview.rows.length}행을 추가했어요.`);
    setPasteText("");
    setPasteOpen(false);
  }

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

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button className="btn-secondary" onClick={() => addRow({ category })}>
          + 행 추가
        </button>
        {pasteImport && (
          <button
            className="btn-secondary"
            onClick={() => {
              setPasteOpen((o) => !o);
              setPasteMessage("");
            }}
          >
            📋 붙여넣기로 추가
          </button>
        )}
        {pasteMessage && <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>{pasteMessage}</span>}
      </div>

      {pasteImport && pasteOpen && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "var(--color-surface-alt)" }}>
          <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 8 }}>
            조회 결과 표를 머리글(제목 줄)까지 드래그해 복사한 뒤 아래에 붙여 넣으세요. 머리글이 없으면{" "}
            {fields.map((f) => f.label).join(" · ")} 순서로 읽어요.
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            placeholder="여기에 붙여넣기 (Ctrl+V)"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              fontSize: 14,
              fontFamily: "inherit",
              boxSizing: "border-box",
              background: "white",
            }}
          />
          {pastePreview.rows.length > 0 && (
            <div style={{ marginTop: 8, overflowX: "auto" }}>
              <div style={{ fontSize: 14, marginBottom: 4 }}>
                미리보기 {pastePreview.rows.length}행
                {pastePreview.headerFound ? " (머리글로 칸을 맞췄어요)" : " (머리글이 없어 순서대로 읽었어요)"}
              </div>
              <table style={{ borderCollapse: "collapse", fontSize: 13, background: "white", width: "100%" }}>
                <thead>
                  <tr>
                    {fields.map((f) => (
                      <th key={f.key} style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid var(--color-border)" }}>
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pastePreview.rows.map((r, i) => (
                    <tr key={i}>
                      {fields.map((f) => (
                        <td key={f.key} style={{ padding: "4px 6px", borderBottom: "1px solid var(--color-border)" }}>
                          {r[f.key] || <span style={{ color: "var(--color-text-muted)" }}>-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn-primary" onClick={handlePasteAdd} disabled={!pastePreview.rows.length}>
              {pastePreview.rows.length ? `${pastePreview.rows.length}행 추가` : "추가"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setPasteOpen(false);
                setPasteText("");
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
