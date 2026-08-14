"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const LEVELS = ["판단불가", "낮음", "보통", "높음"];
const LEVEL_STYLE = {
  판단불가: { bg: "var(--color-surface-alt)", text: "var(--color-text-muted)", label: "─ 판단불가" },
  낮음: { bg: "#fff3cd", text: "#8a6d1a", label: "★☆☆ 낮음" },
  보통: { bg: "#ffdca8", text: "#8a4b1a", label: "★★☆ 보통" },
  높음: { bg: "#f6b1ab", text: "#8a1f1a", label: "★★★ 높음" },
};

function nextLevel(level) {
  const idx = LEVELS.indexOf(level);
  return LEVELS[(idx + 1) % LEVELS.length];
}

export default function PollutionMappingTab({ caseId }) {
  const [companies, setCompanies] = useState([]);
  const [substances, setSubstances] = useState([]);
  const [cells, setCells] = useState({}); // key: `${substance}::${company}` -> {level, note}
  const [loading, setLoading] = useState(true);
  const [newSubstance, setNewSubstance] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const [{ data: dartRows }, { data: factoryRows }, { data: mapRows }] = await Promise.all([
      supabase
        .from("dart_search_results")
        .select("corp_name")
        .eq("case_id", caseId)
        .eq("status", "완료"),
      supabase
        .from("factory_search_results")
        .select("cmpny_nm")
        .eq("case_id", caseId)
        .eq("status", "완료"),
      supabase.from("pollution_mappings").select("*").eq("case_id", caseId),
    ]);

    const companySet = new Set();
    (dartRows || []).forEach((r) => r.corp_name && companySet.add(r.corp_name));
    (factoryRows || []).forEach((r) => r.cmpny_nm && companySet.add(r.cmpny_nm));

    if (companySet.size === 0) {
      const { data: ownerRows } = await supabase
        .from("module_rows")
        .select("row_data")
        .eq("case_id", caseId)
        .eq("module_number", 3);
      (ownerRows || []).forEach((r) => {
        const d = r.row_data || {};
        if (d.category === "ownership" && d.owner_name) companySet.add(d.owner_name);
      });
    }

    const substanceSet = new Set();
    const cellMap = {};
    (mapRows || []).forEach((r) => {
      companySet.add(r.company_name);
      substanceSet.add(r.substance);
      cellMap[`${r.substance}::${r.company_name}`] = { level: r.level, note: r.note || "" };
    });

    setCompanies([...companySet].sort());
    setSubstances([...substanceSet].sort());
    setCells(cellMap);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  function getCell(substance, company) {
    return cells[`${substance}::${company}`] || { level: "판단불가", note: "" };
  }

  async function saveCell(substance, company, patch) {
    const key = `${substance}::${company}`;
    const current = getCell(substance, company);
    const updated = { ...current, ...patch };
    setCells((c) => ({ ...c, [key]: updated }));

    await supabase.from("pollution_mappings").upsert(
      {
        case_id: caseId,
        substance,
        company_name: company,
        level: updated.level,
        note: updated.note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_id,substance,company_name" }
    );
  }

  function handleCellClick(substance, company) {
    const current = getCell(substance, company);
    saveCell(substance, company, { level: nextLevel(current.level) });
  }

  async function handleAddSubstance() {
    const name = newSubstance.trim();
    if (!name || substances.includes(name)) return;
    setSubstances((s) => [...s, name].sort());
    setNewSubstance("");
    // 최소 하나의 셀을 만들어둬서 새로고침해도 이 오염물질 행이 남아있게 해요.
    if (companies.length > 0) {
      await saveCell(name, companies[0], { level: "판단불가" });
    }
  }

  async function handleRemoveSubstance(substance) {
    if (!confirm(`"${substance}" 오염물질 행을 삭제할까요?`)) return;
    await supabase
      .from("pollution_mappings")
      .delete()
      .eq("case_id", caseId)
      .eq("substance", substance);
    load();
  }

  async function handleRefreshCompanies() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return <div className="card">불러오는 중이에요...</div>;
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>오염물질 × 기업 연관성 매트릭스</div>
          <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
            셀 클릭 → 연관성 수준 변경, 하단 텍스트 → 메모 입력
          </div>
        </div>
        <button className="btn-secondary" onClick={handleRefreshCompanies} disabled={refreshing}>
          {refreshing ? "불러오는 중..." : "↻ 기업 목록 새로고침"}
        </button>
      </div>

      <div
        style={{
          background: "var(--color-badge-blue-bg)",
          border: "1px solid var(--color-badge-blue-bg)",
          borderRadius: 8,
          padding: 10,
          fontSize: 14,
          marginBottom: 14,
        }}
      >
        연관성 수준(높음/보통/낮음)은 자동으로 판단해주지 않아요. 위원회에서 직접
        검토해서 입력해주세요. 업종별 오염물질 기준은{" "}
        <a
          href="https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%ED%86%A0%EC%96%91%ED%99%98%EA%B2%BD%EB%B3%B4%EC%A0%84%EB%B2%95%EC%8B%9C%ED%96%89%EA%B7%9C%EC%B9%99"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--color-primary)" }}
        >
          토양환경보전법 시행규칙(국가법령정보센터)
        </a>{" "}
        별표1·별표5를 참고해주세요.
      </div>

      <div style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 12, flexWrap: "wrap" }}>
        {LEVELS.map((l) => (
          <span
            key={l}
            style={{
              background: LEVEL_STYLE[l].bg,
              color: LEVEL_STYLE[l].text,
              padding: "3px 8px",
              borderRadius: 6,
              fontWeight: 600,
            }}
          >
            {LEVEL_STYLE[l].label}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={newSubstance}
          onChange={(e) => setNewSubstance(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddSubstance()}
          placeholder="오염물질 추가 (예: TPH, 벤젠, 아연 등)"
          style={{
            flex: 1,
            maxWidth: 300,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
          }}
        />
        <button className="btn-secondary" onClick={handleAddSubstance}>
          + 오염물질 추가
        </button>
      </div>

      {companies.length === 0 ? (
        <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
          모듈5에서 DART 검색 또는 공장등록 조회로 회사를 먼저 찾아주세요. (모듈3
          소유자만 있어도 표시돼요.)
        </div>
      ) : substances.length === 0 ? (
        <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
          위에서 오염물질을 추가하면 표가 만들어져요.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    background: "white",
                    padding: "8px 10px",
                    borderBottom: "2px solid var(--color-border)",
                    textAlign: "left",
                    minWidth: 100,
                  }}
                >
                  오염물질 \ 기업
                </th>
                {companies.map((c) => (
                  <th
                    key={c}
                    style={{
                      padding: "8px 10px",
                      borderBottom: "2px solid var(--color-border)",
                      textAlign: "center",
                      minWidth: 130,
                      fontWeight: 600,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {substances.map((s) => (
                <tr key={s}>
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      background: "white",
                      padding: "8px 10px",
                      borderBottom: "1px solid var(--color-border)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {s}
                      <button
                        onClick={() => handleRemoveSubstance(s)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--color-text-muted)",
                          cursor: "pointer",
                          fontSize: 13,
                        }}
                        title="이 오염물질 행 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                  {companies.map((c) => {
                    const cell = getCell(s, c);
                    const style = LEVEL_STYLE[cell.level];
                    return (
                      <td
                        key={c}
                        style={{
                          borderBottom: "1px solid var(--color-border)",
                          padding: 6,
                          verticalAlign: "top",
                        }}
                      >
                        <button
                          onClick={() => handleCellClick(s, c)}
                          style={{
                            width: "100%",
                            border: "none",
                            background: style.bg,
                            color: style.text,
                            fontWeight: 600,
                            padding: "6px 4px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 14,
                            marginBottom: 4,
                          }}
                        >
                          {style.label}
                        </button>
                        <input
                          value={cell.note}
                          onChange={(e) =>
                            setCells((prev) => ({
                              ...prev,
                              [`${s}::${c}`]: { ...cell, note: e.target.value },
                            }))
                          }
                          onBlur={(e) => saveCell(s, c, { note: e.target.value })}
                          placeholder="메모"
                          style={{
                            width: "100%",
                            padding: "4px 6px",
                            fontSize: 13,
                            borderRadius: 4,
                            border: "1px solid var(--color-border)",
                            boxSizing: "border-box",
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
