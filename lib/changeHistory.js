// 변경 이력(change_history, sql/025)을 화면에 보여주고 되돌리기 위한 도우미.
// 이력은 DB 트리거가 자동으로 남기므로, 각 화면의 저장 코드는 따로 손댈 필요가 없다.
import { supabase } from "@/lib/supabaseClient";

// 장·하위 화면별로 어떤 기록을 "이 화면 관련"으로 볼지. module_rows는 module_number로 구분.
const SCREEN_SCOPES = {
  "1": { modules: [0], tables: ["cases"] },
  "2.1": { modules: [1] },
  "2.2": { modules: [2, 7], tables: ["surrounding_impacts"] },
  "3": { modules: [3, 4, 5] },
  "4": { modules: [6], tables: ["field_surveys"] },
  "5": { modules: [8] },
  "6": { modules: [3, 7], tables: ["pollution_mappings", "review_opinions"] },
};

export function screenScope(chapterKey, subTabKey) {
  return SCREEN_SCOPES[subTabKey] || SCREEN_SCOPES[chapterKey] || null;
}

export function inScope(entry, scope) {
  if (!scope) return true;
  if (entry.table_name === "module_rows") return (scope.modules || []).includes(entry.module_number);
  return (scope.tables || []).includes(entry.table_name);
}

const MODULE_LABELS = {
  0: "1. 개요",
  1: "2.1 대상부지 오염현황",
  2: "2.2 주변부지 조사",
  3: "3장·6장",
  4: "3.4 항공사진",
  5: "3.1 DART·공장조회",
  6: "4. 현장 및 청취조사",
  7: "2.2·6장 종합",
  8: "5. 과학적 기법",
};

const TABLE_LABELS = {
  cases: "안건 정보",
  field_surveys: "4. 현장조사",
  pollution_mappings: "6장 오염원 매핑",
  surrounding_impacts: "2.2 주변부지 영향",
  review_opinions: "6장 검토 의견",
};

const CATEGORY_LABELS = {
  overview: "개요",
  settings: "설정",
  ownership: "소유 이력",
  lease: "임대차 이력",
  ownership_lease: "소유·임대차",
  ownership_table_analysis: "소유이력 표 분석",
  party_matching: "당사자 매칭",
  soil_assessment: "토양환경평가",
  cost_capacity: "비용감당능력",
  cost_capacity_item: "비용감당능력 항목",
  access: "출입가능성",
  agreement: "정화책임자간 약정",
  management_history: "관리이력",
  factory_history_item: "공장등록 이력",
  legal: "법적 판단",
  scientific_analysis: "과학적 분석",
  pollution_map: "오염분포도",
  sample_points: "시료채취지점",
  site_plan: "배치 평면도",
  progress: "진행 상황",
};

export function entryPlace(entry) {
  if (entry.table_name !== "module_rows") return TABLE_LABELS[entry.table_name] || entry.table_name;
  const base = MODULE_LABELS[entry.module_number] ?? `모듈 ${entry.module_number}`;
  const cat = (entry.new_data || entry.old_data)?.row_data?.category;
  return cat ? `${base} · ${CATEGORY_LABELS[cat] || cat}` : base;
}

// 각 화면 표의 칸 이름(FIELDS)에서 모은 것. 없는 칸은 영문 키 그대로 보인다.
const FIELD_LABELS = {
  acquired_date: "취득일(예전)", acquisition_reason: "취득원인", action_standard: "대책기준",
  address: "주소", agreement_exists: "약정 유무", amount: "금액(원)", area: "오염면적",
  area_total: "오염면적 합계", area_sqm: "면적(㎡)", business_type: "업종",
  case_number: "안건번호", company_name: "회사명", concern_standard: "우려기준",
  contaminant: "오염물질", contaminants: "오염물질", content: "내용", date: "일자",
  depth: "심도", depth_end: "끝 깊이", depth_start: "시작 깊이", description: "내용",
  disposed_date: "처분일(예전)", due_date: "마감일", industrial_complex: "산업단지명",
  item: "구분", item_type: "제출자료 유형", land_use: "토지이용 현황", lease_end: "임차 종료",
  lease_start: "임차 시작", lease_type: "유형", manager: "담당자", max_concentration: "최고농도",
  note: "비고", occupant_name: "점유자", occupant_period: "점유 기간", owner_period: "소유 기간", opinion: "검토 의견", owner_name: "소유자", product: "생산품",
  raw_material: "원자재", region: "지역", region_grade: "지역등급", site_name: "부지명",
  status: "상태", substance: "오염물질", tenant_name: "임차인명", volume: "오염량",
  other_text: "기타", sources: "출처",
};

export function fieldLabel(key) {
  return FIELD_LABELS[key] || key;
}

const IGNORED_COLUMNS = new Set(["id", "case_id", "created_at", "updated_at", "module_number", "row_order"]);

// 비교 대상 칸들: module_rows는 row_data 안, 나머지 테이블은 컬럼 그대로
function fieldsOf(table, row) {
  if (!row) return {};
  if (table === "module_rows") {
    const { category, ...rest } = row.row_data || {};
    return rest;
  }
  const out = {};
  Object.entries(row).forEach(([k, v]) => {
    if (!IGNORED_COLUMNS.has(k)) out[k] = v;
  });
  return out;
}

function same(a, b) {
  return JSON.stringify(a ?? "") === JSON.stringify(b ?? "");
}

// [{ key, before, after }] — 실제로 값이 바뀐 칸만
export function changedFields(entry) {
  const before = fieldsOf(entry.table_name, entry.old_data);
  const after = fieldsOf(entry.table_name, entry.new_data);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys
    .filter((k) => !same(before[k], after[k]))
    .map((k) => ({ key: k, before: before[k], after: after[k] }));
}

export function displayValue(v) {
  if (v === undefined || v === null || v === "") return "(비어 있음)";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export async function loadCaseHistory(caseId) {
  const { data, error } = await supabase
    .from("change_history")
    .select("*")
    .eq("case_id", caseId)
    .order("changed_at", { ascending: false })
    .limit(300);
  return { data: data || [], error };
}

// 칸 하나만 예전 값으로 되돌린다 — 같은 행의 다른 칸에 나중에 입력한 내용은 건드리지 않는다.
export async function restoreField(entry, key, value) {
  const { data: current, error: loadError } = await supabase
    .from(entry.table_name)
    .select("*")
    .eq("id", entry.row_id)
    .maybeSingle();
  if (loadError) return { error: loadError };
  if (!current) return { error: { message: "이 행은 이미 삭제됐어요. 삭제 기록에서 '되살리기'를 먼저 해 주세요." } };

  let patch;
  if (entry.table_name === "module_rows") {
    const row_data = { ...(current.row_data || {}) };
    if (value === undefined) delete row_data[key];
    else row_data[key] = value;
    patch = { row_data };
  } else {
    patch = { [key]: value ?? null };
  }
  if ("updated_at" in current) patch.updated_at = new Date().toISOString();
  return supabase.from(entry.table_name).update(patch).eq("id", entry.row_id);
}

// 삭제된 행을 삭제 직전 그대로 다시 넣는다(같은 id).
export async function restoreDeletedRow(entry) {
  const { data: exists } = await supabase
    .from(entry.table_name)
    .select("id")
    .eq("id", entry.row_id)
    .maybeSingle();
  if (exists) return { error: { message: "이 행은 이미 되살려져 있어요." } };
  return supabase.from(entry.table_name).insert([entry.old_data]);
}

// 추가했던 행을 지운다(추가 취소).
export async function undoInsert(entry) {
  return supabase.from(entry.table_name).delete().eq("id", entry.row_id);
}
