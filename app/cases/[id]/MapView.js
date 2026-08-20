"use client";

import { MapContainer, TileLayer, Circle, CircleMarker, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function MapView({ center, radiusKm, points }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={13}
        style={{ height: 500, width: "100%" }}
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
        {points.slice(0, 300).map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lon]}
            radius={5}
            pathOptions={{
              color: p.source_type === "측정망" ? "#2563eb" : "#d97706",
              weight: 1,
              fillColor: p.source_type === "측정망" ? "#2563eb" : "#d97706",
              fillOpacity: 0.7,
            }}
          >
            <Popup>
              {p.site_name || p.address}
              <br />
              {p.source_type} · {p.survey_year}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
