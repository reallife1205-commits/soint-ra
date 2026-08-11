"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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

export default function AerialMapView({ coords, address }) {
  const [mapType, setMapType] = useState("satellite");

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
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {MAP_TYPES.map((t) => (
            <button
              key={t.key}
              className={mapType === t.key ? "btn-primary" : "btn-secondary"}
              onClick={() => setMapType(t.key)}
            >
              {t.label}
            </button>
          ))}
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

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <MapContainer
          center={[coords.lat, coords.lon]}
          zoom={18}
          style={{ height: 500, width: "100%" }}
        >
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
            </>
          )}
          <Marker position={[coords.lat, coords.lon]}>
            <Popup>대상부지{address ? ` · ${address}` : ""}</Popup>
          </Marker>
        </MapContainer>
      </div>

      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 8 }}>
        V-World 위성사진 기준이에요. 연도별 과거 항공사진은 위 링크에서 확인하시거나
        &apos;사진 업로드&apos; 탭을 이용하세요.
      </div>
    </div>
  );
}
