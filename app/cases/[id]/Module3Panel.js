"use client";

import { useState } from "react";
import CategorizedRowsTable from "./CategorizedRowsTable";
import ChecklistJudgmentForm from "./ChecklistJudgmentForm";
import OwnershipTableUpload from "./OwnershipTableUpload";
import ImageGallery from "./ImageGallery";
import { useModuleRows } from "@/lib/useModuleRows";

// 보고서 [표 4] "기간/소유자/점유자/업종"과 같은 모양으로, 소유와 점유(임차)를 한 표에 적는다.
// 예전 "임대차 이력"(category lease, tenant_name 등)은 화면에서 뺐고, 남아 있으면 LegacyLeaseRows로 옮긴다.
// 예전에 적은 취득원인(acquisition_reason)은 row_data에 남아 있지만 화면·보고서에는 쓰지 않는다.
const OWNERSHIP_FIELDS = [
  // 업종은 너비를 안 줘서 남는 폭을 전부 가져가게 한다(업종 설명이 가장 길다)
  { key: "owner_name", label: "소유자", width: "17%" },
  { key: "occupant_name", label: "점유자", width: "17%" },
  { key: "acquired_date", label: "취득일", width: "11%" },
  { key: "disposed_date", label: "처분일", width: "11%" },
  { key: "business_type", label: "업종" },
  { key: "note", label: "비고", width: "14%" },
];

const COST_CAPACITY_FIELDS = [
  { key: "item_type", label: "제출자료 유형" },
  { key: "amount", label: "금액(원)" },
  { key: "note", label: "비고" },
];

const OWNERSHIP_SUB_TABS = [
  { key: "ownership", label: "소유·점유 이력" },
  { key: "table", label: "증빙 표" },
];

// 3.1 소유·점유·운영 안의 "소유·점유 이력" 도구. (항공사진/DART는 별도 컴포넌트를 그대로 씀)
export function OwnershipLeaseSection({ caseId }) {
  const [subTab, setSubTab] = useState("ownership");
  // 예전 임대차 행을 옮긴 뒤 표를 다시 불러오도록(표와 옮기기 칸이 행을 각자 불러온다)
  const [tableVersion, setTableVersion] = useState(0);

  return (
    <div>
      <ChecklistJudgmentForm
        caseId={caseId}
        moduleNumber={3}
        category="ownership_lease"
        checklistOptions={[
          { key: "lease_contract", label: "임대차계약서" },
          { key: "land_registry", label: "토지대장" },
          { key: "aerial_photo", label: "항공사진" },
          { key: "cadastral_map", label: "지적도" },
        ]}
        summaryLabel="토양오염관리대상시설(또는 부지)의 소유·점유 또는 운영"
        summaryPlaceholder="예: 토지대장 상 자문부지는 '89년 소유권이 이전되었고..."
        summaryRows={8}
      />

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-border)", margin: "18px 0 16px" }}>
        {OWNERSHIP_SUB_TABS.map((t) => (
          <button
            key={t.key}
            data-view onClick={() => setSubTab(t.key)}
            style={{
              border: "none",
              background: "transparent",
              padding: "8px 14px",
              fontSize: 15,
              cursor: "pointer",
              fontWeight: subTab === t.key ? 700 : 400,
              borderBottom:
                subTab === t.key
                  ? "2px solid var(--color-primary)"
                  : "2px solid transparent",
              color: subTab === t.key ? "var(--color-primary)" : "var(--color-text)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "ownership" && (
        <>
          <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 10 }}>
            등기부등본 갑구 기준 소유권 변동 이력과 그 기간의 점유자(직접 사용하면 소유자와 같은 이름, 임차인이 썼으면
            임차인)를 입력하세요. 보고서 [표 4] 소유·점유 현황에 이 순서대로 들어가요.
          </div>
          <LegacyLeaseRows caseId={caseId} onMoved={() => setTableVersion((v) => v + 1)} />
          <OwnerToOccupant key={`fix-${tableVersion}`} caseId={caseId} onMoved={() => setTableVersion((v) => v + 1)} />
          <CategorizedRowsTable
            key={tableVersion}
            caseId={caseId}
            moduleNumber={3}
            category="ownership"
            fields={OWNERSHIP_FIELDS}
            emptyText="소유·점유 이력 없음 — 아래 버튼으로 추가하세요"
          />
        </>
      )}

      {subTab === "table" && <OwnershipTableUpload caseId={caseId} />}
    </div>
  );
}

