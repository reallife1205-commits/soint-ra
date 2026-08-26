"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { CHAPTERS } from "@/lib/modules";
import { ddayInfo } from "@/lib/dday";
import Module0Overview from "./Module0Overview";
import Module1Panel from "./Module1Panel";
import Module2Panel from "./Module2Panel";
import { OwnershipLeaseSection, SoilAssessmentSection, CostCapacitySection, AccessSection, AgreementSection, ManagementHistorySection } from "./Module3Panel";
import Module4Panel from "./Module4Panel";
import Module5Panel from "./Module5Panel";
import Module6Panel from "./Module6Panel";
import LegalJudgmentForm from "./LegalJudgmentForm";
import IntegratedTimeline from "./Module7IntegratedTimeline";
import PollutionMappingTab from "./Module7PollutionMapping";
import SurroundingImpactTab from "./Module7SurroundingImpact";
import ReviewOpinionTab from "./Module7ReviewOpinion";
import ModuleCompletionToggle from "./ModuleCompletionToggle";
import DocumentUpload from "./DocumentUpload";

const SUB_TAB_31 = [
  { key: "ownership", label: "소유·임대차 이력", moduleNumber: 3 },
  { key: "aerial", label: "항공사진", moduleNumber: 4 },
  { key: "dart", label: "DART·공장조회", moduleNumber: 5 },
];

const SUB_TAB_22 = [
  { key: "surrounding_data", label: "주변부지 조사", moduleNumber: 2 },
  { key: "surrounding_impact", label: "주변부지 영향 판단", moduleNumber: 7 },
];

const SUB_TAB_6 = [
  { key: "legal", label: "법적 판단", moduleNumber: 3 },
  { key: "timeline", label: "통합 타임라인", moduleNumber: 7 },
  { key: "opinion", label: "검토 의견", moduleNumber: 7 },
];

