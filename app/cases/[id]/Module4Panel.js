"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { useModuleRows } from "@/lib/useModuleRows";
import { ownerPeriod, occupantPeriod } from "@/lib/currentOwner";
import { useAerialTags } from "@/lib/useAerialTags";
import { FACILITY_TYPES, FACILITY_LABEL, FACILITY_COLOR } from "@/lib/facilityTypes";

// 항공사진은 초록·회색이 많아 시설 종류 색(특히 회색 '기타 시설')의 얇은 선이 묻혔다 — 그리는 중이든
// 저장된 태그든 박스는 형광 노랑 굵은 점선에 안팎으로 어두운 테두리를 둘러 어떤 사진에서도 보이게 한다.
// 시설 종류는 박스 위 이름표 색으로 구분한다.
const DRAFT_BOX_STYLE = {
  border: "3px dashed #ffea00",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(0,0,0,0.75)",
};
import TimelinePanel from "./TimelinePanel";
import ReportStatusBadge from "./ReportStatusBadge";
import { yearFromFileName } from "@/lib/photoYear";
import { splitExt } from "./UploadHelpers";
const AerialMapView = dynamic(() => import("./AerialMapView"), { ssr: false });

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;

const TABS = [
  { key: "map", label: "지도" },
  { key: "upload", label: "사진 연도·태깅" }, // 업로드는 왼쪽에서 하고, 여기선 고른 사진에 연도·시설 표시
  { key: "timeline", label: "타임라인" },
];

const MIN_BOX_SIZE = 0.01; // 이미지 대비 1% 미만이면 클릭으로 간주하고 무시

export default function Module4Panel({ caseId, caseInfo, onCaseUpdated }) {
  const [tab, setTab] = useState("map");
  const [timelineCount, setTimelineCount] = useState(0);

  // 타임라인 탭을 열기 전에도 사진 수가 보이게(예전엔 탭을 열어야 숫자가 채워져 "타임라인 0"으로 보였다)
  useEffect(() => {
    supabase
      .from("documents")
      .select("file_name")
      .eq("case_id", caseId)
      .eq("module_number", 4)
      .then(({ data }) => setTimelineCount((data || []).filter((d) => IMAGE_EXT_RE.test(d.file_name)).length));
  }, [caseId]);

  const coords =
    caseInfo?.lat && caseInfo?.lon
      ? { lat: caseInfo.lat, lon: caseInfo.lon }
      : null;

  async function handleBoundarySave(points) {
    const value = points ? points.map((p) => ({ lat: p.lat, lon: p.lon })) : null;
    await supabase
      .from("cases")
      .update({ boundary_points: value })
      .eq("id", caseId);
    // 예전엔 페이지 전체를 새로고침해서 1. 개요로 돌아갔다 — 안건 정보만 다시 불러와 이 화면에 그대로 머문다
    if (onCaseUpdated) await onCaseUpdated();
    else if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <div>
      {/* 3.4 출입가능성 아래에 붙는 별도 구역이라, 제목과 버튼형 탭으로 위 입력란과 구분한다 */}
      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 20, marginBottom: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>
          항공사진
          <ReportStatusBadge status="required" />
        </div>
        <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 4 }}>
          왼쪽 &quot;항공사진·현장사진 업로드&quot;에 올린 사진에 촬영연도를 넣으면 타임라인과 보고서 항공사진 표(오래된 연도부터)에 들어가요.
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            data-view onClick={() => setTab(t.key)}
            className={tab === t.key ? "btn-primary" : "btn-secondary"}
            style={{ fontSize: 14 }}
          >
            {t.label}
            {t.key === "timeline" && <span style={{ marginLeft: 4, opacity: 0.75 }}>{timelineCount}</span>}
          </button>
        ))}
      </div>

      {tab === "map" && (
        <>
          <InflectionYearsHint caseId={caseId} />
          <ExternalAerialLinks coords={coords} address={caseInfo?.address} />
          <AerialMapView
            coords={coords}
            address={caseInfo?.address}
            boundary={caseInfo?.boundary_points}
            boundaryEditable={true}
            onBoundarySave={handleBoundarySave}
          />
        </>
      )}
      {tab === "upload" && <UploadTaggingSection caseId={caseId} />}
      {tab === "timeline" && (
        <TimelinePanel caseId={caseId} onCountChange={setTimelineCount} />
      )}
    </div>
  );
}

