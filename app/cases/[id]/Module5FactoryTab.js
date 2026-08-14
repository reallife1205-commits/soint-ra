"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FactorySearchTab({ caseId }) {
  const [ownerNames, setOwnerNames] = useState([]);
  const [statusByName, setStatusByName] = useState({});
  const [loading, setLoading] = useState(true);
  const [autoSearching, setAutoSearching] = useState(false);
  const [manualSearching, setManualSearching] = useState(false);
  const [autoError, setAutoError] = useState("");
  const [manualError, setManualError] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [manualResults, setManualResults] = useState(null);
  const [savedResults, setSavedResults] = useState([]);

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
      .from("factory_search_results")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    const statusMap = {};
    (existing || []).forEach((r) => {
      if (!statusMap[r.source_name]) statusMap[r.source_name] = r.status;
    });

    setOwnerNames([...names]);
    setStatusByName(statusMap);
    setSavedResults(existing || []);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    loadNames();
  }, [loadNames]);

  async function runSearch(names, searchType) {
    if (names.length === 0) return null;
    const setLoadingFlag = searchType === "auto" ? setAutoSearching : setManualSearching;
    const setErrorFlag = searchType === "auto" ? setAutoError : setManualError;
    setLoadingFlag(true);
    setErrorFlag("");

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      const res = await fetch("/api/factory-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();

      if (!res.ok) {
        setErrorFlag(
          (data.error || "공장등록 조회에 실패했어요.") +
            (data.debugDetail ? `\n\n[상세정보] ${data.debugDetail}` : "")
        );
        setLoadingFlag(false);
        return null;
      }

      await supabase
        .from("factory_search_results")
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
              ...m,
              status: "완료",
              search_type: searchType,
            });
          });
        }
      });

      if (rowsToInsert.length > 0) {
        await supabase.from("factory_search_results").insert(rowsToInsert);
      }

      await loadNames();
      setLoadingFlag(false);
      return data.results;
    } catch (e) {
      if (e.name === "AbortError") {
        setErrorFlag("공장등록 조회가 너무 오래 걸려서 중단했어요. 잠시 후 다시 시도해주세요.");
      } else {
        setErrorFlag("공장등록 조회 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
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

  async function handleDeleteResult(id) {
    await supabase.from("factory_search_results").delete().eq("id", id);
    loadNames();
  }

  return (
    <div>
      <div
        className="card"
        style={{
          background: "var(--color-badge-blue-bg)",
          border: "1px solid var(--color-badge-blue-bg)",
          marginBottom: 16,
          fontSize: 13,
        }}
      >
        한국산업단지공단의 공장등록(팩토리온) 자료에서 회사명으로 공장 등록 여부와
        용지·건축면적, 용도지역 등을 조회해요.
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          모듈3 이력 기반 자동 검색
        </div>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
          소유·임대차 이력에서 추출된 {ownerNames.length}개 업체명을 조회해요.
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
          <div
            style={{
              color: "var(--color-badge-red-text)",
              fontSize: 13,
              marginBottom: 10,
              whiteSpace: "pre-wrap",
            }}
          >
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>추가 검색</div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10 }}>
          회사명을 직접 입력해서 검색해요.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            placeholder="회사명 입력"
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
          <div
            style={{
              color: "var(--color-badge-red-text)",
              fontSize: 13,
              marginBottom: 10,
              whiteSpace: "pre-wrap",
            }}
          >
            {manualError}
          </div>
        )}

        {manualResults && (
          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
            {manualResults.map((r) =>
              r.matches.length === 0 ? (
                <div key={r.source_name} style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{r.source_name}</span> — 등록된
                  공장을 찾지 못했어요. <StatusBadge status="없음" />
                </div>
              ) : (
                r.matches.map((m, i) => (
                  <FactoryResultCard key={i} match={m} />
                ))
              )
            )}
          </div>
        )}
      </div>

      {savedResults.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
            조회된 공장 정보 ({savedResults.length})
          </div>
          {savedResults.map((r) => (
            <div
              key={r.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              {r.status === "없음" ? (
                <div style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{r.source_name}</span> —{" "}
                  <StatusBadge status="없음" />
                </div>
              ) : (
                <div style={{ flex: 1 }}>
                  <FactoryResultCard match={r} compact />
                </div>
              )}
              <button
                onClick={() => handleDeleteResult(r.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FactoryResultCard({ match, compact }) {
  const cmpnyNm = match.cmpny_nm || match.cmpnyNm;
  return (
    <div style={{ fontSize: 13, padding: compact ? 0 : "8px 0" }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>
        {cmpnyNm} <StatusBadge status="완료" />
      </div>
      <div style={{ color: "var(--color-text-muted)" }}>
        대표자 {match.rprsntv_nm || "-"} · 관할기관 {match.org_nm || "-"} · 전화{" "}
        {match.tel_no || "-"}
      </div>
      <div style={{ color: "var(--color-text-muted)" }}>{match.road_address || "-"}</div>
      <div style={{ color: "var(--color-text-muted)" }}>
        용지면적 {match.land_area || "-"} · 건축면적 {match.building_area || "-"} · 용도지역{" "}
        {match.use_area || "-"}
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
