// 1.1 안건개요의 정화책임자 = 3.1 소유 이력의 마지막(현재) 소유자.
// 취득일이 가장 늦은 소유자를 고른다. 같은 날 취득한 공유자가 여럿이면 함께 적는다.
// 취득일이 하나도 없으면 표의 마지막 행을 현재 소유자로 본다.

// "1989.9", "1989-09-08", "'89.9.8", "2008년 3월" 등을 YYYYMMDD 숫자로 바꾼다. 못 읽으면 null.
function dateKey(text) {
  const nums = String(text || "").match(/\d+/g);
  if (!nums) return null;
  let year = Number(nums[0]);
  if (nums[0].length === 2) year += year > 50 ? 1900 : 2000;
  if (year < 1900 || year > 2100) return null;
  const month = Number(nums[1] || 0);
  const day = Number(nums[2] || 0);
  return year * 10000 + month * 100 + day;
}

// 3.1 표 한 행의 소유 기간. 소유 기간 칸(owner_period, "1986~2014", "2014~현재" 등)을 "~"로 나눠 읽고,
// 비어 있으면 예전처럼 취득일·처분일 칸(지금은 점유 시작·종료)을 소유 기간으로 본다.
export function ownerPeriod(d) {
  const text = String(d.owner_period || "").trim();
  if (!text) return { start: d.acquired_date || "", end: d.disposed_date || "" };
  const [start, end = ""] = text.split(/\s*~\s*/);
  return { start: start.trim(), end: /현재/.test(end) ? "" : end.trim() };
}

// 예전 "임대차 이력" 탭에서 행만 추가하고 아무것도 안 적은 행
export function isEmptyLeaseRow(d) {
  return !["tenant_name", "lease_start", "lease_end", "business_type", "lease_type", "note"].some((k) =>
    String(d[k] || "").trim()
  );
}

// rows: 3.1 표의 row_data 배열 (row_order 순)
export function currentOwnerNames(rows) {
  const owners = rows.filter((d) => d.category === "ownership" && d.owner_name);
  if (!owners.length) return [];

  const dated = owners.map((d) => ({ d, key: dateKey(ownerPeriod(d).start) })).filter((x) => x.key !== null);
  if (!dated.length) return [owners[owners.length - 1].owner_name];

  const latest = Math.max(...dated.map((x) => x.key));
  const names = dated.filter((x) => x.key === latest).map((x) => x.d.owner_name);
  return Array.from(new Set(names));
}
