"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { OLD_MODULES } from "@/lib/modules";
import TopNav from "@/app/components/TopNav";
import SoilBanner from "@/app/components/SoilBanner";
import { ddayInfo } from "@/lib/dday";

const STATUS_OPTIONS = ["전체", "작성중", "완료"];

export default function CasesPage() {
  const [cases, setCases] = useState([]);
  const [progressByCase, setProgressByCase] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [showAddForm, setShowAddForm] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorMsg("");

    const { data: caseRows, error: caseError } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false });

    if (caseError) {
      setErrorMsg(
        "안건 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요."
      );
      setLoading(false);
      return;
    }

    const { data: statusRows } = await supabase
      .from("module_status")
      .select("case_id, is_completed");

    const progressMap = {};
    (statusRows || []).forEach((row) => {
      if (!progressMap[row.case_id]) {
        progressMap[row.case_id] = { done: 0, total: 0 };
      }
      progressMap[row.case_id].total += 1;
      if (row.is_completed) progressMap[row.case_id].done += 1;
    });

    setCases(caseRows || []);
    setProgressByCase(progressMap);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchesStatus =
        statusFilter === "전체" || c.status === statusFilter;
      const keyword = search.trim().toLowerCase();
      const matchesSearch =
        !keyword ||
        [c.case_number, c.address, c.manager, c.company_name]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(keyword));
      return matchesStatus && matchesSearch;
    });
  }, [cases, search, statusFilter]);

  const summary = useMemo(() => {
    const done = cases.filter((c) => c.status === "완료").length;
    const inProgress = cases.filter((c) => c.status !== "완료").length;
    return { done, inProgress, total: cases.length };
  }, [cases]);

  const byManager = useMemo(() => {
    const map = {};
    cases.forEach((c) => {
      const key = c.manager || "미배정";
      if (!map[key]) map[key] = { done: 0, inProgress: 0 };
      if (c.status === "완료") map[key].done += 1;
      else map[key].inProgress += 1;
    });
    return Object.entries(map);
  }, [cases]);

  return (
    <div className="page">
      <TopNav />
      <SoilBanner />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 20,
        }}
      >
        <button className="btn-accent" onClick={() => setShowAddForm(true)}>
          + 새 안건 등록
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="안건번호, 주소, 담당자 검색"
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid var(--color-border)",
            background: "white",
            fontSize: 16,
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid var(--color-border)",
            background: "white",
            fontSize: 16,
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 15,
            color: "var(--color-text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          총 {filteredCases.length}건
        </div>
      </div>

      {errorMsg && (
        <div
          className="card"
          style={{ marginBottom: 20, color: "var(--color-badge-red-text)" }}
        >
          {errorMsg}
        </div>
      )}

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ flex: 1 }}>
          {loading ? (
            <div className="card">불러오는 중이에요...</div>
          ) : filteredCases.length === 0 ? (
            <div className="card">
              등록된 안건이 없어요. 오른쪽 위 &quot;새 안건 등록&quot; 버튼으로
              첫 안건을 추가해보세요.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16,
              }}
            >
              {filteredCases.map((c) => {
                const progress = progressByCase[c.id] || { done: 0, total: 7 };
                const dday = ddayInfo(c.due_date);
                return (
                  <Link
                    key={c.id}
                    href={`/cases/${c.id}`}
                    className="card"
                    style={{ display: "block" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
                        {c.case_number}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {dday !== null && (
                          <span className={`badge ${dday.badgeClass}`}>
                            {dday.label}
                          </span>
                        )}
                        <span
                          className={`badge ${
                            c.status === "완료" ? "badge-green" : "badge-blue"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>
                      {c.company_name}
                    </div>
                    <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
                      {c.address}
                    </div>
                    <div style={{ fontSize: 15, marginTop: 8 }}>
                      {c.region_grade}
                      {c.region_grade && c.contaminants ? " · " : ""}
                      {c.contaminants}
                    </div>
                    <div style={{ fontSize: 15, color: "var(--color-text-muted)", marginTop: 4 }}>
                      담당자 {c.manager || "-"} · 등록 {c.registered_date || "-"}
                      {c.due_date ? ` · 마감 ${c.due_date}` : ""}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 14,
                        marginBottom: 6,
                        fontSize: 14,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      <span>챕터 진행</span>
                      <span>
                        {progress.done}/7
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: "var(--color-surface-alt)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(progress.done / 7) * 100}%`,
                          background: "var(--color-primary)",
                        }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <aside style={{ width: 260, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>전체 현황</div>
            <div style={{ display: "flex", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>완료</div>
                <div style={{ fontSize: 21, fontWeight: 700 }}>{summary.done}건</div>
              </div>
              <div>
                <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>진행중</div>
                <div style={{ fontSize: 21, fontWeight: 700 }}>{summary.inProgress}건</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>담당자별</div>
            {byManager.length === 0 && (
              <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
                데이터가 없어요
              </div>
            )}
            {byManager.map(([name, stat]) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 15,
                  padding: "6px 0",
                }}
              >
                <span>{name}</span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  완료 {stat.done} · 진행 {stat.inProgress}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {showAddForm && (
        <AddCaseModal
          onClose={() => setShowAddForm(false)}
          onCreated={() => {
            setShowAddForm(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function AddCaseModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    case_number: "",
    company_name: "",
    address: "",
    manager: "",
    region_grade: "",
    contaminants: "",
    registered_date: new Date().toISOString().slice(0, 10),
    due_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.case_number || !form.company_name) {
      setError("안건번호와 회사명은 꼭 입력해주세요.");
      return;
    }
    setSaving(true);
    setError("");

    const { data: newCase, error: insertError } = await supabase
      .from("cases")
      .insert([{ ...form, due_date: form.due_date || null, status: "작성중" }])
      .select()
      .single();

    if (insertError) {
      setError("저장에 실패했어요. 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    const moduleRows = OLD_MODULES.map((m) => ({
      case_id: newCase.id,
      module_number: m.number,
      module_name: m.name,
      is_completed: false,
    }));
    await supabase.from("module_status").insert(moduleRows);

    setSaving(false);
    onCreated();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: 420, background: "white" }}
      >
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
          새 안건 등록
        </div>

        {[
          { key: "case_number", label: "안건번호 (예: 2026-18-사상)" },
          { key: "company_name", label: "회사명" },
          { key: "address", label: "주소" },
          { key: "manager", label: "담당자" },
          { key: "region_grade", label: "지역등급 (예: 3지역)" },
          { key: "contaminants", label: "오염물질 (예: 비소(As), 납(Pb))" },
        ].map((field) => (
          <div key={field.key} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              {field.label}
            </label>
            <input
              value={form[field.key]}
              onChange={(e) => update(field.key, e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                marginTop: 4,
              }}
            />
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              등록일
            </label>
            <input
              type="date"
              value={form.registered_date}
              onChange={(e) => update("registered_date", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                marginTop: 4,
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              마감일 (D-day 기준)
            </label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => update("due_date", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                marginTop: 4,
              }}
            />
          </div>
        </div>

        {error && (
          <div style={{ color: "var(--color-badge-red-text)", fontSize: 15, marginBottom: 10 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "저장 중..." : "등록"}
          </button>
        </div>
      </form>
    </div>
  );
}
