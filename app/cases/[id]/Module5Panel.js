"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import FactorySearchTab from "./Module5FactoryTab";
import CategorizedRowsTable from "./CategorizedRowsTable";
import ReportStatusBadge from "./ReportStatusBadge";

// 보고서 [표 5]에 들어가는 건 "공장등록 현황(표5)" 하나라 맨 앞(기본 화면)에 둔다. "업체 조회"(DART·공장등록
// 조회)는 회사 정보를 찾아보는 보조 도구라 보고서엔 안 들어간다. 예전의 "수동 추가"/"수집 결과" 탭은
// 오염물질×기업 매핑의 업체 목록을 채우던 용도였는데, 매핑이 3.1 소유·임대차 이력을 쓰게 되면서 없앴다
// (dart_search_results에 저장된 예전 기록은 DB에 그대로 있음).
const TABS = [
  { key: "factory_history", label: "공장등록 현황(표5)", status: "optional" },
  { key: "lookup", label: "업체 조회 (DART·공장등록)" },
];

// [표 5] = 팩토리온 "공장(기업)조회 서비스" 결과 칸(대표업종은 빼기로 함). 예전 칸(승인일·취소일·보유구분·업종)으로
// 입력했던 행은 DB에 그대로 있지만 화면·보고서엔 회사명만 이어서 보인다.
// aliases: 결과 표를 붙여 넣을 때 머리글 이름이 조금 달라도 칸을 맞추기 위한 다른 이름들
const FACTORY_HISTORY_FIELDS = [
  { key: "company_name", label: "공장(기업)명", width: "15%", aliases: ["공장명", "기업명", "회사명", "업체명", "상호"] },
  { key: "region", label: "지역", width: "13%", aliases: ["시군구", "소재지역"] },
  { key: "industrial_complex", label: "산업단지명", width: "17%", aliases: ["산업단지", "단지명"] },
  { key: "address", label: "대표주소", width: "29%", aliases: ["공장(기업) 대표주소", "공장대표주소", "주소", "소재지"] },
  { key: "product", label: "생산품", width: "11%", aliases: ["생산제품", "주생산품"] },
  { key: "raw_material", label: "원자재", width: "11%", aliases: ["원재료", "주원자재"] },
];

export default function Module5Panel({ caseId }) {
  const [tab, setTab] = useState("factory_history");

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
            data-view onClick={() => setTab(t.key)}
            style={{
              border: "none",
              background: "transparent",
              padding: "8px 14px",
              fontSize: 15,
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
            <ReportStatusBadge status={t.status} superscript />
          </button>
        ))}
      </div>

      {tab === "lookup" && (
        <>
          <DartSearchTab caseId={caseId} />
          <div style={{ marginTop: 20 }}>
            <FactorySearchTab caseId={caseId} />
          </div>
        </>
      )}
      {tab === "factory_history" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ fontWeight: 700 }}>공장등록 현황 (표5 — 팩토리온 공장(기업)조회 서비스 결과)</div>
            {/* 로그인 안 돼 있으면 팩토리온이 로그인 화면을 먼저 보여 주고, 로그인 후 이 조회 화면으로 간다 */}
            <a
              href="https://www.factoryon.go.kr/fctry/search/fctryRegistSearch.do"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
              style={{ fontSize: 14, padding: "6px 12px", whiteSpace: "nowrap" }}
            >
              팩토리온 공장(기업)조회 바로가기 ↗
            </a>
          </div>
          <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 14 }}>
            팩토리온(factoryon.go.kr) 로그인 → 민원서비스 → 공장(기업)조회 서비스에서 지역과 공장(기업)명으로
            조회한 결과를 넣어 주세요. 결과 표를 머리글까지 드래그해 복사하거나, [엑셀저장]으로 받은 엑셀에서
            복사해 [📋 붙여넣기로 추가]에 붙이면 칸이 자동으로 맞춰져요(대표업종 칸은 버려요). 연번은 입력
            순서대로 매겨져요. 필수 항목은 아니에요 — 비워 두면 보고서에서 [표 5]가 통째로 빠져요.
          </div>
          <CategorizedRowsTable
            caseId={caseId}
            moduleNumber={5}
            category="factory_history_item"
            fields={FACTORY_HISTORY_FIELDS}
            emptyText="입력된 공장 없음 — 아래 버튼으로 추가하거나, 팩토리온 조회 결과를 복사해 붙여 넣으세요"
            pasteImport
          />
        </div>
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
      if (d.category === "ownership" && d.occupant_name) names.add(d.occupant_name.trim());
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
          data-view onClick={() => setShowInfo((v) => !v)}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 15,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 0,
          }}
        >
          ⓘ DART 검색 가능 범위 참고사항 {showInfo ? "▲" : "▼"}
        </button>
        {showInfo && (
          <div style={{ fontSize: 15, color: "var(--color-text-muted)", marginTop: 10 }}>
            DART는 상장사 및 외부감사 대상 법인처럼 공시 의무가 있는 회사만
            검색돼요. 개인사업자나 소규모 법인은 DART에 정보가 없을 수 있어요.
            그런 경우 &quot;공장등록 조회&quot; 탭이나 &quot;수동 추가&quot; 탭을
            이용해주세요.
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
          챕터 03 이력 기반 자동 검색
        </div>
        <div
          style={{
            fontSize: 15,
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
          <div style={{ color: "var(--color-badge-red-text)", fontSize: 15, marginBottom: 10 }}>
            {autoError}
          </div>
        )}

        {loading ? (
          <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>불러오는 중...</div>
        ) : ownerNames.length === 0 ? (
          <div style={{ fontSize: 15, color: "var(--color-text-muted)" }}>
            챕터 03에 등록된 소유자/임차인 이력이 없어요. 먼저 챕터 03을 채워주세요.
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
                  fontSize: 15,
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
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>추가 검색</div>
        <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 10 }}>
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
          <div style={{ color: "var(--color-badge-red-text)", fontSize: 15, marginBottom: 10 }}>
            {manualError}
          </div>
        )}
        <div style={{ display: "flex", gap: 14, fontSize: 14 }}>
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
                <div key={r.source_name} style={{ fontSize: 15 }}>
                  <span style={{ fontWeight: 600 }}>{r.source_name}</span> — DART에서
                  찾지 못했어요. <StatusBadge status="없음" />
                </div>
              ) : (
                r.matches.map((m, i) => (
                  <div
                    key={`${r.source_name}-${i}`}
                    style={{
                      fontSize: 15,
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
