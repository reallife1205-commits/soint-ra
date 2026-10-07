"use client";

// 이 화면에 입력한 내용이 실제로 hwpx 보고서에 반영되는지 한눈에 보여주는 작은 표시.
// "required" = 반영됨(필수작성), "reference" = 입력해도 보고서엔 안 들어감(참고용).
// status가 없으면 아무것도 안 그린다(주로 검색·조회 보조 화면처럼 굳이 표시할 필요 없는 곳).
// superscript: 위첨자처럼 작게 올려 붙인다 — 상단 챕터 탭이 한 줄에 다 보이도록 폭을 줄일 때 사용.
export default function ReportStatusBadge({ status, superscript = false }) {
  if (status === "required") {
    return (
      <span
        className="badge badge-green"
        style={
          superscript
            ? { fontSize: 10, padding: "0 5px", marginLeft: 2, verticalAlign: "super", lineHeight: 1.4 }
            : { fontSize: 11, padding: "1px 6px", marginLeft: 6, verticalAlign: "middle" }
        }
        title="이 화면에 입력한 내용이 보고서에 반영돼요"
      >
        필수작성
      </span>
    );
  }
  if (status === "reference") {
    // 기본 .badge 클래스는 배경/글자색이 없어서(색상 종류별 클래스로만 색을 입힘) 그냥
    // 텍스트처럼 보여 눈에 안 띈다 — 회색 배경을 직접 지정해 "참고용"임이 보이게 한다.
    return (
      <span
        className="badge"
        style={{
          fontSize: 11,
          padding: "1px 6px",
          marginLeft: 6,
          verticalAlign: "middle",
          background: "var(--color-surface-alt)",
          color: "var(--color-text-muted)",
          border: "1px solid var(--color-border)",
        }}
        title="이 화면에 입력한 내용은 보고서에는 반영되지 않아요(참고·관리용)"
      >
        참고용
      </span>
    );
  }
  return null;
}
