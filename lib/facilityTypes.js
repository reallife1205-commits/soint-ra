export const FACILITY_TYPES = [
  { key: "building", label: "건물", color: "#2f5fd6" },
  { key: "road", label: "도로", color: "#a5760b" },
  { key: "storage", label: "저장탱크/야적장", color: "#c23434" },
  { key: "parking", label: "주차장", color: "#5f7048" },
  { key: "etc", label: "기타 시설", color: "#6b7269" },
];

export const FACILITY_LABEL = Object.fromEntries(
  FACILITY_TYPES.map((f) => [f.key, f.label])
);
export const FACILITY_COLOR = Object.fromEntries(
  FACILITY_TYPES.map((f) => [f.key, f.color])
);
