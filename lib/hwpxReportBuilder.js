import {
  loadTemplate,
  getTables,
  getRows,
  getCells,
  getPics,
  setCellText,
  setCaptionText,
  cloneRowsAfter,
  removeRow,
  removeTable,
  setSurveyPairText,
  setTNodeText,
  clonePairsAfter,
  removePair,
  replaceImage,
  serialize,
  getSectionParagraphs,
  getParagraphText,
  cloneParagraphsAfter,
  removeParagraph,
} from "./hwpxTemplate.js";
import { SUBSTANCE_LABELS, findSubstanceKey } from "./substances.js";
import { CONCERN_STANDARDS, ACTION_STANDARDS, parseRegionGrade } from "./soilStandards.js";

const TBL = {
  OVERVIEW: 0,
  NETWORK: 3,
  SURVEY: 4,
  OWNERSHIP: 5,
  FACTORY_HISTORY: 6,
  OWNERSHIP_SHARE: 7,
  COST_CAPACITY: 8,
  AERIAL_1: 9,
  AERIAL_2: 10,
  FIELD_PHOTOS: 11,
  SUMMARY: 12,
};

const NETWORK_SUBSTANCE_KEYS_BLOCK1 = [
  "cadmium", "copper", "arsenic", "mercury", "lead", "chromium6", "zinc", "nickel", "organophosphorus", "cyanide", "ph",
];
const FIELD_PHOTO_LABELS = [
  "특정토양오염관리대상시설",
  "토양 표면상태, 식물 생장상태",
  "지하수 관측시설 설치 및 사용",
  "오염지역의 누출흔적",
  "각종 폐기물의 매립 또는 방치",
  "기타",
];

const NETWORK_SUBSTANCE_KEYS_BLOCK2 = [
  "fluorine", "pcb", "phenol", "benzene", "toluene", "ethylbenzene", "xylene", "tph", "tce", "pce", "benzoapyrene",
];

function toNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function toNumOrNull(v) {
  const n = parseFloat(v);
  return v === null || v === undefined || v === "" || isNaN(n) ? null : n;
}
function formatSum(n) {
  return Number(Math.round(n * 100) / 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function summarizeContamination(items) {
  let area = 0;
  let volume = 0;
  let maxConc = null;
  let minStart = null;
  let maxEnd = null;
  items.forEach((d) => {
    area += toNum(d.area);
    volume += toNum(d.volume);
    const c = toNumOrNull(d.max_concentration);
    if (c !== null && (maxConc === null || c > maxConc)) maxConc = c;
    const s = toNumOrNull(d.depth_start);
    if (s !== null && (minStart === null || s < minStart)) minStart = s;
    const e = toNumOrNull(d.depth_end);
    if (e !== null && (maxEnd === null || e > maxEnd)) maxEnd = e;
  });
  return { area, volume, maxConc, minStart, maxEnd };
}

// ---- 1.1 안건개요 ----
function fillOverview(table, caseInfo, overview, contaminationRows) {
  const substances = Array.from(new Set(contaminationRows.map((d) => d.contaminant).filter(Boolean)));
  const totals = summarizeContamination(contaminationRows);
  const rangeText =
    totals.area || totals.volume || totals.minStart !== null
      ? `면적 : ${formatSum(totals.area)} ㎡, 부피 : ${formatSum(totals.volume)} ㎥, 심도 : ${
          totals.minStart !== null && totals.maxEnd !== null ? `${totals.minStart} ~ ${totals.maxEnd} m` : "-"
        }`
      : "-";

  setCellText(table, 0, 1, overview.advisory_subject || "-");
  setCellText(table, 1, 1, overview.currentOwners.length ? overview.currentOwners.join(", ") : "-");
  setCellText(table, 2, 1, substances.length ? substances.join(", ") : "-");
  setCellText(table, 3, 1, totals.maxConc !== null ? `${formatSum(totals.maxConc)} ㎎/㎏ (최고농도)` : "-");
  setCellText(table, 4, 1, rangeText);
  setCellText(
    table,
    5,
    1,
    overview.investigation_start || overview.investigation_end
      ? `${overview.investigation_start || "?"} ~ ${overview.investigation_end || "?"}`
      : "-"
  );
  setCellText(table, 6, 1, overview.application_number || "-");
}

// ---- 1.2 추진 경과 (표가 아닌 본문 문단 목록) ----
// "1.2 추진 경과" 제목 바로 다음에 오는, 텍스트가 있는 연속된 문단들을 템플릿 항목으로 보고
// 실제 진행 건수에 맞춰 복제/삭제한 뒤 "ㅇ (일자) 내용" 형식으로 채운다.
function fillProgress(doc, progressItems) {
  const paragraphs = getSectionParagraphs(doc);
  const headingIdx = paragraphs.findIndex((p) => getParagraphText(p).trim() === "1.2 추진 경과");
  if (headingIdx === -1) return;

  const templateItems = [];
  for (let i = headingIdx + 1; i < paragraphs.length; i++) {
    if (!getParagraphText(paragraphs[i]).trim()) break;
    templateItems.push(paragraphs[i]);
  }
  if (templateItems.length === 0) return;

  if (progressItems.length === 0) {
    templateItems.forEach(removeParagraph);
    return;
  }

  let targets;
  if (progressItems.length <= templateItems.length) {
    for (let i = progressItems.length; i < templateItems.length; i++) {
      removeParagraph(templateItems[i]);
    }
    targets = templateItems.slice(0, progressItems.length);
  } else {
    const extra = cloneParagraphsAfter(
      templateItems[templateItems.length - 1],
      progressItems.length - templateItems.length
    );
    targets = [...templateItems, ...extra];
  }

  progressItems.forEach((item, i) => {
    const text = `ㅇ ${item.date ? `(${item.date}) ` : ""}${item.description || ""}`;
    setTNodeText(targets[i], text);
  });
}

const HP_NS = "http://www.hancom.co.kr/hwpml/2011/paragraph";

function paragraphHasTable(p) {
  return p.getElementsByTagNameNS(HP_NS, "tbl").length > 0;
}

// 체크박스 선택지 줄(□/☑)과 그림·표 캡션 줄은 이번 작업 범위 밖(체크박스 상태 반영은 다음에,
// 캡션은 표/그림 자체에 딸린 라벨이라 채워 넣을 케이스 데이터가 없음) — 그대로 둔다.
function isPreservedLine(text) {
  return (
    text.startsWith("□") ||
    text.startsWith("☑") ||
    text.startsWith("<그림") ||
    text.startsWith("<표") ||
    text.startsWith("[표") ||
    text.startsWith("[그림")
  );
}

// headingText로 시작하는 문단부터 nextHeadingText로 시작하는 문단 직전까지에서,
// 체크박스/캡션/표를 제외한 "서술 문단"만 순서대로 모아 반환한다. 템플릿(다른 사건의 실제
// 보고서)엔 이 구간에 표로 끊긴 서술 조각이 여러 개 있는 경우(3.1, 3.4, 3.6 등)가 있는데,
// 표를 건너뛰고 나머지를 전부 한 목록으로 모아서 처리한다.
function collectNarrativeParas(doc, headingText, nextHeadingText) {
  const paragraphs = getSectionParagraphs(doc);
  const headingIdx = paragraphs.findIndex((p) => getParagraphText(p).trim().startsWith(headingText));
  if (headingIdx === -1) return [];
  let endIdx = paragraphs.length;
  for (let i = headingIdx + 1; i < paragraphs.length; i++) {
    if (nextHeadingText && getParagraphText(paragraphs[i]).trim().startsWith(nextHeadingText)) {
      endIdx = i;
      break;
    }
  }
  const result = [];
  for (let i = headingIdx + 1; i < endIdx; i++) {
    const p = paragraphs[i];
    const text = getParagraphText(p).trim();
    if (!text || paragraphHasTable(p) || isPreservedLine(text)) continue;
    result.push(p);
  }
  return result;
}

// narrativeParas 개수와 채워 넣을 lines 개수가 다르면 복제/삭제로 맞춘 뒤 텍스트를 채운다.
// lines가 비어 있으면(케이스 데이터가 아직 없으면) 서술 문단을 전부 지워, 템플릿(다른 사건)의
// 잔여 텍스트가 하나도 남지 않게 한다.
function fillParagraphLines(narrativeParas, lines) {
  if (narrativeParas.length === 0) return;
  if (lines.length === 0) {
    narrativeParas.forEach(removeParagraph);
    return;
  }
  if (lines.length <= narrativeParas.length) {
    for (let k = lines.length; k < narrativeParas.length; k++) removeParagraph(narrativeParas[k]);
    const targets = narrativeParas.slice(0, lines.length);
    lines.forEach((line, k) => setTNodeText(targets[k], line));
  } else {
    const extra = cloneParagraphsAfter(narrativeParas[narrativeParas.length - 1], lines.length - narrativeParas.length);
    const targets = [...narrativeParas, ...extra];
    lines.forEach((line, k) => setTNodeText(targets[k], line));
  }
}

// 자유 서술 텍스트(줄바꿈으로 여러 문단) 한 구간을 채운다 — 1.3/1.4/3.1/3.2/3.3/3.4/3.5/3.6,
// 그리고 아직 케이스 쪽 입력 UI가 없는 2.1/2.2는 content를 빈 문자열로 넘겨 비워낸다.
function fillSectionNarrative(doc, headingText, nextHeadingText, content) {
  const narrativeParas = collectNarrativeParas(doc, headingText, nextHeadingText);
  const lines = (content || "")
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  fillParagraphLines(narrativeParas, lines);
}

// 4.1 현장조사 / 4.2 청취조사 — "ㅇ 항목명" / "- 확인 내용" 쌍이 반복되는 구조라 전용 처리.
function fillFieldSurveySection(doc, headingText, nextHeadingText, items) {
  const narrativeParas = collectNarrativeParas(doc, headingText, nextHeadingText);
  const lines = [];
  (items || []).forEach((item) => {
    lines.push(`ㅇ ${item.label}`);
    lines.push(`- ${(item.answer || "").trim() || "확인되지 않음"}`);
  });
  fillParagraphLines(narrativeParas, lines);
}

// ---- 5장 과학적 기법에 의한 오염원인 추정 (본문 문단, 단일 텍스트) ----
// 템플릿엔 제목 문단 바로 다음에 "검토제외" placeholder 문단 하나만 있어서,
// 1.2 추진 경과처럼 목록을 늘리고 줄일 필요 없이 그 문단 텍스트만 바꿔치기하면 된다.
function fillScientificAnalysis(doc, content) {
  const paragraphs = getSectionParagraphs(doc);
  // 제목 문단이 "5. 과학적 기법에 의한 오염원인 추정 ※ 고려 가능 시"처럼 안내문구까지
  // 한 문단에 붙어있고, 그 다음 빈 문단을 하나 건너뛴 뒤에야 "검토제외" 내용 문단이 나온다.
  const headingIdx = paragraphs.findIndex((p) =>
    getParagraphText(p).trim().startsWith("5. 과학적 기법에 의한 오염원인 추정")
  );
  if (headingIdx === -1) return;
  let targetIdx = headingIdx + 1;
  while (targetIdx < paragraphs.length && !getParagraphText(paragraphs[targetIdx]).trim()) {
    targetIdx++;
  }
  const target = paragraphs[targetIdx];
  if (!target) return;
  setTNodeText(target, (content || "").trim() || "검토제외");
}

// ---- 표2 토양측정망 (고정 구조, 값만 채움) ----
function fillNetwork(table, networkRows, regionGrade) {
  const zone = parseRegionGrade(regionGrade);
  function statsFor(key) {
    const values = networkRows.map((r) => toNumOrNull(r[key])).filter((v) => v !== null);
    return {
      max: values.length ? Math.max(...values) : null,
      avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    };
  }

  function fillBlock(headerRowIdx, keys) {
    keys.forEach((key, i) => {
      const col = i + 1;
      const concern = zone && CONCERN_STANDARDS[key]?.[zone] !== undefined ? formatSum(CONCERN_STANDARDS[key][zone]) : "-";
      setCellText(table, headerRowIdx + 1, col, concern);
      const s = statsFor(key);
      setCellText(table, headerRowIdx + 2, col, s.max !== null ? formatSum(s.max) : "-");
      setCellText(table, headerRowIdx + 3, col, s.avg !== null ? formatSum(s.avg) : "-");
    });
  }

  fillBlock(0, NETWORK_SUBSTANCE_KEYS_BLOCK1);
  fillBlock(4, NETWORK_SUBSTANCE_KEYS_BLOCK2);
}

// 템플릿 표3의 연도 열은 '10~'23(2010~2023) 14개로 고정되어 있어, 실제 데이터의 연도가
// 무엇이든 이 고정된 연도 위치에 맞춰 값을 넣어야 한다(연도를 상대 순서로 채우면 라벨이 틀어짐).
const SURVEY_TEMPLATE_YEARS = Array.from({ length: 14 }, (_, i) => 2010 + i);

// ---- 표3 토양오염실태조사 (물질쌍 가변) ----
// selectedSubstances: 챕터02 "측정항목 선택" 체크박스로 고른 물질만 표에 싣는다.
// 선택된 게 없으면(null 포함) 표 자체를 지운다.
function fillSurvey(table, surveyRows, selectedSubstances) {
  const allKeys = [...NETWORK_SUBSTANCE_KEYS_BLOCK1, ...NETWORK_SUBSTANCE_KEYS_BLOCK2];
  const candidateKeys = selectedSubstances ? allKeys.filter((k) => selectedSubstances.includes(k)) : [];
  const presentKeys = candidateKeys.filter((k) => surveyRows.some((r) => toNumOrNull(r[k]) !== null));

  if (presentKeys.length === 0) {
    removeTable(table);
    return;
  }

  function statsFor(key, year) {
    const values = surveyRows
      .filter((r) => Number(r.survey_year) === year)
      .map((r) => toNumOrNull(r[key]))
      .filter((v) => v !== null);
    return {
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
    };
  }

  const targetKeys = presentKeys.length ? presentKeys : [];
  const templatePairCount = 2;

  if (targetKeys.length > templatePairCount) {
    clonePairsAfter(table, 3, targetKeys.length - templatePairCount);
  } else if (targetKeys.length < templatePairCount) {
    for (let i = 0; i < templatePairCount - targetKeys.length; i++) {
      removePair(table, 1);
    }
  }

  targetKeys.forEach((key, idx) => {
    const label = SUBSTANCE_LABELS.find((l) => findSubstanceKey(l) === key) || key;
    const minValues = [];
    const maxValues = [];
    SURVEY_TEMPLATE_YEARS.forEach((year) => {
      const s = statsFor(key, year);
      minValues.push(s.min !== null ? formatSum(s.min) : "-");
      maxValues.push(s.max !== null ? formatSum(s.max) : "-");
    });
    setSurveyPairText(table, 1 + idx * 2, { substance: label, minValues, maxValues });
  });
}

// ---- 표4 소유·점유 현황 / 표5 공장등록 현황 (가변 행 공통 패턴) ----
function fillVariableRows(table, items, rowMapper, { headerRowIdx = 0 } = {}) {
  const templateDataRowIdx = headerRowIdx + 1;
  const rows = getRows(table);
  const currentDataRowCount = rows.length - 1 - headerRowIdx;

  if (items.length === 0) {
    for (let i = 0; i < currentDataRowCount; i++) removeRow(table, templateDataRowIdx);
    return;
  }

  if (items.length > currentDataRowCount) {
    cloneRowsAfter(table, rows.length - 1, items.length - currentDataRowCount);
  } else if (items.length < currentDataRowCount) {
    for (let i = 0; i < currentDataRowCount - items.length; i++) {
      removeRow(table, templateDataRowIdx);
    }
  }

  items.forEach((item, i) => {
    const rowIdx = templateDataRowIdx + i;
    const values = rowMapper(item, i);
    values.forEach((v, colIdx) => setCellText(table, rowIdx, colIdx, v));
  });
}

function fillOwnership(table, ownershipRows) {
  fillVariableRows(table, ownershipRows, (d) => [
    `${d.acquired_date || "?"} ~ ${d.disposed_date || "현재"}`,
    d.owner_name || "-",
    d.owner_name || "-",
    d.business_type || "-",
  ]);
}

function fillFactoryHistory(table, items) {
  fillVariableRows(table, items, (d, i) => [
    String(i + 1),
    d.approved_date ? d.approved_date.replaceAll("-", "") : "-",
    d.cancelled_date ? d.cancelled_date.replaceAll("-", "") : "-",
    d.company_name || "-",
    d.holding_type || "-",
    d.business_type || "-",
  ]);
}

// 표6(소유권 지분현황)은 헤더가 2행(변동일자/소유권지분/소유자/비고 + 변동원인/성명 또는 명칭)이고
// 데이터가 없어 데이터 행만 전부 제거해 빈 표로 둔다.
function clearOwnershipShare(table) {
  fillVariableRows(table, [], () => [], { headerRowIdx: 1 });
}

// ---- 항공사진 / 현장사진 ----
async function fillPhotoGrid(zip, table, images, labels) {
  const rows = getRows(table);
  let imgIdx = 0;
  let labelIdx = 0;
  for (const row of rows) {
    for (const cell of getCells(row)) {
      const pics = getPics(cell);
      if (pics.length > 0) {
        const img = images[imgIdx];
        imgIdx++;
        if (img) await replaceImage(zip, null, pics[0], img.data, img.type);
        continue;
      }
      if (labels) {
        setTNodeText(cell, labels[labelIdx] || "");
        labelIdx++;
      }
    }
  }
}

// ---- 표11 재산세 등 제출자료 ----
// 템플릿은 "제출자료 하나에 유형 여러 개"를 표현하려고 셀 병합(rowSpan)이 섞여있어서,
// 우리 데이터(제출자료 유형/금액/비고 flat 목록)에 맞게 병합 없는 행(원본 row6) 하나만 남기고
// 나머지 예시 행은 지운 뒤 그 행을 템플릿으로 복제한다.
function prepareCostCapacityTemplate(table) {
  for (let i = 0; i < 3; i++) removeRow(table, 7); // 원본 row7,8,9 제거
  for (let i = 0; i < 5; i++) removeRow(table, 1); // 원본 row1~5 제거, row6(병합 없음)만 남음
}

function fillCostCapacity(table, items) {
  prepareCostCapacityTemplate(table);
  setCaptionText(table, "[표] 재산세 등 제출자료 현황");
  fillVariableRows(table, items, (d) => [d.item_type || "-", "", d.amount || "-", d.note || "-"]);
}

// ---- 표13 종합 기술검토결과 ----
function checklistSummaryLine(judgment, checklistOptions) {
  if (!judgment) return "-";
  const checked = checklistOptions.filter((opt) => judgment.checked?.[opt.key]).map((opt) => opt.label);
  if (judgment.checked?.other && judgment.other_text) checked.push(judgment.other_text);
  return checked.length ? checked.join(", ") : "-";
}

function fillSummaryTable(table, judgments, legalSummary) {
  const rows = [
    { content: "소유·점유·운영 이력", opinion: legalSummary || "-" },
    {
      content: checklistSummaryLine(judgments.soil_assessment, [{ key: "assessment_report", label: "토양환경평가보고서" }]),
      opinion: judgments.soil_assessment?.summary || "※ 판단 내용 미입력",
    },
    {
      content: checklistSummaryLine(judgments.cost_capacity, [
        { key: "property_tax", label: "재산세 납부실적" },
        { key: "asset_valuation", label: "재산평가액 보고서" },
        { key: "debt_assessment", label: "부채정도 평가서" },
      ]),
      opinion: judgments.cost_capacity?.summary || "※ 판단 내용 미입력",
    },
    {
      content: checklistSummaryLine(judgments.access, [
        { key: "aerial_photo", label: "항공사진" },
        { key: "design_drawing", label: "설계도면" },
        { key: "site_plan", label: "배치 평면도" },
        { key: "site_photo", label: "현장사진" },
      ]),
      opinion: judgments.access?.summary || "※ 판단 내용 미입력",
    },
    {
      content: checklistSummaryLine(judgments.agreement, [
        { key: "cleanup_agreement", label: "정화분담 약정서" },
        { key: "cost_agreement", label: "비용분담 합의서" },
      ]),
      opinion: judgments.agreement?.summary || "※ 판단 내용 미입력",
    },
    {
      content: checklistSummaryLine(judgments.management_history, [
        { key: "facility_report", label: "특정토양오염관리대상시설 설치신고서" },
        { key: "hazmat_permit", label: "위험물 제조소·저장소·취급소 설치허가서" },
        { key: "other_permit", label: "기타 환경인허가" },
        { key: "process_evidence", label: "원료, 성분, 구성, 제조공정 등 증빙자료" },
        { key: "slag_test", label: "슬래그 시험성적서" },
        { key: "slag_cert", label: "슬래그 친환경 인증" },
      ]),
      opinion: judgments.management_history?.summary || "※ 판단 내용 미입력",
    },
  ];

  rows.forEach((r, i) => {
    const rowIdx = i + 1; // row0은 헤더
    setCellText(table, rowIdx, 1, r.content);
    setCellText(table, rowIdx, 2, r.opinion);
  });
}

export async function buildReportHwpx(templateBuffer, payload) {
  const {
    caseInfo,
    overview,
    contaminationRows,
    networkRows,
    surveyRows,
    selectedSubstances,
    ownership,
    factoryHistoryItems,
    judgments,
    legalSummary,
    costCapacityItems,
    aerialImages,
    fieldPhotoImages,
    fieldSurvey,
    scientificAnalysis,
  } = payload;

  const { zip, doc } = await loadTemplate(templateBuffer);
  const tables = getTables(doc);

  fillOverview(tables[TBL.OVERVIEW], caseInfo, overview, contaminationRows);
  fillProgress(doc, overview.progressItems || []);
  fillSectionNarrative(doc, "1.3 정화책임자에 대한", "1.4 정화책임자 의견", overview.sido_opinion);
  fillSectionNarrative(doc, "1.4 정화책임자 의견", "2. 토양오염물질", overview.responsible_party_opinion_text);
  fillSectionNarrative(doc, "2.1 대상부지 토양오염 현황", "2.2 인접·주변부지", "");
  fillSectionNarrative(doc, "2.2 인접·주변부지 토양오염 현황", "3. 기술검토 결과", "");
  fillSectionNarrative(doc, "3.1 토양오염관리대상시설", "3.2 토양환경평가", judgments.ownership_lease?.summary);
  fillSectionNarrative(doc, "3.2 토양환경평가의 실시", "3.3 토양정화에 드는", judgments.soil_assessment?.summary);
  fillSectionNarrative(doc, "3.3 토양정화에 드는 비용을", "3.4 토양오염이 발생한", judgments.cost_capacity?.summary);
  fillSectionNarrative(doc, "3.4 토양오염이 발생한 토지로의 출입", "3.5 정화책임자 간의", judgments.access?.summary);
  fillSectionNarrative(doc, "3.5 정화책임자 간의 약정", "3.6 토양오염물질의 관리", judgments.agreement?.summary);
  fillSectionNarrative(doc, "3.6 토양오염물질의 관리 이력", "4. 현장 및 청취조사", judgments.management_history?.summary);
  fillFieldSurveySection(doc, "4.1 현장조사", "4.2 청취조사", fieldSurvey?.field_items);
  fillFieldSurveySection(doc, "4.2 청취조사", "5. 과학적 기법에 의한 오염원인 추정", fieldSurvey?.interview_items);
  fillScientificAnalysis(doc, scientificAnalysis);
  fillNetwork(tables[TBL.NETWORK], networkRows, caseInfo.region_grade);
  fillSurvey(tables[TBL.SURVEY], surveyRows, selectedSubstances ?? null);
  fillOwnership(tables[TBL.OWNERSHIP], ownership.ownershipRows);
  fillFactoryHistory(tables[TBL.FACTORY_HISTORY], factoryHistoryItems);
  clearOwnershipShare(tables[TBL.OWNERSHIP_SHARE]);
  fillCostCapacity(tables[TBL.COST_CAPACITY], costCapacityItems);
  fillSummaryTable(tables[TBL.SUMMARY], judgments, legalSummary);

  const aerial1 = aerialImages.slice(0, 4);
  const aerial2 = aerialImages.slice(4, 8);
  await fillPhotoGrid(zip, tables[TBL.AERIAL_1], aerial1);
  await fillPhotoGrid(zip, tables[TBL.AERIAL_2], aerial2);
  // 현장사진 표는 안건마다 관련 회사 수에 따라 구조(줄 수)가 달라져 자동 채우기가 맞지 않음.
  // 지금은 템플릿 원본 상태 그대로 두고, 보고서 작성자가 한글에서 직접 채움.

  return serialize(zip, doc);
}
