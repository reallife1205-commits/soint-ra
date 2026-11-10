"use client";

import { MapContainer, TileLayer, Circle, CircleMarker, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { siteKey } from "@/lib/surroundingContaminationDraft";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const NETWORK_COLOR = "#2563eb";
const SURVEY_COLOR = "#d97706";
const colorFor = (sourceType) => (sourceType === "측정망" ? NETWORK_COLOR : SURVEY_COLOR);

// 같은 지점을 여러 해 측정하면 같은 자리에 점이 겹쳐 하나로 보인다 — 자리(좌표)·자료 종류별로 한 점으로 합치고
// 측정 연도를 모아 둔다(점을 누르면 연도가 다 보임).
function groupBySite(points) {
  const groups = new Map();
  points.forEach((p) => {
    if (p.lat == null || p.lon == null) return;
    const key = `${p.source_type}|${siteKey(p)}`;
    if (!groups.has(key)) groups.set(key, { ...p, key, names: new Set(), years: new Set() });
    const g = groups.get(key);
    g.names.add(p.site_name || p.address || "");
    if (p.survey_year != null) g.years.add(Number(p.survey_year));
  });
  return Array.from(groups.values());
}

function LegendDot({ color }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        opacity: 0.85,
        marginRight: 5,
        verticalAlign: "-1px",
      }}
    />
  );
}

export default function MapView({ center, radiusKm, points }) {
  const sites = groupBySite(points);
  const networkCount = sites.filter((s) => s.source_type === "측정망").length;
  const surveyCount = sites.length - networkCount;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
      {/* preferCanvas: 원·점을 SVG 대신 캔버스로 그린다. SVG로 그리면 지도를 끌어 옮긴 뒤 "화면 캡처해서
          저장"(html2canvas)할 때 이동분 위치 보정이 빠져 반경 원이 엉뚱한 자리에 찍혔다. */}
      <MapContainer
        preferCanvas
        center={[center.lat, center.lon]}
        zoom={13}
        // 확대·축소를 한 단계(2배)씩이 아니라 1/4 단계씩 — 반경 원이 화면에 꼭 맞게 맞추기 쉽도록
        zoomSnap={0.25}
        zoomDelta={0.25}
        wheelPxPerZoomLevel={240}
        style={{ height: 400, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={[center.lat, center.lon]}
          radius={radiusKm * 1000}
          pathOptions={{ color: "#a8562f", weight: 1, fillColor: "#a8562f", fillOpacity: 0.12 }}
        />
        <Marker position={[center.lat, center.lon]}>
          <Popup>대상부지</Popup>
        </Marker>
        {sites.slice(0, 300).map((s) => (
          <CircleMarker
            key={s.key}
            center={[s.lat, s.lon]}
            radius={6}
            pathOptions={{
              color: "white",
              weight: 1.5,
              fillColor: colorFor(s.source_type),
              fillOpacity: 0.85,
            }}
          >
            <Popup>
              {Array.from(s.names).filter(Boolean).join(", ") || "이름 없음"}
              <br />
              {s.source_type === "측정망" ? "토양측정망" : "토양오염실태조사"} ·{" "}
              {Array.from(s.years).sort((a, b) => a - b).join(", ") || "연도 없음"}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {/* 범례: 지도 캡처(보고서 2.2 그림)에도 같이 찍히도록 지도 상자 안에 둔다 */}
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          zIndex: 1000,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid #ccc",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 13,
          lineHeight: 1.7,
          color: "#222",
          pointerEvents: "none",
        }}
      >
        <div>
          <LegendDot color={NETWORK_COLOR} />
          토양측정망 ({networkCount}곳)
        </div>
        <div>
          <LegendDot color={SURVEY_COLOR} />
          토양오염실태조사 ({surveyCount}곳)
        </div>
        <div>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              border: "1.5px solid #a8562f",
              background: "rgba(168,86,47,0.15)",
              marginRight: 5,
              verticalAlign: "-1px",
            }}
          />
          조사 반경 {radiusKm}km
        </div>
      </div>
    </div>
  );
}
