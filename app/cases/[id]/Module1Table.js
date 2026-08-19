"use client";

import { useEffect, useState } from "react";
import { useModuleRows } from "@/lib/useModuleRows";
import { SUBSTANCE_LABELS } from "@/lib/substances";

const FIELDS = [
  { key: "contaminant", label: "오염물질", width: 120 },
  { key: "depth", label: "심도", width: 80 },
  { key: "depth_start", label: "시작 깊이", width: 60, group: "깊이(m)" },
  { key: "depth_end", label: "끝 깊이", width: 60, group: "깊이(m)" },
  { key: "concern_standard", label: "우려기준 초과", width: 110, group: "초과내역(시료수)" },
  { key: "action_standard", label: "대책기준 초과", width: 110, group: "초과내역(시료수)" },
  { key: "max_concentration", label: "최고농도(mg/kg)", width: 130 },
  { key: "area", label: "오염면적(m²)", width: 110 },
  { key: "volume", label: "오염량(m³)", width: 100 },
];

// FIELDS를 그룹 단위로 묶어 2단 헤더를 구성하기 위한 헬퍼
const HEADER_GROUPS = [];
FIELDS.forEach((f) => {
  const last = HEADER_GROUPS[HEADER_GROUPS.length - 1];
  if (f.group && last && last.group === f.group) {
    last.fields.push(f);
  } else {
    HEADER_GROUPS.push({ group: f.group || null, fields: [f] });
  }
});

function toNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function formatSum(n) {
  return Number(Math.round(n * 100) / 100).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  });
}

