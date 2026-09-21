"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { OLD_MODULES } from "@/lib/modules";
import TopNav from "@/app/components/TopNav";
import SoilBanner from "@/app/components/SoilBanner";
import { ddayInfo } from "@/lib/dday";

const STATUS_OPTIONS = ["전체", "작성중", "완료"];
const CURRENT_YEAR = new Date().getFullYear();
const TH_STYLE = { textAlign: "left", padding: "10px 14px", fontSize: 14, color: "var(--color-text-muted)", fontWeight: 600 };
const TD_STYLE = { padding: "10px 14px" };

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState([]);
  const [progressByCase, setProgressByCase] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewMode, setViewMode] = useState("card"); // "card" | "table"
  const [assignedCases, setAssignedCases] = useState([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm] = useState({ case_number: "", company_name: "", manager: "", due_date: "" });
  const [savingAssign, setSavingAssign] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [announcementInput, setAnnouncementInput] = useState("");
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

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

    const { data: assignedRows } = await supabase
      .from("assigned_cases")
      .select("*")
      .eq("year", CURRENT_YEAR)
      .order("created_at", { ascending: true });
    setAssignedCases(assignedRows || []);

    const { data: announcementRow } = await supabase
      .from("announcements")
      .select("content")
      .eq("id", 1)
      .maybeSingle();
    setAnnouncement(announcementRow?.content || "");
  }

  useEffect(() => {
    loadData();
  }, []);

  // 공유 비밀번호 하나로 누구나 들어오는 사이트라 실수로 삭제 버튼을 누르는 걸 막기 위해,
  // window.confirm 대신 안건번호를 정확히 타이핑해야만 삭제가 실행되는 모달을 띄운다.
  function handleDeleteCase(e, c) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(c);
  }

  // 안건과 그 아래 딸린 모든 자료(표 입력값, 문서, 항공사진 태그 등)를 완전히 삭제한다.
  // 대부분 테이블에 on delete cascade가 걸려 있지만, 스토리지 파일은 DB cascade로 안 지워지므로
  // 먼저 documents의 file_path들을 스토리지에서 지운 다음 관련 테이블을 명시적으로 정리한다.
  async function confirmDeleteCase(c) {
    setDeleteTarget(null);
    setDeletingId(c.id);

    const { data: docs } = await supabase
      .from("documents")
      .select("file_path")
      .eq("case_id", c.id);
    if (docs && docs.length > 0) {
      await supabase.storage.from("documents").remove(docs.map((d) => d.file_path));
    }

    const relatedTables = [
      "aerial_photo_tags",
      "module_rows",
      "module_status",
      "documents",
      "dart_search_results",
      "factory_search_results",
      "field_surveys",
      "pollution_mappings",
      "surrounding_impacts",
      "review_opinions",
      "timeline_analyses",
    ];
    for (const table of relatedTables) {
      await supabase.from(table).delete().eq("case_id", c.id);
    }

    await supabase.from("cases").delete().eq("id", c.id);

    setDeletingId(null);
    loadData();
  }

  async function saveAssignedCase(e) {
    e.preventDefault();
    if (!assignForm.case_number.trim()) return;
    setSavingAssign(true);
    const { data, error } = await supabase
      .from("assigned_cases")
      .insert([{ year: CURRENT_YEAR, ...assignForm, due_date: assignForm.due_date || null }])
      .select()
      .single();
    setSavingAssign(false);
    if (error) return;
    setAssignedCases((prev) => [...prev, data]);
    setAssignForm({ case_number: "", company_name: "", manager: "", due_date: "" });
    setShowAssignForm(false);
  }

  async function deleteAssignedCase(id) {
    await supabase.from("assigned_cases").delete().eq("id", id);
    setAssignedCases((prev) => prev.filter((a) => a.id !== id));
  }

  async function saveAnnouncement() {
    setSavingAnnouncement(true);
    const content = announcementInput.trim();
    await supabase.from("announcements").upsert({ id: 1, content, updated_at: new Date().toISOString() });
    setAnnouncement(content);
    setSavingAnnouncement(false);
    setEditingAnnouncement(false);
  }

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

  // "배정 현황" 리스트 — 실제로 등록된 안건(cases)과 아직 등록 전인 배정 안건(assigned_cases)을
  // 안건번호 기준으로 합쳐서 하나의 목록으로 보여준다. 이미 등록된 안건이 있으면 그쪽 정보를
  // 우선(더 정확)하고, 배정만 되고 아직 등록 안 한 안건은 assigned_cases의 정보를 그대로 쓴다.
  const assignedList = useMemo(() => {
    const byCaseNumber = new Map();
    cases.forEach((c) => {
      byCaseNumber.set(c.case_number, {
        case_number: c.case_number,
        company_name: c.company_name,
        manager: c.manager,
        due_date: c.due_date,
        registered: true,
        linkedCase: c,
        assignedId: null,
      });
    });
    assignedCases.forEach((a) => {
      if (byCaseNumber.has(a.case_number)) return;
      byCaseNumber.set(a.case_number, {
        case_number: a.case_number,
        company_name: a.company_name,
        manager: a.manager,
        due_date: a.due_date,
        registered: false,
        linkedCase: null,
        assignedId: a.id,
      });
    });
    return Array.from(byCaseNumber.values());
  }, [cases, assignedCases]);

  return (
    <div className="page">
      <TopNav />
      <SoilBanner />

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editingAnnouncement || announcement ? 8 : 0 }}>
          <div style={{ fontWeight: 700 }}>📢 공지사항</div>
          {!editingAnnouncement && (
            <button
              onClick={() => {
                setAnnouncementInput(announcement);
                setEditingAnnouncement(true);
              }}
              title="공지사항 수정"
              style={{ border: "none", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 13 }}
            >
              ✏️
            </button>
          )}
        </div>
        {editingAnnouncement ? (
          <div>
            <textarea
              value={announcementInput}
              onChange={(e) => setAnnouncementInput(e.target.value)}
              placeholder="예: 9/30까지 3분기 안건 전부 등록 완료해주세요."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                fontSize: 15,
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="btn-secondary" onClick={() => setEditingAnnouncement(false)} disabled={savingAnnouncement}>
                취소
              </button>
              <button className="btn-primary" onClick={saveAnnouncement} disabled={savingAnnouncement}>
                {savingAnnouncement ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        ) : announcement ? (
          <div style={{ fontSize: 15, whiteSpace: "pre-wrap" }}>{announcement}</div>
        ) : (
          <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>등록된 공지사항이 없어요.</div>
        )}
      </div>

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
        <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-border)" }}>
          {[
            { key: "card", label: "카드형" },
            { key: "table", label: "표형" },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              style={{
                border: "none",
                padding: "0 16px",
                fontSize: 15,
                cursor: "pointer",
                background: viewMode === v.key ? "var(--color-primary)" : "white",
                color: viewMode === v.key ? "white" : "var(--color-text)",
              }}
            >
              {v.label}
            </button>
          ))}
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
          ) : viewMode === "table" ? (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
                <thead>
                  <tr style={{ background: "var(--color-surface-alt)" }}>
                    <th style={TH_STYLE}>안건번호</th>
                    <th style={TH_STYLE}>회사명</th>
                    <th style={TH_STYLE}>담당자</th>
                    <th style={TH_STYLE}>상태</th>
                    <th style={TH_STYLE}>D-day</th>
                    <th style={TH_STYLE}>진행</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map((c) => {
                    const progress = progressByCase[c.id] || { done: 0, total: 7 };
                    const dday = ddayInfo(c.due_date);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/cases/${c.id}`)}
                        style={{ cursor: "pointer", borderTop: "1px solid var(--color-border)" }}
                      >
                        <td style={{ ...TD_STYLE, color: "var(--color-text-muted)" }}>{c.case_number}</td>
                        <td style={{ ...TD_STYLE, fontWeight: 600 }}>{c.company_name}</td>
                        <td style={TD_STYLE}>{c.manager || "-"}</td>
                        <td style={TD_STYLE}>
                          <span className={`badge ${c.status === "완료" ? "badge-green" : "badge-blue"}`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={TD_STYLE}>
                          {dday !== null ? <span className={`badge ${dday.badgeClass}`}>{dday.label}</span> : "-"}
                        </td>
                        <td style={{ ...TD_STYLE, color: "var(--color-text-muted)" }}>{progress.done}/7</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
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
                    style={{ display: "block", position: "relative", padding: "12px 14px" }}
                  >
                    <button
                      onClick={(e) => handleDeleteCase(e, c)}
                      disabled={deletingId === c.id}
                      title="안건 삭제"
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        border: "none",
                        background: "transparent",
                        color: "var(--color-text-muted)",
                        cursor: "pointer",
                        fontSize: 13,
                        padding: 2,
                      }}
                    >
                      {deletingId === c.id ? "..." : "🗑️"}
                    </button>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingRight: 22,
                      }}
                    >
                      <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                        {c.case_number}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {dday !== null && (
                          <span className={`badge ${dday.badgeClass}`} style={{ fontSize: 12, padding: "2px 6px" }}>
                            {dday.label}
                          </span>
                        )}
                        <span
                          className={`badge ${c.status === "완료" ? "badge-green" : "badge-blue"}`}
                          style={{ fontSize: 12, padding: "2px 6px" }}
                        >
                          {c.status}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={c.company_name}
                    >
                      {c.company_name}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 13,
                        color: "var(--color-text-muted)",
                        marginTop: 6,
                      }}
                    >
                      <span>담당자 {c.manager || "-"}</span>
                      <span>{progress.done}/7</span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 999,
                        background: "var(--color-surface-alt)",
                        overflow: "hidden",
                        marginTop: 4,
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>{CURRENT_YEAR}년 배정 현황</div>
              <button
                onClick={() => setShowAssignForm((v) => !v)}
                title="배정 안건 추가"
                style={{ border: "none", background: "transparent", color: "var(--color-primary)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                {showAssignForm ? "닫기" : "+ 추가"}
              </button>
            </div>

            {showAssignForm && (
              <form
                onSubmit={saveAssignedCase}
                style={{ marginBottom: 14, padding: 10, background: "var(--color-surface-alt)", borderRadius: 8 }}
              >
                <input
                  required
                  value={assignForm.case_number}
                  onChange={(e) => setAssignForm((f) => ({ ...f, case_number: e.target.value }))}
                  placeholder="안건번호 (예: 2026-14-사상)"
                  style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 14 }}
                />
                <input
                  value={assignForm.company_name}
                  onChange={(e) => setAssignForm((f) => ({ ...f, company_name: e.target.value }))}
                  placeholder="회사명"
                  style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 14, marginTop: 6 }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input
                    value={assignForm.manager}
                    onChange={(e) => setAssignForm((f) => ({ ...f, manager: e.target.value }))}
                    placeholder="담당자"
                    style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 14 }}
                  />
                  <input
                    type="date"
                    value={assignForm.due_date}
                    onChange={(e) => setAssignForm((f) => ({ ...f, due_date: e.target.value }))}
                    style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 14 }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button type="submit" className="btn-primary" disabled={savingAssign} style={{ padding: "6px 14px" }}>
                    {savingAssign ? "추가 중..." : "추가"}
                  </button>
                </div>
              </form>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>배정</div>
                <div style={{ fontSize: 19, fontWeight: 700 }}>{assignedList.length}건</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>등록</div>
                <div style={{ fontSize: 19, fontWeight: 700 }}>{cases.length}건</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>완료</div>
                <div style={{ fontSize: 19, fontWeight: 700 }}>{summary.done}건</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>미등록</div>
                <div
                  style={{
                    fontSize: 19,
                    fontWeight: 700,
                    color: assignedList.length - cases.length > 0 ? "var(--color-badge-red-text)" : undefined,
                  }}
                >
                  {Math.max(0, assignedList.length - cases.length)}건
                </div>
              </div>
            </div>

            {/* 안건번호 기준으로 등록된 안건(cases)과 아직 등록 전인 배정 안건(assigned_cases)을
                합친 리스트 — 제목/담당자/기한을 한 줄씩 보여주고, 등록 여부/완료 여부를 뱃지로
                바로 확인할 수 있게 함. 등록된 항목은 클릭하면 해당 안건으로 이동. */}
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10, maxHeight: 320, overflowY: "auto" }}>
              {assignedList.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  배정된 안건이 없어요. &quot;+ 추가&quot;로 등록 전 안건도 미리 리스트업할 수 있어요.
                </div>
              ) : (
                assignedList.map((a) => {
                  const dday = ddayInfo(a.due_date);
                  const Wrapper = a.registered ? Link : "div";
                  const wrapperProps = a.registered ? { href: `/cases/${a.linkedCase.id}` } : {};
                  return (
                    <Wrapper
                      key={a.case_number}
                      {...wrapperProps}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        padding: "6px 0",
                        color: "var(--color-text)",
                        textDecoration: "none",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                          {a.company_name || a.case_number}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.case_number}
                          {a.manager ? ` · ${a.manager}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {dday !== null && (
                          <span className={`badge ${dday.badgeClass}`} style={{ fontSize: 11, padding: "1px 5px" }}>
                            {dday.label}
                          </span>
                        )}
                        {a.registered ? (
                          <span
                            className={`badge ${a.linkedCase.status === "완료" ? "badge-green" : "badge-blue"}`}
                            style={{ fontSize: 11, padding: "1px 5px" }}
                          >
                            {a.linkedCase.status}
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: 11, padding: "1px 5px" }}>
                            미등록
                          </span>
                        )}
                        {!a.registered && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              deleteAssignedCase(a.assignedId);
                            }}
                            title="배정 목록에서 삭제"
                            style={{ border: "none", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 12, padding: 0 }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </Wrapper>
                  );
                })
              )}
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

      {deleteTarget && (
        <DeleteCaseModal
          caseInfo={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => confirmDeleteCase(deleteTarget)}
        />
      )}
    </div>
  );
}

// 안건번호를 정확히 타이핑해야만 삭제 버튼이 눌리는 확인 모달.
// 공유 비밀번호로 누구나 들어오는 사이트라 실수 클릭 방지가 목적.
function DeleteCaseModal({ caseInfo, onClose, onConfirm }) {
  const [input, setInput] = useState("");
  const matched = input === caseInfo.case_number;

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
      <div className="card" style={{ width: 420, background: "white" }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>
          안건 삭제
        </div>
        <div style={{ fontSize: 15, marginBottom: 14 }}>
          <strong>{caseInfo.case_number} · {caseInfo.company_name}</strong> 안건을
          삭제합니다. 입력된 모든 자료(표, 업로드한 문서·사진 등)가 함께
          영구 삭제되며 되돌릴 수 없어요.
        </div>
        <label style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          확인을 위해 안건번호 <strong>{caseInfo.case_number}</strong>를 정확히
          입력해주세요
        </label>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={caseInfo.case_number}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            marginTop: 4,
            marginBottom: 16,
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!matched}
            onClick={onConfirm}
            style={!matched ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            영구 삭제
          </button>
        </div>
      </div>
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
