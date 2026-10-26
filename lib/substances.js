// 모듈1(자유 입력)과 모듈2(정해진 목록) 사이 오염물질 이름 표기를 맞춰주는 공용 유틸

export const SUBSTANCE_GROUPS = [
  {
    label: "중금속류",
    items: [
      ["cadmium", "카드뮴(Cd)"],
      ["copper", "구리(Cu)"],
      ["arsenic", "비소(As)"],
      ["lead", "납(Pb)"],
      ["chromium6", "6가크롬(Cr6+)"],
      ["mercury", "수은(Hg)"],
      ["zinc", "아연(Zn)"],
      ["nickel", "니켈(Ni)"],
    ],
  },
  {
    label: "유기물질",
    items: [
      ["organophosphorus", "유기인"],
      ["cyanide", "시안(CN)"],
      ["phenol", "페놀류"],
      ["benzene", "벤젠"],
      ["toluene", "톨루엔"],
      ["ethylbenzene", "에틸벤젠"],
      ["xylene", "크실렌"],
      ["tph", "TPH"],
    ],
  },
  {
    label: "휘발성 유기화합물",
    items: [
      ["tce", "TCE"],
      ["pce", "PCE"],
    ],
  },
  {
    label: "기타",
    items: [
      ["fluorine", "불소(F)"],
      ["pcb", "PCB"],
      ["benzoapyrene", "벤조(a)피렌"],
    ],
  },
];

export const SUBSTANCE_LABELS = SUBSTANCE_GROUPS.flatMap((g) =>
  g.items.map(([, label]) => label)
);

// "아연(Zn)" -> "아연", "6가크롬(Cr6+)" -> "6가크롬" 처럼 괄호와 공백을 없애요.
export function normalizeSubstanceName(name) {
  return (name || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

// "아연", "아연(Zn)", "Zn", "zinc" 등 어떻게 입력해도 같은 물질로 찾아줘요.
export function findSubstanceKey(name) {
  const norm = normalizeSubstanceName(name);
  if (!norm) return null;

  for (const group of SUBSTANCE_GROUPS) {
    for (const [key, label] of group.items) {
      if (normalizeSubstanceName(label) === norm) return key;
      if (key.toLowerCase() === norm) return key;

      const symbolMatch = label.match(/\(([^)]+)\)/);
      if (symbolMatch && symbolMatch[1].toLowerCase() === norm) return key;
    }
  }
  return null;
}

// 오염물질이 중금속뿐인 안건의 5장(과학적 기법에 의한 오염원인 추정) 예시 문구.
// 중금속이 아닌 물질이 하나라도 있거나 물질이 없으면 null. 검토자가 안건에 맞게 고쳐 쓰도록 "예시)"를 붙인다.
const HEAVY_METAL_KEYS = new Set(SUBSTANCE_GROUPS[0].items.map(([key]) => key));

export function heavyMetalScientificExample(contaminants) {
  const keys = Array.from(new Set((contaminants || []).map(findSubstanceKey)));
  if (!keys.length || !keys.every((k) => HEAVY_METAL_KEYS.has(k))) return null;
  const names = keys.map((k) =>
    SUBSTANCE_GROUPS[0].items.find(([key]) => key === k)[1].replace(/\(.*?\)/g, "")
  );
  return (
    `예시) 대상부지의 오염물질인 중금속(${names.join(", ")})은 유류와 달리 휘발되지 않고 토양 입자에 강하게 흡착되어, ` +
    "오염이 주로 발생 지점 주변에 국한되어 분포한다. 또한 유류 지문분석이나 풍화도 분석 등 오염 시기 및 원인을 추정하는 " +
    "과학적 기법은 주로 유기 오염물질에 적용되는 방법으로 중금속에는 적용하기 어렵다. 따라서 본 검토에서는 과학적 기법에 " +
    "의한 오염원인 추정은 제외하고 오염 농도의 분포와 부지의 소유·점유 및 토지이용 이력을 종합하여 오염원인을 판단하였음."
  );
}
