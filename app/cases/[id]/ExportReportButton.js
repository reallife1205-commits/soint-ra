"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { drawOwnershipTimelinePng } from "@/lib/ownershipTimeline";

// 보고서 초안 내보내기. [표 4] 아래 넣을 소유·점유 타임라인 그림(6장 통합 타임라인, 항공사진 줄 제외)은
// 서버에 한글 글꼴이 없어 브라우저 캔버스로 그려 같이 보낸다. 그림을 못 만들면 그림 없이 예전처럼 받는다.
export default function ExportReportButton({ caseId }) {
  const [busy, setBusy] = useState(false);
  const url = `/api/cases/${caseId}/export-report`;

  async function exportReport(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { data: rows, error } = await supabase
        .from("module_rows")
        .select("row_data")
        .eq("case_id", caseId)
        .eq("module_number", 3);
      if (error) throw error;
      const png = await drawOwnershipTimelinePng((rows || []).map((r) => r.row_data || {}));

      const form = new FormData();
      if (png) form.append("timeline", png, "timeline.png");
      const res = await fetch(url, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "보고서를 만들지 못했어요");
        return;
      }
      const disposition = res.headers.get("Content-Disposition") || "";
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const fileName = encoded ? decodeURIComponent(encoded) : "기술검토보고서_초안.hwpx";
      const blobUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      // 타임라인 그림 단계에서 막히면 그림 없이라도 받게 한다
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  return (
    <a href={url} onClick={exportReport} className="btn-secondary" data-view aria-busy={busy}>
      {busy ? "⏳ 보고서 만드는 중..." : "📄 보고서 초안 내보내기"}
    </a>
  );
}
