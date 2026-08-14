"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import FactorySearchTab from "./Module5FactoryTab";

const TABS = [
  { key: "dart", label: "DART 검색" },
  { key: "factory", label: "공장등록 조회" },
  { key: "manual", label: "수동 추가" },
  { key: "results", label: "수집 결과" },
];

export default function Module5Panel({ caseId }) {
  const [tab, setTab] = useState("dart");
  const [resultCount, setResultCount] = useState(0);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 16,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: "none",
              background: "transparent",
              padding: "8px 14px",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: tab === t.key ? 700 : 400,
              borderBottom:
                tab === t.key
                  ? "2px solid var(--color-primary)"
                  : "2px solid transparent",
              color: tab === t.key ? "var(--color-primary)" : "var(--color-text)",
            }}
          >
            {t.label}
            {t.key === "results" && (
              <span style={{ marginLeft: 4, color: "var(--color-text-muted)" }}>
                {resultCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "dart" && (
        <DartSearchTab caseId={caseId} onResultsChanged={setResultCount} />
      )}
      {tab === "factory" && <FactorySearchTab caseId={caseId} />}
      {tab === "manual" && <ManualAddTab caseId={caseId} onResultsChanged={setResultCount} />}
      {tab === "results" && (
        <ResultsTab caseId={caseId} onResultsChanged={setResultCount} />
      )}
    </div>
  );
}

