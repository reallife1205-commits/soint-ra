"use client";

import { useRef, useState } from "react";

// 완료 처리한 장은 잠가서 실수로 고치지 못하게 한다. 고치려면 "완료 취소"를 눌러 잠금을 푼다.
// 각 화면 코드를 하나하나 고치지 않고, 감싼 영역에서 입력·버튼 이벤트를 먼저 가로채는 방식:
//  - 글자 칸(input/textarea): 포커스될 때 읽기 전용으로 바꾼다 → 선택·복사는 되고 입력(한글 포함)은 안 됨
//  - 체크박스·선택상자·날짜·파일 등, 그리고 버튼: 누르는 걸 막는다
//  - 화면 안 탭·사진 미리보기처럼 보기만 하는 버튼은 data-view 속성을 붙여 허용한다
const TEXT_INPUT_TYPES = new Set(["text", "number", "search", "email", "tel", "url", "password", ""]);

function isTextField(el) {
  if (el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && TEXT_INPUT_TYPES.has((el.getAttribute("type") || "").toLowerCase());
}

const INTERACTIVE = "button, input, select, textarea, label, [role='button']";

export default function ChapterLock({ locked, chapterKey, children, showBanner = true }) {
  const [warned, setWarned] = useState(false);
  const timer = useRef(null);

  function warn() {
    setWarned(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setWarned(false), 1800);
  }

  function blocked(e) {
    const el = e.target.closest?.(INTERACTIVE);
    if (!el || el.closest("[data-view]")) return null;
    return el;
  }

  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
    warn();
  }

  const handlers = locked
    ? {
        onFocusCapture: (e) => {
          const el = e.target;
          if (isTextField(el) && !el.readOnly) {
            el.readOnly = true;
            el.dataset.lockedReadonly = "1";
          }
        },
        onBlurCapture: (e) => {
          const el = e.target;
          if (el.dataset?.lockedReadonly) {
            el.readOnly = false;
            delete el.dataset.lockedReadonly;
          }
        },
        onMouseDownCapture: (e) => {
          const el = blocked(e);
          // 글자 칸은 클릭해서 선택·복사할 수 있게 둔다(포커스되면 읽기 전용이 됨)
          if (el && !isTextField(el) && el.tagName !== "BUTTON") stop(e);
        },
        onClickCapture: (e) => {
          const el = blocked(e);
          if (el && !isTextField(el)) stop(e);
        },
        onKeyDownCapture: (e) => {
          const el = e.target;
          if (isTextField(el)) {
            if (!e.ctrlKey && !e.metaKey && e.key.length === 1) warn();
            return;
          }
          if ((e.key === "Enter" || e.key === " ") && blocked(e)) stop(e);
        },
        onPasteCapture: stop,
        onCutCapture: stop,
        onDragOverCapture: (e) => {
          // 여기서 막지 않으면 파일 끌어놓기가 브라우저 새 탭으로 열려버린다
          e.preventDefault();
          e.stopPropagation();
        },
        onDropCapture: stop,
      }
    : {};

  return (
    <div className={locked ? "chapter-locked" : undefined} {...handlers}>
      {locked && showBanner && (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: 12,
            borderRadius: 8,
            fontSize: 14,
            transition: "background 0.2s, color 0.2s",
            background: warned ? "var(--color-badge-red-bg)" : "var(--color-complete-done-bg)",
            color: warned ? "var(--color-badge-red-text)" : "var(--color-complete-done-text)",
          }}
        >
          🔒 {chapterKey}장은 완료 처리돼 있어 수정할 수 없어요. 고치려면 오른쪽 위 <b>완료 취소</b>를 눌러주세요.
        </div>
      )}
      {children}
    </div>
  );
}
