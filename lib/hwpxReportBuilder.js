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
} from "./hwpxTemplate.js";
import { SUBSTANCE_LABELS, findSubstanceKey } from "./substances.js";
import { CONCERN_STANDARDS, ACTION_STANDARDS, parseRegionGrade } from "./soilStandards.js";

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
function fillParagraphLines(narrativeParas, lines) {
  if (narrativeParas.length === 0) return;
  if (lines.length === 0) {
    narrativeParas.forEach((p) => setTNodeText(p, ""));
    return;
  }
  if (lines.length <= narrativeParas.length) {
    for (let k = lines.length; k < narrativeParas.length; k++) setTNodeText(narrativeParas[k], "");
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

function enlargeAerialPhoto(pic, cellWidth) {
  const orgSz = pic.getElementsByTagNameNS(HP_NS, "orgSz")[0];
  if (!orgSz) return;
  const orgW = parseInt(orgSz.getAttribute("width"), 10);
  const orgH = parseInt(orgSz.getAttribute("height"), 10);
  if (!orgW || !orgH || orgW <= 2 || orgH <= 2) return; // 2px 이하는 빈 자리(BLANK_PNG) — 그대로 둔다

  const frameW = Math.round(cellWidth * AERIAL_FRAME_WIDTH_RATIO);
  const frameH = Math.round(frameW / AERIAL_FRAME_ASPECT);
  const scale = Math.min(frameW / orgW, frameH / orgH);
  const finalW = Math.max(1, Math.round(orgW * scale));
  const finalH = Math.max(1, Math.round(orgH * scale));

  let sz = pic.getElementsByTagNameNS(HP_NS, "sz")[0];
  if (!sz) {
    sz = pic.ownerDocument.createElementNS(HP_NS, "hp:sz");
    sz.setAttribute("widthRelTo", "ABSOLUTE");
    sz.setAttribute("heightRelTo", "ABSOLUTE");
    sz.setAttribute("protect", "0");
    const insertBeforeNode =
      pic.getElementsByTagNameNS(HP_NS, "pos")[0] || pic.getElementsByTagNameNS(HP_NS, "outMargin")[0] || null;
    if (insertBeforeNode) pic.insertBefore(sz, insertBeforeNode);
    else pic.appendChild(sz);
  }
  sz.setAttribute("width", String(finalW));
  sz.setAttribute("height", String(finalH));

  const curSz = pic.getElementsByTagNameNS(HP_NS, "curSz")[0];
  if (curSz) {
    curSz.setAttribute("width", String(finalW));
    curSz.setAttribute("height", String(finalH));
  }

  // renderingInfo의 첫 scaMatrix는 orgSz 대비 실제 표시 배율이다. 사진마다 남아있던 값이
  // 제각각(어떤 건 실제 비율, 어떤 건 이미 orgSz=표시크기라 1:1)이라 헷갈리지 않게, 우리가
  // 방금 정한 finalW/finalH 기준으로 새로 정확히 맞춰 둔다.
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
  const n = parseFloat(v);
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

// [표 5] 대상부지 공장등록 현황 — 사업장마다 공장 등록 여부/양식이 달라 필수 항목이 아니다.
// 케이스에 입력된 내용이 없으면 빈 표(제목만 있는 상태)로 남기지 않고 표 자체를 지운다 —
// 필요하면 사용자가 사이드바 참고 문서에 각자 형식의 자료를 직접 첨부/작성해서 쓴다.
function fillFactoryHistory(table, items) {
  if (items.length === 0) {
    removeTable(table);
    return;
  }
  fillVariableRows(table, items, (d, i) => [
    String(i + 1),
    d.approved_date ? d.approved_date.replaceAll("-", "") : "-",
    d.cancelled_date ? d.cancelled_date.replaceAll("-", "") : "-",
    d.company_name || "-",
    d.holding_type || "-",
    d.business_type || "-",
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

// 라벨과 단위가 한 줄에 붙어있는 헤더 셀(예: "금액(원)")을 [표1]처럼 두 줄(라벨/단위)로
// 나눈다 — 제목과 내용의 구분이 더 잘 보이도록. 셀에 문단(hp:p)을 하나 더 만들어 넣는다.
function splitCellIntoTwoLines(cell, line1, line2) {
  if (!cell) return;
  const p1 = cell.getElementsByTagNameNS(HP_NS, "p")[0];
  if (!p1) return;
  const t1 = p1.getElementsByTagNameNS(HP_NS, "t")[0];
  if (!t1) return;
  while (t1.firstChild) t1.removeChild(t1.firstChild);
  t1.appendChild(t1.ownerDocument.createTextNode(line1));
  resetLineSegArray(t1);

  const subList = cell.getElementsByTagNameNS(HP_NS, "subList")[0];
  const p2 = p1.cloneNode(true);
  p2.setAttribute("id", "0");
  const t2 = p2.getElementsByTagNameNS(HP_NS, "t")[0];
  while (t2.firstChild) t2.removeChild(t2.firstChild);
  t2.appendChild(t2.ownerDocument.createTextNode(line2));
  resetLineSegArray(t2);
  subList.insertBefore(p2, p1.nextSibling);
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
    samplePointImages,
    pollutionMapImages,
    surroundingImages,
    sitePlanImages,
    fieldSurvey,
    scientificAnalysis,
  } = payload;

  const { zip, doc } = await loadTemplate(templateBuffer);
  const tables = getTables(doc);
  // [표1] 오염현황 표를 만들 때 스타일 원본으로 쓸 표6(OWNERSHIP_SHARE)을 지금 미리 복제해둔다
  // — clearOwnershipShare가 뒤에서 이 표의 데이터 행을 다 지워버려서, 그 이후에 참조하면
  // 헤더 행(0,1)밖에 안 남아있다.
  const contamTableStyleSource = tables[TBL.OWNERSHIP_SHARE].cloneNode(true);

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
  removeOwnershipShareTable(tables[TBL.OWNERSHIP_SHARE]);
  fillCostCapacity(tables[TBL.COST_CAPACITY], costCapacityItems);
  fillSummaryTable(tables[TBL.SUMMARY], judgments, legalSummary);

  const aerial1 = aerialImages.slice(0, 4);
  const aerial2 = aerialImages.slice(4, 8);
  await fillPhotoGrid(zip, tables[TBL.AERIAL_1], aerial1);
  await fillPhotoGrid(zip, tables[TBL.AERIAL_2], aerial2);

  // 현장사진 표는 안건마다 관련 회사 수에 따라 구조(칸 수)가 달라져 어느 칸이 어느 회사인지
  // 자동으로 맞출 순 없지만, 케이스에 올라온 사진 자체는 실제로 표출돼야 하므로 업로드 순서대로
  // 채우고 각 사진의 캡션(4장 체크리스트 항목명 또는 직접 입력한 설명)을 그대로 붙인다.
  const fieldPhotoLabels = fieldPhotoImages.map((img) => img.caption || "");
  await fillPhotoGrid(zip, tables[TBL.FIELD_PHOTOS], fieldPhotoImages, fieldPhotoLabels);

  // 2.1/2.2/3.4는 전용 업로드가 없거나(2.2, 3.4는 사이드바 일반 참고 문서) 케이스에 아직
  // 사진이 없을 수도 있어, 있으면 그 사진을 쓰고 없으면 다른 사건 사진이 남지 않게 비운다.
  // "<그림> 토양시료 채취 지점 및 기준 초과 현황"엔 오염분포도(pollution_map)가 들어간다
  // (samplePointImages는 오염분포도가 없을 때만 대신 쓰는 대체용).
  await fillOrBlankTableImage(zip, tables[TBL.SAMPLE_POINT_IMAGE], pollutionMapImages);
  await fillOrBlankTableImage(zip, tables[TBL.SURROUNDING_IMAGE], surroundingImages);
  await fillOrBlankParagraphImage(zip, doc, "<그림> 배치도면", sitePlanImages);
  // "[표 1] 오염면적 및 오염범위" 캡션이 붙은 자리는 화면 캡처 이미지가 아니라, 오염현황
  // 데이터(contaminationRows)로 직접 만든 네이티브 표를 넣는다(화면 캡처 방식은 2단 헤더
  // 렌더링이 계속 불안정해서 포기함 — buildContaminationTable 주석 참고).
  await fillContaminationStatusTable(zip, doc, contamTableStyleSource, contaminationRows);

  sanitizeCheckboxAnnotations(doc);
  removeStrayOverlayShapes(doc);
  ungroupSingleChildContainers(doc);
  enlargeAerialPhotos(tables);

  return serialize(zip, doc);
}
