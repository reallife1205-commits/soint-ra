"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PollutionMappingTab from "./Module7PollutionMapping";
import SurroundingImpactTab from "./Module7SurroundingImpact";
import ReviewOpinionTab from "./Module7ReviewOpinion";

const LEGAL_REFERENCE_DATE = "1996-01-06"; // 토양환경보전법 시행일 기준
const PX_PER_YEAR = 50;
const ROW_HEIGHT = 40;

const TABS = [
  { key: "timeline", label: "통합 타임라인" },
  { key: "mapping", label: "오염물질 × 기업 매핑" },
  { key: "surrounding", label: "주변부지 영향" },
  { key: "opinion", label: "검토 의견" },
];

export default function Module7Panel({ caseId, caseInfo }) {
  const [tab, setTab] = useState("timeline");

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: "none",
              background: "transparent",
              padding: "8px 14px",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: tab === t.key ? 700 : 400,
              borderBottom:
                tab === t.key
                  ? "2px solid var(--color-primary)"
                  : "2px solid transparent",
              color: tab === t.key ? "var(--color-primary)" : "var(--color-text)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "timeline" && <IntegratedTimeline caseId={caseId} />}
      {tab === "mapping" && <PollutionMappingTab caseId={caseId} />}
      {tab === "surrounding" && <SurroundingImpactTab caseId={caseId} caseInfo={caseInfo} />}
      {tab === "opinion" && <ReviewOpinionTab caseId={caseId} />}
    </div>
  );
}

function yearFraction(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear() + d.getMonth() / 12 + d.getDate() / 365;
}

function formatDate(dateStr) {
  if (!dateStr) return "현재";
  return dateStr;
}

function IntegratedTimeline({ caseId }) {
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
      ownerList.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
      tenantList.sort((a, b) => (a.start || "").localeCompare(b.start || ""));

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
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 14 }}>
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
                    fontSize: 11,
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
                left: legalX,
                width: 0,
                height: (owners.length > 0 ? ROW_HEIGHT : 0) + (photoDocs.length > 0 ? ROW_HEIGHT : 0) + 40,
                borderLeft: "2px dashed #d64545",
                zIndex: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 26,
                left: legalX + 4,
                fontSize: 11,
                color: "#d64545",
                fontWeight: 700,
                zIndex: 2,
                whiteSpace: "nowrap",
              }}
            >
              ▲ {LEGAL_REFERENCE_DATE}
            </div>

            {/* 소유자 행 */}
            <div style={{ marginTop: 40 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>소유자</div>
              <div style={{ position: "relative", height: ROW_HEIGHT }}>
                {owners.map((o, i) => {
                  const s = yearFraction(o.start);
                  const e = yearFraction(o.end) || new Date().getFullYear();
                  if (s == null) return null;
                  const left = xForYearFraction(s);
                  const width = Math.max(xForYearFraction(e) - left, 4);
                  return (
                    <div
                      key={i}
                      title={`${o.name} (${formatDate(o.start)} ~ ${formatDate(o.end)})`}
                      style={{
                        position: "absolute",
                        left,
                        width,
                        height: 28,
                        top: 4,
                        background: "#8b6fd6",
                        color: "white",
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        borderRadius: 4,
                        padding: "0 4px",
                        boxSizing: "border-box",
                      }}
                    >
                      {o.name}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 임차인 행 */}
            {tenants.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>임차인</div>
                <div style={{ position: "relative", height: ROW_HEIGHT }}>
                  {tenants.map((t, i) => {
                    const s = yearFraction(t.start);
                    const e = yearFraction(t.end) || new Date().getFullYear();
                    if (s == null) return null;
                    const left = xForYearFraction(s);
                    const width = Math.max(xForYearFraction(e) - left, 4);
                    return (
                      <div
                        key={i}
                        title={`${t.name} (${formatDate(t.start)} ~ ${formatDate(t.end)})`}
                        style={{
                          position: "absolute",
                          left,
                          width,
                          height: 28,
                          top: 4,
                          background: "#e0a13c",
                          color: "white",
                          fontSize: 11,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          borderRadius: 4,
                          padding: "0 4px",
                          boxSizing: "border-box",
                        }}
                      >
                        {t.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 항공사진 행 */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>항공사진</div>
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
                      fontSize: 10,
                      color: "var(--color-text-muted)",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <div style={{ fontSize: 16 }}>🖼️</div>
                    <div>{doc.photo_year}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 12, marginTop: 12, color: "var(--color-text-muted)" }}>
          <span>
            <span style={{ display: "inline-block", width: 10, height: 10, background: "#8b6fd6", borderRadius: 2, marginRight: 4 }} />
            소유자
          </span>
          <span>
            <span style={{ display: "inline-block", width: 10, height: 10, background: "#e0a13c", borderRadius: 2, marginRight: 4 }} />
            임차인
          </span>
          <span>🖼️ 항공사진</span>
          <span style={{ color: "#d64545" }}>┊ 1996.1.6 법 기준일</span>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>이력 목록</div>
        {owners.length === 0 && tenants.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            모듈3에 소유·임대차 이력을 입력하면 여기에 자동으로 나와요.
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {owners.map((o, i) => (
              <li key={`o${i}`} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#8b6fd6", marginRight: 8 }} />
                소유자 {o.name} ({formatDate(o.start)} ~ {formatDate(o.end)})
              </li>
            ))}
            {tenants.map((t, i) => (
              <li key={`t${i}`} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#e0a13c", marginRight: 8 }} />
                임차인 {t.name} ({formatDate(t.start)} ~ {formatDate(t.end)})
              </li>
            ))}
          </ul>
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
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {selectedPhoto.photo_year}년 · {selectedPhoto.photo_note || selectedPhoto.file_name}
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18 }}
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
