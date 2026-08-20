"use client";

import { Fragment, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { SUBSTANCE_GROUPS } from "@/lib/substances";
import { CONCERN_STANDARDS, parseRegionGrade } from "@/lib/soilStandards";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const SUBSTANCE_LABEL = Object.fromEntries(
  SUBSTANCE_GROUPS.flatMap((g) => g.items)
);
const ORDERED_SUBSTANCE_KEYS = SUBSTANCE_GROUPS.flatMap((g) =>
  g.items.map(([key]) => key)
);

// 토양측정망 표([표2]) 헤더 표기: 샘플 보고서와 동일한 물질명(영문 병기 없이 단일 줄)
const NETWORK_SUBSTANCE_LABEL = {
  cadmium: "카드뮴",
  copper: "구리",
  arsenic: "비소",
  mercury: "수은",
  lead: "납",
  chromium6: "6가크롬",
  zinc: "아연",
  nickel: "니켈",
  organophosphorus: "유기인",
  cyanide: "시안",
  ph: "pH",
  fluorine: "불소",
  pcb: "PCB",
  phenol: "페놀류",
  benzene: "벤젠",
  toluene: "톨루엔",
  ethylbenzene: "에틸벤젠",
  xylene: "크실렌",
  tph: "TPH",
  tce: "TCE",
  pce: "PCE",
  benzoapyrene: "벤조(a)피렌",
};
// 표2는 선택 여부와 무관하게 전 물질(pH 포함 22개)을 항상 표시. 순서는 샘플 보고서와 동일하게 맞춤
const NETWORK_SUBSTANCE_KEYS = Object.keys(NETWORK_SUBSTANCE_LABEL);

const CELL_BORDER = "1px solid var(--color-border)";

function toNum(v) {
  const n = parseFloat(v);
  return v === null || v === undefined || v === "" || isNaN(n) ? null : n;
}

function formatNum(n) {
  return Number(Math.round(n * 100) / 100).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  });
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

