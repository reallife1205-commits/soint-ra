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
