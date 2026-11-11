"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { shrinkImageForUpload, friendlyUploadError } from "@/lib/shrinkImage";
import { splitExt } from "./UploadHelpers";

// 경계선을 그린 사진은 이름 뒤에 이 말을 붙인다.
// - "배치도 등"(module 3, site_plan) 사진: 원본은 두고 같은 목록에 따로 저장 (보고서 3.4 배치도면이 이 이름을 먼저 고른다)
// - 왼쪽 항공사진(module 4): 그 사진 자리에 바꿔 넣는다 — 연도·태깅을 그대로 쓰고, 6장 타임라인·보고서 항공사진 표에도
//   경계선 사진이 들어간다(따로 저장하면 같은 연도 사진이 두 장이 된다). 원본 파일은 저장소에 지우지 않고 남겨 둔다.
const BOUNDARY_SUFFIX = "_경계선";
const SITE_PLAN = { moduleNumber: 3, category: "site_plan" };

function boundaryName(fileName) {
  const base = splitExt(fileName).base;
  return (base.endsWith(BOUNDARY_SUFFIX) ? base : base + BOUNDARY_SUFFIX) + ".jpg";
}

// 항공사진처럼 그 사진 자리에 바꿔 넣는다. { error } 또는 { name }.
// 이름 확장자도 .jpg로 바꾼다 — 보고서 내보내기가 파일 이름의 확장자로 그림 형식을 정한다.
export async function replaceWithBoundary(caseId, doc, blob) {
  const name = boundaryName(doc.file_name);
  const file = await shrinkImageForUpload(new File([blob], name, { type: "image/jpeg" }));
  const folder = doc.file_path.replace(/\/[^/]*$/, "");
  const filePath = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
  if (uploadError) return { error: friendlyUploadError(uploadError.message) };
  // 원본 위치를 적어 둔다("원본으로 되돌리기"용). 이미 경계선을 그린 사진에 다시 그리면 처음 원본을 그대로 둔다.
  const original = doc.original_file_path
    ? { original_file_path: doc.original_file_path, original_file_name: doc.original_file_name }
    : { original_file_path: doc.file_path, original_file_name: doc.file_name };
  const base = { file_path: filePath, file_name: name, file_size: file.size };
  let { error: updateError } = await supabase.from("documents").update({ ...base, ...original }).eq("id", doc.id);
  // sql/028을 아직 안 돌렸으면 원본 위치 열이 없다 — 그래도 그리기는 되게 열 없이 다시 저장한다
  if (updateError && /original_file/.test(updateError.message)) {
    ({ error: updateError } = await supabase.from("documents").update(base).eq("id", doc.id));
  }
  if (updateError) {
    await supabase.storage.from("documents").remove([filePath]);
    return { error: `저장에 실패했어요: ${updateError.message}` };
  }
  // 경계선 사진에 다시 그렸으면 그 전 경계선 사진 파일은 더 쓸 데가 없다(원본은 지우지 않는다)
  if (doc.original_file_path && doc.file_path !== doc.original_file_path) {
    await supabase.storage.from("documents").remove([doc.file_path]);
  }
  window.dispatchEvent(new CustomEvent("documents-changed", { detail: { caseId, moduleNumber: doc.module_number } }));
  return { name };
}

