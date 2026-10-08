"use client";

import { supabase } from "@/lib/supabaseClient";
import { OLD_MODULES } from "@/lib/modules";

// 옛 module_number(0~7) 하나에 대한 완료 처리 버튼. 여러 새 화면(예: 3.1 안의 소유이력/항공사진/DART)에서
// 각자 자기 옛 번호로 재사용됨. moduleStatus/caseStatus는 상위(page.js)에서 한 번만 불러온 걸 그대로 씀.
export default function ModuleCompletionToggle({
  caseId,
  moduleNumber,
  moduleStatus,
  caseStatus,
  reloadModuleStatus,
  reloadCase,
}) {
  const current = moduleStatus[moduleNumber];
  const isCompleted = !!current?.is_completed;

  async function toggleComplete() {
    const newValue = !isCompleted;

    // 예전엔 저장 실패를 무시해서, 1. 개요처럼 DB가 거부해도 버튼만 눌리고 아무 일도 없었다.
    let saveError;
    if (current) {
      ({ error: saveError } = await supabase
        .from("module_status")
        .update({
          is_completed: newValue,
          completed_at: newValue ? new Date().toISOString() : null,
        })
        .eq("id", current.id));
    } else {
      ({ error: saveError } = await supabase.from("module_status").insert([
        {
          case_id: caseId,
          module_number: moduleNumber,
          module_name: OLD_MODULES.find((m) => m.number === moduleNumber)?.name,
          is_completed: newValue,
          completed_at: newValue ? new Date().toISOString() : null,
        },
      ]));
    }
    if (saveError) {
      alert(`완료 처리를 저장하지 못했어요: ${saveError.message}`);
      return;
    }
    await reloadModuleStatus();

    const allDone = OLD_MODULES.every((m) =>
      m.number === moduleNumber ? newValue : moduleStatus[m.number]?.is_completed
    );
    if (allDone) {
      await supabase.from("cases").update({ status: "완료" }).eq("id", caseId);
      reloadCase();
    } else if (caseStatus === "완료") {
      await supabase.from("cases").update({ status: "작성중" }).eq("id", caseId);
      reloadCase();
    }
  }

  return (
    <button className={isCompleted ? "btn-complete-done" : "btn-complete"} onClick={toggleComplete}>
      {isCompleted ? "✓ 완료 취소" : "완료 처리"}
    </button>
  );
}
