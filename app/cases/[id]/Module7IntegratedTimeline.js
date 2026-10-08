"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const LEGAL_REFERENCE_DATE = "1996-01-06"; // 토양환경보전법 시행일 기준
const PX_PER_YEAR = 30; // 연도 간격. 50이면 막대가 너무 길어 한눈에 안 들어와서 줄임

// 취득일/처분일 등이 이제 날짜선택기가 아니라 수기 텍스트라 "1989.9", "2008-01-10",
// "2008" 등 형식이 제각각이다. 정확한 날짜 파싱 대신 연도(필수)와 있으면 월까지만
// 관대하게 뽑아서 타임라인 위치를 근사한다. 연도를 못 찾으면(예: "현재") null 반환.
function yearFraction(dateStr) {
  if (!dateStr) return null;
  const yearMatch = dateStr.match(/(19|20)\d{2}/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[0], 10);
  const rest = dateStr.slice(yearMatch.index + yearMatch[0].length);
  const monthMatch = rest.match(/\d{1,2}/);
  const month = monthMatch ? Math.min(Math.max(parseInt(monthMatch[0], 10), 1), 12) : 1;
  return year + (month - 1) / 12;
}

// 정렬·비교용 키 (일까지). 연도를 못 찾으면 null.
function dateKey(dateStr) {
  if (!dateStr) return null;
  const yearMatch = dateStr.match(/(19|20)\d{2}/);
  if (!yearMatch) return null;
  const nums = dateStr.slice(yearMatch.index + yearMatch[0].length).match(/\d{1,2}/g) || [];
  return parseInt(yearMatch[0], 10) * 10000 + (parseInt(nums[0], 10) || 1) * 100 + (parseInt(nums[1], 10) || 1);
}

function formatDate(dateStr) {
  if (!dateStr) return "현재";
  return dateStr;
}

// 처분일을 비워 둔 소유자가 대부분이라 전부 "~ 현재"로 겹쳐 그려졌다.
// 처분일이 없으면 다음 소유자(더 늦은 취득일)의 취득일까지로 본다.
// 같은 날 취득한 사람들은 공동소유로 보고 함께 끝난다.
function inferOwnerEnds(list) {
  return list.map((o) => {
    if (o.end) return o;
    const k = dateKey(o.start);
    if (k == null) return o;
    const next = list
      .filter((x) => dateKey(x.start) != null && dateKey(x.start) > k)
      .sort((a, b) => dateKey(a.start) - dateKey(b.start))[0];
    return next ? { ...o, end: next.start, endInferred: true } : o;
  });
}

// 기간이 겹치는 막대는 아랫줄로 내려서 서로 가리지 않게 한다.
function assignLanes(items, colorCount) {
  const laneEnds = [];
  const laneLastColor = [];
  const placed = [];
  items.forEach((it) => {
    let lane = laneEnds.findIndex((end) => end <= it.s + 1e-6);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.e);
      laneLastColor.push(-1);
    } else {
      laneEnds[lane] = it.e;
    }
    // 같은 줄 바로 앞 막대, 그리고 기간이 겹치는 다른 줄 막대와 색이 겹치지 않게 고른다
    const forbidden = new Set([laneLastColor[lane]]);
    placed.forEach((p) => {
      if (p.s < it.e && it.s < p.e) forbidden.add(p.colorIdx);
    });
    let colorIdx = laneLastColor[lane] + 1;
    for (let k = 0; k < colorCount; k++) {
      const c = (laneLastColor[lane] + 1 + k) % colorCount;
      if (!forbidden.has(c)) {
        colorIdx = c;
        break;
      }
    }
    laneLastColor[lane] = colorIdx % colorCount;
    placed.push({ ...it, lane, colorIdx: colorIdx % colorCount });
  });
  return placed;
}

// 이웃 막대끼리 확실히 구분되도록 명도 차이가 큰 초록·연두·노랑. 밝은 색은 글자를 어둡게.
const OWNER_COLORS = [
  { bg: "#2e7d32", fg: "white" },
  { bg: "#9ccc65", fg: "#1b3a1d" },
  { bg: "#f4c430", fg: "#4a3b00" },
];
// 임차인은 소유자(초록 계열)와 헷갈리지 않게 갈색 계열
const TENANT_COLORS = [
  { bg: "#a8562f", fg: "white" },
  { bg: "#d9a066", fg: "#3d2310" },
];
const BAR_HEIGHT = 28;
const LANE_HEIGHT = 32;

