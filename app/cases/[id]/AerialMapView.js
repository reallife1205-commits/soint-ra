"use client";

import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
  CircleMarker,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const VWORLD_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;

function vworldTileUrl(layer, ext) {
  return `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/${layer}/{z}/{y}/{x}.${ext}`;
}

const MAP_TYPES = [
  { key: "satellite", label: "🛰️ 위성사진" },
  { key: "hybrid", label: "🗺️ 하이브리드" },
  { key: "base", label: "📍 일반지도" },
];

function DrawClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

export default function AerialMapView({
  coords,
  address,
  boundary,
  boundaryEditable = false,
  onBoundarySave,
}) {
  const [mapType, setMapType] = useState("satellite");
  const [showParcel, setShowParcel] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [savingBoundary, setSavingBoundary] = useState(false);

  if (!coords) {
    return (
      <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        먼저 모듈2에서 부지 주소의 좌표를 확인해주세요. 좌표가 있어야 지도를 표시할 수 있어요.
      </div>
    );
  }

  const kakaoUrl = `https://map.kakao.com/link/map/${encodeURIComponent(
    address || "대상부지"
  )},${coords.lat},${coords.lon}`;
  const ngiiUrl = "https://map.ngii.go.kr/ms/map/Aerial.do";

  const baseLayerType = mapType === "base" ? "Base" : "Satellite";
  const baseLayerExt = mapType === "base" ? "png" : "jpeg";

  const boundaryPositions =
    boundary && boundary.length > 0
      ? boundary.map((p) => [p.lat, p.lon])
      : null;
  const draftPositions = draftPoints.map((p) => [p.lat, p.lon]);

  function startDrawing() {
    setDrawing(true);
    setDraftPoints([]);
  }

  function cancelDrawing() {
    setDrawing(false);
    setDraftPoints([]);
  }

  function handleMapClick(latlng) {
    if (!drawing) return;
    setDraftPoints((pts) => [...pts, { lat: latlng.lat, lon: latlng.lng }]);
  }

  function undoLastPoint() {
    setDraftPoints((pts) => pts.slice(0, -1));
  }

  async function finishDrawing() {
    if (draftPoints.length < 3) return;
    setSavingBoundary(true);
    if (onBoundarySave) {
      await onBoundarySave(draftPoints);
    }
    setSavingBoundary(false);
    setDrawing(false);
    setDraftPoints([]);
  }

  async function clearBoundary() {
    if (!confirm("저장된 경계선을 삭제할까요?")) return;
    setSavingBoundary(true);
    if (onBoundarySave) {
      await onBoundarySave(null);
    }
    setSavingBoundary(false);
  }

  return (
    <div>
      {!VWORLD_KEY && (
        <div
          className="card"
          style={{
            background: "var(--color-badge-yellow-bg)",
            border: "1px solid var(--color-badge-yellow-bg)",
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          브이월드 API 키가 아직 설정되지 않아서 위성사진을 불러올 수 없어요.
          배포 환경(Vercel)과 로컬 .env.local 에{" "}
          <code>NEXT_PUBLIC_VWORLD_API_KEY</code> 값을 추가해주세요.
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {MAP_TYPES.map((t) => (
            <button
              key={t.key}
              className={mapType === t.key ? "btn-primary" : "btn-secondary"}
              onClick={() => setMapType(t.key)}
            >
              {t.label}
            </button>
          ))}
          <button
            className={showParcel ? "btn-primary" : "btn-secondary"}
            onClick={() => setShowParcel((v) => !v)}
          >
            ⬜ 대상 필지
          </button>
          {boundaryEditable && !drawing && (
            <button className="btn-secondary" onClick={startDrawing}>
              📐 경계 그리기
            </button>
          )}
          {boundaryEditable && boundaryPositions && !drawing && (
            <button
              className="btn-secondary"
              onClick={clearBoundary}
              disabled={savingBoundary}
              style={{ color: "var(--color-badge-red-text)" }}
            >
              경계선 삭제
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
          <a href={kakaoUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary)" }}>
            ↗ 카카오맵 항공사진 (2008년~)
          </a>
          <a href={ngiiUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary)" }}>
            ↗ 국토지리정보원 (~2008년)
          </a>
        </div>
      </div>

      {drawing && (
        <div
          className="card"
          style={{
            background: "var(--color-badge-blue-bg)",
            border: "1px solid var(--color-badge-blue-bg)",
            marginBottom: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            fontSize: 13,
          }}
        >
          <span>
            지도를 클릭해서 경계선의 점을 찍어주세요. (점 {draftPoints.length}개
            {draftPoints.length < 3 ? " · 최소 3개 필요해요" : ""})
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn-secondary"
              onClick={undoLastPoint}
              disabled={draftPoints.length === 0}
            >
              마지막 점 취소
            </button>
            <button className="btn-secondary" onClick={cancelDrawing}>
              그리기 취소
            </button>
            <button
              className="btn-primary"
              onClick={finishDrawing}
              disabled={draftPoints.length < 3 || savingBoundary}
            >
              {savingBoundary ? "저장 중..." : "완료 (저장)"}
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <MapContainer
          center={[coords.lat, coords.lon]}
          zoom={18}
          style={{ height: 500, width: "100%", cursor: drawing ? "crosshair" : "" }}
        >
          <DrawClickHandler onClick={handleMapClick} />
          {VWORLD_KEY && (
            <>
              <TileLayer
                key={baseLayerType}
                url={vworldTileUrl(baseLayerType, baseLayerExt)}
                attribution="&copy; VWorld"
                maxZoom={19}
              />
              {mapType === "hybrid" && (
                <TileLayer url={vworldTileUrl("Hybrid", "png")} maxZoom={19} />
              )}
              {showParcel && (
                <WMSTileLayer
                  url={`https://api.vworld.kr/req/wms?key=${VWORLD_KEY}&domain=${
                    typeof window !== "undefined" ? window.location.hostname : ""
                  }`}
                  layers="lp_pa_cbnd_bubun"
                  styles="lp_pa_cbnd_bubun"
                  format="image/png"
                  transparent={true}
                  version="1.3.0"
                />
              )}
            </>
          )}
          <Marker position={[coords.lat, coords.lon]}>
            <Popup>대상부지{address ? ` · ${address}` : ""}</Popup>
          </Marker>

          {boundaryPositions && !drawing && (
            <Polygon
              positions={boundaryPositions}
              pathOptions={{ color: "#e0793c", weight: 3, fillOpacity: 0.15 }}
            />
          )}

          {drawing && draftPositions.length > 0 && (
            <>
              <Polyline
                positions={draftPositions}
                pathOptions={{ color: "#e0793c", weight: 3, dashArray: "6 6" }}
              />
              {draftPoints.map((p, i) => (
                <CircleMarker
                  key={i}
                  center={[p.lat, p.lon]}
                  radius={5}
                  pathOptions={{ color: "#e0793c", fillColor: "#e0793c", fillOpacity: 1 }}
                />
              ))}
            </>
          )}
        </MapContainer>
      </div>

      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 8 }}>
        V-World 위성사진 기준이에요. 연도별 과거 항공사진은 위 링크에서 확인하시거나
        &apos;사진 업로드&apos; 탭을 이용하세요.
      </div>
    </div>
  );
}
