// 보고서 목차(샘플 hwpx 기준)에 맞춘 화면 챕터 구조.
// number는 표시용 문자열(하위 항목 포함), oldModuleNumbers는 그 화면에 걸린 기존 module_status
// 완료 처리 단위(0~7)를 그대로 나열한 것 — 데이터/완료기록 자체는 옛 번호를 그대로 씀.
export const CHAPTERS = [
  { key: "1", label: "1. 개요", oldModuleNumbers: [0] },
  {
    key: "2",
    label: "2. 토양오염물질의 종류·양·특성",
    subTabs: [
      { key: "2.1", label: "2.1 대상부지 토양오염 현황", oldModuleNumbers: [1] },
      { key: "2.2", label: "2.2 인접·주변부지 토양오염 현황", oldModuleNumbers: [2, 7] },
    ],
  },
  {
    key: "3",
    label: "3. 기술검토 결과",
    subTabs: [
      { key: "3.1", label: "3.1 소유·점유·운영", oldModuleNumbers: [3, 4, 5] },
      { key: "3.2", label: "3.2 토양환경평가", oldModuleNumbers: [3] },
      { key: "3.3", label: "3.3 비용감당능력", oldModuleNumbers: [3] },
      { key: "3.4", label: "3.4 출입가능성", oldModuleNumbers: [3] },
      { key: "3.5", label: "3.5 정화책임자간 약정", oldModuleNumbers: [3] },
      { key: "3.6", label: "3.6 관리이력", oldModuleNumbers: [3] },
    ],
  },
  { key: "4", label: "4. 현장 및 청취조사", oldModuleNumbers: [6] },
  { key: "5", label: "5. 과학적 기법에 의한 오염원인 추정", oldModuleNumbers: [] },
  { key: "6", label: "6. 기술검토 결과(종합)", oldModuleNumbers: [3, 7] },
];

// module_status 완료 카운트 표시용 — 옛 챕터 0~7, 총 8개 그대로
export const TOTAL_TRACKED_MODULES = 8;

// module_status 테이블은 옛 module_number(0~7) 단위로 완료 여부를 기록한다(스키마 변경 없이 그대로 사용).
// 케이스 생성 시 초기 레코드를 만들거나, 완료 토글 시 module_name을 채울 때 씀.
export const OLD_MODULES = [
  { number: 0, name: "안건 개요" },
  { number: 1, name: "대상부지 오염현황" },
  { number: 2, name: "주변부지 오염현황" },
  { number: 3, name: "소유 이력 분석" },
  { number: 4, name: "항공사진 분석" },
  { number: 5, name: "활용 이력 분석" },
  { number: 6, name: "현장 및 청취조사" },
  { number: 7, name: "오염 개연성 판단" },
];