function toBars(list, colorCount) {
  const thisYear = new Date().getFullYear();
  const bars = list
    .map((item, i) => {
      const s = yearFraction(item.start);
      if (s == null) return null;
      const e = Math.max(yearFraction(item.end) || thisYear, s);
      return { ...item, i, s, e };
    })
    .filter(Boolean);
  return assignLanes(bars, colorCount);
}

// 이력 목록의 점 색을 타임라인 막대 색과 맞춘다
function barColor(bars, i, colors) {
  const b = bars.find((x) => x.i === i);
  return colors[(b ? b.colorIdx : i) % colors.length].bg;
}

function BarRow({ label, bars, colors, xFor }) {
  const lanes = Math.max(1, ...bars.map((b) => b.lane + 1));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ position: "relative", height: lanes * LANE_HEIGHT + 8 }}>
        {bars.map((b) => {
          const left = xFor(b.s);
          // 1px 간격을 둬서 이어지는 막대끼리 경계가 보이게
          const width = Math.max(xFor(b.e) - left - 1, 4);
          return (
            <div
              key={b.i}
              title={`${b.name} (${formatDate(b.start)} ~ ${formatDate(b.end)})`}
              style={{
                position: "absolute",
                left,
                width,
                height: BAR_HEIGHT,
                top: 4 + b.lane * LANE_HEIGHT,
                background: colors[b.colorIdx % colors.length].bg,
                color: colors[b.colorIdx % colors.length].fg,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                borderRadius: 4,
                padding: "0 4px",
                boxSizing: "border-box",
              }}
            >
              {b.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function IntegratedTimeline({ caseId }) {
  const [loading, setLoading] = useState(true);
  const [owners, setOwners] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [photoDocs, setPhotoDocs] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: rows } = await supabase
        .from("module_rows")
        .select("row_data")
        .eq("case_id", caseId)
        .eq("module_number", 3);

      const ownerList = [];
      const tenantList = [];
      (rows || []).forEach((r) => {
        const d = r.row_data || {};
        if (d.category === "ownership" && d.owner_name) {
          ownerList.push({
            name: d.owner_name,
            start: d.acquired_date || null,
            end: d.disposed_date || null,
          });
        }
        if (d.category === "lease" && d.tenant_name) {
          tenantList.push({
            name: d.tenant_name,
            start: d.lease_start || null,
            end: d.lease_end || null,
          });
        }
      });
      const byStart = (a, b) => (dateKey(a.start) ?? Infinity) - (dateKey(b.start) ?? Infinity);
      ownerList.sort(byStart);
      tenantList.sort(byStart);

      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("case_id", caseId)
        .eq("module_number", 4);

      const validDocs = (docs || []).filter(
        (d) => d.photo_year !== null && d.photo_year !== undefined && d.photo_year !== ""
      );
      // 같은 연도에 사진이 여러 장이면 대표로 1장만 타임라인에 표시해요.
      const byYear = new Map();
      validDocs.forEach((d) => {
        if (!byYear.has(d.photo_year)) byYear.set(d.photo_year, d);
      });
      const photoList = [...byYear.values()].sort((a, b) => a.photo_year - b.photo_year);

      if (!cancelled) {
        setOwners(inferOwnerEnds(ownerList));
        setTenants(tenantList);
        setPhotoDocs(photoList);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  async function openPhoto(doc) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 3600);
    setSelectedPhoto({ ...doc, signedUrl: data?.signedUrl || null });
  }

  const { minYear, maxYear, totalWidth } = useMemo(() => {
    const today = new Date();
    let allYears = [today.getFullYear()];
    owners.forEach((o) => {
      const s = yearFraction(o.start);
      const e = yearFraction(o.end) || today.getFullYear();
      if (s) allYears.push(Math.floor(s));
      allYears.push(Math.ceil(e));
    });
    tenants.forEach((t) => {
      const s = yearFraction(t.start);
      const e = yearFraction(t.end) || today.getFullYear();
      if (s) allYears.push(Math.floor(s));
      allYears.push(Math.ceil(e));
    });
    photoDocs.forEach((d) => allYears.push(d.photo_year));
    allYears.push(1996);

    const min = Math.min(...allYears) - 2;
    const max = Math.max(...allYears) + 2;
    return {
      minYear: min,
      maxYear: max,
      totalWidth: (max - min) * PX_PER_YEAR,
    };
  }, [owners, tenants, photoDocs]);

  function xForYearFraction(yf) {
    return (yf - minYear) * PX_PER_YEAR;
  }

  const legalX = xForYearFraction(yearFraction(LEGAL_REFERENCE_DATE));
  const ownerBars = toBars(owners, OWNER_COLORS.length);
  const tenantBars = toBars(tenants, TENANT_COLORS.length);

  const yearTicks = [];
  for (let y = Math.ceil(minYear / 5) * 5; y <= maxYear; y += 5) {
    yearTicks.push(y);
  }

  if (loading) {
    return <div className="card">불러오는 중이에요...</div>;
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, color: "var(--color-text-muted)", marginBottom: 14 }}>
          소유자·임차인 기간, 항공사진, 법 기준일을 한눈에 확인합니다. 가로 스크롤 가능해요.
        </div>

        <div style={{ overflowX: "auto", paddingBottom: 8 }}>
          <div style={{ position: "relative", width: totalWidth, minWidth: "100%" }}>
            {/* 연도 눈금 */}
            <div style={{ position: "relative", height: 24, borderBottom: "1px solid var(--color-border)" }}>
              {yearTicks.map((y) => (
                <div
                  key={y}
                  style={{
                    position: "absolute",
                    left: xForYearFraction(y),
                    fontSize: 13,
                    color: "var(--color-text-muted)",
                    transform: "translateX(-50%)",
                  }}
                >
                  {y}
                </div>
              ))}
            </div>

            {/* 법 기준일 세로선 */}
            <div
              style={{
                position: "absolute",
                top: 24,
                bottom: 0,
                left: legalX,
                width: 0,
                borderLeft: "2px dashed #d64545",
                zIndex: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 26,
                left: legalX + 4,
                fontSize: 13,
                color: "#d64545",
                fontWeight: 700,
                zIndex: 2,
                whiteSpace: "nowrap",
              }}
            >
              ▲ {LEGAL_REFERENCE_DATE}
            </div>

            {/* 소유자 행 */}
            <div style={{ marginTop: 32 }}>
              <BarRow label="소유자" bars={ownerBars} colors={OWNER_COLORS} xFor={xForYearFraction} />
            </div>

            {/* 임차인 행 */}
            {tenants.length > 0 && (
              <BarRow label="임차인" bars={tenantBars} colors={TENANT_COLORS} xFor={xForYearFraction} />
            )}

            {/* 항공사진 행 */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>항공사진</div>
              <div style={{ position: "relative", height: 30 }}>
                {photoDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => openPhoto(doc)}
                    title={doc.photo_note || doc.file_name}
                    style={{
                      position: "absolute",
                      left: xForYearFraction(doc.photo_year) - 10,
                      textAlign: "center",
                      fontSize: 13,
                      color: "var(--color-text-muted)",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <div style={{ fontSize: 18 }}>🖼️</div>
                    <div>{doc.photo_year}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 14, marginTop: 12, color: "var(--color-text-muted)" }}>
          <span>
            <span style={{ display: "inline-block", width: 10, height: 10, background: OWNER_COLORS[0].bg, borderRadius: 2, marginRight: 4 }} />
            소유자
          </span>
          <span>
            <span style={{ display: "inline-block", width: 10, height: 10, background: TENANT_COLORS[0].bg, borderRadius: 2, marginRight: 4 }} />
            임차인
          </span>
          <span>🖼️ 항공사진</span>
          <span style={{ color: "#d64545" }}>┊ 1996.1.6 법 기준일</span>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>이력 목록</div>
        {owners.length === 0 && tenants.length === 0 ? (
          <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
            챕터 03에 소유·임대차 이력을 입력하면 여기에 자동으로 나와요.
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {owners.map((o, i) => (
              <li key={`o${i}`} style={{ fontSize: 15, padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: barColor(ownerBars, i, OWNER_COLORS), marginRight: 8 }} />
                소유자 {o.name} ({formatDate(o.start)} ~ {formatDate(o.end)}
                {o.endInferred && <span style={{ color: "var(--color-text-muted)" }}>*</span>})
              </li>
            ))}
            {tenants.map((t, i) => (
              <li key={`t${i}`} style={{ fontSize: 15, padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: barColor(tenantBars, i, TENANT_COLORS), marginRight: 8 }} />
                임차인 {t.name} ({formatDate(t.start)} ~ {formatDate(t.end)})
              </li>
            ))}
          </ul>
        )}
        {owners.some((o) => o.endInferred) && (
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 8 }}>
            * 처분일이 비어 있어 다음 소유자의 취득일까지로 표시했어요. 같은 날 취득한 소유자는 공동소유로 보고 겹쳐 표시해요.
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 10,
              padding: 16,
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {selectedPhoto.photo_year}년 · {selectedPhoto.photo_note || selectedPhoto.file_name}
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 19 }}
              >
                ✕
              </button>
            </div>
            {selectedPhoto.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedPhoto.signedUrl}
                alt={selectedPhoto.file_name}
                style={{ maxWidth: "100%", maxHeight: "75vh", display: "block" }}
              />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
                불러오는 중...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
