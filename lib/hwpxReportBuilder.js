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
  resetLineSegArray,
  loadHeader,
  writeHeader,
  makeBoldCharPrFactory,
  makeIndentedParaPrFactory,
  makeCharPrNormalizer,
  makeLineSpacingParaPrFactory,
  makeDoubleLineBorderFactory,
  setHeaderBoundaryDoubleLine,
  growTableRows,
  makeAlignParaPrFactory,
  centerHeaderRows,
  fitPicCover,
  insertColumnBefore,
  setColumnWidths,
  getRowWidth,
} from "./hwpxTemplate.js";
import { SUBSTANCE_LABELS, findSubstanceKey, heavyMetalScientificExample } from "./substances.js";
import { CONCERN_STANDARDS, ACTION_STANDARDS, parseRegionGrade } from "./soilStandards.js";
import { ownerPeriodText, occupantPeriodText } from "./currentOwner.js";

const TBL = {
  OVERVIEW: 0,
  SAMPLE_POINT_IMAGE: 1,
  SURROUNDING_IMAGE: 2,
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

// 천 단위 쉼표(예: "1,250")가 있으면 parseFloat가 1로 읽어버려서 먼저 제거한다.
function toNum(v) {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}
function toNumOrNull(v) {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
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
    // 일자 칸에 사용자가 이미 괄호를 넣어서 입력한 경우("(24.6월 ~ 25.12월)")가 있어, 우리가
    // 또 괄호를 씌우면 "((24.6월 ~ 25.12월))"처럼 이중으로 나온다 — 앞뒤 괄호를 먼저 벗겨낸다.
    const date = (item.date || "").trim().replace(/^\(+/, "").replace(/\)+$/, "").trim();
    const text = `ㅇ ${date ? `(${date}) ` : ""}${item.description || ""}`;
    setTNodeText(targets[i], text);
  });
}

const HP_NS = "http://www.hancom.co.kr/hwpml/2011/paragraph";
const HC_NS = "http://www.hancom.co.kr/hwpml/2011/core";

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

// narrativeParas 개수와 채워 넣을 lines 개수가 다르면 맞춘 뒤 텍스트를 채운다(setTNodeText가
// 내부적으로 줄 위치 캐시도 비워준다). 남는 문단은 (지우지 않고) 빈 텍스트로만 비운다 — 문단을
// 통째로 지우면 뒤따르는 표의 캐시된 위치가 실제 내용과 더 크게 어긋나기 때문. 문단 개수는
// 템플릿 그대로 유지한다.
//
// 문단의 paraPrIDRef는 템플릿(다른 사건의 실제 문단)이 원래 쓰던 값을 그대로 물려받는데,
// 그 문단이 원래 번호/글머리 목록 항목이었다면 문단속성에 "첫 줄 내어쓰기"(음수 intent)가
// 걸려있어서 — 우리가 넣은 일반 서술문이 줄바꿈될 때 첫 줄만 정상 위치고 둘째 줄부터 오른쪽으로
// 밀려 보인다(1.3/3.6 등 여러 곳에서 확인됨). paraPrIDRef=0은 이 문서 전체에서 안전하게 쓰이는
// 기본 문단속성(들여쓰기 없음)이라 서술 문단은 전부 이걸로 통일한다.
// 채운 문단 목록(lines와 같은 순서)을 돌려준다.
function fillParagraphLines(narrativeParas, lines) {
  if (narrativeParas.length === 0) return [];
  if (lines.length === 0) {
    narrativeParas.forEach((p) => {
      setTNodeText(p, "");
      p.setAttribute("paraPrIDRef", "0");
    });
    return [];
  }
  let targets;
  if (lines.length <= narrativeParas.length) {
    for (let k = lines.length; k < narrativeParas.length; k++) setTNodeText(narrativeParas[k], "");
    targets = narrativeParas.slice(0, lines.length);
    lines.forEach((line, k) => setTNodeText(targets[k], line));
  } else {
    const extra = cloneParagraphsAfter(narrativeParas[narrativeParas.length - 1], lines.length - narrativeParas.length);
    targets = [...narrativeParas, ...extra];
    lines.forEach((line, k) => setTNodeText(targets[k], line));
    extra.forEach((p) => p.setAttribute("paraPrIDRef", "0"));
  }
  narrativeParas.forEach((p) => p.setAttribute("paraPrIDRef", "0"));
  return targets;
}

// 3.4처럼 "(소제목) 내용" 형식으로 쓰는 항목은 화면 미리보기(ChecklistJudgmentForm의
// headingPreview)와 똑같이 보고서에서도 줄 맨 앞 "(소제목)"을 굵게 하고, 단락 사이 빈 줄도 살린다.
const LEADING_HEADING = /^(\([^)]*\))(.*)$/;

// 빈 줄은 남기되(연속된 빈 줄은 하나로), 맨 앞뒤의 빈 줄은 버린다.
function linesKeepingBlank(content) {
  const lines = [];
  (content || "").split(/\r?\n/).forEach((raw) => {
    const line = stripMarkdownArtifacts(raw.trim());
    if (!line && (lines.length === 0 || lines[lines.length - 1] === "")) return;
    lines.push(line);
  });
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

// 문단의 첫 글자 run을 "(소제목)"(굵게)과 나머지(원래 서식) 두 run으로 나눈다. 굵은 서식은
// 원래 run의 charPr를 복제해 굵게만 켠 것이라 글꼴·크기는 그대로다.
function boldLeadingHeading(p, boldCharPrFor) {
  const t = p.getElementsByTagNameNS(HP_NS, "t")[0];
  if (!t) return;
  const m = (t.textContent || "").match(LEADING_HEADING);
  if (!m) return;
  const run = t.parentNode;
  const doc = p.ownerDocument;
  while (t.firstChild) t.removeChild(t.firstChild);
  t.appendChild(doc.createTextNode(m[1]));
  if (m[2]) {
    const restRun = doc.createElementNS(HP_NS, "hp:run");
    restRun.setAttribute("charPrIDRef", run.getAttribute("charPrIDRef"));
    const restT = doc.createElementNS(HP_NS, "hp:t");
    restT.appendChild(doc.createTextNode(m[2]));
    restRun.appendChild(restT);
    run.parentNode.insertBefore(restRun, run.nextSibling);
  }
  run.setAttribute("charPrIDRef", boldCharPrFor(run.getAttribute("charPrIDRef")));
}

// 템플릿 서술 문단 중 "※ ..." 참고 문단은 8pt 파란 글씨라, 우리 내용이 그 자리에 들어가면 그
// 단락만 작고 파랗게 보인다. "ㅇ"로 시작하는 본문 문단에서 가장 긴 글자 run의 서식을 본문
// 서식으로 보고, 채운 문단 전부를 그 서식으로 맞춘다.
function bodyCharPrOf(paras) {
  let best = null;
  paras
    .filter((p) => getParagraphText(p).trim().startsWith("ㅇ"))
    .forEach((p) => {
      Array.from(p.getElementsByTagNameNS(HP_NS, "run")).forEach((run) => {
        const len = Array.from(run.getElementsByTagNameNS(HP_NS, "t")).reduce((n, t) => n + (t.textContent || "").length, 0);
        if (!best || len > best.len) best = { len, id: run.getAttribute("charPrIDRef") };
      });
    });
  return best?.id ?? null;
}

function fillHeadedSectionNarrative(doc, headingText, nextHeadingText, content, boldCharPrFor) {
  const narrativeParas = collectNarrativeParas(doc, headingText, nextHeadingText);
  const bodyCharPr = bodyCharPrOf(narrativeParas);
  const targets = fillParagraphLines(narrativeParas, linesKeepingBlank(content));
  targets.forEach((p) => {
    const t = p.getElementsByTagNameNS(HP_NS, "t")[0];
    if (bodyCharPr && t) t.parentNode.setAttribute("charPrIDRef", bodyCharPr);
    boldLeadingHeading(p, boldCharPrFor);
  });
}

// 사용자가 문서를 작성/복사하면서 마크다운 서식(**볼드**)이나 빈 줄 대신 쓴 취소선(~~~)
// 표시가 그대로 텍스트로 남아있는 경우가 있었다(예: "**~~~~~~~~~**") — 한글 문서에는 그런
// 서식이 적용되지 않고 문자 그대로 찍혀 보이니 제거한다. "**...**"로 감싼 취소선 구간을
// 먼저 통째로 지우고, 남은 3개 이상 연속된 물결/별표도 각각 지운다.
function stripMarkdownArtifacts(text) {
  if (!text) return text;
  return text
    .replace(/\*{2,}~{3,}\*{2,}/g, "")
    .replace(/~{3,}/g, "")
    .replace(/\*{2,}/g, "")
    .trim();
}

// 자유 서술 텍스트(줄바꿈으로 여러 문단) 한 구간을 채운다 — 1.3/1.4/3.1/3.2/3.3/3.4/3.5/3.6,
// 그리고 아직 케이스 쪽 입력 UI가 없는 2.1/2.2는 content를 빈 문자열로 넘겨 비워낸다.
function fillSectionNarrative(doc, headingText, nextHeadingText, content) {
  const narrativeParas = collectNarrativeParas(doc, headingText, nextHeadingText);
  const lines = (content || "")
    .split(/\r?\n+/)
    .map((s) => stripMarkdownArtifacts(s.trim()))
    .filter(Boolean);
  fillParagraphLines(narrativeParas, lines);
}

// 3.1처럼 구간 중간에 표([표 4])가 있어 서술 문단이 표 위아래로 나뉜 곳에서, 내용을 전부 표 위에 넣는다.
// fillSectionNarrative로 채우면 템플릿 문단 순서대로 앞 몇 줄은 표 위, 나머지는 표 아래로 갈라졌다(사용자 요청:
// "3.1 아래 '-' 줄들을 표 4 위에"). 표 아래 템플릿 서술 문단은 지우되, 첫 문단은 빈 줄로 남겨
// [표 4]와 다음 표([표 5])가 붙어 보이지 않게 한다.
function fillNarrativeAboveFirstTable(doc, headingText, nextHeadingText, content) {
  const narrativeParas = collectNarrativeParas(doc, headingText, nextHeadingText);
  const paragraphs = getSectionParagraphs(doc);
  const headingIdx = paragraphs.findIndex((p) => getParagraphText(p).trim().startsWith(headingText));
  const tableIdx = paragraphs.findIndex((p, i) => i > headingIdx && paragraphHasTable(p));
  const above = narrativeParas.filter((p) => tableIdx === -1 || paragraphs.indexOf(p) < tableIdx);
  const below = narrativeParas.filter((p) => !above.includes(p));
  if (!above.length) {
    fillSectionNarrative(doc, headingText, nextHeadingText, content);
    return;
  }
  below.forEach((p, i) => {
    if (i > 0) return removeParagraph(p);
    setTNodeText(p, "");
    p.setAttribute("paraPrIDRef", "0");
  });
  const lines = (content || "")
    .split(/\r?\n+/)
    .map((s) => stripMarkdownArtifacts(s.trim()))
    .filter(Boolean);
  fillParagraphLines(above, lines);
}

// 2.1/2.2 제목 아래 "□ 토양오염도검사 성적서 ☑ 토양정밀조사보고서 …" 줄을 바꾼다. 이 줄은 글상자(묶음
// 개체) 안 문단이라 collectNarrativeParas가 건너뛰고(isPreservedLine), 앞에 공백 run이 따로 있어
// setTNodeText(첫 run에 씀)를 못 쓴다 — 체크박스 글자가 든 hp:t만 찾아 그 텍스트를 바꾼다.
function setSourceCheckboxLine(doc, headingText, nextHeadingText, line) {
  if (!line) return;
  const paragraphs = getSectionParagraphs(doc);
  const headingIdx = paragraphs.findIndex((p) => getParagraphText(p).trim().startsWith(headingText));
  if (headingIdx === -1) return;
  for (let i = headingIdx + 1; i < paragraphs.length; i++) {
    const text = getParagraphText(paragraphs[i]).trim();
    if (nextHeadingText && text.startsWith(nextHeadingText)) return;
    const t = Array.from(paragraphs[i].getElementsByTagNameNS(HP_NS, "t")).find((n) => /^[□☑]/.test(n.textContent.trim()));
    if (!t) continue;
    while (t.firstChild) t.removeChild(t.firstChild);
    t.appendChild(doc.createTextNode(line));
    resetLineSegArray(t);
    return;
  }
}

// 우리가 채운 서술 문단(fillParagraphLines가 기본 모양 0으로 바꿔 둔 본문 문단) 중 "ㅇ"/"-"로
// 시작하는 줄에 샘플과 같은 내어쓰기 모양을 준다 — "ㅇ"줄은 템플릿의 ㅇ 문단 모양(68), "-"줄은 그걸
// 복제해 왼쪽 여백을 ㅇ 내어쓰기 폭만큼 늘린 모양이라 "ㅇ" 뒤 글자 위치에서 시작한다. 두 모양 모두
// 내어쓰기라 줄이 넘어가도 둘째 줄이 기호 뒤 글자에 맞춰진다.
const BULLET_PARA_PR = "68";
const BULLET_HANG = 1908; // paraPr 68의 내어쓰기 폭(case 단위)
function indentBulletLines(doc, indentedParaPrFor) {
  const dashParaPr = indentedParaPrFor(BULLET_PARA_PR, BULLET_HANG);
  getSectionParagraphs(doc).forEach((p) => {
    if (p.getAttribute("paraPrIDRef") !== "0" || paragraphHasTable(p)) return;
    const text = getParagraphText(p).trimStart();
    if (/^[ㅇ○]\s/.test(text)) p.setAttribute("paraPrIDRef", BULLET_PARA_PR);
    else if (/^-(?!\d)/.test(text)) p.setAttribute("paraPrIDRef", dashParaPr);
  });
}

// 4.1 현장조사 / 4.2 청취조사 — "ㅇ 항목명" / "- 확인 내용" 쌍이 반복되는 구조라 전용 처리.
function fillFieldSurveySection(doc, headingText, nextHeadingText, items) {
  const narrativeParas = collectNarrativeParas(doc, headingText, nextHeadingText);
  const lines = [];
  (items || []).forEach((item) => {
    lines.push(`ㅇ ${stripMarkdownArtifacts(item.label)}`);
    lines.push(`- ${stripMarkdownArtifacts((item.answer || "").trim()) || "확인되지 않음"}`);
  });
  fillParagraphLines(narrativeParas, lines);
}

// headingText 문단 바로 앞에 빈 문단이 없으면 하나 끼워 넣어 앞 섹션과의 간격을 띄운다
// (예: 4.1의 마지막 내용 문단과 4.2 제목 문단 사이에 여백이 전혀 없어서 붙어 보이던 문제).
function insertBlankLineBefore(doc, headingText) {
  const paragraphs = getSectionParagraphs(doc);
  const idx = paragraphs.findIndex((p) => getParagraphText(p).trim().startsWith(headingText));
  if (idx <= 0) return;
  const prev = paragraphs[idx - 1];
  if (!getParagraphText(prev).trim()) return; // 이미 빈 줄이 있으면 그대로 둔다
  const [blank] = cloneParagraphsAfter(prev, 1);
  setTNodeText(blank, "");
  blank.setAttribute("paraPrIDRef", "0");
}

// 1x1 흰색 PNG — 다른 사건의 실제 사진(그림/표 이미지)을 대체할 케이스별 이미지가 아직 없어서,
// 최소한 그 사진이 보이지는 않게 비우는 용도. replaceImage가 이 이미지의 실제 픽셀 크기(1x1)에
// 맞춰 hp:orgSz 등을 같이 고쳐 쓰기 때문에, 큰 사진 자리에 늘어나도 흐릿한 그라데이션이 아니라
// 깨끗한 흰 칸으로 보인다.
const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC",
  "base64"
);

