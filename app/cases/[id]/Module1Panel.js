"use client";

import { useState } from "react";
import Module1Table from "./Module1Table";
import ImageGallery from "./ImageGallery";

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

      {/* 보고서 [표1] 오염면적 및 오염범위(총괄)에는 이 표를 화면 캡처한 이미지가 아니라,
          여기 입력하는 데이터로 직접 만든 네이티브 표가 들어간다(export-report/hwpxReportBuilder의
          fillContaminationStatusTable) — 캡처 방식은 2단 헤더 렌더링이 계속 불안정해서 포기함. */}
      {tab === "table" && (
        <div className="card">
          <Module1Table caseId={caseId} caseInfo={caseInfo} />
        </div>
      )}
      {tab === "sample_points" && (
        <ImageGallery caseId={caseId} category="sample_points" title="시료채취지점 사진" />
      )}
      {tab === "pollution_map" && (
        <ImageGallery caseId={caseId} category="pollution_map" title="오염분포도 이미지" />
      )}
    </div>
  );
}
