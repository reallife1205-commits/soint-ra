"use client";

import { useState } from "react";
import Module1Table from "./Module1Table";
import Module1ImageGallery from "./Module1ImageGallery";

const TABS = [
  { key: "table", label: "오염 현황 테이블" },
  { key: "sample_points", label: "시료채취지점" },
  { key: "pollution_map", label: "오염분포도" },
];

export default function Module1Panel({ caseId, caseInfo }) {
  const [tab, setTab] = useState("table");

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
          </button>
        ))}
      </div>

      {tab === "table" && (
        <div className="card">
          <Module1Table caseId={caseId} caseInfo={caseInfo} />
        </div>
      )}
      {tab === "sample_points" && (
        <Module1ImageGallery caseId={caseId} category="sample_points" title="시료채취지점 사진" />
      )}
      {tab === "pollution_map" && (
        <Module1ImageGallery caseId={caseId} category="pollution_map" title="오염분포도 이미지" />
      )}
    </div>
  );
}