// 다른 사건 템플릿에서, 사진 위에 특정 위치를 가리키려고 직접 그려 넣은 장식용 도형(예:
// 항공사진 표의 "빨간 네모" — 자신들 사진에선 대상부지를 가리켰지만, 사진만 바꿔 끼우면 그
// 도형은 원래 위치·회전 그대로 남아서 새 사진 위 엉뚱한 자리를 가리키게 됨)을 제거한다.
// 체크박스 등 hp:rect로 만든 텍스트박스는 배경/테두리용 rect와 실제 글자를 담는 rect가
// 형제(sibling)로 나뉘어 있어서 "drawText를 담고 있는지"로는 구분이 안 됨(배경용 rect까지
// 같이 지워져 체크박스 테두리가 사라지는 부작용이 있었음) — 대신 실제 leak인 빨간 계열
// 선 색상(#FF0000 등)을 가진 rect만 정확히 골라서 지운다.
function isRedLineColor(hex) {
  if (!hex || hex.length !== 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r >= 180 && g <= 80 && b <= 80;
}

function removeStrayOverlayShapes(doc) {
  // 항공사진의 "빨간 네모"는 hp:rect 하나가 아니라, 네 변을 각각 그은 hp:line 4개를 그룹으로
  // 묶어 표현한 경우도 있었다(실제로 24개 line = 상자 6개). rect/line 둘 다 확인해서 지운다.
  const shapes = [
    ...doc.getElementsByTagNameNS(HP_NS, "rect"),
    ...doc.getElementsByTagNameNS(HP_NS, "line"),
  ];
  shapes.forEach((el) => {
    const lineShape = el.getElementsByTagNameNS(HP_NS, "lineShape")[0];
    const color = lineShape?.getAttribute("color");
    if (isRedLineColor(color) && el.parentNode) el.parentNode.removeChild(el);
  });
}

// 빨간 네모(rect/line)가 사진과 같은 hp:container(묶음 개체)에 형제로 들어있던 경우, 도형만
// 지우면 사진 혼자 그 묶음 안에 남는다. 묶음 컨테이너 자체의 orgSz/curSz는 원래 "사진+빨간
// 네모"를 합친 바운딩 박스 기준으로 잡혀있어서(사진 단독 크기와 다름), 도형을 지운 뒤에도
// 그 낡은 묶음 크기 그대로 남아있으면 한글이 사진 하나를 그 낡은(더 큰) 박스에 맞춰 확대해서
// 그리는 것으로 보인다(실제 사용자 신고로 확인됨: 빨간 네모 제거 후 항공사진이 커져 보임).
// 묶음을 풀어(사진을 컨테이너 자리로 직접 꺼내) 사진 자신의 orgSz/curSz만 기준이 되게 한다.
function ungroupSingleChildContainers(doc) {
  const containers = Array.from(doc.getElementsByTagNameNS(HP_NS, "container"));
  containers.forEach((container) => {
    const groupedChildren = Array.from(container.childNodes).filter(
      (n) => n.nodeType === 1 && n.hasAttribute && n.hasAttribute("groupLevel")
    );
    if (groupedChildren.length !== 1 || groupedChildren[0].localName !== "pic") return;
    const pic = groupedChildren[0];

    // 컨테이너의 표시 크기(hp:sz)도 사진 자신에게 없으면(대부분 그랬음) 같이 옮겨준다 — 이걸
    // 빠뜨리면 사진이 표시 크기 정보 없이 남아 작게(또는 의도와 다르게) 보인다.
    const outMargin = pic.getElementsByTagNameNS(HP_NS, "outMargin")[0];
    const containerSz = container.getElementsByTagNameNS(HP_NS, "sz")[0];
    const picHasSz = pic.getElementsByTagNameNS(HP_NS, "sz").length > 0;
    if (containerSz && !picHasSz) {
      const clonedSz = containerSz.cloneNode(true);
      if (outMargin) pic.insertBefore(clonedSz, outMargin);
      else pic.appendChild(clonedSz);
    }
    const containerPos = container.getElementsByTagNameNS(HP_NS, "pos")[0];
    const picHasPos = pic.getElementsByTagNameNS(HP_NS, "pos").length > 0;
    if (containerPos && !picHasPos) {
      const clonedPos = containerPos.cloneNode(true);
      if (outMargin) pic.insertBefore(clonedPos, outMargin);
      else pic.appendChild(clonedPos);
    }
    ["zOrder", "textWrap", "textFlow"].forEach((attr) => {
      if (container.hasAttribute(attr)) pic.setAttribute(attr, container.getAttribute(attr));
    });
    pic.setAttribute("groupLevel", "0");

    if (container.parentNode) container.parentNode.replaceChild(pic, container);
  });
}

// 항공사진이 작아 보인다는 신고(묶음을 풀면서 표시 크기가 없어진 게 주원인)에 더해, 사용자가
// 아예 더 크게(기존 대비 2~2.5배 정도, 가로세로 4:3 정도) 보고 싶어해서, 표 칸 가로 폭을 꽉
// 채우는 4:3 프레임 안에 실제 업로드된 사진의 원래 비율을 유지한 채(늘리거나 찌그러뜨리지
// 않고) 최대한 크게 넣는다. hp:pic은 treatAsChar(문단 안 인라인 문자 취급)라 행 높이는 한글이
// 사진 크기에 맞춰 자동으로 늘려 그린다 — 현장사진 표도 행 높이를 따로 계산하지 않고 이 방식
// 그대로 잘 표시되고 있어서 같은 방식을 따랐다.
const AERIAL_FRAME_WIDTH_RATIO = 0.96; // 칸 테두리에 사진이 딱 붙지 않게 하는 여유
const AERIAL_FRAME_ASPECT = 4 / 3; // width / height

// 사진마다 비율이 달라(정사각형·납작·세로로 긺) 같은 표 안에서 크기가 제각각이라는 요청으로, 2026-10-22부터는
// 원래 비율대로 줄이는 대신 4:3 프레임을 꽉 채우고 넘치는 가장자리를 가운데 기준으로 잘라낸다(fitPicCover).
function enlargeAerialPhoto(pic, cellWidth) {
  const frameW = Math.round(cellWidth * AERIAL_FRAME_WIDTH_RATIO);
  const frameH = Math.round(frameW / AERIAL_FRAME_ASPECT);
  fitPicCover(pic, frameW, frameH);
}

// 현장 사진 표도 같은 방식으로 칸마다 같은 크기로 맞춘다 — 세로 사진이 칸 왼쪽에 가늘게 찍히던 문제 포함.
// 표가 다음 쪽으로 밀리지 않게 크기는 템플릿 사진 자리(hp:sz) 그대로 쓰고, 그 안을 꽉 채우도록만 자른다.
function fitFieldPhotos(table) {
  if (!table) return;
  getPics(table).forEach((pic) => {
    const sz = pic.getElementsByTagNameNS(HP_NS, "sz")[0];
    const w = sz ? parseInt(sz.getAttribute("width"), 10) : 0;
    const h = sz ? parseInt(sz.getAttribute("height"), 10) : 0;
    if (w && h) fitPicCover(pic, w, h);
  });
}


function enlargeAerialPhotos(tables) {
  [tables[TBL.AERIAL_1], tables[TBL.AERIAL_2]].forEach((table) => {
    if (!table) return;
    getRows(table).forEach((row) => {
      getCells(row).forEach((cell) => {
        const cellSz = cell.getElementsByTagNameNS(HP_NS, "cellSz")[0];
        const cellWidth = cellSz ? parseInt(cellSz.getAttribute("width"), 10) : 0;
        if (!cellWidth) return;
        const pics = getPics(cell);
        if (pics.length) enlargeAerialPhoto(pics[0], cellWidth);
      });
    });
  });
}

// ---- 글꼴 통일 ----
// 템플릿 글꼴이 함초롬돋움·HY헤드라인M·휴먼명조·바탕 등으로 섞여 있고 본문 크기도 8~13pt로 제각각이라는
// 사용자 요청으로, 문서 전체 글꼴을 맑은 고딕으로 바꾸고 본문(표 밖 최상위 문단) 글자는 12pt로 맞춘다.
// 표·그림 캡션도 12pt. 표 안 글자는 칸이 넘치지 않게 표마다 가장 많이 쓰인 크기 하나로 맞춘다.
// 장·절 제목(14pt 이상)과 표지 제목, 글상자(점선 체크박스 줄) 글자는 크기를 유지한다.
const REPORT_FONT = "맑은 고딕";
const BODY_HEIGHT = 1200; // 12pt
const HEADING_MIN_HEIGHT = 1400;
const TABLE_MIN_HEIGHT = 1000; // 10pt
const TABLE_MIN_HEIGHT_WIDE = 900; // 9pt

function unifyFonts(doc, normalize) {
  const sec = doc.documentElement;
  const hasText = (run) => Array.from(run.getElementsByTagNameNS(HP_NS, "t")).some((t) => t.textContent.trim());
  // 글자 위치: 표·그림 캡션("[표 2] …", "<그림> …") / 가장 바깥 표 / 그 밖
  function placeOf(run) {
    let outerTable = null;
    let inCaption = false;
    for (let n = run.parentNode; n && n !== sec; n = n.parentNode) {
      if (n.localName === "caption") inCaption = true;
      if (n.localName === "tbl") outerTable = n;
    }
    return { inCaption, outerTable };
  }

  // 같은 표 안에서도 글자 크기가 제각각이라(예: 1.1 안건 개요 값 칸이 10pt·12pt 섞임) 표마다 가장 많이 쓰인
  // 크기 하나로 맞춘다. 표마다 크기는 다를 수 있다(측정망·실태조사처럼 칸이 많은 표는 작게 유지).
  const counts = new Map();
  const runs = Array.from(doc.getElementsByTagNameNS(HP_NS, "run"));
  runs.forEach((run) => {
    const id = run.getAttribute("charPrIDRef");
    if (id == null || !hasText(run)) return;
    const { inCaption, outerTable } = placeOf(run);
    if (inCaption || !outerTable) return;
    const h = normalize.heightOf(id);
    if (!counts.has(outerTable)) counts.set(outerTable, new Map());
    const m = counts.get(outerTable);
    m.set(h, (m.get(h) || 0) + 1);
  });
  // 템플릿 표 글자가 8~9pt라 작아 보인다는 의견으로 최소 크기를 둔다 — 보통 표는 10pt, 칸이 10개 이상인 넓은 표
  // ([표 2] 측정망·[표 3] 실태조사 등)는 칸이 넘치지 않게 9pt.
  const minHeightOf = (table) => {
    const firstRow = Array.from(table.childNodes).find((n) => n.localName === "tr");
    const cols = firstRow ? Array.from(firstRow.childNodes).filter((n) => n.localName === "tc").length : 0;
    return cols >= 10 ? TABLE_MIN_HEIGHT_WIDE : TABLE_MIN_HEIGHT;
  };
  const tableHeight = new Map();
  counts.forEach((m, table) => {
    const common = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    tableHeight.set(table, Math.max(common, minHeightOf(table)));
  });

  runs.forEach((run) => {
    const baseId = run.getAttribute("charPrIDRef");
    if (baseId == null) return;
    const p = run.parentNode;
    const { inCaption, outerTable } = placeOf(run);
    let target = null;
    if (hasText(run)) {
      if (inCaption) target = BODY_HEIGHT;
      else if (outerTable) target = tableHeight.get(outerTable) ?? null;
      else if (p?.localName === "p" && p.parentNode === sec && normalize.heightOf(baseId) < HEADING_MIN_HEIGHT) target = BODY_HEIGHT;
    }
    if (target && normalize.heightOf(baseId) !== target) {
      run.setAttribute("charPrIDRef", normalize(baseId, target));
      // 글자 크기가 바뀌면 줄 위치 캐시(linesegarray)가 예전 크기 기준이라 줄이 겹쳐 보인다 — 비워서 한글이 다시 계산하게
      const segs = p?.getElementsByTagNameNS(HP_NS, "linesegarray")[0];
      if (segs) while (segs.firstChild) segs.removeChild(segs.firstChild);
    } else {
      run.setAttribute("charPrIDRef", normalize(baseId));
    }
  });
}

// "그림 하나"짜리 자리에 쓸 사진 하나를 고른다. export-report의 fetchImages는(항공사진처럼
// 연도순으로 정렬하는 경우가 아니면) uploaded_at 오름차순(오래된 것부터)으로 내려주는데, 이런
// 단일 이미지 자리는 재캡처/재업로드로 갱신하는 게 자연스러워서 배열의 마지막(가장 최근 올린
// 것)을 써야 한다 — images[0](가장 오래된 것)을 쓰면 다시 캡처해도 이전 캡처가 계속 남아있게
// 됨(실제로 오염현황 테이블 재캡처 후에도 안 바뀌는 문제로 확인됨).
function latestImage(images) {
  return images && images.length ? images[images.length - 1] : null;
}

// ---- [표 1] 오염면적 및 오염범위(총괄) — 화면 캡처 대신 실제 데이터로 만드는 네이티브 표 ----
// html2canvas로 오염현황 테이블 화면을 캡처하는 방식은 이 표처럼 2단 헤더(rowSpan)가 섞인
// 표에서 렌더링이 계속 불안정했다(제목줄이 잘리거나 눌림, foreignObjectRendering으로 바꿔봤더니
// 아예 안 보이는 부작용까지 있었음 — 사용자가 반복 확인). 대신 contaminationRows 데이터로
// 진짜 한글 표를 새로 만들어 넣는다 — 캡처가 아니라서 항상 정확하게 보인다. 테두리/글꼴/정렬
// 스타일 참조 ID는 전부 템플릿에 이미 있는 표6(OWNERSHIP_SHARE, 2단 헤더 구조가 있는 표)의
// 셀을 복제해서 재사용한다 — 직접 새 ID를 만들면 header.xml에 정의가 없어 손상 위험이 있다.
function toNumC(v) {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}
function fmtNumC(n) {
  return Number(Math.round(n * 100) / 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}
function summarizeContamGroup(items) {
  let concern = 0,
    action = 0,
    area = 0,
    volume = 0,
    maxConc = null,
    minStart = null,
    maxEnd = null;
  items.forEach((d) => {
    concern += toNumC(d.concern_standard);
    action += toNumC(d.action_standard);
    area += toNumC(d.area);
    volume += toNumC(d.volume);
    if (d.max_concentration !== undefined && d.max_concentration !== "") {
      const c = toNumC(d.max_concentration);
      if (maxConc === null || c > maxConc) maxConc = c;
    }
    if (d.depth_start !== undefined && d.depth_start !== "") {
      const s = toNumC(d.depth_start);
      if (minStart === null || s < minStart) minStart = s;
    }
    if (d.depth_end !== undefined && d.depth_end !== "") {
      const e = toNumC(d.depth_end);
      if (maxEnd === null || e > maxEnd) maxEnd = e;
    }
  });
  return { concern, action, area, volume, maxConc, minStart, maxEnd };
}

// 표6의 sz.width(48681, 페이지 usable width)에 맞춰 9개 칸 폭을 비례 배분(원본 화면 표의
// px 비율: 115,80,72,72,108,108,117,110,100 그대로 스케일업).
const CONTAM_COLS = [
  { key: "contaminant", width: 6347 }, // 오염물질
  { key: "depth", width: 4415 }, // 심도
  { key: "depth_start", width: 3974 }, // 시작 깊이
  { key: "depth_end", width: 3974 }, // 끝 깊이
  { key: "concern_standard", width: 5961 }, // 우려기준
  { key: "action_standard", width: 5961 }, // 대책기준
  { key: "max_concentration", width: 6459 }, // 최고농도
  { key: "area", width: 6071 }, // 오염면적
  { key: "volume", width: 5521 }, // 오염량
];
const CONTAM_ROW_H = 1500;

function buildContaminationTable(doc, templateTable, contaminationRows) {
  const tplRows = getRows(templateTable);
  const headerTc = getCells(tplRows[0])[0]; // 표6 헤더 셀(테두리/글자 스타일 원본)
  const dataTc = getCells(tplRows[2])[1]; // 표6 데이터 셀(가운데 정렬 스타일 원본)

  function positionCell(tc, { colAddr, rowAddr, colSpan, rowSpan, width, height }) {
    const addr = tc.getElementsByTagNameNS(HP_NS, "cellAddr")[0];
    addr.setAttribute("colAddr", String(colAddr));
    addr.setAttribute("rowAddr", String(rowAddr));
    const span = tc.getElementsByTagNameNS(HP_NS, "cellSpan")[0];
    span.setAttribute("colSpan", String(colSpan));
    span.setAttribute("rowSpan", String(rowSpan));
    const sz = tc.getElementsByTagNameNS(HP_NS, "cellSz")[0];
    sz.setAttribute("width", String(width));
    sz.setAttribute("height", String(height));
  }

  function makeCell(template, { text, colAddr, rowAddr, colSpan = 1, rowSpan = 1, width, height }) {
    const tc = template.cloneNode(true);
    positionCell(tc, { colAddr, rowAddr, colSpan, rowSpan, width, height });
    const p = tc.getElementsByTagNameNS(HP_NS, "p")[0];
    p.setAttribute("id", "0");
    setTNodeText(tc, text ?? "");
    return tc;
  }

  // "최고농도(mg/kg)"처럼 라벨+단위가 붙은 헤더는 화면(Module1Table)에서도 두 줄로 나눠
  // 보여주는데, 표1 표에서도 한 줄에 붙여 쓰면 좁은 칸에 글자가 빡빡해 보인다 — 셀 안에
  // 문단(hp:p)을 하나 더 만들어(clone) 라벨/단위를 각각 다른 줄에 넣는다.
  function makeTwoLineCell(template, { line1, line2, colAddr, rowAddr, colSpan = 1, rowSpan = 1, width, height }) {
    const tc = template.cloneNode(true);
    positionCell(tc, { colAddr, rowAddr, colSpan, rowSpan, width, height });
    tc.getElementsByTagNameNS(HP_NS, "p")[0].setAttribute("id", "0");
    splitCellIntoTwoLines(tc, line1, line2);
    return tc;
  }
  function makeRow(cells) {
    const tr = doc.createElementNS(HP_NS, "hp:tr");
    cells.forEach((c) => tr.appendChild(c));
    return tr;
  }
  const colW = (i) => CONTAM_COLS[i].width;

  const trs = [];
  let rowAddr = 0;

  trs.push(
    makeRow([
      makeCell(headerTc, { text: "오염물질", colAddr: 0, rowAddr, rowSpan: 2, width: colW(0), height: CONTAM_ROW_H * 2 }),
      makeCell(headerTc, { text: "심도", colAddr: 1, rowAddr, rowSpan: 2, width: colW(1), height: CONTAM_ROW_H * 2 }),
      makeCell(headerTc, { text: "깊이(m)", colAddr: 2, rowAddr, colSpan: 2, width: colW(2) + colW(3), height: CONTAM_ROW_H }),
      makeCell(headerTc, { text: "초과내역(시료수)", colAddr: 4, rowAddr, colSpan: 2, width: colW(4) + colW(5), height: CONTAM_ROW_H }),
      makeTwoLineCell(headerTc, { line1: "최고농도", line2: "(mg/kg)", colAddr: 6, rowAddr, rowSpan: 2, width: colW(6), height: CONTAM_ROW_H * 2 }),
      makeTwoLineCell(headerTc, { line1: "오염면적", line2: "(m²)", colAddr: 7, rowAddr, rowSpan: 2, width: colW(7), height: CONTAM_ROW_H * 2 }),
      makeTwoLineCell(headerTc, { line1: "오염량", line2: "(m³)", colAddr: 8, rowAddr, rowSpan: 2, width: colW(8), height: CONTAM_ROW_H * 2 }),
    ])
  );
  rowAddr++;
  trs.push(
    makeRow([
      makeCell(headerTc, { text: "시작 깊이", colAddr: 2, rowAddr, width: colW(2), height: CONTAM_ROW_H }),
      makeCell(headerTc, { text: "끝 깊이", colAddr: 3, rowAddr, width: colW(3), height: CONTAM_ROW_H }),
      makeCell(headerTc, { text: "우려기준", colAddr: 4, rowAddr, width: colW(4), height: CONTAM_ROW_H }),
      makeCell(headerTc, { text: "대책기준", colAddr: 5, rowAddr, width: colW(5), height: CONTAM_ROW_H }),
    ])
  );
  rowAddr++;

  const groups = [];
  const groupIndex = {};
  contaminationRows.forEach((d) => {
    const name = d.contaminant || "";
    if (!(name in groupIndex)) {
      groupIndex[name] = groups.length;
      groups.push({ name, items: [] });
    }
    groups[groupIndex[name]].items.push(d);
  });

  groups.forEach((group) => {
    group.items.forEach((d, i) => {
      const cells = [];
      if (i === 0) {
        cells.push(
          makeCell(dataTc, {
            text: group.name,
            colAddr: 0,
            rowAddr,
            rowSpan: group.items.length + 1,
            width: colW(0),
            height: CONTAM_ROW_H * (group.items.length + 1),
          })
        );
      }
      cells.push(makeCell(dataTc, { text: d.depth || "", colAddr: 1, rowAddr, width: colW(1), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: d.depth_start || "", colAddr: 2, rowAddr, width: colW(2), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: d.depth_end ? `~ ${d.depth_end}` : "", colAddr: 3, rowAddr, width: colW(3), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: d.concern_standard || "", colAddr: 4, rowAddr, width: colW(4), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: d.action_standard || "", colAddr: 5, rowAddr, width: colW(5), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: d.max_concentration || "", colAddr: 6, rowAddr, width: colW(6), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: "-", colAddr: 7, rowAddr, width: colW(7), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: "-", colAddr: 8, rowAddr, width: colW(8), height: CONTAM_ROW_H }));
      trs.push(makeRow(cells));
      rowAddr++;
    });

    const s = summarizeContamGroup(group.items);
    const firstRow = group.items[0] || {};
    const depthRange = s.minStart !== null && s.maxEnd !== null ? `${s.minStart}-${s.maxEnd}` : "-";
    trs.push(
      makeRow([
        makeCell(dataTc, { text: "합계", colAddr: 1, rowAddr, width: colW(1), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: depthRange, colAddr: 2, rowAddr, colSpan: 2, width: colW(2) + colW(3), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: fmtNumC(s.concern), colAddr: 4, rowAddr, width: colW(4), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: fmtNumC(s.action), colAddr: 5, rowAddr, width: colW(5), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: s.maxConc !== null ? fmtNumC(s.maxConc) : "-", colAddr: 6, rowAddr, width: colW(6), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: firstRow.area_total || "", colAddr: 7, rowAddr, width: colW(7), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: fmtNumC(s.volume), colAddr: 8, rowAddr, width: colW(8), height: CONTAM_ROW_H }),
      ])
    );
    rowAddr++;
  });

  if (groups.length > 1) {
    const depthGroups = [];
    const depthGroupIndex = {};
    contaminationRows.forEach((d) => {
      const label = d.depth || "";
      if (!(label in depthGroupIndex)) {
        depthGroupIndex[label] = depthGroups.length;
        depthGroups.push({ label, items: [] });
      }
      depthGroups[depthGroupIndex[label]].items.push(d);
    });

    depthGroups.forEach((dg, i) => {
      const ds = summarizeContamGroup(dg.items);
      const dRange = ds.minStart !== null && ds.maxEnd !== null ? `${ds.minStart}-${ds.maxEnd}` : "-";
      const cells = [];
      if (i === 0) {
        cells.push(
          makeCell(dataTc, {
            text: "종합",
            colAddr: 0,
            rowAddr,
            rowSpan: depthGroups.length + 1,
            width: colW(0),
            height: CONTAM_ROW_H * (depthGroups.length + 1),
          })
        );
      }
      cells.push(makeCell(dataTc, { text: dg.label || "-", colAddr: 1, rowAddr, width: colW(1), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: dRange, colAddr: 2, rowAddr, colSpan: 2, width: colW(2) + colW(3), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: fmtNumC(ds.concern), colAddr: 4, rowAddr, width: colW(4), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: fmtNumC(ds.action), colAddr: 5, rowAddr, width: colW(5), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: "-", colAddr: 6, rowAddr, width: colW(6), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: fmtNumC(ds.area), colAddr: 7, rowAddr, width: colW(7), height: CONTAM_ROW_H }));
      cells.push(makeCell(dataTc, { text: fmtNumC(ds.volume), colAddr: 8, rowAddr, width: colW(8), height: CONTAM_ROW_H }));
      trs.push(makeRow(cells));
      rowAddr++;
    });

    const grand = summarizeContamGroup(contaminationRows);
    const grandAreaTotal = groups.reduce((sum, g) => sum + toNumC(g.items[0]?.area_total), 0);
    const grandRange = grand.minStart !== null && grand.maxEnd !== null ? `${grand.minStart}-${grand.maxEnd}` : "-";
    // "종합" 라벨 셀의 rowSpan(depthGroups.length+1)이 이 합계 행의 0번 칸까지 이미 덮고
    // 있어서(화면 표에서도 rowSpan이 그렇게 걸림), 이 행은 1번 칸("합계")부터 시작한다 —
    // 0번 칸을 또 채우면 같은 칸이 두 번 채워져 표가 깨진다.
    trs.push(
      makeRow([
        makeCell(dataTc, { text: "합계", colAddr: 1, rowAddr, width: colW(1), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: grandRange, colAddr: 2, rowAddr, colSpan: 2, width: colW(2) + colW(3), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: fmtNumC(grand.concern), colAddr: 4, rowAddr, width: colW(4), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: fmtNumC(grand.action), colAddr: 5, rowAddr, width: colW(5), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: "-", colAddr: 6, rowAddr, width: colW(6), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: fmtNumC(grandAreaTotal), colAddr: 7, rowAddr, width: colW(7), height: CONTAM_ROW_H }),
        makeCell(dataTc, { text: fmtNumC(grand.volume), colAddr: 8, rowAddr, width: colW(8), height: CONTAM_ROW_H }),
      ])
    );
    rowAddr++;
  }

  const newTbl = templateTable.cloneNode(true);
  newTbl.setAttribute("id", String(1000000000 + Math.floor(Math.random() * 900000000)));
  newTbl.setAttribute("rowCnt", String(trs.length));
  newTbl.setAttribute("colCnt", "9");
  Array.from(newTbl.getElementsByTagNameNS(HP_NS, "tr")).forEach((tr) => newTbl.removeChild(tr));
  const tblSz = newTbl.getElementsByTagNameNS(HP_NS, "sz")[0];
  if (tblSz) tblSz.setAttribute("height", String(CONTAM_ROW_H * trs.length));
  trs.forEach((tr) => newTbl.appendChild(tr));
  return newTbl;
}

// "[표 1] 오염면적 및 오염범위(총괄)" 자리의 그림을 실제 오염현황 데이터로 만든 표로 바꾼다.
// 데이터가 없으면(케이스에 오염물질을 아직 안 넣었으면) 표를 만들 수 없으니 기존처럼 빈
// 그림으로 비워둔다.
async function fillContaminationStatusTable(zip, doc, tableStyleSource, contaminationRows) {
  const paragraphs = getSectionParagraphs(doc);
  const target = paragraphs.find((p) => getParagraphText(p).trim().startsWith("[표 1] 오염면적"));
  if (!target) return;
  const pic = getPics(target)[0];
  if (!pic) return;

  if (!contaminationRows || contaminationRows.length === 0) {
    await replaceImage(zip, null, pic, BLANK_PNG, "png");
    return;
  }

  // "[표 1] 오염면적 및 오염범위(총괄)" 캡션은 문단의 별도 텍스트가 아니라 그림(hp:pic) 자신의
  // hp:caption 안에 들어있다 — 그림을 통째로 지우면 이 캡션도 같이 사라지므로, 새 표에 그대로
  // 옮겨준다(setCaptionText가 표의 caption 텍스트를 바꿔줌).
  const picCaption = pic.getElementsByTagNameNS(HP_NS, "caption")[0];
  const captionText = picCaption ? getParagraphText(picCaption).trim() : "";

  const newTable = buildContaminationTable(doc, tableStyleSource, contaminationRows);
  if (captionText) setCaptionText(newTable, captionText);
  pic.parentNode.replaceChild(newTable, pic);
  return newTable;
}

// 2장 표들([표 1] 오염면적, [표 2] 측정망, [표 3] 실태조사): 내용 칸이 좁아 답답해 보이고 제목 줄과
// 내용 줄이 잘 구분되지 않는다는 요청으로, 내용 줄 높이를 늘리고 제목 줄 바로 아래 선을 이중선으로 한다.
// [표 2]는 "측정항목" 제목 줄이 두 묶음(0행·4행)이라 각각 그 아래에 이중선을 긋는다.
const DATA_ROW_GROW = 1.3;

// 표 캡션 "[표 2] 토양측정망 조사결과 ⋯(공백 여러 개)⋯ (단위 : mg/kg)"는 공백으로 단위를 오른쪽에 밀어 둔
// 한 줄짜리라, 캡션 글자를 12pt로 키우자 줄이 넘쳐 단위가 다음 줄 왼쪽으로 떨어졌다. 단위를 따로
// 오른쪽 정렬 문단으로 떼어 내 표 바로 위 오른쪽에 오게 한다.
const UNIT_CAPTION_RE = /^(.*?\S)\s{2,}(\(단위[^)]*\))\s*$/;

function splitUnitCaptions(doc, alignFor) {
  Array.from(doc.getElementsByTagNameNS(HP_NS, "caption")).forEach((caption) => {
    Array.from(caption.getElementsByTagNameNS(HP_NS, "p")).forEach((p) => {
      const m = getParagraphText(p).match(UNIT_CAPTION_RE);
      if (!m) return;
      const unitP = p.cloneNode(true);
      setParagraphOnlyText(p, m[1]);
      setParagraphOnlyText(unitP, m[2]);
      const id = unitP.getAttribute("paraPrIDRef");
      if (id != null) unitP.setAttribute("paraPrIDRef", alignFor(id, "RIGHT"));
      p.parentNode.insertBefore(unitP, p.nextSibling);
    });
  });
}

// 문단의 첫 글자 칸에 text만 남기고 나머지 글자 칸은 비운다(줄 위치 캐시도 비움).
function setParagraphOnlyText(p, text) {
  const ts = Array.from(p.getElementsByTagNameNS(HP_NS, "t"));
  if (!ts.length) return;
  ts.forEach((t, i) => {
    while (t.firstChild) t.removeChild(t.firstChild);
    if (i === 0) t.appendChild(t.ownerDocument.createTextNode(text));
  });
  const segs = p.getElementsByTagNameNS(HP_NS, "linesegarray")[0];
  if (segs) while (segs.firstChild) segs.removeChild(segs.firstChild);
}

function styleDataTables(contamTable, networkTable, surveyTable, doubleLineFor) {
  if (contamTable) {
    setHeaderBoundaryDoubleLine(contamTable, 2, doubleLineFor); // 제목 2줄(깊이·초과내역 하위 칸)
    growTableRows(contamTable, (r) => r >= 2, DATA_ROW_GROW);
  }
  if (networkTable) {
    setHeaderBoundaryDoubleLine(networkTable, 1, doubleLineFor);
    setHeaderBoundaryDoubleLine(networkTable, 5, doubleLineFor);
    growTableRows(networkTable, (r) => r !== 0 && r !== 4, DATA_ROW_GROW);
  }
  if (surveyTable?.parentNode) {
    setHeaderBoundaryDoubleLine(surveyTable, 1, doubleLineFor);
    growTableRows(surveyTable, (r) => r >= 1, DATA_ROW_GROW);
  }
}

// table 안의 첫 사진을 케이스에 올라온 최신 사진으로 바꾸고, 없으면 빈 이미지로 비운다.
// 2.1/2.2처럼 "그림 하나"짜리 1x1 이미지 프레임 표에 쓴다.
async function fillOrBlankTableImage(zip, table, images) {
  if (!table) return;
  const rows = getRows(table);
  const cell = rows[0] && getCells(rows[0])[0];
  const pic = cell && getPics(cell)[0];
  if (!pic) return;
  const img = latestImage(images);
  if (img) await replaceImage(zip, null, pic, img.data, img.type);
  else await replaceImage(zip, null, pic, BLANK_PNG, "png");
}

// 문단에 직접 박힌 그림(예: [표 1] 오염현황 캡처, 3.4 배치도면)의 표시 높이를, 원래 프레임의
// 가로폭은 유지한 채 실제 사진의 가로세로 비율에 맞게 다시 계산한다. 템플릿의 원래 프레임은
// 다른 사건의(대개 다른 비율의) 사진 기준으로 잡힌 크기라, 그대로 두면 지금 사진이 그 비율에
// 안 맞아 세로로 눌리거나 늘어나 보인다(사용자 확인: "그림을 보고서 크기에 맞게 늘려져 있어서
// 깔끔한 맛이 없어"). hp:pic은 treatAsChar라 높이가 늘어나도 한글이 자동으로 문단 줄바꿈에
// 맞춰 배치한다(항공사진 확대 때와 동일한 근거).
function fitParagraphImageToWidth(pic) {
  const sz = pic.getElementsByTagNameNS(HP_NS, "sz")[0];
  const orgSz = pic.getElementsByTagNameNS(HP_NS, "orgSz")[0];
  if (!sz || !orgSz) return;
  const frameW = parseInt(sz.getAttribute("width"), 10);
  const orgW = parseInt(orgSz.getAttribute("width"), 10);
  const orgH = parseInt(orgSz.getAttribute("height"), 10);
  if (!frameW || !orgW || !orgH) return;

  const finalW = frameW;
  const finalH = Math.max(1, Math.round((frameW * orgH) / orgW));
  sz.setAttribute("width", String(finalW));
  sz.setAttribute("height", String(finalH));

  const curSz = pic.getElementsByTagNameNS(HP_NS, "curSz")[0];
  if (curSz) {
    curSz.setAttribute("width", String(finalW));
    curSz.setAttribute("height", String(finalH));
  }

  const scaMatrix = pic.getElementsByTagNameNS(HP_NS, "renderingInfo")[0]?.getElementsByTagNameNS(HC_NS, "scaMatrix")[0];
  if (scaMatrix) {
    scaMatrix.setAttribute("e1", String(finalW / orgW));
    scaMatrix.setAttribute("e2", "0");
    scaMatrix.setAttribute("e3", "0");
    scaMatrix.setAttribute("e4", "0");
    scaMatrix.setAttribute("e5", String(finalH / orgH));
    scaMatrix.setAttribute("e6", "0");
  }
}

// 표로 안 감싼 문단에 직접 박힌 그림(3.4 배치도면)도 같은 방식으로 케이스의 최신 사진으로 바꾼다.
async function fillOrBlankParagraphImage(zip, doc, headingText, images) {
  const paragraphs = getSectionParagraphs(doc);
  const target = paragraphs.find((p) => getParagraphText(p).trim().startsWith(headingText));
  if (!target) return;
  const pic = getPics(target)[0];
  if (!pic) return;
  const img = latestImage(images);
  if (img) {
    await replaceImage(zip, null, pic, img.data, img.type);
    fitParagraphImageToWidth(pic);
  } else {
    await replaceImage(zip, null, pic, BLANK_PNG, "png");
  }
}

// [표 4] 바로 아래에 소유·점유 타임라인 그림(6장 통합 타임라인, 항공사진 줄 제외)을 넣는다. 템플릿에는 이
// 자리의 그림이 없어서, 3.4 배치도면 그림 문단(그림 + 아래 캡션, 본문 폭)을 미리 복제해 둔 것(picParaSource)을
// 쓴다. 복제본이라 그림 id와 화면 위치 캐시(lineseg)를 새로 매기고, 그림 비율에 맞게 높이를 다시 잡는다.
// 그림이 없으면(타임라인에 막대가 없거나 GET으로 받은 경우) 아무것도 넣지 않는다.
// ---- [표 3] 실태조사 표 아래 작은 글씨 주석 (화면 실태조사 표 위 안내와 같은 내용) ----
// noteSource: 템플릿의 "※ ..." 작은 글씨 주석 문단(채우기 전에 복제해 둔 것)
function insertSurveyNote(surveyTable, noteSource, surveyRows, regionGrade) {
  if (!noteSource || !surveyTable?.parentNode) return; // 선택한 물질이 없어 표를 지웠으면 주석도 없다
  let tablePara = surveyTable;
  while (tablePara && !(tablePara.localName === "p" && tablePara.parentNode?.localName === "sec")) {
    tablePara = tablePara.parentNode;
  }
  if (!tablePara) return;
  const zone = parseRegionGrade(regionGrade);
  const para = noteSource.cloneNode(true);
  para.setAttribute("id", "0");
  Array.from(para.getElementsByTagNameNS(HP_NS, "linesegarray")).forEach((l) => l.parentNode.removeChild(l));
  setTNodeText(
    para,
    `※ 지점 ${surveyRows.length}개 · 우려기준 기준 지역: ${zone ? `${zone}지역 (기준 초과 값은 빨간 굵은 글씨)` : "미지정"}`
  );
  tablePara.parentNode.insertBefore(para, tablePara.nextSibling);
}

const TIMELINE_CAPTION = "<그림> 대상부지 소유·점유 이력";

async function insertOwnershipTimeline(zip, doc, ownershipTable, picParaSource, image) {
  if (!image || !picParaSource || !ownershipTable?.parentNode) return;
  let tablePara = ownershipTable;
  while (tablePara && !(tablePara.localName === "p" && tablePara.parentNode?.localName === "sec")) {
    tablePara = tablePara.parentNode;
  }
  if (!tablePara) return;

  const para = picParaSource.cloneNode(true);
  para.setAttribute("id", "0");
  Array.from(para.getElementsByTagNameNS(HP_NS, "linesegarray")).forEach((l) => l.parentNode.removeChild(l));
  const pic = getPics(para)[0];
  if (!pic) return;
  const maxZ = Math.max(0, ...Array.from(doc.getElementsByTagNameNS(HP_NS, "*")).map((n) => Number(n.getAttribute("zOrder")) || 0));
  pic.setAttribute("zOrder", String(maxZ + 1));
  pic.setAttribute("id", String(1900000000 + Math.floor(Math.random() * 100000000)));
  pic.setAttribute("instid", String(100000000 + Math.floor(Math.random() * 100000000)));
  const captionPara = pic.getElementsByTagNameNS(HP_NS, "caption")[0]?.getElementsByTagNameNS(HP_NS, "p")[0];
  if (captionPara) setTNodeText(captionPara, TIMELINE_CAPTION);

  // 그림 상자를 위 [표 4]와 같은 폭·같은 시작 위치로: 표 문단의 문단 모양(들여쓰기)을 쓰고 폭을 표 폭에 맞춘다.
  // 테두리는 그림(PNG)에 그려져 있다(drawOwnershipTimelinePng).
  para.setAttribute("paraPrIDRef", tablePara.getAttribute("paraPrIDRef"));
  const tableWidth = ownershipTable.getElementsByTagNameNS(HP_NS, "sz")[0]?.getAttribute("width") || String(getRowWidth(ownershipTable));
  pic.getElementsByTagNameNS(HP_NS, "sz")[0]?.setAttribute("width", tableWidth);
  pic.getElementsByTagNameNS(HP_NS, "caption")[0]?.setAttribute("lastWidth", tableWidth);

  tablePara.parentNode.insertBefore(para, tablePara.nextSibling);
  await replaceImage(zip, null, pic, image.data, image.type);
  fitParagraphImageToWidth(pic);
  const curSz = pic.getElementsByTagNameNS(HP_NS, "curSz")[0];
  const rotation = pic.getElementsByTagNameNS(HP_NS, "rotationInfo")[0];
  if (curSz && rotation) {
    rotation.setAttribute("centerX", String(Math.round(Number(curSz.getAttribute("width")) / 2)));
    rotation.setAttribute("centerY", String(Math.round(Number(curSz.getAttribute("height")) / 2)));
  }
}

// 체크박스 선택지 줄의 "기타( ... )"류 괄호 안 내용은 이번에 체크 상태 자체는 손대지 않기로
// 했지만, 괄호 안에 다른 사건의 실제 회사명 등이 그대로 박혀있는 경우(예: "기타
// 환경인허가(파랑돌 폐수배출시설 설치신고증명서)")가 있어 그 부분만 비운다.
function sanitizeCheckboxAnnotations(doc) {
  const allT = Array.from(doc.getElementsByTagNameNS(HP_NS, "t"));
  const re = /(기타[^()]*)\(([^)]*)\)/g;
  allT.forEach((t) => {
    const text = t.textContent;
    if (!text || !text.includes("기타")) return;
    re.lastIndex = 0;
    if (!re.test(text)) return;
    re.lastIndex = 0;
    const cleaned = text.replace(re, (_m, pre) => `${pre}()`);
    if (cleaned === text) return;
    while (t.firstChild) t.removeChild(t.firstChild);
    t.appendChild(t.ownerDocument.createTextNode(cleaned));
    // 텍스트를 줄였는데 줄 위치 캐시(hp:linesegarray)를 그대로 두면, 예전(더 긴) 텍스트 기준
    // 위치 정보가 남아 뒤따르는 내용과 겹쳐 보인다 — 다른 문단 편집과 동일하게 초기화해준다.
    resetLineSegArray(t);
  });
}

