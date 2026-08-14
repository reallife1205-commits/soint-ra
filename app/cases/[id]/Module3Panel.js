"use client";

import { useState } from "react";
import CategorizedRowsTable from "./CategorizedRowsTable";
import LegalJudgmentForm from "./LegalJudgmentForm";

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

const SUB_TABS = [
  { key: "ownership", label: "소유 이력" },
  { key: "lease", label: "임대차 이력" },
  { key: "legal", label: "법적 판단" },
];

export default function Module3Panel({ caseId }) {
  const [subTab, setSubTab] = useState("ownership");

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-border)", marginBottom: 16 }}>
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
    </div>
  );
}