// { error } 또는 { name }(저장한 파일 이름)을 돌려준다.
export async function saveBoundaryCopy(caseId, sourceDoc, blob) {
  const name = boundaryName(sourceDoc.file_name);
  const file = await shrinkImageForUpload(new File([blob], name, { type: "image/jpeg" }));
  const filePath = `${caseId}/module${SITE_PLAN.moduleNumber}/${SITE_PLAN.category}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
  if (uploadError) return { error: friendlyUploadError(uploadError.message) };
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
    return { error: `저장에 실패했어요: ${insertError.message}` };
  }
  window.dispatchEvent(new CustomEvent("documents-changed", { detail: { caseId, moduleNumber: SITE_PLAN.moduleNumber } }));
  return { name };
}

// 크게 본 사진 창에 붙이는 "부지 경계 그리기" 버튼 + 그리기 창. 원본 사진을 받아 와 그리고, 저장하면 saveBoundaryCopy.
// 그리기 창은 사진 창 위(zIndex 110)에 뜬다. 사진 창을 닫으면 이 버튼과 함께 그리기 창도 사라지니 닫지 않는다.
// 저장 결과는 알림 창으로 알린다 — 사진 창 뒤 목록에 오류를 적으면 가려져서, 저장이 됐는지 안 됐는지 알 수 없었다.
// onSaved: 저장에 성공하면 불러 준다(사진 창 닫기 등). inPlace: 따로 저장하지 않고 그 사진 자리에 바꿔 넣는다(항공사진).
export function BoundaryDrawButton({ caseId, doc, onSaved, inPlace = false }) {
  const [blob, setBlob] = useState(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const { data, error } = await supabase.storage.from("documents").download(doc.file_path);
    setBusy(false);
    if (error || !data) {
      alert("사진을 불러오지 못했어요");
      return;
    }
    setBlob(data);
  }

  async function save(drawn) {
    const result = inPlace ? await replaceWithBoundary(caseId, doc, drawn) : await saveBoundaryCopy(caseId, doc, drawn);
    if (result.error) {
      alert(result.error); // 그리기 창은 그대로 두어 그린 선을 잃지 않게 한다
      return;
    }
    setBlob(null);
    alert(
      inPlace
        ? `경계선을 그려 이 사진을 "${result.name}"(으)로 바꿨어요.
6장 타임라인과 보고서 항공사진에도 경계선이 그려진 사진이 들어가요.`
        : `경계선을 그린 사진을 3.4 "배치도 등"에 "${result.name}"(으)로 저장했어요.
원본 사진은 그대로 두었고, 보고서 배치도면엔 이 사진이 들어가요.`
    );
    onSaved?.();
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

// 경계선을 그려 바꿔 넣은 항공사진인가 — 원본 위치가 적혀 있거나, 그 열이 생기기 전에 그린 사진(이름 끝 _경계선)
export function hasBoundaryDrawn(doc) {
  return !!doc.original_file_path || splitExt(doc.file_name).base.endsWith(BOUNDARY_SUFFIX);
}

function originalNameFor(doc, originalPath) {
  if (doc.original_file_name) return doc.original_file_name;
  const base = splitExt(doc.file_name).base.replace(new RegExp(`${BOUNDARY_SUFFIX}$`), "");
  const ext = originalPath.match(/\.[^./]+$/)?.[0] || ".jpg";
  return base + ext;
}

// 경계선 사진을 원본으로 되돌린다. 연도·태깅·캡션은 그대로. 경계선 사진 파일은 지운다.
async function restoreOriginal(caseId, doc, originalPath) {
  const { data: blob, error: dlError } = await supabase.storage.from("documents").download(originalPath);
  if (dlError || !blob) return { error: "원본 사진을 불러오지 못했어요" };
  const name = originalNameFor(doc, originalPath);
  const base = { file_path: originalPath, file_name: name, file_size: blob.size };
  let { error } = await supabase
    .from("documents")
    .update({ ...base, original_file_path: null, original_file_name: null })
    .eq("id", doc.id);
  if (error && /original_file/.test(error.message)) {
    ({ error } = await supabase.from("documents").update(base).eq("id", doc.id));
  }
  if (error) return { error: `되돌리지 못했어요: ${error.message}` };
  if (doc.file_path !== originalPath) await supabase.storage.from("documents").remove([doc.file_path]);
  window.dispatchEvent(new CustomEvent("documents-changed", { detail: { caseId, moduleNumber: doc.module_number } }));
  return { name };
}

// 원본 위치가 안 적힌(sql/028 전에 그린) 사진: 같은 폴더에서 어떤 사진도 쓰지 않는 파일을 원본 후보로 모은다.
// 경계선을 그린 사진이 여러 장이면 후보도 여러 장이라, 사진을 보고 직접 고르게 한다.
async function findOriginalCandidates(caseId, doc) {
  const folder = doc.file_path.replace(/\/[^/]*$/, "");
  const [{ data: files, error: listError }, { data: docs, error: docsError }] = await Promise.all([
    supabase.storage.from("documents").list(folder, { limit: 1000, sortBy: { column: "created_at", order: "asc" } }),
    supabase.from("documents").select("*").eq("case_id", caseId),
  ]);
  if (listError || docsError) return { error: "저장된 사진 목록을 불러오지 못했어요" };
  const used = new Set();
  (docs || []).forEach((d) => {
    used.add(d.file_path);
    if (d.original_file_path) used.add(d.original_file_path);
  });
  const paths = (files || [])
    .filter((f) => f.id) // 하위 폴더는 빼고 파일만
    .map((f) => ({ path: `${folder}/${f.name}`, createdAt: f.created_at }))
    .filter((f) => !used.has(f.path));
  if (paths.length === 0) return { candidates: [] };
  const { data: urls } = await supabase.storage.from("documents").createSignedUrls(
    paths.map((p) => p.path),
    3600
  );
  return { candidates: paths.map((p, i) => ({ ...p, url: urls?.[i]?.signedUrl })) };
}

// 크게 본 항공사진 창에 붙이는 "원본으로 되돌리기" 버튼
export function RestoreOriginalButton({ caseId, doc, onRestored }) {
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState(null); // 후보 고르는 창

  async function finish(originalPath) {
    setBusy(true);
    const result = await restoreOriginal(caseId, doc, originalPath);
    setBusy(false);
    if (result.error) {
      alert(result.error);
      return;
    }
    setCandidates(null);
    alert(`경계선을 그리기 전 원본 사진 "${result.name}"(으)로 되돌렸어요.`);
    onRestored?.();
  }

  async function start() {
    if (doc.original_file_path) {
      if (confirm("경계선을 그리기 전 원본 사진으로 되돌릴까요?\n지금 그려진 경계선은 사라져요.")) finish(doc.original_file_path);
      return;
    }
    setBusy(true);
    const result = await findOriginalCandidates(caseId, doc);
    setBusy(false);
    if (result.error) return alert(result.error);
    if (result.candidates.length === 0) {
      return alert("원본을 찾지 못했어요.\n이 사진을 지우고 원본 항공사진을 다시 올려 주세요.");
    }
    setCandidates(result.candidates);
  }

  return (
    <>
      <button type="button" className="btn-secondary" onClick={start} disabled={busy}>
        {busy ? "찾는 중..." : "↩️ 원본으로 되돌리기"}
      </button>
      {candidates && (
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
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>원본 사진 고르기</div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 10 }}>
              이 사진은 원본 위치가 적혀 있지 않아, 어떤 사진에도 쓰이지 않는 파일을 모았어요. 경계선을 그리기 전 이 사진의 원본을 눌러 고르세요.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {candidates.map((c) => (
                <button
                  key={c.path}
                  type="button"
                  disabled={busy}
                  onClick={() => finish(c.path)}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    padding: 6,
                    background: "white",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {c.url ? (
                    <img src={c.url} alt="" style={{ display: "block", width: 260, height: 200, objectFit: "contain", background: "#f4f4f4" }} />
                  ) : (
                    <div style={{ width: 260, height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>미리보기 없음</div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                    {c.createdAt ? `${new Date(c.createdAt).toLocaleString("ko-KR")} 올림` : ""}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => setCandidates(null)} disabled={busy}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
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
// 선 모양 — 점선 간격은 굵기에 맞춰 늘린다(둥근 끝이 굵기만큼 간격을 메우니 그만큼 더 띄운다)
const STYLES = [
  { value: "solid", label: "실선" },
  { value: "dashed", label: "점선" },
];
const dashFor = (style, lw) => (style === "dashed" ? [lw * 3, lw * 3] : []);
const CLOSE_RADIUS_PX = 14; // 화면에서 첫 점을 이만큼 가까이 누르면 다각형을 닫는다

export default function BoundaryDrawer({ imageBlob, onCancel, onSave }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [points, setPoints] = useState([]);
  const [closed, setClosed] = useState(false);
  const [color, setColor] = useState(COLORS[0].value);
  const [width, setWidth] = useState(WIDTHS[1].value);
  const [lineStyle, setLineStyle] = useState(STYLES[0].value);
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
    ctx.setLineDash(dashFor(lineStyle, lw));
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    if (closed) ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]); // 꼭짓점 동그라미 테두리는 실선으로
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
  }, [img, points, closed, color, width, lineStyle]);

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
          <span style={{ fontSize: 14, marginLeft: 8 }}>선</span>
          {STYLES.map((s) => (
            <button key={s.value} type="button" style={chip(lineStyle === s.value)} onClick={() => setLineStyle(s.value)}>
              <span
                style={{
                  display: "inline-block",
                  width: 18,
                  verticalAlign: "middle",
                  borderTop: `2px ${s.value} #333`,
                  marginRight: 4,
                }}
              />
              {s.label}
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
