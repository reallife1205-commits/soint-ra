"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { useAerialTags } from "@/lib/useAerialTags";
import { FACILITY_TYPES, FACILITY_LABEL, FACILITY_COLOR } from "@/lib/facilityTypes";
import TimelinePanel from "./TimelinePanel";
const AerialMapView = dynamic(() => import("./AerialMapView"), { ssr: false });

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;

const TABS = [
  { key: "map", label: "지도" },
  { key: "upload", label: "사진 업로드" },
  { key: "timeline", label: "타임라인" },
];

const MIN_BOX_SIZE = 0.01; // 이미지 대비 1% 미만이면 클릭으로 간주하고 무시

export default function Module4Panel({ caseId, caseInfo }) {
  const [tab, setTab] = useState("map");
  const [timelineCount, setTimelineCount] = useState(0);

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
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 16,
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
              fontSize: 15,
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
            {t.key === "timeline" && (
              <span style={{ marginLeft: 4, color: "var(--color-text-muted)" }}>
                {timelineCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "map" && (
        <AerialMapView
          coords={coords}
          address={caseInfo?.address}
          boundary={caseInfo?.boundary_points}
          boundaryEditable={true}
          onBoundarySave={handleBoundarySave}
        />
      )}
      {tab === "upload" && <UploadTaggingSection caseId={caseId} />}
      {tab === "timeline" && (
        <TimelinePanel caseId={caseId} onCountChange={setTimelineCount} />
      )}
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

  const selectedDoc = docs.find((d) => d.id === selectedDocId) || null;

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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {docs.map((doc) => {
              const isImage = IMAGE_EXT_RE.test(doc.file_name);
              const isActive = doc.id === selectedDocId;
              return (
                <button
                  key={doc.id}
                  onClick={() => isImage && setSelectedDocId(doc.id)}
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
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isImage ? "🖼️" : "📄"} {doc.file_name}
                </button>
              );
            })}
          </div>
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
            style={{
              position: "relative",
              width: "100%",
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
              style={{ width: "100%", display: "block", pointerEvents: "none" }}
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
                  border: `2px solid ${FACILITY_COLOR[tag.facility_type] || "#6b7269"}`,
                  background:
                    hoveredTagId === tag.id
                      ? `${FACILITY_COLOR[tag.facility_type]}22`
                      : "transparent",
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
                  border: "2px dashed var(--color-primary)",
                  background: "rgba(31,138,95,0.08)",
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
                  border: "2px solid var(--color-primary)",
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
