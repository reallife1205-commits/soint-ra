"use client";

import { supabase } from "@/lib/supabaseClient";
import {
  SITE_CONTAMINATION_CATEGORY,
  SOURCE_OPTIONS,
  defaultSources,
  sourceCheckboxLine,
  buildSiteContaminationDraft,
} from "@/lib/siteContaminationDraft";
import ReportNarrativeCard from "./ReportNarrativeCard";

// 보고서 2.1 본문(그림 위): 자료 종류 체크 + 조사기간·결과 요약 문장.
// 1.1 개요와 같은 module_rows 0번에 category로 구분해 저장한다(2.1 오염현황 표는 1번 행을 전부
// 표 행으로 그리기 때문에 거기에 섞으면 빈 행이 생긴다).
export default function Module1Narrative({ caseId }) {
  async function fetchSources() {
    const [{ data: m0 }, { data: m1 }] = await Promise.all([
      supabase.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 0),
      supabase.from("module_rows").select("row_data").eq("case_id", caseId).eq("module_number", 1).order("row_order", { ascending: true }),
    ]);
    return {
      overview: (m0 || []).map((r) => r.row_data).find((d) => d.category === "overview") || {},
      contaminationRows: (m1 || []).map((r) => r.row_data),
    };
  }

  return (
    <ReportNarrativeCard
      caseId={caseId}
      moduleNumber={0}
      category={SITE_CONTAMINATION_CATEGORY}
      title="보고서 본문 (그림 위 설명)"
      description="보고서 2.1의 <그림> 토양시료 채취 지점 위에 들어가요. 비워 두면 내보낼 때 표 내용으로 자동 작성돼요."
      sourceOptions={SOURCE_OPTIONS}
      checkboxLine={sourceCheckboxLine}
      getDefaultSources={async () => defaultSources((await fetchSources()).overview)}
      buildDraft={async (sources) => {
        const { overview, contaminationRows } = await fetchSources();
        return buildSiteContaminationDraft({ contaminationRows, overview, sources });
      }}
      draftButtonLabel="표 내용으로 초안 만들기"
    />
  );
}
