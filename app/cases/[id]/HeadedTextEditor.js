"use client";

import { useLayoutEffect, useRef } from "react";

// 줄 맨 앞 "(소제목)"을 입력칸 안에서 바로 굵게 보여주는 입력칸. textarea는 글자 일부만 굵게 할 수
// 없어서, 글자를 투명하게 한 textarea 뒤에 같은 글자를 그린 층(backdrop)을 정확히 겹친다.
// 입력·커서·한글 조합·되돌리기는 진짜 textarea가 처리하므로 일반 입력칸과 똑같이 동작한다.
// 굵게는 글자 폭이 바뀌지 않는 테두리 효과(-webkit-text-stroke)로 표현한다 — 진짜 bold는 폭이
// 넓어져 위아래 층의 줄바꿈 위치가 어긋나기 때문. 저장 값은 그대로 일반 텍스트이고, 보고서도 같은
// 규칙으로 굵게 처리한다(hwpxReportBuilder의 boldLeadingHeading).
const LEADING_HEADING = /^(\([^)]*\))(.*)$/;

function renderLines(text) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const m = line.match(LEADING_HEADING);
    const sep = i < lines.length - 1 ? "\n" : "";
    if (!m) return line + sep;
    return (
      <span key={i}>
        <span style={{ WebkitTextStroke: "0.6px currentColor" }}>{m[1]}</span>
        {m[2] + sep}
      </span>
    );
  });
}

export default function HeadedTextEditor({ value, onChange, onBlur, placeholder, rows = 4, style }) {
  const ref = useRef(null);

  // 스크롤바가 생기면 textarea만 글자 폭이 줄어 두 층이 어긋나므로, 스크롤 대신 내용 높이만큼 늘린다.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  const shared = {
    ...style,
    boxSizing: "border-box",
    fontFamily: "inherit",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    letterSpacing: "normal",
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        aria-hidden="true"
        style={{
          ...shared,
          position: "absolute",
          inset: 0,
          // textarea의 marginTop은 부모 div 밖으로 겹쳐(margin collapse) 부모 위치 자체를 내리므로,
          // 표시층에도 margin을 주면 그만큼 더 내려가 어긋난다. (축약형 margin/borderColor를 섞으면
          // React가 개별 속성을 덮어쓰지 못해서, style에 있는 같은 키를 그대로 덮어쓴다.)
          marginTop: 0,
          border: "1px solid transparent",
          background: "var(--color-surface, #fff)",
          color: "var(--color-text)",
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {renderLines(value)}
        {"\n"}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        style={{
          ...shared,
          position: "relative",
          display: "block",
          background: "transparent",
          color: "transparent",
          caretColor: "var(--color-text)",
          overflow: "hidden",
          resize: "none",
        }}
      />
    </div>
  );
}
