"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { MODULES } from "@/lib/modules";
import Module1Panel from "./Module1Panel";
import Module2Panel from "./Module2Panel";
import Module3Panel from "./Module3Panel";
import Module4Panel from "./Module4Panel";
import Module5Panel from "./Module5Panel";
import Module6Panel from "./Module6Panel";
import Module7Panel from "./Module7Panel";
import GenericModuleTable from "./GenericModuleTable";
import DocumentUpload from "./DocumentUpload";

export default function CaseDetailPage() {
  const { id } = useParams();
  const [caseInfo, setCaseInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState(1);
  const [moduleStatus, setModuleStatus] = useState({});

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

  const completedCount = Object.values(moduleStatus).filter(
    (m) => m.is_completed
  ).length;

  async function toggleComplete() {
    const current = moduleStatus[activeModule];
    const newValue = !current?.is_completed;

    if (current) {
      await supabase
        .from("module_status")
        .update({
          is_completed: newValue,
          completed_at: newValue ? new Date().toISOString() : null,
        })
        .eq("id", current.id);
    } else {
      await supabase.from("module_status").insert([
        {
          case_id: id,
          module_number: activeModule,
          module_name: MODULES.find((m) => m.number === activeModule)?.name,
          is_completed: newValue,
          completed_at: newValue ? new Date().toISOString() : null,
        },
      ]);
    }
    await loadModuleStatus();

    const allDone = MODULES.every((m) =>
      m.number === activeModule ? newValue : moduleStatus[m.number]?.is_completed
    );
    if (allDone) {
      await supabase.from("cases").update({ status: "완료" }).eq("id", id);
      loadCase();
    } else if (caseInfo?.status === "완료") {
      await supabase.from("cases").update({ status: "작성중" }).eq("id", id);
      loadCase();
    }
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
        <Link href="/cases" style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
          ← 목록으로
        </Link>
        <div className="card" style={{ marginTop: 16 }}>
          해당 안건을 찾을 수 없어요.
        </div>
      </div>
    );
  }

  const activeInfo = moduleStatus[activeModule];
  const activeModuleMeta = MODULES.find((m) => m.number === activeModule);

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
          <Link href="/cases" style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
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
          </div>
          <div style={{ fontSize: 15, color: "var(--color-text-muted)", marginTop: 2 }}>
            {caseInfo.address} · 담당: {caseInfo.manager || "-"}
          </div>
        </div>
        <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
          {completedCount}/7 완료
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 20,
          overflowX: "auto",
        }}
      >
        {MODULES.map((m) => {
          const isActive = activeModule === m.number;
          const isDone = moduleStatus[m.number]?.is_completed;
          return (
            <button
              key={m.number}
              onClick={() => setActiveModule(m.number)}
              style={{
                border: "none",
                background: "transparent",
                padding: "10px 14px",
                cursor: "pointer",
                borderBottom: isActive
                  ? "2px solid var(--color-primary)"
                  : "2px solid transparent",
                textAlign: "left",
                minWidth: 100,
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: isActive ? "var(--color-primary)" : "var(--color-text)",
                }}
              >
                {isDone && "✓ "}챕터 {String(m.number).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-secondary)", fontWeight: 600 }}>
                {m.name}
              </div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700 }}>
          챕터 {String(activeModule).padStart(2, "0")} — {activeModuleMeta?.name}
        </div>
        <button
          className={activeInfo?.is_completed ? "btn-secondary" : "btn-primary"}
          onClick={toggleComplete}
        >
          {activeInfo?.is_completed ? "완료 취소" : "완료 처리"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        <div className="card" style={{ width: 260, flexShrink: 0 }}>
          <DocumentUpload caseId={id} moduleNumber={activeModule} />
        </div>

        <div style={{ flex: 1 }}>
          {activeModule === 1 ? (
            <Module1Panel caseId={id} caseInfo={caseInfo} />
          ) : activeModule === 2 ? (
            <Module2Panel
              caseInfo={caseInfo}
              onCoordsUpdated={(lat, lon) =>
                setCaseInfo((c) => ({ ...c, lat, lon }))
              }
            />
          ) : activeModule === 3 ? (
            <div className="card">
              <Module3Panel caseId={id} />
            </div>
          ) : activeModule === 4 ? (
            <Module4Panel caseId={id} caseInfo={caseInfo} />
          ) : activeModule === 5 ? (
            <Module5Panel caseId={id} />
          ) : activeModule === 6 ? (
            <Module6Panel caseId={id} />
          ) : activeModule === 7 ? (
            <Module7Panel caseId={id} caseInfo={caseInfo} />
          ) : (
            <div className="card">
              <GenericModuleTable caseId={id} moduleNumber={activeModule} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
