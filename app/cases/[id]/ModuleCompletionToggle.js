"use client";

import { supabase } from "@/lib/supabaseClient";
import { CHAPTERS, CHAPTER_COMPLETIONS, completionTarget, subTabCompletionNumber } from "@/lib/modules";

// 완료 처리 버튼. 보통은 장(1~6) 단위이고, 하위 항목별 장(modules.js의 SUBTAB_COMPLETION_CHAPTERS, 예: 2장)은
// 2.1·2.2를 따로 완료하며 둘 다 완료돼야 장 완료로 친다.
// moduleStatus/caseStatus는 상위(page.js)에서 한 번만 불러온 걸 그대로 씀.
export default function ModuleCompletionToggle({
  caseId,
  chapterKey,
  subTabKey,
  moduleStatus,
  caseStatus,
  reloadModuleStatus,
  reloadCase,
}) {
  const target = completionTarget(chapterKey, subTabKey);
  if (!target) return null;
  const isCompleted = !!moduleStatus[target.number]?.is_completed;

  // 기록이 있으면 고치고 없으면 새로 넣는다. 예전엔 저장 실패를 무시해서 버튼만 눌리고 아무 일도 없었다.
  async function saveStatus(number, name, value) {
    const current = moduleStatus[number];
    const fields = { is_completed: value, completed_at: value ? new Date().toISOString() : null };
    const { error } = current
      ? await supabase.from("module_status").update(fields).eq("id", current.id)
      : await supabase.from("module_status").insert([{ case_id: caseId, module_number: number, module_name: name, ...fields }]);
    return error;
  }

  async function toggleComplete() {
    const newValue = !isCompleted;
    const status = { ...moduleStatus };
    const setLocal = (n, v) => (status[n] = { ...status[n], is_completed: v });

    let saveError = await saveStatus(target.number, target.name, newValue);
    setLocal(target.number, newValue);

    // 하위 항목을 바꿨으면 장 완료도 맞춘다: 하위 항목이 전부 완료일 때만 장 완료
    if (!saveError && target.subTabKey) {
      const chapter = CHAPTERS.find((c) => c.key === chapterKey);
      const chapterNumber = CHAPTER_COMPLETIONS.find((c) => c.chapterKey === chapterKey).number;
      const chapterDone = chapter.subTabs.every((s) => status[subTabCompletionNumber(s.key)]?.is_completed);
      if (!!status[chapterNumber]?.is_completed !== chapterDone) {
        saveError = await saveStatus(chapterNumber, chapter.label, chapterDone);
        setLocal(chapterNumber, chapterDone);
      }
    }

    if (saveError) {
      alert(`완료 처리를 저장하지 못했어요: ${saveError.message}`);
      await reloadModuleStatus();
      return;
    }
    await reloadModuleStatus();

    const allDone = CHAPTER_COMPLETIONS.every((c) => status[c.number]?.is_completed);
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
      {isCompleted ? `✓ ${target.label} 완료 취소` : `${target.label} 완료 처리`}
    </button>
  );
}