// ---- 5장 과학적 기법에 의한 오염원인 추정 (본문 문단, 단일 텍스트) ----
// 템플릿엔 제목 문단 바로 다음에 "검토제외" placeholder 문단 하나만 있어서,
// 1.2 추진 경과처럼 목록을 늘리고 줄일 필요 없이 그 문단 텍스트만 바꿔치기하면 된다.
// 비워 두면 "검토제외"를, 오염물질이 중금속뿐이면 그 물질 이름을 넣은 "예시)" 문구를 넣는다.
// bodyStyle: 템플릿 4.2 본문("ㅇ ...") 문단의 {paraPr, charPr} — 4.2를 채우기 전에 미리 읽어 둔 것.
function fillScientificAnalysis(doc, content, contaminationRows, bodyStyle) {
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
  const fallback =
    heavyMetalScientificExample(contaminationRows.map((d) => d.contaminant)) || "검토제외";
  const text = stripMarkdownArtifacts((content || "").trim()) || fallback;
  setTNodeText(target, text);
  // 템플릿의 "검토제외" 자리는 크고 굵은 글씨라, 문장을 넣을 땐 바로 앞 4.2 본문("ㅇ ..." 문단)과 같은 모양으로 맞춘다
  if (text === "검토제외" || !bodyStyle?.charPr) return;
  target.setAttribute("paraPrIDRef", bodyStyle.paraPr);
  Array.from(target.getElementsByTagNameNS(HP_NS, "run")).forEach((run) => run.setAttribute("charPrIDRef", bodyStyle.charPr));
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
// 선택된 게 없으면(null 포함) 표 자체를 지운다. 안건 지역등급의 우려기준을 넘는 값은 빨간 굵은 글씨로 표시한다.
function fillSurvey(table, surveyRows, selectedSubstances, regionGrade, exceedCharPrFor) {
  const zone = parseRegionGrade(regionGrade);
  // 템플릿 견본 값 중엔 이미 빨간 글씨인 칸도 있어서, 값 칸은 전부 첫 연도 칸("미검사")의 보통 글자 모양으로 맞춘 뒤 초과 값만 빨갛게 한다
  const normalCharPr = getCells(getRows(table)[1])[2]?.getElementsByTagNameNS(HP_NS, "run")[0]?.getAttribute("charPrIDRef");
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
    const minRaw = [];
    const maxRaw = [];
    SURVEY_TEMPLATE_YEARS.forEach((year) => {
      const s = statsFor(key, year);
      minValues.push(s.min !== null ? formatSum(s.min) : "-");
      maxValues.push(s.max !== null ? formatSum(s.max) : "-");
      minRaw.push(s.min);
      maxRaw.push(s.max);
    });
    const standard = zone ? CONCERN_STANDARDS[key]?.[zone] : undefined;
    const raw = new Map();
    const emphasize = (cell, v) => {
      const value = raw.get(cell);
      const exceeded = standard !== undefined && value != null && value > standard;
      Array.from(cell.getElementsByTagNameNS(HP_NS, "run")).forEach((run) => {
        const base = normalCharPr || run.getAttribute("charPrIDRef");
        run.setAttribute("charPrIDRef", exceeded ? exceedCharPrFor(base) : base);
      });
    };
    // 칸 순서대로 원래 숫자를 짝지어 두려고 셀 목록을 미리 읽는다 (최저 행: 연도 칸이 3번째부터, 최고 행: 2번째부터)
    const rows = getRows(table);
    getCells(rows[1 + idx * 2]).slice(2).forEach((c, i) => raw.set(c, minRaw[i]));
    getCells(rows[2 + idx * 2]).slice(1).forEach((c, i) => raw.set(c, maxRaw[i]));
    setSurveyPairText(table, 1 + idx * 2, { substance: label, minValues, maxValues, emphasize });
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

// [표 4] 대상시설(또는 부지)의 소유·점유 현황 — 헤더가 "기간/소유자/점유자/업종"이라 임대차
// 이력(점유자)도 들어갈 자리가 있는데, 지금까지 leaseRows를 아예 안 쓰고 점유자 칸에도
// owner_name을 그대로 중복해서 넣고 있었다(임대차 화면에 입력해도 보고서에 전혀 반영 안 됨) —
// 소유 이력은 소유자 칸에, 임대차 이력은 점유자 칸에 각각 채우도록 수정.
// 지금은 3.1 화면이 소유·점유를 한 표(소유자·점유자 칸)로 받는다. leaseRows는 예전 임대차 행이 아직
// 옮겨지지 않은 안건용으로만 남겨 둔다.
// 템플릿은 "기간/소유자/점유자/업종" 4칸인데, 기간이 소유 기간인지 점유 기간인지 헷갈려서
// 5칸(소유 기간/소유자/점유 기간/점유자/업종)으로 바꾼다. 기간이 이름 앞에 오는 게 읽기 편하다는 요청. 소유 기간·점유 기간은 행마다 둘 다 있거나
// 하나만 있을 수 있어 빈 칸은 "-"로 둔다. 칸 너비는 템플릿 표 너비를 비율로 나눈다.
const OWNERSHIP_COLUMNS = [
  { label: "소유 기간", ratio: 17 },
  { label: "소유자", ratio: 22 },
  { label: "점유 기간", ratio: 17 },
  { label: "점유자", ratio: 22 },
  { label: "업종", ratio: 22 },
];

function fillOwnership(table, ownershipRows, leaseRows) {
  const period = (text) => (text || "").replace(/\s*~\s*/, " ~ ").trim() || "-";
  const combined = [
    ...ownershipRows.map((d) => [
      period(ownerPeriodText(d)),
      d.owner_name || "-",
      period(occupantPeriodText(d)),
      d.occupant_name || "-",
      d.business_type || "-",
    ]),
    ...(leaseRows || []).map((d) => [
      "-",
      "-",
      `${d.lease_start || "?"} ~ ${d.lease_end || "현재"}`,
      d.tenant_name || "-",
      d.business_type || "-",
    ]),
  ];

  const total = getRowWidth(table);
  insertColumnBefore(table, 3);
  const widths = OWNERSHIP_COLUMNS.map((c) => Math.floor((total * c.ratio) / 100));
  widths[widths.length - 1] += total - widths.reduce((a, b) => a + b, 0);
  setColumnWidths(table, widths);
  OWNERSHIP_COLUMNS.forEach((c, col) => setCellText(table, 0, col, c.label));
  fillVariableRows(table, combined, (values) => values);
}

// [표 5] 대상부지 공장등록 현황 — 사업장마다 공장 등록 여부/양식이 달라 필수 항목이 아니다.
// 케이스에 입력된 내용이 없으면 빈 표(제목만 있는 상태)로 남기지 않고 표 자체를 지운다 —
// 필요하면 사용자가 사이드바 참고 문서에 각자 형식의 자료를 직접 첨부/작성해서 쓴다.
// [표 5] 대상부지 공장등록 현황 — 팩토리온 "공장(기업)조회 서비스" 결과 칸(대표업종 제외)을 그대로 싣는다.
// 샘플 표는 6칸(연번·승인일·취소일·회사명·보유구분·업종)이라 한 칸을 끼워 7칸으로 만들고 머리글을 바꾼다.
// 선택 항목이라 입력이 없으면 표(캡션 포함)를 통째로 지운다.
const FACTORY_COLUMNS = [
  { label: "연번", width: 3217 },
  { label: "공장(기업)명", width: 8000, key: "company_name" },
  { label: "지역", width: 6000, key: "region" },
  { label: "산업단지명", width: 6500, key: "industrial_complex" },
  { label: "대표주소", width: 12049, key: "address" },
  { label: "생산품", width: 6500, key: "product" },
  { label: "원자재", width: 6500, key: "raw_material" },
]; // 너비 합 48766 = 샘플 표 너비

function fillFactoryHistory(table, items) {
  if (items.length === 0) {
    removeTable(table);
    return;
  }
  insertColumnBefore(table, getCells(getRows(table)[0]).length - 1);
  setColumnWidths(table, FACTORY_COLUMNS.map((c) => c.width));
  FACTORY_COLUMNS.forEach((c, col) => setCellText(table, 0, col, c.label));
  fillVariableRows(table, items, (d, i) => [
    String(i + 1),
    ...FACTORY_COLUMNS.slice(1).map((c) => (d[c.key] || "").trim() || "-"),
  ]);
}

// [표 6] 대상부지 소유권 지분 현황 — 이 표도 필수가 아니고 사업장마다 양식이 달라, 채워 넣을
// 데이터 소스 자체가 없다(케이스 입력 화면에 이 표에 대응하는 입력란이 없음). 빈 표(제목만
// 있는 상태)로 남기지 않고 아예 지운다 — 필요하면 사용자가 사이드바 참고 문서에 각자 형식의
// 자료를 직접 첨부/작성해서 쓴다.
function removeOwnershipShareTable(table) {
  removeTable(table);
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
        // 케이스에 올라온 사진이 표 칸 수보다 적으면, 남는 칸엔 다른 사건의 실제 사진이 그대로
        // 남아있던 자리라 빈 이미지로 덮어써서 leak을 막는다.
        if (img) await replaceImage(zip, null, pics[0], img.data, img.type);
        else await replaceImage(zip, null, pics[0], BLANK_PNG, "png");
        continue;
      }
      if (labels) {
        setTNodeText(cell, labels[labelIdx] || "");
        labelIdx++;
      }
    }
  }
}

