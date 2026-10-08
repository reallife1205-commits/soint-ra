// 보고서 목차(샘플 hwpx 기준)에 맞춘 화면 챕터 구조.
// number는 표시용 문자열(하위 항목 포함), oldModuleNumbers는 그 화면에 걸린 기존 module_status
// 완료 처리 단위(0~7)를 그대로 나열한 것 — 데이터/완료기록 자체는 옛 번호를 그대로 씀.
// reportStatus: "required"(hwpx 보고서에 반영됨) | "reference"(입력해도 보고서엔 안 들어감).
// 화면 하나에 반영되는 부분과 안 되는 부분이 섞여 있으면(예: 2.2, 3.1, 3.6, 6장) 여기엔 안
// 붙이고 그 안의 도구탭(SUB_TAB_*)이나 화면 안 문구로 더 정확하게 표시한다.
export const CHAPTERS = [
  { key: "1", label: "1. 개요", oldModuleNumbers: [0], reportStatus: "required" },
  {
    key: "2",
    label: "2. 토양오염물질의 종류·양·특성",
    subTabs: [
      { key: "2.1", label: "2.1 대상부지 토양오염 현황", oldModuleNumbers: [1], reportStatus: "required" },
      { key: "2.2", label: "2.2 인접·주변부지 토양오염 현황", oldModuleNumbers: [2, 7] },
    ],
  },
  {
    key: "3",
    label: "3. 기술검토 결과",
    subTabs: [
      { key: "3.1", label: "3.1 소유·점유·운영", oldModuleNumbers: [3, 4, 5] },
      { key: "3.2", label: "3.2 토양환경평가", oldModuleNumbers: [3], reportStatus: "required" },
      { key: "3.3", label: "3.3 비용감당능력", oldModuleNumbers: [3], reportStatus: "required" },
      { key: "3.4", label: "3.4 출입가능성", oldModuleNumbers: [3, 4], reportStatus: "required" },
      { key: "3.5", label: "3.5 정화책임자간 약정", oldModuleNumbers: [3], reportStatus: "required" },
      { key: "3.6", label: "3.6 관리이력", oldModuleNumbers: [3] },
    ],
  },
  { key: "4", label: "4. 현장 및 청취조사", oldModuleNumbers: [6], reportStatus: "required" },
  { key: "5", label: "5. 과학적 기법에 의한 오염원인 추정", oldModuleNumbers: [], reportStatus: "required" },
  { key: "6", label: "6. 기술검토 결과(종합)", oldModuleNumbers: [3, 7] },
];

// 완료 처리는 장(1~6) 단위. module_status에 module_number = 10 + 장 번호(11~16)로 기록한다.
// (예전엔 옛 단위 0~7로 셌는데, 화면의 장과 안 맞아 "5/8"처럼 헷갈리고 여러 화면이 같은 번호를 같이 써서 바꿈.
//  옛 0~7 기록은 DB에 남아 있지만 이제 안 씀 — sql/024에서 장 기준으로 옮김.)
export const CHAPTER_COMPLETIONS = CHAPTERS.map((c) => ({
  chapterKey: c.key,
  number: 10 + Number(c.key),
  name: c.label,
}));

export const TOTAL_CHAPTERS = CHAPTER_COMPLETIONS.length;

export function chapterCompletionNumber(chapterKey) {
  return CHAPTER_COMPLETIONS.find((c) => c.chapterKey === chapterKey)?.number;
}

export function isChapterCompletionNumber(n) {
  return CHAPTER_COMPLETIONS.some((c) => c.number === n);
}
