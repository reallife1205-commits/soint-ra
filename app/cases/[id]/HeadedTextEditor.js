"use client";

import { useEffect, useRef } from "react";

// 줄 맨 앞 "(소제목)"을 입력칸 안에서 바로 굵게 보여주는 편집칸. textarea는 글자 일부만 굵게 할 수
// 없어서 contentEditable로 만들었다. 저장되는 값은 여전히 줄바꿈(\n)이 든 일반 텍스트이고, 굵게는
// 화면 표시일 뿐이다(보고서도 같은 규칙으로 굵게 처리 — hwpxReportBuilder의 boldLeadingHeading).
const LEADING_HEADING = /^(\([^)]*\))(.*)$/;

function buildLines(text) {
  const frag = document.createDocumentFragment();
  text.split("\n").forEach((line) => {
    const div = document.createElement("div");
    const m = line.match(LEADING_HEADING);
    if (m) {
      const strong = document.createElement("strong");
      strong.textContent = m[1];
      div.appendChild(strong);
      if (m[2]) div.appendChild(document.createTextNode(m[2]));
    } else if (line) {
      div.appendChild(document.createTextNode(line));
    } else {
      div.appendChild(document.createElement("br"));
    }
    frag.appendChild(div);
  });
  return frag;
}

function renderedHtml(text) {
  const tmp = document.createElement("div");
  tmp.appendChild(buildLines(text));
  return tmp.innerHTML;
}

// 줄 하나 = 최상위 div 하나(buildLines 구조). innerText는 빈 줄(<div><br></div>)을 두 줄로 세어서
// 저장할 때마다 빈 줄이 늘어나므로 직접 센다. 처음 입력하면 div 없이 글자가 바로 들어오거나
// 최상위 <br>로 줄이 나뉘기도 해서 그 경우도 한 줄로 묶는다.
function readText(el) {
  const lines = [];
  let cur = null;
  el.childNodes.forEach((n) => {
    if (n.nodeName === "DIV" || n.nodeName === "P") {
      if (cur !== null) lines.push(cur);
      cur = null;
      lines.push(n.textContent);
    } else if (n.nodeName === "BR") {
      lines.push(cur ?? "");
      cur = null;
    } else {
      cur = (cur ?? "") + n.textContent;
    }
  });
  if (cur !== null) lines.push(cur);
  return lines.join("\n");
}

// 커서 위치를 "몇 번째 줄의 몇 번째 글자"로 저장했다가, 다시 그린 뒤 같은 자리로 되돌린다.
function getCaret(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !el.contains(sel.focusNode)) return null;
  let line = sel.focusNode;
  while (line && line.parentNode !== el) line = line.parentNode;
  if (!line) return null;
  const lineIdx = Array.prototype.indexOf.call(el.childNodes, line);
  const range = document.createRange();
  range.setStart(line, 0);
  range.setEnd(sel.focusNode, sel.focusOffset);
  return { lineIdx, offset: range.toString().length };
}

function setCaret(el, caret) {
  if (!caret) return;
  const line = el.childNodes[Math.min(caret.lineIdx, el.childNodes.length - 1)];
  if (!line) return;
  const range = document.createRange();
  let remaining = caret.offset;
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let placed = false;
  while (node) {
    if (remaining <= node.length) {
      range.setStart(node, remaining);
      placed = true;
      break;
    }
    remaining -= node.length;
    node = walker.nextNode();
  }
  if (!placed) range.setStart(line, line.childNodes.length && line.lastChild.nodeName !== "BR" ? line.childNodes.length : 0);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export default function HeadedTextEditor({ value, onChange, onBlur, placeholder, rows = 4, style }) {
  const ref = useRef(null);
  const composing = useRef(false);

  // 처음 그리기 + 바깥에서 값이 바뀐 경우(불러오기 등)에만 다시 그린다.
  useEffect(() => {
    const el = ref.current;
    if (el && readText(el) !== value) {
      el.innerHTML = "";
      if (value) el.appendChild(buildLines(value));
    }
  }, [value]);

  function normalize() {
    const el = ref.current;
    const text = readText(el);
    if (text && el.innerHTML !== renderedHtml(text)) {
      const caret = getCaret(el);
      el.innerHTML = "";
      el.appendChild(buildLines(text));
      setCaret(el, caret);
    }
    onChange(text);
  }

  return (
    <div style={{ position: "relative" }}>
      {!value && (
        <div
          style={{
            ...style,
            position: "absolute",
            inset: 0,
            border: "1px solid transparent",
            color: "var(--color-text-muted)",
            lineHeight: 1.6,
            pointerEvents: "none",
            whiteSpace: "pre-wrap",
            overflow: "hidden",
          }}
        >
          {placeholder}
        </div>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={() => {
          // 한글 조합 중에 다시 그리면 글자가 깨지므로, 조합이 끝난 뒤(compositionend)에 정리한다.
          if (composing.current) onChange(readText(ref.current));
          else normalize();
        }}
        onCompositionStart={() => (composing.current = true)}
        onCompositionEnd={() => {
          composing.current = false;
          normalize();
        }}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        onBlur={onBlur}
        style={{
          ...style,
          minHeight: `${rows * 1.6 + 1}em`,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          outline: "none",
          background: "var(--color-surface, #fff)",
        }}
      />
    </div>
  );
}