// 항공사진 표는 현장사진과 달리 연도 글자("1992년")가 사진과 같은 칸 안, 사진 문단 아래 문단에
// 템플릿 값 그대로 박혀 있어서, 사진만 바꾸면 다른 사건의 연도가 남았다. fillPhotoGrid와 같은
// 순서(사진 칸 순)로 돌며 그 문단을 이 사진의 연도로 바꾼다(연도 모르거나 빈 칸이면 비움).
function setAerialYearLabels(table, images) {
  if (!table) return;
  let imgIdx = 0;
  for (const row of getRows(table)) {
    for (const cell of getCells(row)) {
      if (!getPics(cell).length) continue;
      const year = images[imgIdx]?.year;
      imgIdx++;
      const labelPara = Array.from(cell.getElementsByTagNameNS(HP_NS, "p")).find(
        (p) => !getPics(p).length && getParagraphText(p).trim()
      );
      if (labelPara) setTNodeText(labelPara, year ? `${year}년` : "");
    }
  }
}

// 항공사진이 4장 이하면 아래 표(5~8번째 칸)는 통째로 비므로 지운다. 그림 제목("<그림> 대상부지
// 항공사진", hp:caption)이 아래 표에 붙어 있어서 위 표의 같은 자리(outMargin 바로 뒤)로 옮긴 뒤,
// 아래 표가 들어 있던 문단까지 지운다(빈 줄이 남지 않게). 위 표 문단은 높이가 바뀌니 줄 위치 캐시를 비운다.
function removeEmptyAerialTable(upper, lower) {
  if (!upper || !lower) return;
  const childOf = (node, name) => Array.from(node.childNodes).find((n) => n.nodeType === 1 && n.localName === name);
  const caption = childOf(lower, "caption");
  if (caption && !childOf(upper, "caption")) {
    const anchor = childOf(upper, "outMargin");
    upper.insertBefore(caption, anchor ? anchor.nextSibling : upper.firstChild);
    const upperPara = upper.parentNode?.parentNode;
    const lineSegs = upperPara && childOf(upperPara, "linesegarray");
    if (lineSegs) while (lineSegs.firstChild) lineSegs.removeChild(lineSegs.firstChild);
  }
  const lowerPara = lower.parentNode?.parentNode;
  removeTable(lower);
  if (lowerPara?.localName === "p" && !getParagraphText(lowerPara).trim() && !lowerPara.getElementsByTagNameNS(HP_NS, "tbl").length) {
    lowerPara.parentNode.removeChild(lowerPara);
  }
}

