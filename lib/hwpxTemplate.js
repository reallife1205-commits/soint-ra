import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const HP_NS = "http://www.hancom.co.kr/hwpml/2011/paragraph";
const HC_NS = "http://www.hancom.co.kr/hwpml/2011/core";

export async function loadTemplate(templateBuffer) {
  const zip = await JSZip.loadAsync(templateBuffer);
  const xmlText = await zip.file("Contents/section0.xml").async("string");
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  return { zip, doc };
}

export function getTables(doc) {
  return Array.from(doc.getElementsByTagNameNS(HP_NS, "tbl"));
}

function directChildren(node, localName) {
  return Array.from(node.childNodes).filter(
    (n) => n.nodeType === 1 && n.localName === localName
  );
}

export function getRows(table) {
  return directChildren(table, "tr");
}

export function getCells(row) {
  return directChildren(row, "tc");
}

export function setCaptionText(table, text) {
  const caption = directChildren(table, "caption")[0];
  if (!caption) return;
  const doc = caption.ownerDocument;
  const tNodes = Array.from(caption.getElementsByTagNameNS(HP_NS, "t"));
  if (tNodes.length === 0) return;
  while (tNodes[0].firstChild) tNodes[0].removeChild(tNodes[0].firstChild);
  tNodes[0].appendChild(doc.createTextNode(text));
  for (let i = 1; i < tNodes.length; i++) {
    while (tNodes[i].firstChild) tNodes[i].removeChild(tNodes[i].firstChild);
  }
}

export function getPics(cell) {
  return Array.from(cell.getElementsByTagNameNS(HP_NS, "pic"));
}

function firstDescendant(node, localName) {
  const found = node.getElementsByTagNameNS(HP_NS, localName);
  return found.length ? found[0] : null;
}

// 셀 안의 hp:t 텍스트를 교체 (첫 run만 남기고 나머지 run은 비움)
export function setCellText(table, rowIdx, colIdx, text) {
  const rows = getRows(table);
  const row = rows[rowIdx];
  if (!row) return;
  const cell = getCells(row)[colIdx];
  if (!cell) return;
  const doc = cell.ownerDocument;
  const tNodes = Array.from(cell.getElementsByTagNameNS(HP_NS, "t"));
  if (tNodes.length === 0) return;

  while (tNodes[0].firstChild) tNodes[0].removeChild(tNodes[0].firstChild);
  tNodes[0].appendChild(doc.createTextNode(String(text ?? "")));
  for (let i = 1; i < tNodes.length; i++) {
    while (tNodes[i].firstChild) tNodes[i].removeChild(tNodes[i].firstChild);
  }
}

function rowHeight(row) {
  const cells = getCells(row);
  let max = 0;
  cells.forEach((c) => {
    const sz = firstDescendant(c, "cellSz");
    if (sz) max = Math.max(max, parseInt(sz.getAttribute("height"), 10) || 0);
  });
  return max;
}

function setTableRowCnt(table, delta) {
  const cur = parseInt(table.getAttribute("rowCnt"), 10) || 0;
  table.setAttribute("rowCnt", String(cur + delta));
}

function adjustTableHeight(table, deltaHeight) {
  const sz = firstDescendant(table, "sz");
  if (!sz) return;
  const cur = parseInt(sz.getAttribute("height"), 10) || 0;
  sz.setAttribute("height", String(Math.max(0, cur + deltaHeight)));
}

function setRowAddr(row, rowAddr) {
  getCells(row).forEach((cell) => {
    const addr = firstDescendant(cell, "cellAddr");
    if (addr) addr.setAttribute("rowAddr", String(rowAddr));
  });
}

// templateRowIdx 행을 복제해서 그 뒤에 count개 추가. 실제 데이터 행 수에 맞춰 표를 늘릴 때 사용.
export function cloneRowsAfter(table, templateRowIdx, count) {
  const rows = getRows(table);
  const templateRow = rows[templateRowIdx];
  if (!templateRow || count <= 0) return [];

  const added = [];
  const h = rowHeight(templateRow);
  let refNode = templateRow;
  for (let i = 0; i < count; i++) {
    const clone = templateRow.cloneNode(true);
    table.insertBefore(clone, refNode.nextSibling);
    refNode = clone;
    added.push(clone);
  }

  // 삽입된 행 뒤에 있던 기존 행들의 rowAddr를 count만큼 뒤로 밀기
  const allRows = getRows(table);
  const insertEndIdx = templateRowIdx + 1 + count;
  for (let i = insertEndIdx; i < allRows.length; i++) {
    setRowAddr(allRows[i], templateRowIdx + count + (i - insertEndIdx) + 1);
  }
  added.forEach((row, i) => setRowAddr(row, templateRowIdx + 1 + i));

  setTableRowCnt(table, count);
  adjustTableHeight(table, h * count);
  return added;
}

// rowIdx 행을 표에서 제거 (표5/표6처럼 데이터가 없어 빈 표로 둘 때, 또는 예시 행 정리용)
export function removeRow(table, rowIdx) {
  const rows = getRows(table);
  const row = rows[rowIdx];
  if (!row) return;
  const h = rowHeight(row);
  table.removeChild(row);

  const remaining = getRows(table);
  for (let i = rowIdx; i < remaining.length; i++) {
    setRowAddr(remaining[i], i);
  }
  setTableRowCnt(table, -1);
  adjustTableHeight(table, -h);
}

