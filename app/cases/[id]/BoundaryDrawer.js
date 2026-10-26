"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { shrinkImageForUpload, friendlyUploadError } from "@/lib/shrinkImage";
import { splitExt } from "./UploadHelpers";

// 경계선을 그린 사진은 원본 이름 뒤에 이 말을 붙여 3.4 "배치도 등"(module 3, site_plan)에 따로 저장한다.
// 보고서 3.4 배치도면은 이 이름의 사진을 먼저 고른다(export-report SITE_PLAN_NAME_PRIORITY).
// 왼쪽 항공사진(module 4)에서 그려도 항공사진 목록이 아니라 여기에 저장해, 6장·보고서 항공사진 표에 같은 사진이 두 번 들어가지 않게 한다.
const BOUNDARY_SUFFIX = "_경계선";
const SITE_PLAN = { moduleNumber: 3, category: "site_plan" };

// 저장에 실패하면 오류 문구를, 성공하면 null을 돌려준다.
export async function saveBoundaryCopy(caseId, sourceDoc, blob) {
  const base = splitExt(sourceDoc.file_name).base;
  const name = (base.endsWith(BOUNDARY_SUFFIX) ? base : base + BOUNDARY_SUFFIX) + ".jpg";
  const file = await shrinkImageForUpload(new File([blob], name, { type: "image/jpeg" }));
  const filePath = `${caseId}/module${SITE_PLAN.moduleNumber}/${SITE_PLAN.category}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
  if (uploadError) return friendlyUploadError(uploadError.message);
  const { error: insertError } = await supabase.from("documents").insert([
    {
      case_id: caseId,
      module_number: SITE_PLAN.moduleNumber,
      category: SITE_PLAN.category,
      file_name: name,
      file_path: filePath,
      file_size: file.size,
    },
  ]);
  if (insertError) {
    await supabase.storage.from("documents").remove([filePath]);
    return `저장에 실패했어요: ${insertError.message}`;
  }
  window.dispatchEvent(new CustomEvent("documents-changed", { detail: { caseId, moduleNumber: SITE_PLAN.moduleNumber } }));
  return null;
}

// 크게 본 사진 창에 붙이는 "부지 경계 그리기" 버튼 + 그리기 창. 원본 사진을 받아 와 그리고, 저장하면 saveBoundaryCopy.
// 그리기 창은 사진 창 위(zIndex 110)에 뜬다. 사진 창을 닫으면 이 버튼과 함께 그리기 창도 사라지니 닫지 않는다.
export function BoundaryDrawButton({ caseId, doc, onError }) {
  const [blob, setBlob] = useState(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const { data, error } = await supabase.storage.from("documents").download(doc.file_path);
    setBusy(false);
    if (error || !data) {
      onError?.("사진을 불러오지 못했어요");
      return;
    }
    setBlob(data);
  }

  async function save(drawn) {
    const err = await saveBoundaryCopy(caseId, doc, drawn);
    if (err) onError?.(err);
    setBlob(null);
  }

  return (
    <>
      <button type="button" className="btn-secondary" onClick={start} disabled={busy} style={{ marginLeft: "auto" }}>
        {busy ? "불러오는 중..." : "✏️ 부지 경계 그리기"}
      </button>
      {blob && <BoundaryDrawer imageBlob={blob} onCancel={() => setBlob(null)} onSave={save} />}
    </>
  );
}

// 3.4 "배치도 등" 사진 위에 대상부지 경계선을 직접 찍어 그리는 창.
// 사진엔 좌표 정보가 없어 6장 지도의 경계선(boundary_points)을 겹칠 수 없으니, 모서리를 차례로 눌러 그린다.
// 점은 사진 원래 픽셀 좌표로 저장해서, 화면에서 줄여 보여도 저장할 땐 원본 크기 그대로 그려 넣는다.
const COLORS = [
  { value: "#ff0000", label: "빨강" },
  { value: "#ffd400", label: "노랑" },
  { value: "#00a0ff", label: "파랑" },
];
// 굵기는 사진 긴 변 1000px 기준 두께 — 사진 크기가 달라도 보고서에서 비슷한 굵기로 보이게
const WIDTHS = [
  { value: 3, label: "가늘게" },
  { value: 6, label: "보통" },
  { value: 10, label: "굵게" },
];
const CLOSE_RADIUS_PX = 14; // 화면에서 첫 점을 이만큼 가까이 누르면 다각형을 닫는다

export default function BoundaryDrawer({ imageBlob, onCancel, onSave }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [points, setPoints] = useState([]);
  const [closed, setClosed] = useState(false);
  const [color, setColor] = useState(COLORS[0].value);
  const [width, setWidth] = useState(WIDTHS[1].value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(imageBlob);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);

  const lineWidthFor = (image) => (width * Math.max(image.naturalWidth, image.naturalHeight)) / 1000;

  function draw(ctx, image, { showVertices }) {
    ctx.drawImage(image, 0, 0);
    if (points.length === 0) return;
    const lw = lineWidthFor(image);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    if (closed) ctx.closePath();
    ctx.stroke();
    if (showVertices) {
      points.forEach(([x, y], i) => {
        ctx.beginPath();
        ctx.arc(x, y, lw * (i === 0 && !closed ? 1.6 : 1), 0, Math.PI * 2);
        ctx.fillStyle = i === 0 && !closed ? "#ffffff" : color;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = lw / 2;
        ctx.stroke();
      });
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    draw(canvas.getContext("2d"), img, { showVertices: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, points, closed, color, width]);

  function handleClick(e) {
    if (closed || !img) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = img.naturalWidth / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * (img.naturalHeight / rect.height);
    if (points.length >= 3) {
      const [fx, fy] = points[0];
      if (Math.hypot(fx - x, fy - y) / scale <= CLOSE_RADIUS_PX) {
        setClosed(true);
        return;
      }
    }
    setPoints([...points, [x, y]]);
  }

  function undo() {
    if (closed) setClosed(false);
    else setPoints(points.slice(0, -1));
  }

  async function save() {
    if (!img || points.length < 2) return;
    setSaving(true);
    const out = document.createElement("canvas");
    out.width = img.naturalWidth;
    out.height = img.naturalHeight;
    draw(out.getContext("2d"), img, { showVertices: false });
    const blob = await new Promise((resolve) => out.toBlob(resolve, "image/jpeg", 0.92));
    await onSave(blob);
    setSaving(false);
  }

  const chip = (active) => ({
    border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
    background: active ? "var(--color-badge-blue-bg)" : "white",
    fontWeight: active ? 700 : 400,
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 14,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 110,
        padding: 20,
      }}
    >
      <div style={{ background: "white", borderRadius: 10, padding: 16, maxWidth: "95vw", maxHeight: "95vh", overflow: "auto" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>대상부지 경계선 그리기</div>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 10 }}>
          부지 모서리를 차례로 누르세요. 첫 점(흰 점)을 다시 누르면 선이 닫혀요. 저장하면 선을 그린 사진이 따로 저장되고 원본은 그대로 남아요.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>색</span>
          {COLORS.map((c) => (
            <button key={c.value} type="button" style={chip(color === c.value)} onClick={() => setColor(c.value)}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: c.value, marginRight: 4 }} />
              {c.label}
            </button>
          ))}
          <span style={{ fontSize: 14, marginLeft: 8 }}>굵기</span>
          {WIDTHS.map((w) => (
            <button key={w.value} type="button" style={chip(width === w.value)} onClick={() => setWidth(w.value)}>
              {w.label}
            </button>
          ))}
          <span style={{ marginLeft: 8 }} />
          <button type="button" className="btn-secondary" onClick={undo} disabled={points.length === 0}>
            되돌리기
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setPoints([]);
              setClosed(false);
            }}
            disabled={points.length === 0}
          >
            모두 지우기
          </button>
          <button type="button" className="btn-secondary" onClick={() => setClosed(true)} disabled={closed || points.length < 3}>
            선 닫기
          </button>
        </div>
        {img ? (
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            style={{
              display: "block",
              maxWidth: "min(90vw, 1400px)",
              maxHeight: "70vh",
              cursor: closed ? "default" : "crosshair",
              border: "1px solid var(--color-border)",
            }}
          />
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>사진 불러오는 중...</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            취소
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving || points.length < 2}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
