"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { findSubstanceKey } from "@/lib/substances";

const VERDICTS = ["판단불가", "외부 영향 가능성 낮음", "외부 영향 가능성 있음", "외부 영향 확인 필요"];
const VERDICT_STYLE = {
  판단불가: { bg: "#eef1eb", text: "var(--color-text-muted)" },
  "외부 영향 가능성 낮음": { bg: "#d7f0da", text: "#1a6b2a" },
  "외부 영향 가능성 있음": { bg: "#ffdca8", text: "#8a4b1a" },
  "외부 영향 확인 필요": { bg: "#f6b1ab", text: "#8a1f1a" },
};

function nextVerdict(v) {
  const idx = VERDICTS.indexOf(v);
  return VERDICTS[(idx + 1) % VERDICTS.length];
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function suggestVerdict(ratio) {
  if (ratio === null || ratio === undefined || isNaN(ratio)) return "판단불가";
  if (ratio >= 0.7) return "외부 영향 가능성 있음";
  if (ratio >= 0.3) return "외부 영향 확인 필요";
  return "외부 영향 가능성 낮음";
}

export default function SurroundingImpactTab({ caseId, caseInfo }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [radius, setRadius] = useState(4);
  const [infoMsg, setInfoMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("surrounding_impacts")
      .select("*")
      .eq("case_id", caseId)
      .order("substance");
    setRows(data || []);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRecalculate() {
    setRecalculating(true);
    setInfoMsg("");

    const { data: m1rows } = await supabase
      .from("module_rows")
      .select("row_data")
      .eq("case_id", caseId)
      .eq("module_number", 1);

    const targetMaxBySubstance = {};
    (m1rows || []).forEach((r) => {
      const d = r.row_data || {};
      const name = (d.contaminant || "").trim();
      const val = parseFloat(d.max_concentration);
      if (!name || isNaN(val)) return;
      if (!targetMaxBySubstance[name] || val > targetMaxBySubstance[name]) {
        targetMaxBySubstance[name] = val;
      }
    });

    const substanceNames = Object.keys(targetMaxBySubstance);
    if (substanceNames.length === 0) {
      setInfoMsg("모듈1에 오염물질/최고농도가 입력되어 있어야 계산할 수 있어요.");
      setRecalculating(false);
      return;
    }

    const coords =
      caseInfo?.lat && caseInfo?.lon ? { lat: caseInfo.lat, lon: caseInfo.lon } : null;

    let surroundingMaxBySubstance = {};
    if (coords) {
      const matchedKeys = substanceNames
        .map((name) => findSubstanceKey(name))
        .filter(Boolean);
      const uniqueKeys = [...new Set(matchedKeys)];

      if (uniqueKeys.length > 0) {
        const latDelta = radius / 111;
        const lonDelta = radius / (111 * Math.cos((coords.lat * Math.PI) / 180));
        const selectCols = ["lat", "lon"].concat(uniqueKeys).join(",");

        const { data: refData } = await supabase
          .from("reference_soil_data")
          .select(selectCols)
          .gte("lat", coords.lat - latDelta)
          .lte("lat", coords.lat + latDelta)
          .gte("lon", coords.lon - lonDelta)
          .lte("lon", coords.lon + lonDelta)
          .limit(2000);

        const withinRadius = (refData || []).filter(
          (r) => haversineKm(coords.lat, coords.lon, r.lat, r.lon) <= radius
        );

        uniqueKeys.forEach((key) => {
          const values = withinRadius
            .map((r) => parseFloat(r[key]))
            .filter((v) => !isNaN(v));
          if (values.length > 0) {
            surroundingMaxBySubstance[key] = Math.max(...values);
          }
        });
      }
    } else {
      setInfoMsg("부지 좌표가 없어서 주변부지 데이터는 못 가져왔어요. (모듈2에서 좌표 확인 필요)");
    }

    const rowsToUpsert = substanceNames.map((name) => {
      const targetMax = targetMaxBySubstance[name];
      const key = findSubstanceKey(name);
      const surroundingMax = key ? surroundingMaxBySubstance[key] ?? null : null;
      const ratio =
        surroundingMax !== null && targetMax ? surroundingMax / targetMax : null;
      return {
        case_id: caseId,
        substance: name,
        target_max: targetMax,
        surrounding_max: surroundingMax,
        ratio,
        verdict: suggestVerdict(ratio),
        updated_at: new Date().toISOString(),
      };
    });

    const { data: existingRows } = await supabase
      .from("surrounding_impacts")
      .select("id, substance")
      .eq("case_id", caseId);

    const staleIds = (existingRows || [])
      .filter((r) => !substanceNames.includes(r.substance))
      .map((r) => r.id);

    if (staleIds.length > 0) {
      await supabase.from("surrounding_impacts").delete().in("id", staleIds);
    }

    await supabase
      .from("surrounding_impacts")
      .upsert(rowsToUpsert, { onConflict: "case_id,substance" });

    await load();
    setRecalculating(false);
  }

  async function handleVerdictClick(row) {
    const newVerdict = nextVerdict(row.verdict);
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, verdict: newVerdict } : r))
    );
    await supabase
      .from("surrounding_impacts")
      .update({ verdict: newVerdict, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  function handleNoteChange(row, note) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, note } : r)));
  }

  async function handleNoteBlur(row) {
    await supabase
      .from("surrounding_impacts")
      .update({ note: row.note, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>주변부지 오염 영향 판단</div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            대상부지(모듈1) vs 주변부지(모듈2 반경 검색 데이터) 최고농도 비교 · 판정 클릭 시 변경
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            반경
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(parseFloat(e.target.value) || 1)}
              style={{ width: 50, marginLeft: 4, marginRight: 2, padding: "2px 4px" }}
            />
            km
          </label>
          <button className="btn-secondary" onClick={handleRecalculate} disabled={recalculating}>
            {recalculating ? "계산 중..." : "↻ 재계산"}
          </button>
        </div>
      </div>

      <div
        style={{
          background: "var(--color-badge-blue-bg)",
          border: "1px solid var(--color-badge-blue-bg)",
          borderRadius: 8,
          padding: 10,
          fontSize: 12,
          margin: "12px 0",
        }}
      >
        판정은 주변/대상 비율을 기준으로 한 참고용 제안이에요 (공식 기준이 아니에요). 판정
        칸을 클릭하면 위원회 판단으로 직접 바꿀 수 있어요.
      </div>

      {infoMsg && (
        <div style={{ color: "var(--color-badge-red-text)", fontSize: 12, marginBottom: 10 }}>
          {infoMsg}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          오른쪽 위 &quot;재계산&quot;을 눌러서 모듈1·모듈2 데이터를 불러와 비교해보세요.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}>오염물질</th>
                <th style={{ padding: "8px 6px" }}>대상부지 최고(mg/kg)</th>
                <th style={{ padding: "8px 6px" }}>주변부지 최고(mg/kg)</th>
                <th style={{ padding: "8px 6px" }}>주변/대상 비율</th>
                <th style={{ padding: "8px 6px" }}>판정</th>
                <th style={{ padding: "8px 6px" }}>메모</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const style = VERDICT_STYLE[row.verdict] || VERDICT_STYLE["판단불가"];
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "8px 6px", fontWeight: 600 }}>{row.substance}</td>
                    <td style={{ padding: "8px 6px" }}>
                      {row.target_max !== null ? row.target_max.toLocaleString() : "─"}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      {row.surrounding_max !== null ? row.surrounding_max.toLocaleString() : "─"}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      {row.ratio !== null ? row.ratio.toFixed(2) : "─"}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <button
                        onClick={() => handleVerdictClick(row)}
                        style={{
                          border: "none",
                          background: style.bg,
                          color: style.text,
                          fontWeight: 600,
                          padding: "5px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.verdict}
                      </button>
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <input
                        value={row.note || ""}
                        onChange={(e) => handleNoteChange(row, e.target.value)}
                        onBlur={() => handleNoteBlur(row)}
                        placeholder="메모"
                        style={{
                          width: "100%",
                          padding: "4px 6px",
                          fontSize: 12,
                          borderRadius: 4,
                          border: "1px solid var(--color-border)",
                          boxSizing: "border-box",
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
