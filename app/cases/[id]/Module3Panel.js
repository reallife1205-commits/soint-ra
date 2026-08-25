"use client";

import { useState } from "react";
import CategorizedRowsTable from "./CategorizedRowsTable";
import LegalJudgmentForm from "./LegalJudgmentForm";
import ChecklistJudgmentForm from "./ChecklistJudgmentForm";

const OWNERSHIP_FIELDS = [
  { key: "owner_name", label: "소유자명" },
  { key: "acquired_date", label: "취득일", type: "date" },
  { key: "disposed_date", label: "처분일", type: "date" },
  { key: "acquisition_reason", label: "취득원인" },
  { key: "business_type", label: "업종" },
  { key: "note", label: "비고" },
];

const LEASE_FIELDS = [
  { key: "tenant_name", label: "임차인명" },
  { key: "business_type", label: "업종" },
  { key: "lease_start", label: "임차 시작", type: "date" },
  { key: "lease_end", label: "임차 종료", type: "date" },
  { key: "lease_type", label: "유형" },
  { key: "note", label: "비고" },
];

const COST_CAPACITY_FIELDS = [
  { key: "item_type", label: "제출자료 유형" },
  { key: "amount", label: "금액(원)" },
  { key: "note", label: "비고" },
];

const SUB_TABS = [
  { key: "ownership", label: "소유 이력" },
  { key: "lease", label: "임대차 이력" },
  { key: "legal", label: "법적 판단" },
  { key: "soil_assessment", label: "3.2 토양환경평가" },
  { key: "cost_capacity", label: "3.3 비용감당능력" },
  { key: "access", label: "3.4 출입가능성" },
  { key: "agreement", label: "3.5 정화책임자간 약정" },
  { key: "management_history", label: "3.6 관리이력" },
];

export default function Module3Panel({ caseId }) {
  const [subTab, setSubTab] = useState("ownership");

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, borderBottom: "1px solid var(--color-border)", marginBottom: 16 }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
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
            등기부등본 갑구 기준 소유권 변동 이력을 입력하세요. 취득일 기준 오래된 순으로 정렬돼요.
          </div>
          <CategorizedRowsTable
            caseId={caseId}
            moduleNumber={3}
            category="ownership"
            fields={OWNERSHIP_FIELDS}
            emptyText="소유 이력 없음 — 아래 버튼으로 추가하세요"
          />
        </>
      )}

      {subTab === "lease" && (
        <>
          <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 10 }}>
            임차인 및 전대차 이력을 입력하세요. 업종 정보가 있으면 오염원 특정에 활용돼요.
          </div>
          <CategorizedRowsTable
            caseId={caseId}
            moduleNumber={3}
            category="lease"
            fields={LEASE_FIELDS}
            emptyText="임대차 이력 없음 — 아래 버튼으로 추가하세요"
          />
        </>
      )}

      {subTab === "legal" && <LegalJudgmentForm caseId={caseId} />}

      {subTab === "soil_assessment" && (
        <ChecklistJudgmentForm
          caseId={caseId}
          moduleNumber={3}
          category="soil_assessment"
          checklistOptions={[{ key: "assessment_report", label: "토양환경평가보고서" }]}
          summaryLabel="토양환경평가 실시, 그 밖의 토양오염 방지를 위한 주의의 정도"
          summaryPlaceholder="예: 토양환경평가 실시 여부 확인되지 않음"
        />
      )}

      {subTab === "cost_capacity" && (
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
      )}

      {subTab === "access" && (
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
          summaryPlaceholder="예: 과거 소유자는 '96.1.5일 이전에 대상부지를 양수하였으며..."
        />
      )}

      {subTab === "agreement" && (
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
      )}

      {subTab === "management_history" && (
        <ChecklistJudgmentForm
          caseId={caseId}
          moduleNumber={3}
          category="management_history"
          checklistOptions={[
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
      )}
    </div>
  );
}
