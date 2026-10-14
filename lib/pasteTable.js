// 웹 화면(예: 팩토리온 조회 결과)의 표를 드래그·복사해 붙여 넣은 텍스트를 행 데이터로 바꾼다.
// 브라우저에서 표를 복사하면 칸은 탭, 줄은 줄바꿈으로 구분된 텍스트가 된다.
//
// fields: [{ key, label, type?, aliases? }] — 첫 줄이 머리글이면 label/aliases로 칸을 맞추고,
// 머리글이 없으면 fields 순서대로 채운다. "연번"·"No" 같은 번호 칸은 버린다.

const SKIP_HEADERS = /^(연번|번호|순번|no\.?|#)$/i;

function normalizeHeader(s) {
  return String(s || "").replace(/\s+/g, "").replace(/[()（）]/g, "").toLowerCase();
}

// "2008.1.10", "2008-01-10", "20080110", "2008년 1월 10일" → "2008-01-10". 못 읽으면 원문 그대로.
export function normalizeDate(text) {
  const t = String(text || "").trim();
  if (!t || t === "-") return "";
  let m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) m = t.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (!m) return t;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function splitCells(line) {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  // 탭이 없으면(일부 화면은 공백으로 복사됨) 공백 2칸 이상을 칸 구분으로 본다
  return line.split(/\s{2,}/).map((c) => c.trim());
}

export function parsePastedTable(text, fields) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], headerFound: false };

  const matchField = (cell) => {
    const h = normalizeHeader(cell);
    if (!h) return null;
    return (
      fields.find((f) => [f.label, ...(f.aliases || [])].some((a) => normalizeHeader(a) === h)) ||
      fields.find((f) => [f.label, ...(f.aliases || [])].some((a) => h.includes(normalizeHeader(a)))) ||
      null
    );
  };

  // 머리글 줄 찾기: 칸 2개 이상이 필드 이름과 맞으면 머리글로 본다
  let columnKeys = null;
  let start = 0;
  let firstCells = splitCells(lines[0]);
  const isHeader = (cells) =>
    cells.map((c) => (SKIP_HEADERS.test(c.trim()) ? null : matchField(c))).filter(Boolean).length >= 2;
  if (isHeader(firstCells)) {
    start = 1;
    // 머리글 칸 안에 줄바꿈이 있으면(팩토리온 "대표업종\n(분류코드)") 복사본에서 머리글이 두 줄로
    // 쪼개진다 — 다음 줄이 "("로 시작하면 머리글의 이어지는 부분으로 붙인다.
    while (start < lines.length && /^\(/.test(splitCells(lines[start])[0] || "")) {
      const cont = splitCells(lines[start]);
      firstCells = [...firstCells.slice(0, -1), firstCells[firstCells.length - 1] + cont[0], ...cont.slice(1)];
      start++;
    }
    columnKeys = firstCells.map((c) => (SKIP_HEADERS.test(c.trim()) ? null : matchField(c))?.key || null);
  }

  const rows = [];
  for (let i = start; i < lines.length; i++) {
    let cells = splitCells(lines[i]);
    let keys = columnKeys;
    if (!keys) {
      // 머리글이 없으면: 첫 칸이 숫자뿐(연번)이고 칸이 필드보다 많으면 버리고 순서대로
      if (cells.length > fields.length && /^\d+$/.test(cells[0])) cells = cells.slice(1);
      keys = fields.map((f) => f.key);
    }
    const data = {};
    keys.forEach((key, idx) => {
      if (!key || cells[idx] === undefined) return;
      const field = fields.find((f) => f.key === key);
      const value = field?.type === "date" ? normalizeDate(cells[idx]) : cells[idx].trim();
      if (value && value !== "-") data[key] = value;
    });
    if (Object.keys(data).length > 0) rows.push(data);
  }
  return { rows, headerFound: !!columnKeys };
}
