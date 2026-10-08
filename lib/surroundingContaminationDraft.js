// 보고서 2.2 인접·주변부지 토양오염 현황 — 그림 위 본문(자료 종류 체크박스 줄 + 결과 요약 문장).
// 화면(Module2Narrative)의 "검색 결과로 초안 만들기"와 보고서 내보내기(입력칸이 비어 있을 때)가
// 같은 규칙을 쓰도록 여기 한 곳에 둔다. module_rows(2번, category 아래 값)에 저장.
import { SUBSTANCE_GROUPS } from "./substances.js";
import { CONCERN_STANDARDS, parseRegionGrade } from "./soilStandards.js";

export const SURROUNDING_STATUS_CATEGORY = "surrounding_contamination_status";

export const SURROUNDING_SOURCE_OPTIONS = [
  { key: "soil_network", label: "토양측정망" },
  { key: "soil_survey", label: "토양오염실태조사" },
];

// [표 2] 토양측정망 조사결과의 22개 항목(보고서 표와 같은 순서·구성, pH 포함)
export const NETWORK_KEYS = [
  "cadmium", "copper", "arsenic", "mercury", "lead", "chromium6", "zinc", "nickel", "organophosphorus", "cyanide", "ph",
  "fluorine", "pcb", "phenol", "benzene", "toluene", "ethylbenzene", "xylene", "tph", "tce", "pce", "benzoapyrene",
];

const LABEL = Object.fromEntries(SUBSTANCE_GROUPS.flatMap((g) => g.items));

function toNumOrNull(v) {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return v === null || v === undefined || v === "" || isNaN(n) ? null : n;
}

function joinKorean(items) {
  if (items.length <= 1) return items[0] || "";
  return `${items.slice(0, -1).join(", ")} 및 ${items[items.length - 1]}`;
}

// 저장된 값이 없을 때의 기본 체크 — 검색 결과에 있는 자료만.
export function defaultSurroundingSources(networkRows, surveyRows) {
  const s = [];
  if ((networkRows || []).length) s.push("soil_network");
  if ((surveyRows || []).length) s.push("soil_survey");
  return s;
}

// 샘플: "☑ 토양측정망 ☑ 토양오염실태조사"
export function surroundingCheckboxLine(sources) {
  const set = new Set(sources || []);
  return SURROUNDING_SOURCE_OPTIONS.map((o) => `${set.has(o.key) ? "☑" : "□"} ${o.label}`).join(" ");
}

// 보고서 [표 3]이 실릴지 — hwpxReportBuilder의 fillSurvey와 같은 조건(선택한 측정항목 중 값이 있는 게 있어야 함)
export function surveyTableShown(surveyRows, selectedSubstances) {
  const keys = (selectedSubstances || []).filter((k) => NETWORK_KEYS.includes(k));
  return keys.some((k) => (surveyRows || []).some((r) => toNumOrNull(r[k]) !== null));
}

// networkRows/surveyRows: 반경 내 reference_soil_data(측정망/실태조사), radius: 조사 반경(km)
export function buildSurroundingDraft({ networkRows, surveyRows, radius, selectedSubstances, regionGrade }) {
  const net = networkRows || [];
  const survey = surveyRows || [];
  const zone = parseRegionGrade(regionGrade);
  const r = radius ?? 2;
  const parts = [];

  if (net.length === 0) {
    parts.push(`부지 ${r}km 반경 내에 확인된 토양측정망은 없으며`);
  } else {
    const points = new Set(net.map((row) => row.site_name || row.address || `${row.lat},${row.lon}`)).size;
    const tested = NETWORK_KEYS.filter((k) => net.some((row) => toNumOrNull(row[k]) !== null));
    const untested = NETWORK_KEYS.length - tested.length;
    // 지역 등급이 있으면 최고값이 우려기준을 넘는 항목을 따로 적는다(pH 등 기준 없는 항목은 제외)
    const exceeded = zone
      ? tested.filter((k) => {
          const std = CONCERN_STANDARDS[k]?.[zone];
          if (std === undefined) return false;
          return Math.max(...net.map((row) => toNumOrNull(row[k])).filter((v) => v !== null)) > std;
        })
      : [];
    const scope = untested > 0 ? `미검사 총 ${untested}개 항목을 제외한 ${tested.length}항목` : `${tested.length}개 항목`;
    if (exceeded.length === 0) {
      parts.push(`부지 ${r}km 반경 내에 확인된 토양측정망은 ${points}개 지점으로 ${scope}은 불검출이거나 기준치 이내인 것으로 확인되었고`);
    } else {
      parts.push(
        `부지 ${r}km 반경 내에 확인된 토양측정망은 ${points}개 지점으로 ${scope} 중 ` +
          `${joinKorean(exceeded.map((k) => LABEL[k] || k))} 항목이 우려기준을 초과하였고, 나머지 항목은 불검출이거나 기준치 이내인 것으로 확인되었고`
      );
    }
  }

  if (survey.length === 0) {
    parts.push("토양오염실태조사 지점은 확인되지 않음");
  } else if (surveyTableShown(survey, selectedSubstances)) {
    parts.push("토양오염실태조사 결과는 [표 3]과 같음");
  } else {
    parts.push("토양오염실태조사 결과는 ※ 2.2 측정항목 미선택(보고서 [표 3]이 빠짐)");
  }

  return `ㅇ ${parts.join(", ")}`;
}