function summarizeGroup(items) {
  let concern = 0;
  let action = 0;
  let area = 0;
  let volume = 0;
  let maxConc = null;
  let minStart = null;
  let maxEnd = null;
  items.forEach(({ data }) => {
    concern += toNum(data.concern_standard);
    action += toNum(data.action_standard);
    area += toNum(data.area);
    volume += toNum(data.volume);
    if (data.max_concentration !== undefined && data.max_concentration !== "") {
      const c = toNum(data.max_concentration);
      if (maxConc === null || c > maxConc) maxConc = c;
    }
    if (data.depth_start !== undefined && data.depth_start !== "") {
      const s = toNum(data.depth_start);
      if (minStart === null || s < minStart) minStart = s;
    }
    if (data.depth_end !== undefined && data.depth_end !== "") {
      const e = toNum(data.depth_end);
      if (maxEnd === null || e > maxEnd) maxEnd = e;
    }
  });
  return { concern, action, area, volume, maxConc, minStart, maxEnd };
}

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

  const groups = [];
  const groupIndex = {};
  rows.forEach((row) => {
    const d = localValues[row.id] || row.row_data;
    const name = d.contaminant || "";
    if (!(name in groupIndex)) {
      groupIndex[name] = groups.length;
      groups.push({ name, items: [] });
    }
    groups[groupIndex[name]].items.push({ row, data: d });
  });

  const grandTotal = rows.reduce(
    (acc, row) => {
      const d = localValues[row.id] || row.row_data;
      acc.concern += toNum(d.concern_standard);
      acc.action += toNum(d.action_standard);
      return acc;
    },
    { concern: 0, action: 0 }
  );

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
              {HEADER_GROUPS.map((g) =>
                g.group ? (
                  <th
                    key={g.group}
                    colSpan={g.fields.length}
                    style={{
                      textAlign: "center",
                      padding: "8px 8px",
                      borderBottom: "1px solid var(--color-border)",
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {g.group}
                  </th>
                ) : (
                  <th
                    key={g.fields[0].key}
                    rowSpan={2}
                    style={{
                      textAlign: "left",
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--color-border)",
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                      whiteSpace: "nowrap",
                      verticalAlign: "bottom",
                    }}
                  >
                    {g.fields[0].label}
                  </th>
                )
              )}
              <th rowSpan={2} style={{ width: 40 }}></th>
            </tr>
            <tr style={{ background: "#f6f8f4" }}>
              {HEADER_GROUPS.filter((g) => g.group).flatMap((g) =>
                g.fields.map((f) => (
                  <th
                    key={f.key}
                    style={{
                      textAlign: "left",
                      padding: "8px 8px 10px",
                      borderBottom: "1px solid var(--color-border)",
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.label}
                  </th>
                ))
              )}
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
              <>
                {groups.flatMap((group) => {
                  const itemRows = group.items.map(({ row }, index) => {
                    const localRow = localValues[row.id] || row.row_data;
                    const isConcernExceed = localRow.concern_standard;
                    const isActionExceed = localRow.action_standard;
                    const fields = FIELDS.filter((f) => f.key !== "contaminant");
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        {index === 0 && (
                          <td
                            rowSpan={group.items.length + 1}
                            style={{ padding: "4px 6px", verticalAlign: "middle" }}
                          >
                            <input
                              value={localRow.contaminant || ""}
                              onChange={(e) => handleLocalChange(row.id, "contaminant", e.target.value)}
                              onBlur={() => handleBlurSave(row, "contaminant")}
                              list="substance-options"
                              style={{
                                width: "100%",
                                border: "none",
                                textAlign: "left",
                                background: "transparent",
                                padding: "6px 4px",
                                borderRadius: 4,
                                fontSize: 15,
                                fontWeight: 600,
                              }}
                            />
                          </td>
                        )}
                        {fields.map((f) => (
                          <td key={f.key} style={{ padding: "4px 6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              {f.key === "depth_end" && (
                                <span style={{ color: "var(--color-text-muted)" }}>~</span>
                              )}
                              <input
                                value={localRow[f.key] || ""}
                                onChange={(e) => handleLocalChange(row.id, f.key, e.target.value)}
                                onBlur={() => handleBlurSave(row, f.key)}
                                style={{
                                  width: "100%",
                                  border: "none",
                                  textAlign: "center",
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
                            </div>
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
                  });

                  const s = summarizeGroup(group.items);
                  const subtotalRow = (
                    <tr
                      key={`${group.name}-subtotal`}
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        fontWeight: 600,
                      }}
                    >
                      <td style={{ padding: "6px 6px", textAlign: "center" }}>합계</td>
                      <td colSpan={2} style={{ padding: "6px 6px", textAlign: "center" }}>
                        {s.minStart !== null && s.maxEnd !== null
                          ? `${s.minStart}-${s.maxEnd}`
                          : "-"}
                      </td>
                      <td style={{ padding: "6px 6px", textAlign: "center" }}>
                        {formatSum(s.concern)}
                      </td>
                      <td style={{ padding: "6px 6px", textAlign: "center" }}>
                        {formatSum(s.action)}
                      </td>
                      <td style={{ padding: "6px 6px", textAlign: "center" }}>
                        {s.maxConc !== null ? formatSum(s.maxConc) : "-"}
                      </td>
                      <td style={{ padding: "6px 6px", textAlign: "center" }}>
                        {formatSum(s.area)}
                      </td>
                      <td style={{ padding: "6px 6px", textAlign: "center" }}>
                        {formatSum(s.volume)}
                      </td>
                      <td></td>
                    </tr>
                  );

                  return [...itemRows, subtotalRow];
                })}
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={2} style={{ padding: "8px 6px" }}>
                    총 합계
                  </td>
                  <td colSpan={2}></td>
                  <td style={{ padding: "8px 6px", textAlign: "center" }}>
                    {formatSum(grandTotal.concern)}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "center" }}>
                    {formatSum(grandTotal.action)}
                  </td>
                  <td style={{ textAlign: "center" }}>—</td>
                  <td style={{ textAlign: "center" }}>—</td>
                  <td style={{ textAlign: "center" }}>—</td>
                  <td></td>
                </tr>
              </>
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