// 예전 "임대차 이력" 탭에 적은 행이 남아 있으면 알려 주고, 누르면 소유·점유 표의 행(점유자 칸)으로 바꾼다.
// 새 행을 만들지 않고 같은 행의 row_data만 바꾸므로 변경 이력에서 되돌릴 수 있다.
function LegacyLeaseRows({ caseId, onMoved }) {
  const { rows, updateRow } = useModuleRows(caseId, 3);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const leaseRows = rows.filter((r) => r.row_data.category === "lease");
  if (!leaseRows.length) return null;

  async function moveAll() {
    setMoving(true);
    setError("");
    for (const row of leaseRows) {
      const d = row.row_data;
      const { error: moveError } = await updateRow(row.id, {
        category: "ownership",
        owner_name: "",
        occupant_name: d.tenant_name || "",
        acquired_date: d.lease_start || "",
        disposed_date: d.lease_end || "",
        business_type: d.business_type || "",
        note: [d.lease_type, d.note].filter(Boolean).join(" / "),
      });
      if (moveError) {
        setError(`옮기지 못했어요: ${moveError.message}`);
        break;
      }
    }
    setMoving(false);
    onMoved();
  }

  return (
    <div
      style={{
        padding: "10px 12px",
        marginBottom: 12,
        borderRadius: 8,
        background: "var(--color-badge-yellow-bg)",
        color: "var(--color-badge-yellow-text)",
        fontSize: 14,
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span>
        예전 임대차 이력 {leaseRows.length}건이 따로 남아 있어요 (
        {leaseRows.map((r) => r.row_data.tenant_name || "이름 없음").join(", ")}). 이 표의 점유자 칸으로 옮기면
        기간·업종·비고도 같이 옮겨져요.
      </span>
      <button className="btn-secondary" onClick={moveAll} disabled={moving}>
        {moving ? "옮기는 중..." : "이 표로 옮기기"}
      </button>
      {error && <span style={{ color: "var(--color-badge-red-text)" }}>{error}</span>}
    </div>
  );
}

// 점유자 칸이 생기기 전에는 소유자명 칸에 실제로는 점유 업체를 적은 안건이 있다(지엠금속 등).
// 점유자 칸이 전부 비어 있을 때만 보여 주고, 누르면 소유자 칸 이름을 점유자 칸으로 옮기고 소유자 칸을 비운다.
function OwnerToOccupant({ caseId, onMoved }) {
  const { rows, updateRow } = useModuleRows(caseId, 3);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const ownership = rows.filter((r) => r.row_data.category === "ownership");
  const targets = ownership.filter((r) => r.row_data.owner_name?.trim());
  if (!targets.length || ownership.some((r) => r.row_data.occupant_name?.trim())) return null;

  async function moveAll() {
    setMoving(true);
    setError("");
    for (const row of targets) {
      const { error: moveError } = await updateRow(row.id, {
        ...row.row_data,
        occupant_name: row.row_data.owner_name,
        owner_name: "",
      });
      if (moveError) {
        setError(`옮기지 못했어요: ${moveError.message}`);
        break;
      }
    }
    setMoving(false);
    onMoved();
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10, fontSize: 14 }}>
      <span style={{ color: "var(--color-text-muted)" }}>
        아래 소유자 칸에 적은 이름이 실제로는 점유 업체라면:
      </span>
      <button className="btn-secondary" onClick={moveAll} disabled={moving}>
        {moving ? "옮기는 중..." : "소유자 칸 이름을 점유자 칸으로 옮기기"}
      </button>
      {error && <span style={{ color: "var(--color-badge-red-text)" }}>{error}</span>}
    </div>
  );
}