// 라벨과 단위가 한 줄에 붙어있는 헤더 셀(예: "금액(원)")을 [표1]처럼 두 줄(라벨/단위)로
// 나눈다 — 제목과 내용의 구분이 더 잘 보이도록. 셀에 문단(hp:p)을 하나 더 만들어 넣는다.
function setParaTextRaw(p, text) {
  const t = p.getElementsByTagNameNS(HP_NS, "t")[0];
  if (!t) return;
  while (t.firstChild) t.removeChild(t.firstChild);
  t.appendChild(t.ownerDocument.createTextNode(text));
  resetLineSegArray(t);
}

// 셀 하나를 문단(hp:p) 여러 개로 채운다 — 각 줄이 진짜 별도 문단이라 한글이 줄바꿈을
// 알아서 배치하는 것과 무관하게 각 줄의 맨 앞이 항상 왼쪽 끝에서 시작한다(체크박스 목록처럼
// "항목마다 맨 앞에 표시가 와야 하는" 경우, 한 문단에 다 몰아넣고 자동 줄바꿈에 맡기면 칸
// 폭에 따라 항목 중간에서 줄이 잘려 표시가 앞이 아닌 곳에 걸릴 수 있어 이 방식이 더 안전함).
function setCellLines(cell, lines) {
  if (!cell || !lines.length) return;
  const subList = cell.getElementsByTagNameNS(HP_NS, "subList")[0];
  const existingParas = Array.from(cell.getElementsByTagNameNS(HP_NS, "p"));
  const p1 = existingParas[0];
  if (!p1) return;
  for (let i = 1; i < existingParas.length; i++) subList.removeChild(existingParas[i]);
  p1.setAttribute("paraPrIDRef", "0");
  setParaTextRaw(p1, lines[0]);
  let ref = p1;
  for (let i = 1; i < lines.length; i++) {
    const clone = p1.cloneNode(true);
    clone.setAttribute("id", "0");
    setParaTextRaw(clone, lines[i]);
    subList.insertBefore(clone, ref.nextSibling);
    ref = clone;
  }
}

