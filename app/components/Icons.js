// 관리 버튼용 단순한 선 아이콘 — 컬러 이모지(🗑️📅✏️✕)가 섞여 화면이 산만해 보여 한 가지 모양으로 통일.
// 색은 currentColor라 버튼의 글자색을 따른다.
function Svg({ size = 14, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {children}
    </svg>
  );
}

export function TrashIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
    </Svg>
  );
}

export function CalendarIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  );
}

export function PencilIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13 7l4 4" />
    </Svg>
  );
}

export function XIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}
