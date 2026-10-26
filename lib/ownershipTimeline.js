// 6장 통합 타임라인의 소유자·임차인 막대 계산. 6장 화면(Module7IntegratedTimeline)과 보고서 [표 4] 아래
// 타임라인 그림(drawOwnershipTimelinePng — 보고서 내보내기 버튼이 브라우저에서 그려 서버로 보낸다)이 같이 쓴다.
import { ownerPeriod, occupantPeriod } from "./currentOwner.js";

export const LEGAL_REFERENCE_DATE = "1996-01-06"; // 토양환경보전법 시행일 기준
export const PX_PER_YEAR = 30; // 연도 간격. 50이면 막대가 너무 길어 한눈에 안 들어와서 줄임

// 취득일/처분일 등이 이제 날짜선택기가 아니라 수기 텍스트라 "1989.9", "2008-01-10",
// "2008" 등 형식이 제각각이다. 정확한 날짜 파싱 대신 연도(필수)와 있으면 월까지만
// 관대하게 뽑아서 타임라인 위치를 근사한다. 연도를 못 찾으면(예: "현재") null 반환.
export function yearFraction(dateStr) {
  if (!dateStr) return null;
  const yearMatch = dateStr.match(/(19|20)\d{2}/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[0], 10);
  const rest = dateStr.slice(yearMatch.index + yearMatch[0].length);
  const monthMatch = rest.match(/\d{1,2}/);
  const month = monthMatch ? Math.min(Math.max(parseInt(monthMatch[0], 10), 1), 12) : 1;
  return year + (month - 1) / 12;
}

// 정렬·비교용 키 (일까지). 연도를 못 찾으면 null.
function dateKey(dateStr) {
  if (!dateStr) return null;
  const yearMatch = dateStr.match(/(19|20)\d{2}/);
  if (!yearMatch) return null;
  const nums = dateStr.slice(yearMatch.index + yearMatch[0].length).match(/\d{1,2}/g) || [];
  return parseInt(yearMatch[0], 10) * 10000 + (parseInt(nums[0], 10) || 1) * 100 + (parseInt(nums[1], 10) || 1);
}

export function formatDate(dateStr) {
  if (!dateStr) return "현재";
  return dateStr;
}

// 처분일을 비워 둔 소유자가 대부분이라 전부 "~ 현재"로 겹쳐 그려졌다.
// 처분일이 없으면 다음 소유자(더 늦은 취득일)의 취득일까지로 본다.
// 같은 날 취득한 사람들은 공동소유로 보고 함께 끝난다.
function inferOwnerEnds(list) {
  return list.map((o) => {
    if (o.end) return o;
    const k = dateKey(o.start);
    if (k == null) return o;
    const next = list
      .filter((x) => dateKey(x.start) != null && dateKey(x.start) > k)
      .sort((a, b) => dateKey(a.start) - dateKey(b.start))[0];
    return next ? { ...o, end: next.start, endInferred: true } : o;
  });
}

// 3.1 표 행(row_data 배열)에서 소유자·임차인 목록을 만든다.
export function ownershipTimelineLists(rowDataList) {
  const ownerList = [];
  const tenantList = [];
  rowDataList.forEach((d) => {
    // 소유자 줄은 소유 기간 칸으로. 한 소유자가 점유 업체마다 여러 행에 반복되므로 같은 소유자·기간은 한 번만.
    if (d.category === "ownership" && d.owner_name) {
      const { start, end } = ownerPeriod(d);
      const dup = ownerList.some((o) => o.name === d.owner_name && o.start === (start || null) && o.end === (end || null));
      if (!dup) ownerList.push({ name: d.owner_name, start: start || null, end: end || null });
    }
    // 소유·점유 표의 점유자는 소유자와 다를 때만 임차인 줄에 — 소유자가 직접 쓴 기간은 소유자 줄로 충분하다
    if (d.category === "ownership" && d.occupant_name && d.occupant_name.trim() !== (d.owner_name || "").trim()) {
      const { start, end } = occupantPeriod(d);
      tenantList.push({ name: d.occupant_name, start: start || null, end: end || null });
    }
    if (d.category === "lease" && d.tenant_name) {
      tenantList.push({
        name: d.tenant_name,
        start: d.lease_start || null,
        end: d.lease_end || null,
      });
    }
  });
  const byStart = (a, b) => (dateKey(a.start) ?? Infinity) - (dateKey(b.start) ?? Infinity);
  ownerList.sort(byStart);
  tenantList.sort(byStart);
  return { owners: inferOwnerEnds(ownerList), tenants: tenantList };
}

