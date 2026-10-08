"use client";

import { supabase } from "@/lib/supabaseClient";
import { CHAPTER_COMPLETIONS } from "@/lib/modules";

// 장(1~6) 하나에 대한 완료 처리 버튼. 장 안의 어느 하위 화면에서 눌러도 같은 장 기록을 바꾼다.
// moduleStatus/caseStatus는 상위(page.js)에서 한 번만 불러온 걸 그대로 씀.
export default function ModuleCompletionToggle({
  caseId,
  chapterKey,
  moduleStatus,
  caseStatus,
  reloadModuleStatus,
  reloadCase,
}) {
  const chapter = CHAPTER_COMPLETIONS.find((c) => c.chapterKey === chapterKey);
  if (!chapter) return null;
  const moduleNumber = chapter.number;
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
          module_name: chapter.name,
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

    const allDone = CHAPTER_COMPLETIONS.every((c) =>
      c.number === moduleNumber ? newValue : moduleStatus[c.number]?.is_completed
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
      {isCompleted ? `✓ ${chapterKey}장 완료 취소` : `${chapterKey}장 완료 처리`}
    </button>
  );
}