function splitCellIntoTwoLines(cell, line1, line2) {
  setCellLines(cell, [line1, line2]);
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
  splitCellIntoTwoLines(getCells(getRows(table)[0])[2], "금액", "(원)");
  fillVariableRows(table, items, (d) => [d.item_type || "-", "", d.amount || "-", d.note || "-"]);
}

// ---- 표13 종합 기술검토결과 ----
// 체크된 항목만 쉼표로 나열하던 것을, 샘플보고서처럼 전체 선택지를 ☑/□ 체크박스로 보여주도록
// 바꾼다(3.x 화면의 ChecklistJudgmentForm은 항상 "기타" 체크박스+텍스트도 갖고 있어서 같이 붙임).
// 체크박스와 라벨 사이는 줄바꿈 없는 공백(NBSP)으로 이어서, 칸이 좁아 줄바꿈될 때 체크박스만
// 앞줄 끝에 남고 라벨이 다음 줄로 넘어가는 일이 없게 한다(체크박스가 항상 라벨 맨 앞에 붙어있게).
function checklistSummaryLines(judgment, checklistOptions) {
  const parts = checklistOptions.map((opt) => `${judgment?.checked?.[opt.key] ? "☑" : "□"} ${opt.label}`);
  const otherChecked = !!judgment?.checked?.other;
  parts.push(`${otherChecked ? "☑" : "□"} 기타${otherChecked && judgment?.other_text ? `(${judgment.other_text})` : ""}`);
  return parts;
}