function DartSearchTab({ caseId, onResultsChanged }) {
  const [ownerNames, setOwnerNames] = useState([]);
  const [statusByName, setStatusByName] = useState({});
  const [loading, setLoading] = useState(true);
  const [autoSearching, setAutoSearching] = useState(false);
  const [manualSearching, setManualSearching] = useState(false);
  const [autoError, setAutoError] = useState("");
  const [manualError, setManualError] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [manualResults, setManualResults] = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  const loadNames = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("module_rows")
      .select("row_data")
      .eq("case_id", caseId)
      .eq("module_number", 3);

    const names = new Set();
    (data || []).forEach((row) => {
      const d = row.row_data || {};
      if (d.category === "ownership" && d.owner_name) names.add(d.owner_name.trim());
      if (d.category === "lease" && d.tenant_name) names.add(d.tenant_name.trim());
    });

    const { data: existing } = await supabase
      .from("dart_search_results")
      .select("source_name, status")
      .eq("case_id", caseId);

    const statusMap = {};
    (existing || []).forEach((r) => {
      statusMap[r.source_name] = r.status;
    });

    setOwnerNames([...names]);
    setStatusByName(statusMap);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    loadNames();
  }, [loadNames]);

  async function runSearch(names, searchType = "auto") {
    if (names.length === 0) return;
    const setLoadingFlag = searchType === "auto" ? setAutoSearching : setManualSearching;
    const setErrorFlag = searchType === "auto" ? setAutoError : setManualError;
    setLoadingFlag(true);
    setErrorFlag("");

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 50000);
      const res = await fetch("/api/dart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();

      if (!res.ok) {
        setErrorFlag(data.error || "DART 검색에 실패했어요.");
        setLoadingFlag(false);
        return null;
      }

      await supabase
        .from("dart_search_results")
        .delete()
        .eq("case_id", caseId)
        .in(
          "source_name",
          data.results.map((r) => r.source_name)
        );

      const rowsToInsert = [];
      data.results.forEach((r) => {
        if (r.matches.length === 0) {
          rowsToInsert.push({
            case_id: caseId,
            source_name: r.source_name,
            status: "없음",
            search_type: searchType,
          });
        } else {
          r.matches.forEach((m) => {
            rowsToInsert.push({
              case_id: caseId,
              source_name: r.source_name,
              corp_name: m.corp_name,
              corp_code: m.corp_code,
              ceo_name: m.ceo_name,
              biz_no: m.biz_no,
              address: m.address,
              corp_cls: m.corp_cls,
              status: "완료",
              search_type: searchType,
            });
          });
        }
      });

      if (rowsToInsert.length > 0) {
        await supabase.from("dart_search_results").insert(rowsToInsert);
      }

      if (onResultsChanged) {
        const { count } = await supabase
          .from("dart_search_results")
          .select("*", { count: "exact", head: true })
          .eq("case_id", caseId);
        onResultsChanged(count || 0);
      }

      await loadNames();
      setLoadingFlag(false);
      return data.results;
    } catch (e) {
      if (e.name === "AbortError") {
        setErrorFlag(
          "DART 검색이 너무 오래 걸려서 중단했어요. 잠시 후 다시 시도해주세요 (첫 검색은 특히 오래 걸릴 수 있어요)."
        );
      } else {
        setErrorFlag("DART 검색 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
      setLoadingFlag(false);
      return null;
    }
  }

  async function handleManualSearch() {
    if (!manualQuery.trim()) return;
    setManualResults(null);
    const results = await runSearch([manualQuery.trim()], "manual");
    if (results) setManualResults(results);
    setManualQuery("");
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowInfo((v) => !v)}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 0,
          }}
        >
          ⓘ DART 검색 가능 범위 참고사항 {showInfo ? "▲" : "▼"}
        </button>
        {showInfo && (
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 10 }}>
            DART는 상장사 및 외부감사 대상 법인처럼 공시 의무가 있는 회사만
            검색돼요. 개인사업자나 소규모 법인은 DART에 정보가 없을 수 있어요.
            그런 경우 &quot;공장등록 조회&quot; 탭이나 &quot;수동 추가&quot; 탭을
            이용해주세요.
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          모듈3 이력 기반 자동 검색
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            marginBottom: 12,
          }}
        >
          소유·임대차 이력에서 추출된 {ownerNames.length}개 업체명을 DART에서
          일괄 조회해요.
        </div>

        <button
          className="btn-primary"
          onClick={() => runSearch(ownerNames, "auto")}
          disabled={autoSearching || loading || ownerNames.length === 0}
          style={{ marginBottom: 16 }}
        >
          {autoSearching ? "검색 중..." : "▶ 자동 검색 실행"}
        </button>

        {autoError && (
          <div style={{ color: "var(--color-badge-red-text)", fontSize: 13, marginBottom: 10 }}>
            {autoError}
          </div>
        )}

        {loading ? (
          <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>불러오는 중...</div>
        ) : ownerNames.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            모듈3에 등록된 소유자/임차인 이력이 없어요. 먼저 모듈3을 채워주세요.
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {ownerNames.map((name) => (
              <li
                key={name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--color-border)",
                  fontSize: 13,
                }}
              >
                <span>
                  <span className="badge badge-blue" style={{ marginRight: 8 }}>
                    소유자
                  </span>
                  {name}
                </span>
                <StatusBadge status={statusByName[name]} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>추가 검색</div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10 }}>
          위 목록에 없는 업체명을 직접 검색해요.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            placeholder="법인명 입력"
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
            }}
          />
          <button className="btn-secondary" onClick={handleManualSearch} disabled={manualSearching}>
            {manualSearching ? "검색 중..." : "🔍 검색"}
          </button>
        </div>

        {manualError && (
          <div style={{ color: "var(--color-badge-red-text)", fontSize: 13, marginBottom: 10 }}>
            {manualError}
          </div>
        )}
        <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
          <a
            href="https://www.bizno.net"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--color-primary)" }}
          >
            ↗ bizno.net
          </a>
          <a
            href="https://www.findcompany.kr"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--color-primary)" }}
          >
            ↗ findcompany.kr
          </a>
          <a
            href="https://dart.fss.or.kr"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--color-primary)" }}
          >
            ↗ DART 바로가기
          </a>
        </div>

        {manualResults && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
            {manualResults.map((r) =>
              r.matches.length === 0 ? (
                <div key={r.source_name} style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{r.source_name}</span> — DART에서
                  찾지 못했어요. <StatusBadge status="없음" />
                </div>
              ) : (
                r.matches.map((m, i) => (
                  <div
                    key={`${r.source_name}-${i}`}
                    style={{
                      fontSize: 13,
                      padding: "8px 0",
                      borderBottom:
                        i < r.matches.length - 1
                          ? "1px solid var(--color-border)"
                          : "none",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>
                      {m.corp_name} <StatusBadge status="완료" />
                    </div>
                    <div style={{ color: "var(--color-text-muted)" }}>
                      대표자 {m.ceo_name || "-"} · 사업자번호 {m.biz_no || "-"}
                    </div>
                    <div style={{ color: "var(--color-text-muted)" }}>
                      {m.address || "주소 정보 없음"}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) return <span className="badge">대기 중</span>;
  if (status === "완료") return <span className="badge badge-green">완료</span>;
  if (status === "없음") return <span className="badge badge-red">결과 없음</span>;
  return <span className="badge">{status}</span>;
}

function ManualAddTab({ caseId, onResultsChanged }) {
  const [form, setForm] = useState({
    source_name: "",
    corp_name: "",
    ceo_name: "",
    biz_no: "",
    address: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.source_name && !form.corp_name) return;
    setSaving(true);
    await supabase.from("dart_search_results").insert([
      {
        case_id: caseId,
        source_name: form.source_name || form.corp_name,
        corp_name: form.corp_name || null,
        ceo_name: form.ceo_name || null,
        biz_no: form.biz_no || null,
        address: form.address || null,
        note: form.note || null,
        status: "완료",
        search_type: "manual",
      },
    ]);
    setSaving(false);
    setForm({
      source_name: "",
      corp_name: "",
      ceo_name: "",
      biz_no: "",
      address: "",
      note: "",
    });
    if (onResultsChanged) {
      const { count } = await supabase
        .from("dart_search_results")
        .select("*", { count: "exact", head: true })
        .eq("case_id", caseId);
      onResultsChanged(count || 0);
    }
  }

  const fields = [
    { key: "source_name", label: "검색 대상명 (소유자/업체명)" },
    { key: "corp_name", label: "확인된 회사명" },
    { key: "ceo_name", label: "대표자명" },
    { key: "biz_no", label: "사업자등록번호" },
    { key: "address", label: "주소" },
  ];

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div style={{ fontWeight: 700, marginBottom: 14 }}>직접 입력해서 추가</div>
      {fields.map((f) => (
        <div key={f.key} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{f.label}</label>
          <input
            value={form[f.key]}
            onChange={(e) => update(f.key, e.target.value)}
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
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>메모</label>
        <textarea
          value={form.note}
          onChange={(e) => update("note", e.target.value)}
          rows={2}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            marginTop: 4,
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
      </div>
      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? "저장 중..." : "추가"}
      </button>
    </div>
  );
}

function ResultsTab({ caseId, onResultsChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("dart_search_results")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
    if (onResultsChanged) onResultsChanged((data || []).length);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function handleDelete(id) {
    await supabase.from("dart_search_results").delete().eq("id", id);
    load();
  }

  if (loading) return <div className="card">불러오는 중이에요...</div>;

  if (rows.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        아직 수집된 결과가 없어요. &apos;DART 검색&apos; 탭에서 검색을 실행해보세요.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
            <th style={{ padding: "8px 6px" }}>검색 대상</th>
            <th style={{ padding: "8px 6px" }}>회사명</th>
            <th style={{ padding: "8px 6px" }}>대표자</th>
            <th style={{ padding: "8px 6px" }}>사업자번호</th>
            <th style={{ padding: "8px 6px" }}>주소</th>
            <th style={{ padding: "8px 6px" }}>상태</th>
            <th style={{ padding: "8px 6px" }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
              <td style={{ padding: "8px 6px" }}>{r.source_name}</td>
              <td style={{ padding: "8px 6px" }}>{r.corp_name || "-"}</td>
              <td style={{ padding: "8px 6px" }}>{r.ceo_name || "-"}</td>
              <td style={{ padding: "8px 6px" }}>{r.biz_no || "-"}</td>
              <td style={{ padding: "8px 6px", maxWidth: 220 }}>{r.address || "-"}</td>
              <td style={{ padding: "8px 6px" }}>
                <StatusBadge status={r.status} />
              </td>
              <td style={{ padding: "8px 6px" }}>
                <button
                  onClick={() => handleDelete(r.id)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--color-text-muted)",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
