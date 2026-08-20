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

  async function handleSearch() {
    if (!coords || selected.size === 0) return;
    setSearching(true);
    setSearched(true);

    const latDelta = radius / 111;
    const lonDelta =
      radius / (111 * Math.cos((coords.lat * Math.PI) / 180));

    const selectCols = ["id", "source_type", "address", "lat", "lon", "survey_year", "site_name"]
      .concat(Array.from(selected))
      .join(",");

    const { data } = await supabase
      .from("reference_soil_data")
      .select(selectCols)
      .gte("lat", coords.lat - latDelta)
      .lte("lat", coords.lat + latDelta)
      .gte("lon", coords.lon - lonDelta)
      .lte("lon", coords.lon + lonDelta)
      .limit(1000);

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
            <NetworkSummaryTable
              rows={networkResults}
              substances={Array.from(selected)}
              regionGrade={caseInfo?.region_grade}
            />
          )}

          {activeTab === "실태조사" && (
            <SurveySummaryTable rows={surveyResults} substances={Array.from(selected)} />
          )}
        </>
      )}
    </div>
  );
}

// [표2] 토양측정망 조사결과 형태: 물질을 열로, 우려기준/최고농도/평균농도를 행으로 피벗
function NetworkSummaryTable({ rows, substances, regionGrade }) {
  const zone = parseRegionGrade(regionGrade);
  const keys = ORDERED_SUBSTANCE_KEYS.filter((k) => substances.includes(k));

  if (keys.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        측정항목을 선택해주세요
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        반경 안에 토양측정망 데이터가 없어요
      </div>
    );
  }

  const stats = {};
  keys.forEach((key) => {
    const values = rows.map((r) => toNum(r[key])).filter((v) => v !== null);
    stats[key] = {
      max: values.length ? Math.max(...values) : null,
      avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    };
  });

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 10 }}>
        지점 {rows.length}개 · 우려기준 기준 지역:{" "}
        {zone ? `${zone}지역` : "미지정 (사건 목록에서 지역등급을 입력해주세요)"}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
        <thead>
          <tr style={{ background: "#f6f8f4" }}>
            <th style={{ textAlign: "left", padding: 8, border: CELL_BORDER }}>구분</th>
            {keys.map((key) => (
              <th
                key={key}
                style={{ textAlign: "center", padding: 8, border: CELL_BORDER, whiteSpace: "nowrap" }}
              >
                {SUBSTANCE_LABEL[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: CELL_BORDER, fontWeight: 600 }}>
              {zone ? `${zone}지역(우려기준)` : "우려기준"}
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
                &apos;{String(y).slice(-2)}
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