// 3.1 소유·임대차 이력(취득일/처분일, 임차 시작/종료)에서 변동 시점의 연도를 뽑아
// "이 연도들의 항공사진을 찾아보면 좋다"고 추천해주는 카드. 실제 항공사진 데이터를
// 갖고 판단하는 게 아니라 소유·점유 변동 이력만 근거로 하는 참고용 추천이다.
function InflectionYearsHint({ caseId }) {
  const { rows } = useModuleRows(caseId, 3);

  const byYear = {};
  function addEvent(dateStr, label) {
    if (!dateStr) return;
    // 취득일/처분일 등이 날짜선택기가 아니라 수기 텍스트라 "1989.9", "2008" 등
    // 형식이 제각각이라, 문자열 어디에 있든 4자리 연도를 찾아서 사용한다.
    const match = dateStr.match(/(19|20)\d{2}/);
    if (!match) return;
    const year = match[0];
    if (!byYear[year]) byYear[year] = [];
    // 한 소유자가 점유 업체마다 여러 행에 반복돼 같은 문구가 겹친다
    if (!byYear[year].includes(label)) byYear[year].push(label);
  }

  rows.forEach((r) => {
    const d = r.row_data;
    if (d.category === "ownership") {
      const biz = d.business_type ? ` (${d.business_type})` : "";
      const occupant = (d.occupant_name || "").trim();
      if (d.owner_name || !occupant) {
        const who = d.owner_name || "소유자 미상";
        const { start, end } = ownerPeriod(d);
        addEvent(start, `${who} 소유 시작`);
        addEvent(end, `${who} 소유 종료`);
      }
      if (occupant && occupant !== (d.owner_name || "").trim()) {
        const { start, end } = occupantPeriod(d);
        addEvent(start, `${occupant} 점유 시작${biz}`);
        addEvent(end, `${occupant} 점유 종료`);
      }
    } else if (d.category === "lease") {
      const who = d.tenant_name || "임차인 미상";
      const biz = d.business_type ? ` (${d.business_type})` : "";
      addEvent(d.lease_start, `${who} 임차 시작${biz}`);
      addEvent(d.lease_end, `${who} 임차 종료`);
    }
  });

  const years = Object.keys(byYear).sort();
  if (years.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
        📅 항공사진 변곡점 연도 추천 (3.1 소유·임대차 이력 기준)
      </div>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 10 }}>
        아래 연도 전후로 항공사진을 찾아보시면 부지 용도가 바뀐 시점을 확인하기 좋아요.
      </div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {years.map((y) => (
          <li key={y} style={{ fontSize: 15, marginBottom: 4 }}>
            <strong>{y}년</strong> — {byYear[y].join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

// 과거 항공사진을 찾을 때 쓰는 외부 서비스로 바로 연결하는 버튼들.
// 카카오맵은 URL에 좌표를 실으면 정확한 위치로 바로 이동해서 변곡점 스크리닝(스카이뷰)에 좋고,
// 국토지리정보원은 위치를 URL로 못 넘겨서(내부 검색 상태라) 주소를 클립보드에 복사해주는 정도만 도와줌.
function ExternalAerialLinks({ coords, address }) {
  const [copied, setCopied] = useState(false);

  function openKakaoSkyview() {
    const name = encodeURIComponent(address || "대상부지");
    window.open(`https://map.kakao.com/link/map/${name},${coords.lat},${coords.lon}`, "_blank");
  }

  function openNgii() {
    // 팝업 차단을 피하려면 클립보드 복사(비동기) 전에 새 탭부터 동기적으로 열어야 함
    window.open("https://map.ngii.go.kr/ms/map/NlipMap.do?tabGb=total", "_blank");
    if (address) {
      navigator.clipboard
        .writeText(address)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        })
        .catch(() => {
          // 클립보드 권한이 없어도 새 탭은 이미 열렸으니 그냥 무시
        });
    }
  }

  if (!coords) return null;

  return (
    <div
      className="card"
      style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}
    >
      <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
        과거 항공사진 찾기:
      </span>
      <button className="btn-secondary" data-view onClick={openKakaoSkyview}>
        🛰️ 카카오맵에서 정확한 위치 바로 보기
      </button>
      <button className="btn-secondary" data-view onClick={openNgii}>
        📍 국토지리정보원 항공사진 찾기 {copied && "(주소 복사됨!)"}
      </button>
    </div>
  );
}

function UploadTaggingSection({ caseId }) {
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  const loadDocs = useCallback(async () => {
    setDocsLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("case_id", caseId)
      .eq("module_number", 4)
      .order("uploaded_at", { ascending: false });
    setDocs(data || []);
    setDocsLoading(false);
    setSelectedDocId((prev) => {
      if (prev && (data || []).some((d) => d.id === prev)) return prev;
      const firstImage = (data || []).find((d) => IMAGE_EXT_RE.test(d.file_name));
      return firstImage ? firstImage.id : prev;
    });
  }, [caseId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // 왼쪽 업로드 목록에서 사진을 올리거나 이름(=연도)을 바꾸면 여기 목록도 바로 새로 불러온다
  useEffect(() => {
    function onChanged(e) {
      if (e.detail?.caseId === caseId && e.detail?.moduleNumber === 4) loadDocs();
    }
    window.addEventListener("documents-changed", onChanged);
    return () => window.removeEventListener("documents-changed", onChanged);
  }, [caseId, loadDocs]);

  // 보고서 내보내기가 이 연도 순서로 항공사진을 채워서(오래된 연도부터), 업로드한 순서와
  // 실제 촬영 연도가 다르면 꼭 여기서 연도를 지정해줘야 순서가 맞음.
  async function updateYear(docId, year) {
    const photo_year = year === "" ? null : parseInt(year, 10);
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, photo_year } : d)));
    await supabase.from("documents").update({ photo_year }).eq("id", docId);
  }

  const selectedDoc = docs.find((d) => d.id === selectedDocId) || null;

  // 목록은 보고서 순서와 같게 오래된 연도부터(1996 → 2021), 같은 연도는 파일 이름순, 연도 없는 사진은 맨 뒤
  const sortedDocs = [...docs].sort((a, b) => {
    if (a.photo_year && b.photo_year && a.photo_year !== b.photo_year) return a.photo_year - b.photo_year;
    if (a.photo_year && !b.photo_year) return -1;
    if (!a.photo_year && b.photo_year) return 1;
    return (a.file_name || "").localeCompare(b.file_name || "", "ko", { numeric: true });
  });

  // 연도가 비어 있지만 파일 이름에 연도가 있는 사진(예: "2024년.png") — 버튼 한 번으로 채운다
  const yearFillable = docs.filter((d) => !d.photo_year && yearFromFileName(d.file_name));
  async function fillYearsFromNames() {
    for (const d of yearFillable) await updateYear(d.id, String(yearFromFileName(d.file_name)));
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchUrl() {
      if (!selectedDoc || !IMAGE_EXT_RE.test(selectedDoc.file_name)) {
        setImageUrl(null);
        return;
      }
      setImageLoading(true);
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(selectedDoc.file_path, 3600);
      if (!cancelled) {
        setImageUrl(data?.signedUrl || null);
        setImageLoading(false);
      }
    }
    fetchUrl();
    return () => {
      cancelled = true;
    };
  }, [selectedDoc]);

  return (
    <div>
      <div
        className="card"
        style={{
          background: "var(--color-badge-blue-bg)",
          border: "1px solid var(--color-badge-blue-bg)",
          marginBottom: 16,
          fontSize: 15,
        }}
      >
        왼쪽 사이드바에서 항공사진 파일을 업로드하면 여기서 선택해 태깅할 수 있어요.
        사진 위를 드래그해서 건물·도로 등 시설 영역을 표시하고 메모를 남기세요.
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
          태깅할 항공사진 선택
        </div>
        {docsLoading ? (
          <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
            불러오는 중...
          </div>
        ) : docs.length === 0 ? (
          <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
            아직 업로드된 항공사진이 없어요. 왼쪽에서 먼저 파일을 업로드해주세요.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 8 }}>
              보고서에는 오래된 연도부터 들어가요. 연도가 없는 사진만 옆 칸에 연도를 넣어주세요.
              (연도를 고치려면 왼쪽 목록에서 ✏️로 이름을 연도로 바꾸면 돼요)
            </div>
            {yearFillable.length > 0 && (
              <button className="btn-secondary" onClick={fillYearsFromNames} style={{ fontSize: 14, marginBottom: 10 }}>
                파일 이름에서 연도 채우기 ({yearFillable.length}장)
              </button>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {sortedDocs.map((doc) => {
                const isImage = IMAGE_EXT_RE.test(doc.file_name);
                const isActive = doc.id === selectedDocId;
                // 버튼엔 연도만. 파일 이름에 그 연도가 없을 때만 이름을 짧게 덧붙인다(예: "2014 · 공장전경").
                const base = splitExt(doc.file_name).base;
                const hasYear = doc.photo_year != null && doc.photo_year !== "";
                const chipLabel = !hasYear
                  ? base
                  : base.includes(String(doc.photo_year))
                  ? String(doc.photo_year)
                  : `${doc.photo_year} · ${base}`;
                return (
                  <div
                    key={doc.id}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <button
                      data-view onClick={() => isImage && setSelectedDocId(doc.id)}
                      disabled={!isImage}
                      title={
                        isImage
                          ? doc.file_name
                          : `${doc.file_name} (이미지 형식만 태깅 가능해요)`
                      }
                      className={isActive ? "btn-primary" : "btn-secondary"}
                      style={{
                        opacity: isImage ? 1 : 0.5,
                        cursor: isImage ? "pointer" : "not-allowed",
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isImage ? "🖼️" : "📄"} {chipLabel}
                    </button>
                    {isImage && !hasYear && (
                      <input
                        type="number"
                        placeholder="연도"
                        title="촬영 연도를 넣어주세요"
                        onBlur={(e) => /^(19|20)\d{2}$/.test(e.target.value) && updateYear(doc.id, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        style={{
                          width: 64,
                          padding: "6px 6px",
                          borderRadius: 8,
                          border: "1px solid var(--color-badge-yellow-text)",
                          background: "var(--color-badge-yellow-bg)",
                          fontSize: 14,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedDoc && IMAGE_EXT_RE.test(selectedDoc.file_name) && (
        <TaggingArea
          key={selectedDoc.id}
          caseId={caseId}
          documentId={selectedDoc.id}
          imageUrl={imageUrl}
          imageLoading={imageLoading}
        />
      )}
    </div>
  );
}

function TaggingArea({ caseId, documentId, imageUrl, imageLoading }) {
  const { tags, loading, addTag, deleteTag } = useAerialTags(documentId);
  const containerRef = useRef(null);

  const [drafting, setDrafting] = useState(null); // {x,y,width,height} in %
  const [dragStart, setDragStart] = useState(null);
  const [pendingBox, setPendingBox] = useState(null); // 완료된 드래그, 저장 폼 표시용
  const [facilityType, setFacilityType] = useState(FACILITY_TYPES[0].key);
  const [note, setNote] = useState("");
  const [hoveredTagId, setHoveredTagId] = useState(null);
  const [saving, setSaving] = useState(false);

  function relativePos(e) {
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    return { x, y };
  }

  function handleMouseDown(e) {
    if (pendingBox) return; // 이미 입력 중인 박스가 있으면 새로 시작하지 않음
    const pos = relativePos(e);
    setDragStart(pos);
    setDrafting({ x: pos.x, y: pos.y, width: 0, height: 0 });
  }

  function handleMouseMove(e) {
    if (!dragStart) return;
    const pos = relativePos(e);
    const x = Math.min(dragStart.x, pos.x);
    const y = Math.min(dragStart.y, pos.y);
    const width = Math.abs(pos.x - dragStart.x);
    const height = Math.abs(pos.y - dragStart.y);
    setDrafting({ x, y, width, height });
  }

  function handleMouseUp() {
    if (!dragStart || !drafting) {
      setDragStart(null);
      return;
    }
    if (drafting.width < MIN_BOX_SIZE || drafting.height < MIN_BOX_SIZE) {
      setDrafting(null);
      setDragStart(null);
      return;
    }
    setPendingBox(drafting);
    setDrafting(null);
    setDragStart(null);
    setFacilityType(FACILITY_TYPES[0].key);
    setNote("");
  }

  async function handleSaveTag() {
    if (!pendingBox) return;
    setSaving(true);
    await addTag({
      caseId,
      x: pendingBox.x,
      y: pendingBox.y,
      width: pendingBox.width,
      height: pendingBox.height,
      facilityType,
      note,
    });
    setSaving(false);
    setPendingBox(null);
  }

  function handleCancelPending() {
    setPendingBox(null);
  }

  async function handleDelete(tagId) {
    await deleteTag(tagId);
  }

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div className="card" style={{ padding: 0, overflow: "hidden", flex: "1 1 480px" }}>
        {imageLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
            사진 불러오는 중...
          </div>
        ) : !imageUrl ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
            사진을 표시할 수 없어요
          </div>
        ) : (
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (dragStart) {
                setDragStart(null);
                setDrafting(null);
              }
            }}
            // 세로로 긴 사진(원본 항공사진 타일 모양 그대로)이 화면을 다 차지하지 않게 높이를 제한하고 가운데 둔다.
            // 태그 좌표는 이 상자 기준 비율이라, 상자가 그림 크기에 딱 맞도록 fit-content로 감싼다.
            style={{
              position: "relative",
              width: "fit-content",
              maxWidth: "100%",
              margin: "0 auto",
              userSelect: "none",
              cursor: pendingBox ? "default" : "crosshair",
              lineHeight: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="항공사진"
              draggable={false}
              style={{ maxWidth: "100%", maxHeight: 640, width: "auto", height: "auto", display: "block", pointerEvents: "none" }}
            />

            {tags.map((tag) => (
              <div
                key={tag.id}
                onMouseEnter={() => setHoveredTagId(tag.id)}
                onMouseLeave={() => setHoveredTagId(null)}
                style={{
                  position: "absolute",
                  left: `${tag.x * 100}%`,
                  top: `${tag.y * 100}%`,
                  width: `${tag.width * 100}%`,
                  height: `${tag.height * 100}%`,
                  ...DRAFT_BOX_STYLE,
                  background: hoveredTagId === tag.id ? "rgba(255,234,0,0.18)" : "transparent",
                  boxSizing: "border-box",
                  pointerEvents: "auto",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: -20,
                    left: -2,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "white",
                    background: FACILITY_COLOR[tag.facility_type] || "#6b7269",
                    padding: "1px 6px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                  }}
                >
                  {FACILITY_LABEL[tag.facility_type] || tag.facility_type}
                </span>
              </div>
            ))}

            {drafting && (
              <div
                style={{
                  position: "absolute",
                  left: `${drafting.x * 100}%`,
                  top: `${drafting.y * 100}%`,
                  width: `${drafting.width * 100}%`,
                  height: `${drafting.height * 100}%`,
                  ...DRAFT_BOX_STYLE,
                  background: "rgba(255,234,0,0.12)",
                  boxSizing: "border-box",
                  pointerEvents: "none",
                }}
              />
            )}

            {pendingBox && (
              <div
                style={{
                  position: "absolute",
                  left: `${pendingBox.x * 100}%`,
                  top: `${pendingBox.y * 100}%`,
                  width: `${pendingBox.width * 100}%`,
                  height: `${pendingBox.height * 100}%`,
                  ...DRAFT_BOX_STYLE,
                  boxSizing: "border-box",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ flex: "1 1 260px", maxWidth: 320 }}>
        {pendingBox ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
              시설 태그 추가
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 4 }}>
                시설 유형
              </div>
              <select
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 15,
                }}
              >
                {FACILITY_TYPES.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 4 }}>
                메모
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="예: 폐기물 야적 흔적으로 추정"
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 15,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-primary"
                onClick={handleSaveTag}
                disabled={saving}
                style={{ flex: 1 }}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
              <button className="btn-secondary" onClick={handleCancelPending}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>
            사진 위를 드래그해서 새 태그를 추가하세요.
          </div>
        )}

        <div style={{ marginTop: pendingBox ? 20 : 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            태그 목록 {loading ? "" : `(${tags.length})`}
          </div>
          {loading ? (
            <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
              불러오는 중...
            </div>
          ) : tags.length === 0 ? (
            <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
              아직 태그가 없어요
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  onMouseEnter={() => setHoveredTagId(tag.id)}
                  onMouseLeave={() => setHoveredTagId(null)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "white",
                        background: FACILITY_COLOR[tag.facility_type] || "#6b7269",
                        padding: "1px 6px",
                        borderRadius: 4,
                        marginBottom: 4,
                      }}
                    >
                      {FACILITY_LABEL[tag.facility_type] || tag.facility_type}
                    </span>
                    {tag.note && (
                      <div style={{ fontSize: 14, color: "var(--color-text)" }}>
                        {tag.note}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--color-text-muted)",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    title="삭제"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