// setCellText로 채운 셀의 첫 문단이 원래(다른 사건 템플릿의) 번호/글머리 목록용 내어쓰기
// 문단속성(paraPr)을 쓰고 있으면, 우리가 넣은 일반 문장이 둘째 줄부터 오른쪽으로 밀려
// 보인다(사용자 확인: "3.6 검토의견 문단에서 두번째 줄부터 들여쓰기 되어 있어"). paraPrIDRef=0은
// 이 문서 전체에서 안전하게 쓰이는 기본 문단 속성(들여쓰기 없음, 양쪽 정렬)이라 그걸로 맞춘다.
function resetParaIndent(cell) {
  const p = cell.getElementsByTagNameNS(HP_NS, "p")[0];
  if (p) p.setAttribute("paraPrIDRef", "0");
}

function fillSummaryTable(table, judgments, legalSummary, boldCharPrFor) {
  const rows = [
    {
      contentLines: checklistSummaryLines(judgments.ownership_lease, [
        { key: "lease_contract", label: "임대차계약서" },
        { key: "land_registry", label: "토지대장" },
        { key: "aerial_photo", label: "항공사진" },
        { key: "cadastral_map", label: "지적도" },
      ]),
      // 다른 행처럼 3.1 화면의 판단 내용. 예전 6장 "법적 판단" 요약은 3.1이 비어 있을 때만 쓴다(그 탭은 없앴다).
      opinion: judgments.ownership_lease?.summary || legalSummary || "※ 판단 내용 미입력",
    },
    {
      contentLines: checklistSummaryLines(judgments.soil_assessment, [{ key: "assessment_report", label: "토양환경평가보고서" }]),
      opinion: judgments.soil_assessment?.summary || "※ 판단 내용 미입력",
    },
    {
      contentLines: checklistSummaryLines(judgments.cost_capacity, [
        { key: "property_tax", label: "재산세 납부실적" },
        { key: "asset_valuation", label: "재산평가액 보고서" },
        { key: "debt_assessment", label: "부채정도 평가서" },
      ]),
      opinion: judgments.cost_capacity?.summary || "※ 판단 내용 미입력",
    },
    {
      contentLines: checklistSummaryLines(judgments.access, [
        { key: "aerial_photo", label: "항공사진" },
        { key: "design_drawing", label: "설계도면" },
        { key: "site_plan", label: "배치 평면도" },
        { key: "site_photo", label: "현장사진" },
      ]),
      opinion: judgments.access?.summary || "※ 판단 내용 미입력",
      headedOpinion: true,
    },
    {
      contentLines: checklistSummaryLines(judgments.agreement, [
        { key: "cleanup_agreement", label: "정화분담 약정서" },
        { key: "cost_agreement", label: "비용분담 합의서" },
      ]),
      opinion: judgments.agreement?.summary || "※ 판단 내용 미입력",
    },
    {
      contentLines: checklistSummaryLines(judgments.management_history, [
        { key: "soil_test_report", label: "토양오염도검사 성적서" },
        { key: "leak_test_report", label: "누출검사 성적서" },
        { key: "detailed_survey_report", label: "토양정밀조사보고서" },
        { key: "soil_network", label: "토양측정망" },
        { key: "soil_survey", label: "토양오염실태조사" },
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

  // 3.1 구분 칸만 템플릿에서 "3.1 토양오염관리대상시설의 " / "소유·점유·운영" 두 문단에 문단 속성도
  // 달라 다른 행과 정렬이 어긋나 보였다 — 한 문단으로 합치고 3.2 구분 칸과 같은 문단 속성을 쓴다.
  const labelParaPr = getCells(getRows(table)[2])[0].getElementsByTagNameNS(HP_NS, "p")[0]?.getAttribute("paraPrIDRef");
  rows.forEach((_, i) => {
    const labelCell = getCells(getRows(table)[i + 1])[0];
    const paras = Array.from(labelCell.getElementsByTagNameNS(HP_NS, "p"));
    if (paras.length < 2) return;
    const text = paras.map((p) => getParagraphText(p).trim()).filter(Boolean).join(" ");
    paras.slice(1).forEach((p) => p.parentNode.removeChild(p));
    setTNodeText(paras[0], text);
    if (labelParaPr) paras[0].setAttribute("paraPrIDRef", labelParaPr);
  });

  rows.forEach((r, i) => {
    const rowIdx = i + 1; // row0은 헤더
    const cells = getCells(getRows(table)[rowIdx]);
    // 검토내용은 항목 하나당 줄(문단) 하나로 넣어서 체크박스가 항상 그 줄 맨 앞에서 시작하게
    // 한다(setCellLines). 검토의견은 기존처럼 한 문단으로 채우되, 다른 사건 템플릿에 남아있던
    // 번호목록용 내어쓰기 문단속성 때문에 줄바꿈 시 밀려 보이던 것을 resetParaIndent로 맞춘다.
    setCellLines(cells[1], r.contentLines);
    if (r.headedOpinion) {
      // 3.4는 본문(fillHeadedSectionNarrative)과 같게 단락마다 문단을 나누고 "(소제목)"을 굵게 한다.
      setCellLines(cells[2], linesKeepingBlank(r.opinion));
      Array.from(cells[2].getElementsByTagNameNS(HP_NS, "p")).forEach((p) => boldLeadingHeading(p, boldCharPrFor));
    } else {
      setCellText(table, rowIdx, 2, stripMarkdownArtifacts(r.opinion));
      resetParaIndent(cells[2]);
      // 템플릿에 남은 빈 문단(3.1 검토의견에 2개)이 글 아래 빈 줄로 보이던 것 — 첫 문단 뒤 빈 문단은 지운다
      Array.from(cells[2].getElementsByTagNameNS(HP_NS, "p"))
        .slice(1)
        .filter((p) => !getParagraphText(p).trim() && !getPics(p).length)
        .forEach((p) => p.parentNode.removeChild(p));
    }
  });
}

// 6장 종합표가 한 쪽을 넘어 통째로 다음 쪽으로 밀리고(글자처럼 취급이라 쪽 나눔이 안 됨) 앞 쪽이 비던 문제:
// 내용이 짧은 구분·검토내용 칸을 줄이고 긴 글이 들어가는 검토의견 칸을 넓힌 뒤(전체 폭 49340은 그대로),
// 줄 간격을 150%에서 120%로 줄여 한 쪽에 들어가게 한다.
const SUMMARY_COLUMN_WIDTHS = [9400, 11500, 28440];
const SUMMARY_LINE_SPACING = 120;

function compactSummaryTable(table, lineSpacingFor) {
  if (!table) return;
  setColumnWidths(table, SUMMARY_COLUMN_WIDTHS);
  Array.from(table.getElementsByTagNameNS(HP_NS, "p")).forEach((p) => {
    const id = p.getAttribute("paraPrIDRef");
    if (id != null) p.setAttribute("paraPrIDRef", lineSpacingFor(id, SUMMARY_LINE_SPACING));
    const segs = p.getElementsByTagNameNS(HP_NS, "linesegarray")[0];
    if (segs) while (segs.firstChild) segs.removeChild(segs.firstChild);
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
    samplePointImages,
    pollutionMapImages,
    surroundingImages,
    sitePlanImages,
    fieldSurvey,
    scientificAnalysis,
    siteContamination,
    surroundingContamination,
  } = payload;

  const { zip, doc } = await loadTemplate(templateBuffer);
  const header = await loadHeader(zip);
  const boldCharPrFor = makeBoldCharPrFactory(header);
  const tables = getTables(doc);
  // [표1] 오염현황 표를 만들 때 스타일 원본으로 쓸 표6(OWNERSHIP_SHARE)을 지금 미리 복제해둔다
  // — clearOwnershipShare가 뒤에서 이 표의 데이터 행을 다 지워버려서, 그 이후에 참조하면
  // 헤더 행(0,1)밖에 안 남아있다.
  const contamTableStyleSource = tables[TBL.OWNERSHIP_SHARE].cloneNode(true);
  // [표 4] 아래 타임라인 그림 자리로 쓸 3.4 배치도면 그림 문단도 사진을 바꾸기 전에 복제해 둔다
  const timelineParaSource = getSectionParagraphs(doc)
    .find((p) => getParagraphText(p).trim().startsWith("<그림> 배치도면") && getPics(p).length)
    ?.cloneNode(true);

  // 5장 본문 글자 모양으로 쓸 4.2 본문 문단 모양 — 4.2를 채우면(항목이 없으면 문단이 지워져) 못 읽으니 미리 읽어 둔다
  const interviewParas = collectNarrativeParas(doc, "4.2 청취조사", "5. 과학적 기법에 의한 오염원인 추정");
  const interviewBody = interviewParas.find((p) => getParagraphText(p).trim().startsWith("ㅇ"));
  const scientificBodyStyle = interviewBody && {
    paraPr: interviewBody.getAttribute("paraPrIDRef"),
    charPr: interviewBody.getElementsByTagNameNS(HP_NS, "run")[0]?.getAttribute("charPrIDRef"),
  };

  // [표 3] 아래 주석으로 쓸 템플릿의 작은 글씨 "※" 문단 — 그 자리 내용을 채우기 전에 복제해 둔다
  const noteParaSource = getSectionParagraphs(doc)
    .find((p) => getParagraphText(p).trim().startsWith("※ ‘파랑돌’"))
    ?.cloneNode(true);

  fillOverview(tables[TBL.OVERVIEW], caseInfo, overview, contaminationRows);
  fillProgress(doc, overview.progressItems || []);
  fillSectionNarrative(doc, "1.3 정화책임자에 대한", "1.4 정화책임자 의견", overview.sido_opinion);
  fillSectionNarrative(doc, "1.4 정화책임자 의견", "2. 토양오염물질", overview.responsible_party_opinion_text);
  fillSectionNarrative(doc, "2.1 대상부지 토양오염 현황", "2.2 인접·주변부지", siteContamination?.content || "");
  fillSectionNarrative(doc, "2.2 인접·주변부지 토양오염 현황", "3. 기술검토 결과", surroundingContamination?.content || "");
  fillNarrativeAboveFirstTable(doc, "3.1 토양오염관리대상시설", "3.2 토양환경평가", judgments.ownership_lease?.summary);
  fillSectionNarrative(doc, "3.2 토양환경평가의 실시", "3.3 토양정화에 드는", judgments.soil_assessment?.summary);
  fillSectionNarrative(doc, "3.3 토양정화에 드는 비용을", "3.4 토양오염이 발생한", judgments.cost_capacity?.summary);
  fillHeadedSectionNarrative(doc, "3.4 토양오염이 발생한 토지로의 출입", "3.5 정화책임자 간의", judgments.access?.summary, boldCharPrFor);
  fillSectionNarrative(doc, "3.5 정화책임자 간의 약정", "3.6 토양오염물질의 관리", judgments.agreement?.summary);
  fillSectionNarrative(doc, "3.6 토양오염물질의 관리 이력", "4. 현장 및 청취조사", judgments.management_history?.summary);
  fillFieldSurveySection(doc, "4.1 현장조사", "4.2 청취조사", fieldSurvey?.field_items);
  insertBlankLineBefore(doc, "4.2 청취조사"); // 4.1 마지막 내용과 4.2 제목 사이가 붙어 보이던 것 방지
  fillFieldSurveySection(doc, "4.2 청취조사", "5. 과학적 기법에 의한 오염원인 추정", fieldSurvey?.interview_items);
  fillScientificAnalysis(doc, scientificAnalysis, contaminationRows, scientificBodyStyle);
  fillNetwork(tables[TBL.NETWORK], networkRows, caseInfo.region_grade);
  fillSurvey(tables[TBL.SURVEY], surveyRows, selectedSubstances ?? null, caseInfo.region_grade, makeBoldCharPrFactory(header, { textColor: "#FF0000" }));
  fillOwnership(tables[TBL.OWNERSHIP], ownership.ownershipRows, ownership.leaseRows);
  fillFactoryHistory(tables[TBL.FACTORY_HISTORY], factoryHistoryItems);
  removeOwnershipShareTable(tables[TBL.OWNERSHIP_SHARE]);
  fillCostCapacity(tables[TBL.COST_CAPACITY], costCapacityItems);
  fillSummaryTable(tables[TBL.SUMMARY], judgments, legalSummary, boldCharPrFor);
  compactSummaryTable(tables[TBL.SUMMARY], makeLineSpacingParaPrFactory(header));

  const aerial1 = aerialImages.slice(0, 4);
  const aerial2 = aerialImages.slice(4, 8);
  await fillPhotoGrid(zip, tables[TBL.AERIAL_1], aerial1);
  await fillPhotoGrid(zip, tables[TBL.AERIAL_2], aerial2);
  setAerialYearLabels(tables[TBL.AERIAL_1], aerial1);
  setAerialYearLabels(tables[TBL.AERIAL_2], aerial2);
  if (!aerial2.length) removeEmptyAerialTable(tables[TBL.AERIAL_1], tables[TBL.AERIAL_2]);

  // 현장사진 표는 안건마다 관련 회사 수에 따라 구조(칸 수)가 달라져 어느 칸이 어느 회사인지
  // 자동으로 맞출 순 없지만, 케이스에 올라온 사진 자체는 실제로 표출돼야 하므로 업로드 순서대로
  // 채우고 각 사진의 캡션(4장 체크리스트 항목명 또는 직접 입력한 설명)을 그대로 붙인다.
  const fieldPhotoLabels = fieldPhotoImages.map((img) => img.caption || "");
  await fillPhotoGrid(zip, tables[TBL.FIELD_PHOTOS], fieldPhotoImages, fieldPhotoLabels);

  // 2.1/2.2/3.4는 케이스에 아직 사진이 없을 수도 있어, 있으면 가장 최근에 올린 사진을 쓰고
  // 없으면 다른 사건 사진이 남지 않게 비운다.
  // "<그림> 토양시료 채취 지점 및 기준 초과 현황"엔 오염분포도(pollution_map)가 들어간다
  // (samplePointImages는 오염분포도가 없을 때만 대신 쓰는 대체용).
  await fillOrBlankTableImage(zip, tables[TBL.SAMPLE_POINT_IMAGE], pollutionMapImages);
  await fillOrBlankTableImage(zip, tables[TBL.SURROUNDING_IMAGE], surroundingImages);
  // 어떤 사진을 넣을지(배치도 → 부지전경 → 최근 연도 항공사진)는 export-report의 fetchSitePlanImage가 고른다
  await fillOrBlankParagraphImage(zip, doc, "<그림> 배치도면", sitePlanImages);
  // "[표 1] 오염면적 및 오염범위" 캡션이 붙은 자리는 화면 캡처 이미지가 아니라, 오염현황
  // 데이터(contaminationRows)로 직접 만든 네이티브 표를 넣는다(화면 캡처 방식은 2단 헤더
  // 렌더링이 계속 불안정해서 포기함 — buildContaminationTable 주석 참고).
  const contamTable = await fillContaminationStatusTable(zip, doc, contamTableStyleSource, contaminationRows);
  styleDataTables(contamTable, tables[TBL.NETWORK], tables[TBL.SURVEY], makeDoubleLineBorderFactory(header));
  // 표 제목 줄 글자를 가운데로(템플릿·[표 1]에 왼쪽·양쪽 정렬로 된 제목 칸이 섞여 있었음)
  const alignFor = makeAlignParaPrFactory(header);
  centerHeaderRows(contamTable, [0, 1], alignFor);
  centerHeaderRows(tables[TBL.NETWORK], [0, 4], alignFor);
  [TBL.SURVEY, TBL.FACTORY_HISTORY, TBL.COST_CAPACITY, TBL.SUMMARY].forEach((k) =>
    centerHeaderRows(tables[k], [0], alignFor)
  );
  // [표 4]는 내용 줄까지 전부 가운데 정렬(이름·기간·업종이 짧아 가운데가 보기 좋다는 요청)
  centerHeaderRows(tables[TBL.OWNERSHIP], getRows(tables[TBL.OWNERSHIP]).map((_, i) => i), alignFor);
  splitUnitCaptions(doc, alignFor);
  // 나머지 표([표 4] 소유·점유, 공장등록, 재산세, 6장 종합표)도 제목 줄 아래를 이중선으로(2장 표들과 같게).
  // 내용이 없어 지운 표(parentNode 없음)는 건너뛴다.
  const doubleLineFor = makeDoubleLineBorderFactory(header);
  [TBL.OWNERSHIP, TBL.FACTORY_HISTORY, TBL.COST_CAPACITY, TBL.SUMMARY].forEach((k) => {
    if (tables[k]?.parentNode) setHeaderBoundaryDoubleLine(tables[k], 1, doubleLineFor);
  });
  insertSurveyNote(tables[TBL.SURVEY], noteParaSource, surveyRows, caseInfo.region_grade);
  await insertOwnershipTimeline(zip, doc, tables[TBL.OWNERSHIP], timelineParaSource, payload.ownershipTimelineImage);

  sanitizeCheckboxAnnotations(doc);
  // 2.1 자료 종류 줄은 사용자가 고른 값(기타 자료명 포함)이라 위의 "기타(...)" 비우기보다 뒤에 넣는다.
  setSourceCheckboxLine(doc, "2.1 대상부지 토양오염 현황", "2.2 인접·주변부지", siteContamination?.checkboxLine);
  setSourceCheckboxLine(doc, "2.2 인접·주변부지 토양오염 현황", "3. 기술검토 결과", surroundingContamination?.checkboxLine);
  removeStrayOverlayShapes(doc);
  ungroupSingleChildContainers(doc);
  enlargeAerialPhotos(tables);
  fitFieldPhotos(tables[TBL.FIELD_PHOTOS]);

  indentBulletLines(doc, makeIndentedParaPrFactory(header));
  // 모든 문단을 채우고 들여쓰기까지 끝난 뒤(새로 만든 문단·굵은 글자 포함) 마지막에 글꼴을 통일한다
  unifyFonts(doc, makeCharPrNormalizer(header, REPORT_FONT));
  writeHeader(zip, header); // boldCharPrFor로 추가한 굵은 글자 서식 반영
  return serialize(zip, doc);
}
