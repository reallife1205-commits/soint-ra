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
  resetLineSegArray(tNodes[0]);
  for (let i = 1; i < tNodes.length; i++) {
    while (tNodes[i].firstChild) tNodes[i].removeChild(tNodes[i].firstChild);
    resetLineSegArray(tNodes[i]);
  }
}

// 원본 텍스트가 길어 여러 줄(hp:lineseg 여러 개)로 나뉘어 있던 문단·셀의 텍스트를 바꾸면,
// 남아있는 줄 위치 캐시(textpos/vertpos 등)가 더 이상 실제 텍스트와 맞지 않는다. 짧게 줄인
// 경우엔 존재하지 않는 글자 위치를 가리켜 한글이 "손상되었거나 변조"된 파일로 판단하고, 원래
// 텍스트와 길이가 다른 경우(길어졌든 짧아졌든)엔 vertpos가 실제 줄 수와 안 맞아 뒤따르는
// 내용과 겹쳐 보인다(문단·표 셀 양쪽에서 실제로 확인됨). 캐시를 통째로 비워(linesegarray
// 태그는 남기고) 한글이 새로 계산하게 한다.
export function resetLineSegArray(tNode) {
  const run = tNode.parentNode;
  const p = run && run.parentNode;
  if (!p || p.localName !== "p") return;
  const linesegArray = firstDescendant(p, "linesegarray");
  if (!linesegArray) return;
  while (linesegArray.firstChild) linesegArray.removeChild(linesegArray.firstChild);
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
  let tNodes = Array.from(cell.getElementsByTagNameNS(HP_NS, "t"));
  if (tNodes.length === 0) {
    // 셀이 원래부터 완전히 비어있어(hp:run에 hp:t가 아예 없음) 쓸 곳이 없는 경우 — 예:
    // "1.1 안건개요"의 "자문대상" 값 칸이 템플릿에서부터 빈 텍스트 런이었음. 첫 hp:run에
    // hp:t를 새로 만들어 붙인다.
    const runs = cell.getElementsByTagNameNS(HP_NS, "run");
    if (runs.length === 0) return;
    const newT = doc.createElementNS(HP_NS, "hp:t");
    runs[0].appendChild(newT);
    tNodes = [newT];
  }

  while (tNodes[0].firstChild) tNodes[0].removeChild(tNodes[0].firstChild);
  tNodes[0].appendChild(doc.createTextNode(String(text ?? "")));
  resetLineSegArray(tNodes[0]);
  for (let i = 1; i < tNodes.length; i++) {
    while (tNodes[i].firstChild) tNodes[i].removeChild(tNodes[i].firstChild);
    resetLineSegArray(tNodes[i]);
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

// 표 전체를 문서에서 제거 (보여줄 데이터가 아예 없을 때, 빈 표조차 남기지 않으려는 경우)
export function removeTable(table) {
  const parent = table.parentNode;
  if (parent) parent.removeChild(table);
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

// JPEG의 APP1(Exif) 세그먼트에서 Orientation 태그(0x0112)를 읽는다. 휴대폰 사진은 센서가
// 항상 가로 방향으로 픽셀을 저장하고 "이렇게 돌려서 보여줘라"는 값만 Exif에 남기는 경우가
// 많아서, 이 값을 안 읽으면 세로로 찍은 사진의 실제 픽셀 비율이 가로로 나와 표 칸 비율
// 계산이 틀어진다(사진이 옆으로 눕거나 비율이 안 맞아 보임).
function getJpegOrientation(buffer) {
  try {
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (marker === 0xda) break;
      const segLength = buffer.readUInt16BE(offset + 2);
      if (marker === 0xe1) {
        const segStart = offset + 4;
        // "Exif" 뒤에 널바이트 2개가 와야 진짜 Exif 세그먼트 — 소스 코드에 널바이트를 직접 못
        // 넣으니(파일이 git에서 바이너리로 오인됨) 문자열과 바이트값을 나눠서 확인한다.
        const isExifTag =
          buffer.toString("ascii", segStart, segStart + 4) === "Exif" &&
          buffer[segStart + 4] === 0 &&
          buffer[segStart + 5] === 0;
        if (isExifTag) {
          const tiffStart = segStart + 6;
          const little = buffer.toString("ascii", tiffStart, tiffStart + 2) === "II";
          const u16 = (o) => (little ? buffer.readUInt16LE(o) : buffer.readUInt16BE(o));
          const u32 = (o) => (little ? buffer.readUInt32LE(o) : buffer.readUInt32BE(o));
          const ifd0Offset = tiffStart + u32(tiffStart + 4);
          const numEntries = u16(ifd0Offset);
          for (let i = 0; i < numEntries; i++) {
            const entryOffset = ifd0Offset + 2 + i * 12;
            if (u16(entryOffset) === 0x0112) return u16(entryOffset + 8);
          }
        }
        return 1;
      }
      offset += 2 + segLength;
    }
  } catch {
    return 1;
  }
  return 1;
}

// PNG/JPEG/BMP/GIF 파일 헤더에서 가로·세로 픽셀 크기만 읽어온다(별도 이미지 라이브러리 없이).
// replaceImage가 원본 그림 크기(hp:orgSz 등)를 새 이미지에 맞게 고쳐 쓰는 데 쓴다.
function getImageDimensions(buffer, ext) {
  const e = (ext || "").toLowerCase();
  try {
    if (e === "png" && buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (e === "jpg" || e === "jpeg") {
      let offset = 2;
      while (offset + 4 <= buffer.length) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2;
          continue;
        }
        const segLength = buffer.readUInt16BE(offset + 2);
        const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSOF && offset + 9 <= buffer.length) {
          let width = buffer.readUInt16BE(offset + 7);
          let height = buffer.readUInt16BE(offset + 5);
          const orientation = getJpegOrientation(buffer);
          // 5,6,7,8은 90도/270도 회전 표시 — 가로세로를 맞바꿔야 실제 보이는 비율이 나옴
          if (orientation >= 5 && orientation <= 8) {
            [width, height] = [height, width];
          }
          return { width, height };
        }
        offset += 2 + segLength;
      }
    }
    if (e === "bmp" && buffer.length >= 26) {
      return { width: buffer.readInt32LE(18), height: Math.abs(buffer.readInt32LE(22)) };
    }
    if (e === "gif" && buffer.length >= 10) {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
  } catch {
    return null;
  }
  return null;
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

  // hp:orgSz/imgRect/imgClip/imgDim은 "원본 이미지가 몇 px인지 + 그 중 어디까지 보여줄지"를
  // 담고 있는데, 이걸 새 이미지 크기에 맞춰 고치지 않으면 예전 이미지 픽셀 크기 기준으로 지금
  // 바꿔치기한(대개 크기가 다른) 이미지를 억지로 늘려서 뿌옇게/흐릿하게 렌더링된다. 화면에 보이는
  // 실제 박스 크기(hp:curSz, hp:sz)는 문서 레이아웃을 유지하려고 그대로 둔다.
  const dims = getImageDimensions(imageBuffer, ext);
  if (dims && dims.width > 0 && dims.height > 0) {
    const HWPUNIT_PER_PX = 75; // orgSz가 96dpi 기준 hwpunit(1/7200inch)로 저장돼 있음(7200/96=75)
    const w = Math.round(dims.width * HWPUNIT_PER_PX);
    const h = Math.round(dims.height * HWPUNIT_PER_PX);

    const orgSz = firstDescendant(picNode, "orgSz");
    if (orgSz) {
      orgSz.setAttribute("width", String(w));
      orgSz.setAttribute("height", String(h));
    }
    const imgDim = firstDescendant(picNode, "imgDim");
    if (imgDim) {
      imgDim.setAttribute("dimwidth", String(w));
      imgDim.setAttribute("dimheight", String(h));
    }
    const imgClip = firstDescendant(picNode, "imgClip");
    if (imgClip) {
      imgClip.setAttribute("left", "0");
      imgClip.setAttribute("top", "0");
      imgClip.setAttribute("right", String(w));
      imgClip.setAttribute("bottom", String(h));
    }
    const imgRectEls = picNode.getElementsByTagNameNS(HP_NS, "imgRect");
    const imgRect = imgRectEls.length ? imgRectEls[0] : null;
    if (imgRect) {
      const pt0 = imgRect.getElementsByTagNameNS(HC_NS, "pt0")[0];
      const pt1 = imgRect.getElementsByTagNameNS(HC_NS, "pt1")[0];
      const pt2 = imgRect.getElementsByTagNameNS(HC_NS, "pt2")[0];
      const pt3 = imgRect.getElementsByTagNameNS(HC_NS, "pt3")[0];
      if (pt0) {
        pt0.setAttribute("x", "0");
        pt0.setAttribute("y", "0");
      }
      if (pt1) {
        pt1.setAttribute("x", String(w));
        pt1.setAttribute("y", "0");
      }
      if (pt2) {
        pt2.setAttribute("x", String(w));
        pt2.setAttribute("y", String(h));
      }
      if (pt3) {
        pt3.setAttribute("x", "0");
        pt3.setAttribute("y", String(h));
      }
    }

    // (2026-09-16: curSz/hp:sz를 사진 비율에 맞춰 줄이는 시도를 했었는데, 오히려 정상이던
    // 항공사진이 "확대되어 보이는" 등 새로운 문제를 일으켜서 되돌림 — 표 칸 크기(curSz)는
    // 템플릿 원래 값 그대로 둔다. 사진이 칸과 비율이 안 맞아 잘려 보이는 문제는 아직 원인
    // 파악 중.)
  }
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

// 표가 아닌 본문 최상위 문단(hp:sec의 직계 hp:p) 목록 — 제목으로 구간을 찾아 문단을 채울 때 사용
export function getSectionParagraphs(doc) {
  // section0.xml의 루트(hs:sec)는 hp 네임스페이스가 아니라서 getElementsByTagNameNS(HP_NS, "sec")로는
  // 못 찾는다. 루트 자체가 sec 엘리먼트이므로 documentElement를 바로 쓴다.
  const sec = doc.documentElement;
  if (!sec) return [];
  return directChildren(sec, "p");
}

export function getParagraphText(p) {
  const tNodes = Array.from(p.getElementsByTagNameNS(HP_NS, "t"));
  return tNodes.map((t) => t.textContent).join("");
}

// 문단(refPara)을 복제해 그 뒤에 count개 추가 (표의 cloneRowsAfter와 동일한 목적, 문단 버전)
//
// cloneNode(true)는 원본 문단의 hp:linesegarray(그 문단이 화면 어디에 그려지는지 캐시해둔
// vertpos 등)까지 그대로 복사한다. 그러면 복제된 문단이 원본과 "똑같은 화면 위치"를 주장하게
// 되어, 한글에서 두 문단이 같은 자리에 겹쳐 그려지는 문제가 실제로 확인됐다(예: 3.1에 판단
// 요약이 템플릿 칸 수보다 길어 복제가 필요했던 케이스). 복제본은 한글이 한 번도 배치해본 적
// 없는 새 문단이니, linesegarray를 아예 지워서 처음부터 새로 계산하게 한다.
export function cloneParagraphsAfter(refPara, count) {
  const parent = refPara.parentNode;
  const added = [];
  let ref = refPara;
  for (let i = 0; i < count; i++) {
    const clone = refPara.cloneNode(true);
    const linesegArray = firstDescendant(clone, "linesegarray");
    if (linesegArray) linesegArray.parentNode.removeChild(linesegArray);
    clone.setAttribute("id", "0");
    parent.insertBefore(clone, ref.nextSibling);
    ref = clone;
    added.push(clone);
  }
  return added;
}

export function removeParagraph(p) {
  const parent = p.parentNode;
  if (parent) parent.removeChild(p);
}

export function setTNodeText(cell, text) {
  if (!cell) return;
  const doc = cell.ownerDocument;
  let tNodes = Array.from(cell.getElementsByTagNameNS(HP_NS, "t"));
  if (tNodes.length === 0) {
    const runs = cell.getElementsByTagNameNS(HP_NS, "run");
    if (runs.length === 0) return;
    const newT = doc.createElementNS(HP_NS, "hp:t");
    runs[0].appendChild(newT);
    tNodes = [newT];
  }
  while (tNodes[0].firstChild) tNodes[0].removeChild(tNodes[0].firstChild);
  tNodes[0].appendChild(doc.createTextNode(String(text ?? "")));
  resetLineSegArray(tNodes[0]);
  for (let i = 1; i < tNodes.length; i++) {
    while (tNodes[i].firstChild) tNodes[i].removeChild(tNodes[i].firstChild);
    resetLineSegArray(tNodes[i]);
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
  const added = [];
  for (let i = 0; i < count; i++) {
    const c1 = r1.cloneNode(true);
    const c2 = r2.cloneNode(true);
    table.insertBefore(c1, ref.nextSibling);
    table.insertBefore(c2, c1.nextSibling);
    ref = c2;
    added.push(c1, c2);
  }

  // 복제된 행들과 그 뒤에 있던 기존 행들의 rowAddr를 다시 순서대로 매김
  // (안 하면 복제된 행 전부가 원본 rowAddr를 그대로 공유해 표 구조가 깨짐)
  const allRows = getRows(table);
  const insertEndIdx = templateStartIdx + 2 + count * 2;
  for (let i = insertEndIdx; i < allRows.length; i++) {
    setRowAddr(allRows[i], templateStartIdx + count * 2 + (i - insertEndIdx) + 2);
  }
  added.forEach((row, i) => setRowAddr(row, templateStartIdx + 2 + i));

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
