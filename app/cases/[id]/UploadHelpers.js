"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// 사진을 올리는 곳(참고 문서, 3.4 배치도, 3.1 소유 증빙 표, 4장 현장 사진)에서 같이 쓰는 부품:
//  - PasteZone: 화면 캡처(PrintScreen, Win+Shift+S)를 클릭 후 Ctrl+V로 바로 올리는 칸
//  - RenameInput / renameDocument: 올린 파일 이름을 바로 바꾸기(확장자는 유지)

// 클립보드 이미지는 이름이 "image.png"뿐이라 언제 캡처했는지 알 수 있게 이름을 붙인다.
export function pastedImageFile(e) {
  const image = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
  if (!image) return null;
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ext = image.type === "image/jpeg" ? ".jpg" : ".png";
  const name = `캡처_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${ext}`;
  return new File([image], name, { type: image.type });
}

export const NO_PASTED_IMAGE =
  "붙여넣은 내용에 이미지가 없어요. 화면을 캡처(PrintScreen 또는 Win+Shift+S)한 뒤 다시 붙여넣어 주세요.";

export function PasteZone({ onFile, onError, compact = false, style }) {
  function handlePaste(e) {
    const file = pastedImageFile(e);
    if (!file) {
      onError?.(NO_PASTED_IMAGE);
      return;
    }
    e.preventDefault();
    onFile(file);
  }

  return (
    <div
      tabIndex={0}
      onPaste={handlePaste}
      title="캡처한 화면을 여기에 붙여넣으면 바로 올라가요 (클릭 후 Ctrl+V)"
      className="paste-zone"
      style={{
        padding: compact ? "4px 6px" : "10px 8px",
        border: "1px dashed var(--color-border)",
        borderRadius: 8,
        fontSize: 13,
        color: "var(--color-text-muted)",
        textAlign: "center",
        cursor: "pointer",
        outline: "none",
        ...style,
      }}
    >
      {compact ? (
        "📋 캡처 붙여넣기 (클릭 후 Ctrl+V)"
      ) : (
        <>
          📋 캡처 붙여넣기
          <div style={{ fontSize: 12 }}>여기를 클릭하고 Ctrl+V</div>
        </>
      )}
    </div>
  );
}

export function splitExt(name) {
  const m = String(name ?? "").match(/^(.*?)(\.[^.]+)?$/);
  return { base: m[1], ext: m[2] || "" };
}

// 새 이름에 원래 확장자를 붙인다 — 확장자가 있어야 사진 미리보기·보고서가 그림으로 알아본다.
export function withOriginalExt(oldName, draft) {
  const { ext } = splitExt(oldName);
  return draft.toLowerCase().endsWith(ext.toLowerCase()) ? draft : `${draft}${ext}`;
}

// 이름만 바꾼다(저장된 파일은 그대로). extra: 같이 바꿀 칸(예: 3.4 촬영연도).
export async function renameDocument(doc, draft, extra = {}) {
  return supabase
    .from("documents")
    .update({ file_name: withOriginalExt(doc.file_name, draft), ...extra })
    .eq("id", doc.id);
}

// 이름 바꾸기 칸. 열리면 글자가 선택돼 있어 바로 새 이름(예: 2014)을 치고 Enter. Esc는 취소.
export function RenameInput({ initial, onSave, onCancel, style }) {
  const [draft, setDraft] = useState(initial);
  const done = useRef(false); // Enter·Esc 뒤에 따라오는 blur가 한 번 더 저장하지 않게

  function finish(save) {
    if (done.current) return;
    done.current = true;
    const value = draft.trim();
    if (save && value && value !== initial) onSave(value);
    else onCancel();
  }

  return (
    <input
      autoFocus
      value={draft}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) finish(true);
        if (e.key === "Escape") finish(false);
      }}
      placeholder="새 이름 입력 후 Enter"
      style={{
        minWidth: 0,
        padding: "4px 6px",
        fontSize: 14,
        border: "1px solid var(--color-primary)",
        borderRadius: 4,
        ...style,
      }}
    />
  );
}

export function RenameButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="이름 바꾸기"
      style={{
        border: "none",
        background: "transparent",
        color: "var(--color-text-muted)",
        cursor: "pointer",
        flexShrink: 0,
        padding: "0 2px",
      }}
    >
      ✏️
    </button>
  );
}