export default function CaseDetailPage() {
  const { id } = useParams();
  const [caseInfo, setCaseInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState("1");
  const [activeSubTab, setActiveSubTab] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [moduleStatus, setModuleStatus] = useState({});
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ manager: "", due_date: "" });
  const [savingMeta, setSavingMeta] = useState(false);

  const loadCase = useCallback(async () => {
    const { data } = await supabase.from("cases").select("*").eq("id", id).single();
    setCaseInfo(data);
  }, [id]);

  const loadModuleStatus = useCallback(async () => {
    const { data } = await supabase
      .from("module_status")
      .select("*")
      .eq("case_id", id);
    const map = {};
    (data || []).forEach((row) => {
      map[row.module_number] = row;
    });
    setModuleStatus(map);
  }, [id]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadCase(), loadModuleStatus()]);
      setLoading(false);
    }
    init();
  }, [loadCase, loadModuleStatus]);

  useEffect(() => {
    if (caseInfo && !editingMeta) {
      setMetaForm({
        manager: caseInfo.manager || "",
        due_date: caseInfo.due_date || "",
      });
    }
  }, [caseInfo, editingMeta]);

  async function saveMeta() {
    setSavingMeta(true);
    await supabase
      .from("cases")
      .update({
        manager: metaForm.manager || null,
        due_date: metaForm.due_date || null,
      })
      .eq("id", id);
    await loadCase();
    setSavingMeta(false);
    setEditingMeta(false);
  }

  const completedCount = Object.values(moduleStatus).filter((m) => m.is_completed).length;
  const dday = ddayInfo(caseInfo?.due_date);

  function selectChapter(chapterKey) {
    setActiveChapter(chapterKey);
    const chapter = CHAPTERS.find((c) => c.key === chapterKey);
    setActiveSubTab(chapter?.subTabs ? chapter.subTabs[0].key : null);
    if (chapterKey === "3" && chapter?.subTabs?.[0]?.key === "3.1") setActiveTool("ownership");
    else if (chapterKey === "2") setActiveTool("surrounding_data");
    else if (chapterKey === "6") setActiveTool("legal");
    else setActiveTool(null);
  }

  function selectSubTab(subTabKey) {
    setActiveSubTab(subTabKey);
    if (subTabKey === "3.1") setActiveTool("ownership");
    else if (subTabKey === "2.2") setActiveTool("surrounding_data");
    else setActiveTool(null);
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">불러오는 중이에요...</div>
      </div>
    );
  }

  if (!caseInfo) {
    return (
      <div className="page">
        <Link href="/cases" style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-muted)" }}>
          ← 목록으로
        </Link>
        <div className="card" style={{ marginTop: 16 }}>
          해당 안건을 찾을 수 없어요.
        </div>
      </div>
    );
  }

  const activeChapterMeta = CHAPTERS.find((c) => c.key === activeChapter);
  const activeSubTabMeta = activeChapterMeta?.subTabs?.find((s) => s.key === activeSubTab);

  // 현재 화면에 표시할 제목 + 완료토글에 쓸 옛 module_number 결정
  let headingLabel = activeChapterMeta?.label;
  let effectiveModuleNumber = activeChapterMeta?.oldModuleNumbers?.[0];

  if (activeChapter === "2" && activeSubTab === "2.2") {
    headingLabel = SUB_TAB_22.find((t) => t.key === activeTool)?.label
      ? `${activeSubTabMeta.label} — ${SUB_TAB_22.find((t) => t.key === activeTool).label}`
      : activeSubTabMeta.label;
    effectiveModuleNumber = SUB_TAB_22.find((t) => t.key === activeTool)?.moduleNumber ?? 2;
  } else if (activeSubTabMeta) {
    headingLabel = activeSubTabMeta.label;
    effectiveModuleNumber = activeSubTabMeta.oldModuleNumbers?.[0];
  }

  if (activeChapter === "3" && activeSubTab === "3.1") {
    const tool = SUB_TAB_31.find((t) => t.key === activeTool);
    headingLabel = tool ? `3.1 소유·점유·운영 — ${tool.label}` : "3.1 소유·점유·운영";
    effectiveModuleNumber = tool?.moduleNumber ?? 3;
  }

  if (activeChapter === "6") {
    const tool = SUB_TAB_6.find((t) => t.key === activeTool);
    headingLabel = tool ? `6. 기술검토 결과(종합) — ${tool.label}` : "6. 기술검토 결과(종합)";
    effectiveModuleNumber = tool?.moduleNumber ?? 3;
  }

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <Link href="/cases" style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-muted)" }}>
            ← 목록
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 18 }}>
              {caseInfo.case_number} · {caseInfo.company_name}
            </span>
            <span
              className={`badge ${
                caseInfo.status === "완료" ? "badge-green" : "badge-blue"
              }`}
            >
              {caseInfo.status}
            </span>
            {dday && (
              <span className={`badge ${dday.badgeClass}`}>{dday.label}</span>
            )}
          </div>
          {editingMeta ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
                {caseInfo.address}
              </span>
              <input
                value={metaForm.manager}
                onChange={(e) =>
                  setMetaForm((f) => ({ ...f, manager: e.target.value }))
                }
                placeholder="담당자"
                style={{
                  width: 100,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  fontSize: 14,
                }}
              />
              <input
                type="date"
                value={metaForm.due_date}
                onChange={(e) =>
                  setMetaForm((f) => ({ ...f, due_date: e.target.value }))
                }
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  fontSize: 14,
                }}
              />
              <button
                className="btn-primary"
                onClick={saveMeta}
                disabled={savingMeta}
                style={{ padding: "4px 10px", fontSize: 14 }}
              >
                {savingMeta ? "저장 중..." : "저장"}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setEditingMeta(false)}
                style={{ padding: "4px 10px", fontSize: 14 }}
              >
                취소
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 15, color: "var(--color-text-muted)", marginTop: 2 }}>
              {caseInfo.address} · 담당: {caseInfo.manager || "-"}
              {caseInfo.due_date ? ` · 마감: ${caseInfo.due_date}` : ""}{" "}
              <button
                onClick={() => setEditingMeta(true)}
                style={{
                  border: "none",
                  background: "none",
                  color: "var(--color-primary)",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: 0,
                  marginLeft: 4,
                }}
              >
                수정
              </button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
            {completedCount}/8 완료
          </div>
          <a href={`/api/cases/${id}/export-report`} className="btn-secondary">
            📄 보고서 초안 내보내기
          </a>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--color-border)",
          overflowX: "auto",
        }}
      >
        {CHAPTERS.map((c) => {
          const isActive = activeChapter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => selectChapter(c.key)}
              style={{
                border: "none",
                background: "transparent",
                padding: "10px 14px",
                cursor: "pointer",
                borderBottom: isActive ? "2px solid var(--color-chapter-active)" : "2px solid transparent",
                textAlign: "left",
                fontSize: 17,
                fontWeight: 700,
                whiteSpace: "nowrap",
                color: isActive ? "var(--color-chapter-active)" : "var(--color-secondary)",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {activeChapterMeta?.subTabs && (
        <div
          style={{
            display: "flex",
            gap: 4,
            borderBottom: "1px solid var(--color-border)",
            marginBottom: 20,
            overflowX: "auto",
            background: "#f6f8f4",
          }}
        >
          {activeChapterMeta.subTabs.map((s) => {
            const isActive = activeSubTab === s.key;
            return (
              <button
                key={s.key}
                onClick={() => selectSubTab(s.key)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom: isActive ? "2px solid var(--color-secondary)" : "2px solid transparent",
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 400,
                  whiteSpace: "nowrap",
                  color: isActive ? "var(--color-secondary)" : "var(--color-text-muted)",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}
      {!activeChapterMeta?.subTabs && <div style={{ marginBottom: 20 }} />}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700 }}>{headingLabel}</div>
        {effectiveModuleNumber !== undefined && (
          <ModuleCompletionToggle
            caseId={id}
            moduleNumber={effectiveModuleNumber}
            moduleStatus={moduleStatus}
            caseStatus={caseInfo.status}
            reloadModuleStatus={loadModuleStatus}
            reloadCase={loadCase}
          />
        )}
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {effectiveModuleNumber !== undefined && (
          <div className="card" style={{ width: 260, flexShrink: 0 }}>
            <DocumentUpload caseId={id} moduleNumber={effectiveModuleNumber} />
          </div>
        )}

        <div style={{ flex: 1 }}>
          {activeChapter === "1" && <Module0Overview caseId={id} />}

          {activeChapter === "2" && activeSubTab === "2.1" && (
            <Module1Panel caseId={id} caseInfo={caseInfo} />
          )}

          {activeChapter === "2" && activeSubTab === "2.2" && (
            <>
              <ToolTabs tabs={SUB_TAB_22} active={activeTool} onSelect={setActiveTool} />
              {activeTool === "surrounding_data" && (
                <Module2Panel
                  caseInfo={caseInfo}
                  onCoordsUpdated={(lat, lon) => setCaseInfo((c) => ({ ...c, lat, lon }))}
                />
              )}
              {activeTool === "surrounding_impact" && (
                <div className="card">
                  <SurroundingImpactTab caseId={id} caseInfo={caseInfo} />
                </div>
              )}
            </>
          )}

          {activeChapter === "3" && activeSubTab === "3.1" && (
            <>
              <ToolTabs tabs={SUB_TAB_31} active={activeTool} onSelect={setActiveTool} />
              {activeTool === "ownership" && (
                <div className="card">
                  <OwnershipLeaseSection caseId={id} />
                </div>
              )}
              {activeTool === "aerial" && <Module4Panel caseId={id} caseInfo={caseInfo} />}
              {activeTool === "dart" && <Module5Panel caseId={id} />}
            </>
          )}
          {activeChapter === "3" && activeSubTab === "3.2" && (
            <div className="card">
              <SoilAssessmentSection caseId={id} />
            </div>
          )}
          {activeChapter === "3" && activeSubTab === "3.3" && (
            <div className="card">
              <CostCapacitySection caseId={id} />
            </div>
          )}
          {activeChapter === "3" && activeSubTab === "3.4" && (
            <div className="card">
              <AccessSection caseId={id} />
            </div>
          )}
          {activeChapter === "3" && activeSubTab === "3.5" && (
            <div className="card">
              <AgreementSection caseId={id} />
            </div>
          )}
          {activeChapter === "3" && activeSubTab === "3.6" && (
            <div className="card">
              <ManagementHistorySection caseId={id} />
              <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid var(--color-border)" }} />
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>오염물질 × 기업 매핑</div>
              <PollutionMappingTab caseId={id} />
            </div>
          )}

          {activeChapter === "4" && <Module6Panel caseId={id} />}

          {activeChapter === "5" && (
            <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
              ※ 추후 작성 예정 — 아직 입력 항목이 없어요.
            </div>
          )}

          {activeChapter === "6" && (
            <>
              <ToolTabs tabs={SUB_TAB_6} active={activeTool} onSelect={setActiveTool} />
              {activeTool === "legal" && (
                <div className="card">
                  <LegalJudgmentForm caseId={id} />
                </div>
              )}
              {activeTool === "timeline" && <IntegratedTimeline caseId={id} />}
              {activeTool === "opinion" && (
                <div className="card">
                  <ReviewOpinionTab caseId={id} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolTabs({ tabs, active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className={active === t.key ? "btn-primary" : "btn-secondary"}
          style={{ fontSize: 14 }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