export default function Module2Panel({ caseInfo, onCoordsUpdated }) {
  const [coords, setCoords] = useState(
    caseInfo?.lat && caseInfo?.lon
      ? { lat: caseInfo.lat, lon: caseInfo.lon }
      : null
  );
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");
  const [radius, setRadius] = useState(4);
  const [selected, setSelected] = useState(new Set(["arsenic", "lead"]));
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState("지도");

  async function handleGeocode() {
    if (!caseInfo?.address) return;
    setGeocoding(true);
    setGeocodeError("");
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: caseInfo.address }),
      });
      const data = await res.json();
      if (data.error) {
        setGeocodeError(data.error);
      } else {
        setCoords({ lat: data.lat, lon: data.lon });
        await supabase
          .from("cases")
          .update({ lat: data.lat, lon: data.lon })
          .eq("id", caseInfo.id);
        onCoordsUpdated?.(data.lat, data.lon);
      }
    } catch (e) {
      setGeocodeError("좌표 변환 중 오류가 발생했어요");
    }
    setGeocoding(false);
  }

  useEffect(() => {
    if (!coords && caseInfo?.address) {
      handleGeocode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSubstance(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function queryReferenceSoilData(cols, coords, radius) {
    const latDelta = radius / 111;
    const lonDelta = radius / (111 * Math.cos((coords.lat * Math.PI) / 180));
    const selectCols = ["id", "source_type", "address", "lat", "lon", "survey_year", "site_name"]
      .concat(cols)
      .join(",");
    return supabase
      .from("reference_soil_data")
      .select(selectCols)
      .gte("lat", coords.lat - latDelta)
      .lte("lat", coords.lat + latDelta)
      .gte("lon", coords.lon - lonDelta)
      .lte("lon", coords.lon + lonDelta)
      .limit(1000);
  }

  async function handleSearch() {
    if (!coords || selected.size === 0) return;
    setSearching(true);
    setSearched(true);

    // 토양측정망은 선택 여부와 상관없이 전 항목(pH 포함)을 조사하므로 항상 전체 컬럼을 가져와요.
    // pH 컬럼이 아직 없는 환경이면 실패하니, 그럴 땐 pH 없이 다시 조회해서 나머지는 정상 표시해요.
    let { data, error } = await queryReferenceSoilData(
      [...ORDERED_SUBSTANCE_KEYS, "ph"],
      coords,
      radius
    );
    if (error) {
      ({ data } = await queryReferenceSoilData(ORDERED_SUBSTANCE_KEYS, coords, radius));
    }

    const withDistance = (data || [])
      .map((row) => ({
        ...row,
        distance: haversineKm(coords.lat, coords.lon, row.lat, row.lon),
      }))
      .filter((row) => row.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    setResults(withDistance);
    setSearching(false);
  }

  const networkResults = results.filter((r) => r.source_type === "측정망");
  const surveyResults = results.filter((r) => r.source_type === "실태조사");

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15 }}>
            📍 {caseInfo?.address}{" "}
            {coords && (
              <span style={{ color: "var(--color-text-muted)" }}>
                ({coords.lat.toFixed(6)}, {coords.lon.toFixed(6)})
              </span>
            )}
          </div>
          <button className="btn-secondary" onClick={handleGeocode} disabled={geocoding}>
            {geocoding ? "변환 중..." : "🔄 좌표 재변환"}
          </button>
        </div>
        {geocodeError && (
          <div style={{ color: "var(--color-badge-red-text)", fontSize: 14, marginTop: 6 }}>
            {geocodeError}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 15, marginBottom: 6 }}>
            조사 반경 <strong>{radius}km</strong>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
          측정항목 선택
        </div>
        {SUBSTANCE_GROUPS.map((group) => (
          <div key={group.label} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 4 }}>
              {group.label}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
              {group.items.map(([key, label]) => (
                <label
                  key={key}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 15 }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggleSubstance(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
        <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 8 }}>
          선택됨 ({selected.size}개):{" "}
          {Array.from(selected).map((k) => SUBSTANCE_LABEL[k]).join(", ") || "없음"}
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={handleSearch}
        disabled={!coords || selected.size === 0 || searching}
        style={{ marginBottom: 16 }}
      >
        {searching ? "검색 중..." : "🔄 반경 내 데이터 검색"}
      </button>

      {searched && (
        <>
          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-border)", marginBottom: 12 }}>
            {["지도", `토양측정망 (${networkResults.length})`, `실태조사 (${surveyResults.length})`].map(
              (tabLabel, idx) => {
                const tabKey = ["지도", "토양측정망", "실태조사"][idx];
                return (
                  <button
                    key={tabKey}
                    onClick={() => setActiveTab(tabKey)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: "8px 12px",
                      fontSize: 15,
                      cursor: "pointer",
                      fontWeight: activeTab === tabKey ? 700 : 400,
                      borderBottom:
                        activeTab === tabKey
                          ? "2px solid var(--color-primary)"
                          : "2px solid transparent",
                      color: activeTab === tabKey ? "var(--color-primary)" : "var(--color-text)",
                    }}
                  >
                    {tabLabel}
                  </button>
                );
              }
            )}
          </div>

          {activeTab === "지도" && coords && (
            <MapView center={coords} radiusKm={radius} points={results} />
          )}

          {activeTab === "토양측정망" && (
            <NetworkSummaryTable rows={networkResults} regionGrade={caseInfo?.region_grade} />
          )}

          {activeTab === "실태조사" && (
            <SurveySummaryTable rows={surveyResults} substances={Array.from(selected)} />
          )}
        </>
      )}
    </div>
  );
}

// [표2] 토양측정망 조사결과 형태: 전 물질(pH 포함 22개)을 표 하나 안에서 11개씩 위/아래 두 블록으로
// 나눠 표시 (샘플 보고서와 동일한 구조: 표는 1개, 물질 열 블록이 위 11개·아래 11개로 8줄 구성).
// 측정망은 선택 여부와 무관하게 전 물질을 항상 표시하고, 첫 열 외 물질 열은 모두 동일한 넓이로 맞춤.
function NetworkSummaryTable({ rows, regionGrade }) {
  const zone = parseRegionGrade(regionGrade);

  if (rows.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        반경 안에 토양측정망 데이터가 없어요
      </div>
    );
  }

  const stats = {};
  NETWORK_SUBSTANCE_KEYS.forEach((key) => {
    const values = rows.map((r) => toNum(r[key])).filter((v) => v !== null);
    stats[key] = {
      max: values.length ? Math.max(...values) : null,
      avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    };
  });

  const keyBlocks = [NETWORK_SUBSTANCE_KEYS.slice(0, 11), NETWORK_SUBSTANCE_KEYS.slice(11)];
  const labelColWidth = 130;
  const substanceColWidth = `calc((100% - ${labelColWidth}px) / 11)`;

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 10 }}>
        지점 {rows.length}개 · 우려기준 기준 지역:{" "}
        {zone ? `${zone}지역` : "미지정 (사건 목록에서 지역등급을 입력해주세요)"}
      </div>
      <table
        style={{
          width: "100%",
          minWidth: 900,
          tableLayout: "fixed",
          borderCollapse: "collapse",
          fontSize: 15,
        }}
      >
        <colgroup>
          <col style={{ width: labelColWidth }} />
          {keyBlocks[0].map((key) => (
            <col key={key} style={{ width: substanceColWidth }} />
          ))}
        </colgroup>
        <tbody>
          {keyBlocks.map((keys, blockIndex) => (
            <Fragment key={blockIndex}>
              <tr style={{ background: "#f6f8f4" }}>
                <td style={{ textAlign: "left", padding: 8, border: CELL_BORDER, fontWeight: 600 }}>
                  측정항목
                </td>
                {keys.map((key) => (
                  <td
                    key={key}
                    style={{
                      textAlign: "center",
                      padding: 8,
                      border: CELL_BORDER,
                      fontWeight: 600,
                      wordBreak: "keep-all",
                    }}
                  >
                    {NETWORK_SUBSTANCE_LABEL[key]}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: 8, border: CELL_BORDER, fontWeight: 600 }}>
                  {zone ? `‘${zone}지역(우려기준)` : "우려기준"}
                </td>
                {keys.map((key) => (
                  <td key={key} style={{ padding: 8, border: CELL_BORDER, textAlign: "center" }}>
                    {zone && CONCERN_STANDARDS[key]?.[zone] !== undefined
                      ? formatNum(CONCERN_STANDARDS[key][zone])
                      : "-"}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: 8, border: CELL_BORDER, fontWeight: 600 }}>최고농도</td>
                {keys.map((key) => (
                  <td key={key} style={{ padding: 8, border: CELL_BORDER, textAlign: "center" }}>
                    {stats[key].max !== null ? formatNum(stats[key].max) : "-"}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: 8, border: CELL_BORDER, fontWeight: 600 }}>평균농도</td>
                {keys.map((key) => (
                  <td key={key} style={{ padding: 8, border: CELL_BORDER, textAlign: "center" }}>
                    {stats[key].avg !== null ? formatNum(stats[key].avg) : "-"}
                  </td>
                ))}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 8 }}>
        우려기준 근거: 「토양환경보전법 시행규칙」 제1조의5 및 별표3(토양오염우려기준)
      </div>
    </div>
  );
}

// [표3] 토양오염실태조사 결과 형태: 물질별로 최저/최고농도를 연도별 열로 피벗
function SurveySummaryTable({ rows, substances }) {
  const keys = ORDERED_SUBSTANCE_KEYS.filter((k) => substances.includes(k));

  if (keys.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        측정항목을 선택해주세요
      </div>
    );
  }

  const years = Array.from(new Set(rows.map((r) => r.survey_year).filter((y) => y != null))).sort(
    (a, b) => Number(a) - Number(b)
  );

  if (years.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        반경 안에 토양오염실태조사 데이터가 없어요
      </div>
    );
  }

  function statsFor(key, year) {
    const values = rows
      .filter((r) => r.survey_year === year)
      .map((r) => toNum(r[key]))
      .filter((v) => v !== null);
    return {
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
    };
  }

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 10 }}>
        지점 {rows.length}개
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
        <thead>
          <tr style={{ background: "#f6f8f4" }}>
            <th style={{ textAlign: "center", padding: 8, border: CELL_BORDER }} colSpan={2}>
              구분
            </th>
            {years.map((y) => (
              <th
                key={y}
                style={{ textAlign: "center", padding: 8, border: CELL_BORDER, whiteSpace: "nowrap" }}
              >
                ‘{String(y).slice(-2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const yearStats = years.map((y) => statsFor(key, y));
            return (
              <Fragment key={key}>
                <tr>
                  <td
                    rowSpan={2}
                    style={{
                      padding: 8,
                      border: CELL_BORDER,
                      textAlign: "center",
                      fontWeight: 600,
                      verticalAlign: "middle",
                    }}
                  >
                    {SUBSTANCE_LABEL[key]}
                  </td>
                  <td style={{ padding: 8, border: CELL_BORDER, color: "var(--color-text-muted)" }}>
                    최저농도
                  </td>
                  {yearStats.map((s, i) => (
                    <td key={years[i]} style={{ padding: 8, border: CELL_BORDER, textAlign: "center" }}>
                      {s.min !== null ? formatNum(s.min) : "-"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: 8, border: CELL_BORDER, color: "var(--color-text-muted)" }}>
                    최고농도
                  </td>
                  {yearStats.map((s, i) => (
                    <td key={years[i]} style={{ padding: 8, border: CELL_BORDER, textAlign: "center" }}>
                      {s.max !== null ? formatNum(s.max) : "-"}
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
