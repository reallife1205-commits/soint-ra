export default function SoilBanner() {
  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 20,
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <svg
        viewBox="0 0 1200 200"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#faf5e8" />
            <stop offset="100%" stopColor="#f0e6cf" />
          </linearGradient>
        </defs>

        {/* 하늘 */}
        <rect x="0" y="0" width="1200" height="120" fill="url(#skyGrad)" />

        {/* 해 */}
        <circle cx="1080" cy="52" r="26" fill="#d97f4d" opacity="0.85" />
        <g stroke="#d97f4d" strokeWidth="3" opacity="0.55" strokeLinecap="round">
          <line x1="1080" y1="8" x2="1080" y2="-2" />
          <line x1="1116" y1="24" x2="1124" y2="17" />
          <line x1="1116" y1="80" x2="1124" y2="87" />
        </g>

        {/* 완만한 능선 */}
        <path
          d="M0,105 C150,80 300,115 480,95 C650,76 820,108 1000,90 C1080,82 1150,92 1200,88 L1200,125 L0,125 Z"
          fill="#c9c19f"
          opacity="0.55"
        />

        {/* 토양 단면 - 표토 */}
        <rect x="0" y="118" width="1200" height="30" fill="#6b5a3a" />
        {/* 심토(점토) */}
        <rect x="0" y="148" width="1200" height="30" fill="#a8562f" />
        {/* 모암/기반층 */}
        <rect x="0" y="178" width="1200" height="22" fill="#7a4526" />

        {/* 토양 입자 질감 (점) */}
        <g fill="#5a4a2e" opacity="0.4">
          <circle cx="90" cy="132" r="3" />
          <circle cx="260" cy="138" r="2.5" />
          <circle cx="430" cy="128" r="3" />
          <circle cx="610" cy="140" r="2.5" />
          <circle cx="790" cy="130" r="3" />
          <circle cx="960" cy="138" r="2.5" />
          <circle cx="1120" cy="128" r="3" />
        </g>
        <g fill="#8a4525" opacity="0.5">
          <circle cx="150" cy="162" r="3" />
          <circle cx="340" cy="158" r="2.5" />
          <circle cx="520" cy="166" r="3" />
          <circle cx="700" cy="158" r="2.5" />
          <circle cx="880" cy="164" r="3" />
          <circle cx="1050" cy="158" r="2.5" />
        </g>

        {/* 새싹 3개 */}
        {[180, 560, 940].map((x, i) => (
          <g key={i} transform={`translate(${x}, 118)`}>
            <line x1="0" y1="0" x2="0" y2="-26" stroke="#5f7048" strokeWidth="3" strokeLinecap="round" />
            <path d="M0,-20 C-14,-24 -20,-38 -14,-48 C-2,-42 2,-28 0,-20 Z" fill="#6f8256" />
            <path d="M0,-14 C14,-18 22,-32 16,-42 C4,-36 -2,-22 0,-14 Z" fill="#5f7048" />
          </g>
        ))}

        {/* 조사 표식(측량 깃발) 2개 */}
        {[340, 760].map((x, i) => (
          <g key={i} transform={`translate(${x}, 118)`}>
            <line x1="0" y1="0" x2="0" y2="-44" stroke="#8a7a63" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M0,-44 L26,-37 L0,-30 Z" fill="#a8562f" />
            <circle cx="0" cy="0" r="4" fill="#8a7a63" />
          </g>
        ))}
      </svg>
    </div>
  );
}
