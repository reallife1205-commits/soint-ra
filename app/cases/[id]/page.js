"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function CaseDetailPage() {
  const { id } = useParams();
  const [caseInfo, setCaseInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("cases").select("*").eq("id", id).single();
      setCaseInfo(data);
      setLoading(false);
    }
    load();
  }, [id]);

  return (
    <div className="page">
      <Link href="/cases" style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
        ← 목록으로
      </Link>

      {loading ? (
        <div className="card" style={{ marginTop: 16 }}>
          불러오는 중이에요...
        </div>
      ) : !caseInfo ? (
        <div className="card" style={{ marginTop: 16 }}>
          해당 안건을 찾을 수 없어요.
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>
            {caseInfo.case_number} · {caseInfo.company_name}
          </div>
          <div style={{ color: "var(--color-text-muted)", marginTop: 4 }}>
            {caseInfo.address}
          </div>
          <div style={{ marginTop: 16, fontSize: 13, color: "var(--color-text-muted)" }}>
            모듈 1~7 탭 화면은 다음 단계에서 만들 예정이에요.
          </div>
        </div>
      )}
    </div>
  );
}
