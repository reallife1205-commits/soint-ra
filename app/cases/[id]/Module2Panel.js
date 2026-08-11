"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const SUBSTANCE_GROUPS = [
  {
    label: "중금속류",
    items: [
      ["cadmium", "카드뮴(Cd)"],
      ["copper", "구리(Cu)"],
      ["arsenic", "비소(As)"],
      ["lead", "납(Pb)"],
      ["chromium6", "6가크롬(Cr6+)"],
      ["mercury", "수은(Hg)"],
      ["zinc", "아연(Zn)"],
      ["nickel", "니켈(Ni)"],
    ],
  },
  {
    label: "유기물질",
    items: [
      ["organophosphorus", "유기인"],
      ["cyanide", "시안(CN)"],
      ["phenol", "페놀류"],
      ["benzene", "벤젠"],
      ["toluene", "톨루엔"],
      ["ethylbenzene", "에틸벤젠"],
      ["xylene", "크실렌"],
      ["tph", "TPH"],
    ],
  },
  {
    label: "휘발성 유기화합물",
    items: [
      ["tce", "TCE"],
      ["pce", "PCE"],
    ],
  },
  {
    label: "기타",
    items: [
      ["fluorine", "불소(F)"],
      ["pcb", "PCB"],
      ["benzoapyrene", "벤조(a)피렌"],
    ],
  },
];

const SUBSTANCE_LABEL = Object.fromEntries(
  SUBSTANCE_GROUPS.flatMap((g) => g.items)
);

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
          <div style={{ fontSize: 13 }}>
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
          <div style={{ color: "var(--color-badge-red-text)", fontSize: 12, marginTop: 6 }}>
            {geocodeError}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
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
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          측정항목 선택
        </div>
        {SUBSTANCE_GROUPS.map((group) => (
          <div key={group.label} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>
              {group.label}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
              {group.items.map(([key, label]) => (
                <label
                  key={key}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}
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
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 8 }}>
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
                      fontSize: 13,
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
            <ResultTable rows={networkResults} substances={Array.from(selected)} />
          )}

          {activeTab === "실태조사" && (
            <ResultTable rows={surveyResults} substances={Array.from(selected)} />
          )}
        </>
      )}
    </div>
  );
}

function ResultTable({ rows, substances }) {
  if (rows.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        반경 안에 데이터가 없어요
      </div>
    );
  }
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f6f8f4" }}>
            <th style={{ textAlign: "left", padding: 8 }}>지점명</th>
            <th style={{ textAlign: "left", padding: 8 }}>주소</th>
            <th style={{ textAlign: "left", padding: 8 }}>거리</th>
            <th style={{ textAlign: "left", padding: 8 }}>연도</th>
            {substances.map((s) => (
              <th key={s} style={{ textAlign: "left", padding: 8 }}>
                {SUBSTANCE_LABEL[s]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((row) => (
            <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
              <td style={{ padding: 8 }}>{row.site_name || "-"}</td>
              <td style={{ padding: 8 }}>{row.address}</td>
              <td style={{ padding: 8 }}>{row.distance.toFixed(2)}km</td>
              <td style={{ padding: 8 }}>{row.survey_year}</td>
              {substances.map((s) => (
                <td key={s} style={{ padding: 8 }}>
                  {row[s] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && (
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", padding: 8 }}>
          너무 많아서 가까운 200건만 표시 중이에요 (전체 {rows.length}건)
        </div>
      )}
    </div>
  );
}
