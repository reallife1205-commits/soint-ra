// 보고서 2.1 대상부지 토양오염 현황 — 그림 위 본문(자료 종류 체크박스 줄 + 조사기간 + 결과 요약).
// 화면(Module1Narrative)의 "표 내용으로 초안 만들기"와 보고서 내보내기(입력칸이 비어 있을 때)가
// 같은 규칙으로 초안을 만들도록 여기 한 곳에 둔다. module_rows(0번, category 아래 값)에 저장.

export const SITE_CONTAMINATION_CATEGORY = "site_contamination_status";

export const SOURCE_OPTIONS = [
  { key: "soil_test_report", label: "토양오염도검사 성적서" },
  { key: "leak_test_report", label: "누출검사 성적서" },
  { key: "detailed_survey_report", label: "토양정밀조사보고서" },
  { key: "other", label: "기타" },
];

// 저장된 값이 없을 때의 기본 체크 — 1.1에 정밀조사 시기가 있으면 정밀조사보고서로 본다.
export function defaultSources(overview) {
  return overview?.investigation_start || overview?.investigation_end ? ["detailed_survey_report"] : [];
}

// 샘플 그대로: "□ 토양오염도검사 성적서 □ 누출검사 성적서 ☑ 토양정밀조사보고서 □ 기타(             )"
export function sourceCheckboxLine(sources, otherText) {
  const set = new Set(sources || []);
  return SOURCE_OPTIONS.map((o) => {
    const box = set.has(o.key) ? "☑" : "□";
    if (o.key === "other") {
      const t = (otherText || "").trim();
      return `${box} 기타(${t ? ` ${t} ` : "             "})`;
    }
    return `${box} ${o.label}`;
  }).join(" ");
}

function toNum(v) {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatNum(n) {
  return Number(Math.round(n * 100) / 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

// "2025-06-02" → "'25.6월"
function shortYearMonth(dateStr) {
  const m = String(dateStr || "").match(/(\d{4})\D+(\d{1,2})/);
  if (!m) return null;
  return `'${m[1].slice(2)}.${parseInt(m[2], 10)}월`;
}

// "A", "A 및 B", "A, B 및 C"
function joinKorean(items) {
  if (items.length <= 1) return items[0] || "";
  return `${items.slice(0, -1).join(", ")} 및 ${items[items.length - 1]}`;
}

// contaminationRows: 2.1 오염현황 표의 row_data 목록, overview: 1.1 개요(investigation_start/end)
export function buildSiteContaminationDraft({ contaminationRows, overview, sources }) {
  const rows = (contaminationRows || []).filter((d) => (d.contaminant || "").trim());
  const lines = [];

  const start = shortYearMonth(overview?.investigation_start);
  const end = shortYearMonth(overview?.investigation_end);
  lines.push(
    start || end
      ? `ㅇ (조사기간) ${start || "'  .  월"} ~ ${end || "'  .  월"}`
      : "ㅇ (조사기간) ※ 1.1 정밀조사 시기 미입력"
  );

  if (rows.length === 0) {
    lines.push("- ※ 2.1 오염 현황 표 미입력");
    return lines.join("\n");
  }

  // 물질은 표에 나온 순서대로, 같은 물질(심도별 여러 행)은 한 번만
  const groups = [];
  const byName = {};
  rows.forEach((d) => {
    const name = d.contaminant.trim();
    if (!byName[name]) {
      byName[name] = { name, items: [] };
      groups.push(byName[name]);
    }
    byName[name].items.push(d);
  });

  const concern = rows.some((d) => toNum(d.concern_standard) > 0);
  const action = rows.some((d) => toNum(d.action_standard) > 0);
  const standard = concern && action ? "우려기준 및 대책기준을" : action ? "대책기준을" : "우려기준을";

  // 오염면적은 심도별 중첩 때문에 물질별 합계 칸(area_total, 그 물질 첫 행에 저장)을 더한다 —
  // 2.1 표 화면의 "전체 합계"와 같은 계산. 합계 칸이 비어 있으면 행별 면적을 더한 값으로 대신.
  const areaTotal = groups.reduce((sum, g) => sum + toNum(g.items[0]?.area_total), 0);
  const area = areaTotal || rows.reduce((sum, d) => sum + toNum(d.area), 0);
  const volume = rows.reduce((sum, d) => sum + toNum(d.volume), 0);

  const prefix = (sources || []).includes("detailed_survey_report") ? "개황조사 및 상세조사 결과" : "조사 결과";
  lines.push(
    `- ${prefix}, ${joinKorean(groups.map((g) => g.name))} 항목이 ${standard} 초과하였으며 ` +
      `오염 면적은 ${formatNum(area)} ㎡, 오염량은 ${formatNum(volume)} ㎥로 산정됨`
  );
  return lines.join("\n");
}