// 그릴 연도 범위(앞뒤 2년 여유). extraYears는 화면의 항공사진 연도처럼 같이 보여 줄 연도.
export function timelineYearRange(owners, tenants, extraYears = []) {
  const thisYear = new Date().getFullYear();
  const allYears = [thisYear, 1996, ...extraYears];
  [...owners, ...tenants].forEach((o) => {
    const s = yearFraction(o.start);
    const e = yearFraction(o.end) || thisYear;
    if (s) allYears.push(Math.floor(s));
    allYears.push(Math.ceil(e));
  });
  return { minYear: Math.min(...allYears) - 2, maxYear: Math.max(...allYears) + 2 };
}

// 기간이 겹치는 막대는 아랫줄로 내려서 서로 가리지 않게 한다.
function assignLanes(items, colorCount) {
  const laneEnds = [];
  const laneLastColor = [];
  const placed = [];
  items.forEach((it) => {
    let lane = laneEnds.findIndex((end) => end <= it.s + 1e-6);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.e);
      laneLastColor.push(-1);
    } else {
      laneEnds[lane] = it.e;
    }
    // 같은 줄 바로 앞 막대, 그리고 기간이 겹치는 다른 줄 막대와 색이 겹치지 않게 고른다
    const forbidden = new Set([laneLastColor[lane]]);
    placed.forEach((p) => {
      if (p.s < it.e && it.s < p.e) forbidden.add(p.colorIdx);
    });
    let colorIdx = laneLastColor[lane] + 1;
    for (let k = 0; k < colorCount; k++) {
      const c = (laneLastColor[lane] + 1 + k) % colorCount;
      if (!forbidden.has(c)) {
        colorIdx = c;
        break;
      }
    }
    laneLastColor[lane] = colorIdx % colorCount;
    placed.push({ ...it, lane, colorIdx: colorIdx % colorCount });
  });
  return placed;
}

// 이웃 막대끼리 확실히 구분되도록 명도 차이가 큰 초록·연두·노랑. 밝은 색은 글자를 어둡게.
export const OWNER_COLORS = [
  { bg: "#2e7d32", fg: "white" },
  { bg: "#9ccc65", fg: "#1b3a1d" },
  { bg: "#f4c430", fg: "#4a3b00" },
];
// 임차인은 소유자(초록 계열)와 헷갈리지 않으면서 눈에 덜 띄게 옅은 청회색 두 가지(갈색은 번잡해 보였다)
export const TENANT_COLORS = [
  { bg: "#b4c6dc", fg: "#22344a" },
  { bg: "#d5e0ec", fg: "#22344a" },
];
// 소유자·임차인 막대 모두 얇게(예전 28px은 번잡해 보였다)
export const BAR_HEIGHT = 18;
export const LANE_HEIGHT = 21;

export function toBars(list, colorCount) {
  const thisYear = new Date().getFullYear();
  const bars = list
    .map((item, i) => {
      const s = yearFraction(item.start);
      if (s == null) return null;
      const e = Math.max(yearFraction(item.end) || thisYear, s);
      return { ...item, i, s, e };
    })
    .filter(Boolean);
  return assignLanes(bars, colorCount);
}

// ---- 보고서용 그림 ----
// 6장 화면과 같은 막대·색으로, 항공사진 줄만 빼고 캔버스에 그려 PNG Blob으로 돌려준다(브라우저 전용).
// 보고서 폭(약 17cm)에 줄어들어 들어가므로 글자를 화면보다 크게, 2배 해상도로 그린다.
// 막대가 하나도 없으면 null.
const FONT = '"Malgun Gothic", "맑은 고딕", sans-serif';

function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return t.length > 1 ? `${t}…` : "";
}

