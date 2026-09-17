"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Module1Table from "./Module1Table";
import ImageGallery from "./ImageGallery";

const TABS = [
  { key: "table", label: "오염 현황 테이블" },
  { key: "sample_points", label: "시료채취지점" },
  { key: "pollution_map", label: "오염분포도" },
];

const POLLUTION_STATUS_TABLE_CATEGORY = "pollution_status_table";

export default function Module1Panel({ caseId, caseInfo }) {
  const [tab, setTab] = useState("table");
  const tableWrapperRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0);

  // 오염현황 테이블 화면을 캡처해서 저장 — 보고서([표1] 오염면적 및 오염범위) 자리엔 표 그대로가
  // 아니라 이 화면 캡처 이미지가 들어간다(주변부지 지도 캡처와 동일한 방식). "+ 새 오염물질
  // 추가" 버튼이나 범례 설명까지 같이 찍히지 않게, 감싸는 카드 전체가 아니라 그 안의 <table>
  // 요소만 정확히 찾아서 캡처한다. 또한 html2canvas는 기본적으로 현재 창 스크롤 위치를 기준으로
  // 캡처 범위를 계산해서, 표가 화면 위쪽으로 살짝 스크롤되어 있으면 제목줄 윗부분이 잘려
  // 캡처되는 문제가 있었다(사용자 확인) — scrollX/scrollY를 보정해 스크롤 위치와 무관하게
  // 요소 전체가 온전히 찍히게 한다.
  async function handleCaptureTable() {
    const tableEl = tableWrapperRef.current?.querySelector("table");
    if (!tableEl || !caseId) return;
    setCapturing(true);
    setCaptureError("");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(tableEl, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        scale: 2, // 더 높은 해상도로 캡처(선명하게)
        // foreignObjectRendering을 한 번 켜봤는데, rowSpan 헤더 문제는 안 고쳐지고 캡처
        // 자체가 아예 안 보이는(빈 화면) 심각한 부작용이 있어 되돌림 — 크롬 계열에서
        // foreignObjectRendering이 종종 빈 캔버스를 만드는 알려진 문제라고 함.
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("이미지 변환 실패");

      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
      const filePath = `${caseId}/module1/${POLLUTION_STATUS_TABLE_CATEGORY}/${safeName}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, blob);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("documents").insert([
        {
          case_id: caseId,
          module_number: 1,
          category: POLLUTION_STATUS_TABLE_CATEGORY,
          file_name: `오염현황_테이블_${new Date().toISOString().slice(0, 10)}.png`,
          file_path: filePath,
          file_size: blob.size,
        },
      ]);
      if (insertError) {
        await supabase.storage.from("documents").remove([filePath]);
        throw insertError;
      }
      setGalleryRefreshKey((k) => k + 1);
    } catch (e) {
      setCaptureError(
        "화면 캡처에 실패했어요. 대신 컴퓨터의 화면 캡처 기능(Windows: Win+Shift+S, Mac: Cmd+Shift+4)으로 캡처한 뒤 아래 갤러리에 직접 올려주세요."
      );
    }
    setCapturing(false);
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
          </button>
        ))}
      </div>

      {tab === "table" && (
        <div>
          <div className="card" ref={tableWrapperRef}>
            <Module1Table caseId={caseId} caseInfo={caseInfo} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, marginBottom: 16 }}>
            <button className="btn-secondary" onClick={handleCaptureTable} disabled={capturing}>
              {capturing ? "캡처 중..." : "📸 지금 화면 캡처해서 저장 (보고서 [표1]에 들어감)"}
            </button>
          </div>
          {captureError && (
            <div style={{ color: "var(--color-badge-red-text)", fontSize: 14, marginBottom: 16 }}>
              {captureError}
            </div>
          )}
          <ImageGallery
            key={galleryRefreshKey}
            caseId={caseId}
            category={POLLUTION_STATUS_TABLE_CATEGORY}
            title="오염현황 테이블 캡처 (보고서 [표1]에 들어감)"
          />
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