// 표 안의 이미지(hp:pic)에 새 이미지를 연결. zip의 BinData에 새 파일을 추가하고 매니페스트를 갱신한 뒤
// hp:pic의 binaryItemIDRef를 새 이미지의 ID로 바꿔치기한다.
export async function replaceImage(zip, doc, picNode, imageBuffer, ext) {
  const imgTags = picNode.getElementsByTagNameNS(HC_NS, "img");
  const imgTag = imgTags.length ? imgTags[0] : null;
  if (!imgTag) return;

  const binDataFiles = Object.keys(zip.files).filter(
    (n) => n.startsWith("BinData/") && !zip.files[n].dir
  );
  const nextIndex = binDataFiles.length + 1;
  const fileName = `image${nextIndex}.${ext}`;
  zip.file(`BinData/${fileName}`, imageBuffer);

  const manifestXml = await zip.file("Contents/content.hpf").async("string");
  const manifestDoc = new DOMParser().parseFromString(manifestXml, "text/xml");
  const items = manifestDoc.getElementsByTagName("opf:item").length
    ? manifestDoc.getElementsByTagName("opf:item")
    : manifestDoc.getElementsByTagName("item");
  let maxId = 0;
  for (let i = 0; i < items.length; i++) {
    const idAttr = items[i].getAttribute("id") || "";
    const m = idAttr.match(/(\d+)/);
    if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
  }
  const newId = `image${nextIndex}`;
  const mimeByExt = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", bmp: "image/bmp", gif: "image/gif" };
  const newItem = manifestDoc.createElement(items.length && items[0].tagName.includes(":") ? "opf:item" : "item");
  newItem.setAttribute("id", newId);
  newItem.setAttribute("href", `BinData/${fileName}`);
  newItem.setAttribute("media-type", mimeByExt[ext] || "application/octet-stream");
  newItem.setAttribute("isEmbeded", "1");
  const manifestParent = items.length ? items[0].parentNode : manifestDoc.documentElement;
  manifestParent.appendChild(newItem);
  zip.file("Contents/content.hpf", new XMLSerializer().serializeToString(manifestDoc));

  imgTag.setAttribute("binaryItemIDRef", newId);
}

// 표3(토양오염실태조사)처럼 "물질명(rowSpan=2)+최저농도" / "최고농도" 두 줄이 한 세트인 표 전용 헬퍼.
// pairStartIdx는 세트의 첫 번째 행(물질명 셀이 있는 행) 인덱스.
export function setSurveyPairText(table, pairStartIdx, { substance, minValues, maxValues }) {
  const rows = getRows(table);
  const minRow = rows[pairStartIdx];
  const maxRow = rows[pairStartIdx + 1];
  if (!minRow || !maxRow) return;

  const minCells = getCells(minRow); // [물질명, 최저농도, year0..year13]
  setTNodeText(minCells[0], substance);
  minValues.forEach((v, i) => {
    if (minCells[2 + i]) setTNodeText(minCells[2 + i], v);
  });

  const maxCells = getCells(maxRow); // [최고농도, year0..year13] (물질명 셀 없음, 병합됨)
  maxValues.forEach((v, i) => {
    if (maxCells[1 + i]) setTNodeText(maxCells[1 + i], v);
  });
}

function setTNodeText(cell, text) {
  if (!cell) return;
  const doc = cell.ownerDocument;
  const tNodes = Array.from(cell.getElementsByTagNameNS(HP_NS, "t"));
  if (tNodes.length === 0) return;
  while (tNodes[0].firstChild) tNodes[0].removeChild(tNodes[0].firstChild);
  tNodes[0].appendChild(doc.createTextNode(String(text ?? "")));
  for (let i = 1; i < tNodes.length; i++) {
    while (tNodes[i].firstChild) tNodes[i].removeChild(tNodes[i].firstChild);
  }
}

// 물질쌍(2행)을 templateStartIdx 세트 뒤에 count세트만큼 복제
export function clonePairsAfter(table, templateStartIdx, count) {
  const rows = getRows(table);
  const r1 = rows[templateStartIdx];
  const r2 = rows[templateStartIdx + 1];
  if (!r1 || !r2 || count <= 0) return;
  const h = rowHeight(r1) + rowHeight(r2);
  let ref = r2;
  for (let i = 0; i < count; i++) {
    const c1 = r1.cloneNode(true);
    const c2 = r2.cloneNode(true);
    table.insertBefore(c1, ref.nextSibling);
    table.insertBefore(c2, c1.nextSibling);
    ref = c2;
  }
  setTableRowCnt(table, count * 2);
  adjustTableHeight(table, h * count);
}

// 물질쌍(2행)을 pairStartIdx 세트부터 제거
export function removePair(table, pairStartIdx) {
  removeRow(table, pairStartIdx);
  removeRow(table, pairStartIdx);
}

export async function serialize(zip, doc) {
  const xmlText = new XMLSerializer().serializeToString(doc);
  zip.file("Contents/section0.xml", xmlText);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