export function SoilAssessmentSection({ caseId }) {
  return (
    <ChecklistJudgmentForm
      caseId={caseId}
      moduleNumber={3}
      category="soil_assessment"
      checklistOptions={[{ key: "assessment_report", label: "토양환경평가보고서" }]}
      summaryLabel="토양환경평가 실시, 그 밖의 토양오염 방지를 위한 주의의 정도"
      summaryPlaceholder="예: 토양환경평가 실시 여부 확인되지 않음"
    />
  );
}

export function CostCapacitySection({ caseId }) {
  return (
    <>
      <ChecklistJudgmentForm
        caseId={caseId}
        moduleNumber={3}
        category="cost_capacity"
        checklistOptions={[
          { key: "property_tax", label: "재산세 납부실적" },
          { key: "asset_valuation", label: "재산평가액 보고서" },
          { key: "debt_assessment", label: "부채정도 평가서" },
        ]}
        summaryLabel="토양정화에 드는 비용을 감당할 능력이 있는지 여부"
        summaryPlaceholder="예: 파랑돌(현 소유자 중 1인)의 부채는 7억4천이며..."
      />
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", margin: "14px 0 8px" }}>
        제출자료 상세 (재산세 납부실적 등)
      </div>
      <CategorizedRowsTable
        caseId={caseId}
        moduleNumber={3}
        category="cost_capacity_item"
        fields={COST_CAPACITY_FIELDS}
        emptyText="제출자료 없음 — 아래 버튼으로 추가하세요"
      />
    </>
  );
}

export function AccessSection({ caseId }) {
  return (
    <>
      <ChecklistJudgmentForm
        caseId={caseId}
        moduleNumber={3}
        category="access"
        checklistOptions={[
          { key: "aerial_photo", label: "항공사진" },
          { key: "design_drawing", label: "설계도면" },
          { key: "site_plan", label: "배치 평면도" },
          { key: "site_photo", label: "현장사진" },
        ]}
        summaryLabel="토양오염이 발생한 토지로의 출입 가능성 또는 용이성"
        summaryPlaceholder={
          "예: (오염 발생 당시 출입 가능성) 오염 지점은 '08~'16년 OO단조가 운영하던 단조 공정 및 자재 야적 구역에 해당함\n" +
          "\n(정화 시 출입 용이성) 현 소유자 OO테크가 부지를 직접 사용하고 있어 정화를 위한 출입이 용이함"
        }
        summaryRows={8}
        headingBold
        draftEndpoint="/api/draft-access"
      />
      <div style={{ marginTop: 16 }}>
        <ImageGallery
          caseId={caseId}
          moduleNumber={3}
          category="site_plan"
          title="배치도 등 (항공사진은 왼쪽에)"
          // 실제 고르는 규칙은 export-report의 fetchSitePlanImage — 바꾸면 이 안내도 같이 고칠 것
          hint={
            <>
              보고서 배치도면엔 이름이 <b>배치도</b> → <b>부지전경</b>인 사진이 들어가요(없으면 최근 연도 항공사진).
            </>
          }
        />
      </div>
    </>
  );
}

export function AgreementSection({ caseId }) {
  return (
    <ChecklistJudgmentForm
      caseId={caseId}
      moduleNumber={3}
      category="agreement"
      checklistOptions={[
        { key: "cleanup_agreement", label: "정화분담 약정서" },
        { key: "cost_agreement", label: "비용분담 합의서" },
      ]}
      radioField={{ key: "agreement_exists", label: "복수의 정화책임자 간 약정 유무", options: ["있음", "없음"] }}
      summaryLabel="정화책임자 간의 약정 내용"
      summaryPlaceholder="예: 복수의 정화책임자 간 비용분담에 관한 약정 또는 합의 여부는 확인되지 않음"
    />
  );
}

export function ManagementHistorySection({ caseId }) {
  return (
    <ChecklistJudgmentForm
      caseId={caseId}
      moduleNumber={3}
      category="management_history"
      checklistOptions={[
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
      ]}
      summaryLabel="토양오염물질의 관리 이력"
      summaryPlaceholder="예: 부지 내 시설에서 아연 및 TPH를 취급한 기록이 확인되지 않음"
    />
  );
}
