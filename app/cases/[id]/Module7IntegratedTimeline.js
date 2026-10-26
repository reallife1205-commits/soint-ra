"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  LEGAL_REFERENCE_DATE,
  PX_PER_YEAR,
  yearFraction,
  formatDate,
  ownershipTimelineLists,
  timelineYearRange,
  OWNER_COLORS,
  TENANT_COLORS,
  BAR_HEIGHT,
  LANE_HEIGHT,
  toBars,
} from "@/lib/ownershipTimeline";

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
                fontSize: 12,
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

      const { owners: ownerList, tenants: tenantList } = ownershipTimelineLists((rows || []).map((r) => r.row_data || {}));

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
        setOwners(ownerList);
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
    const { minYear: min, maxYear: max } = timelineYearRange(owners, tenants, photoDocs.map((d) => d.photo_year));
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
                    data-view onClick={() => openPhoto(doc)}
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
                data-view onClick={() => setSelectedPhoto(null)}
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