export function drawOwnershipTimelinePng(rowDataList) {
  const { owners, tenants } = ownershipTimelineLists(rowDataList);
  const ownerBars = toBars(owners, OWNER_COLORS.length);
  const tenantBars = toBars(tenants, TENANT_COLORS.length);
  if (!ownerBars.length && !tenantBars.length) return Promise.resolve(null);

  const { minYear, maxYear } = timelineYearRange(owners, tenants);
  // 화면처럼 연도당 30px로 그리면 7:1쯤 납작한 그림이 돼 본문 폭으로 줄이면 글자가 4pt 정도로 작아진다.
  // 폭을 본문에 맞는 760px로 고정하고 연도 간격을 거기에 맞춘다(글자 13px ≈ 보고서에서 8~9pt).
  const WIDTH = 760;
  const LABEL_W = 56;
  const PAD = 12;
  const AXIS_H = 26;
  const ROW_GAP = 10;
  const LEGEND_H = 30;
  const BAR_H = 20;
  const LANE_H = 24;
  const lanesOf = (bars) => Math.max(1, ...bars.map((b) => b.lane + 1));
  const rows = [{ label: "소유자", bars: ownerBars, colors: OWNER_COLORS }];
  if (tenantBars.length) rows.push({ label: "임차인", bars: tenantBars, colors: TENANT_COLORS });

  const width = WIDTH;
  const chartW = WIDTH - PAD - LABEL_W - PAD;
  const pxPerYear = chartW / (maxYear - minYear);
  const rowsH = rows.reduce((h, r) => h + lanesOf(r.bars) * LANE_H + ROW_GAP, 0);
  const height = PAD + AXIS_H + 6 + rowsH + LEGEND_H + PAD;

  const SCALE = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);

  const x0 = PAD + LABEL_W;
  const xFor = (yf) => x0 + (yf - minYear) * pxPerYear;
  const chartTop = PAD + AXIS_H;
  const chartBottom = chartTop + 6 + rowsH;

  // 연도 눈금(5년마다)과 옅은 세로 보조선
  ctx.font = `13px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (let y = Math.ceil(minYear / 5) * 5; y <= maxYear; y += 5) {
    ctx.fillStyle = "#555";
    ctx.fillText(String(y), xFor(y), chartTop - 8);
    ctx.strokeStyle = "#e6e6e6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xFor(y) + 0.5, chartTop);
    ctx.lineTo(xFor(y) + 0.5, chartBottom);
    ctx.stroke();
  }
  ctx.strokeStyle = "#999";
  ctx.beginPath();
  ctx.moveTo(x0, chartTop + 0.5);
  ctx.lineTo(x0 + chartW, chartTop + 0.5);
  ctx.stroke();

  // 소유자·임차인 막대
  let top = chartTop + 6;
  rows.forEach((r) => {
    const lanes = lanesOf(r.bars);
    ctx.fillStyle = "#222";
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(r.label, PAD, top + (lanes * LANE_H) / 2);
    ctx.textAlign = "center";
    r.bars.forEach((b) => {
      const left = xFor(b.s);
      const w = Math.max(xFor(b.e) - left - 1, 4);
      const y = top + b.lane * LANE_H;
      const color = r.colors[b.colorIdx % r.colors.length];
      ctx.fillStyle = color.bg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(left, y, w, BAR_H, 4);
      else ctx.rect(left, y, w, BAR_H);
      ctx.fill();
      // 짧은 막대는 글자를 조금 줄여 보고, 그래도 넘치면 말줄임
      ctx.font = `13px ${FONT}`;
      if (ctx.measureText(b.name).width > w - 6) ctx.font = `11px ${FONT}`;
      const label = ellipsize(ctx, b.name, w - 6);
      if (label) {
        ctx.fillStyle = color.fg;
        ctx.fillText(label, left + w / 2, y + BAR_H / 2 + 1);
      }
    });
    top += lanes * LANE_H + ROW_GAP;
  });

  // 법 기준일 점선
  const legalX = xFor(yearFraction(LEGAL_REFERENCE_DATE));
  ctx.strokeStyle = "#d64545";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(legalX, chartTop);
  ctx.lineTo(legalX, chartBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  // 범례
  const legendY = chartBottom + LEGEND_H / 2 + 2;
  let lx = x0;
  ctx.font = `13px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const legend = [
    { label: "소유자", color: OWNER_COLORS[0].bg },
    ...(tenantBars.length ? [{ label: "임차인", color: TENANT_COLORS[0].bg }] : []),
  ];
  legend.forEach((it) => {
    ctx.fillStyle = it.color;
    ctx.fillRect(lx, legendY - 5, 10, 10);
    ctx.fillStyle = "#444";
    ctx.fillText(it.label, lx + 14, legendY);
    lx += 14 + ctx.measureText(it.label).width + 18;
  });
  ctx.strokeStyle = "#d64545";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(lx, legendY);
  ctx.lineTo(lx + 18, legendY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#d64545";
  ctx.fillText("1996.1.6 토양환경보전법 시행", lx + 22, legendY);

  // 테두리: 보고서에서 위 [표 4]와 같은 폭으로 놓이므로 표 선(회색 0.1~0.15mm)과 비슷하게 — 1px ≈ 0.22mm
  ctx.strokeStyle = "#808080";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
