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
        <circle cx="1080" cy="52" r="26" fill="#f0a94a" opacity="0.9" />
        <g stroke="#f0a94a" strokeWidth="3" opacity="0.6" strokeLinecap="round">
          <line x1="1080" y1="8" x2="1080" y2="-2" />
          <line x1="1116" y1="24" x2="1124" y2="17" />
          <line x1="1116" y1="80" x2="1124" y2="87" />
        </g>

        {/* 완만한 능선 (연초록빛) */}
        <path
          d="M0,105 C150,80 300,115 480,95 C650,76 820,108 1000,90 C1080,82 1150,92 1200,88 L1200,125 L0,125 Z"
          fill="#a8c084"
          opacity="0.65"
        />

        {/* 잔디 라인 */}
        <g stroke="#7fa35c" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
          {Array.from({ length: 60 }).map((_, i) => {
            const x = 10 + i * 20;
            const h = 5 + ((i * 37) % 6);
            return <line key={i} x1={x} y1="118" x2={x + (i % 2 ? 2 : -2)} y2={118 - h} />;
          })}
        </g>

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

        {/* 새싹 4개 (양 끝 균형 맞춤) */}
        {[60, 220, 600, 980].map((x, i) => (
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

        {/* 마스코트: 흙덩이 캐릭터 "담이" */}
        <g transform="translate(455, 118)">
          {/* 그림자 */}
          <ellipse cx="0" cy="4" rx="34" ry="6" fill="#5a4a2e" opacity="0.25" />
          {/* 몸통 */}
          <path
            d="M-32,0 C-34,-30 -18,-46 0,-46 C18,-46 34,-30 32,0 C32,8 -32,8 -32,0 Z"
            fill="#a8562f"
            stroke="#8a4525"
            strokeWidth="2"
          />
          {/* 배 하이라이트 */}
          <ellipse cx="0" cy="-14" rx="16" ry="12" fill="#c06a3f" opacity="0.6" />
          {/* 머리 위 새싹 */}
          <line x1="0" y1="-46" x2="0" y2="-62" stroke="#5f7048" strokeWidth="3" strokeLinecap="round" />
          <path d="M0,-58 C-11,-62 -15,-72 -10,-80 C0,-75 3,-64 0,-58 Z" fill="#6f8256" />
          <path d="M0,-54 C11,-58 16,-69 11,-77 C1,-71 -2,-60 0,-54 Z" fill="#5f7048" />
          {/* 볼터치 */}
          <circle cx="-14" cy="-20" r="4" fill="#e8967a" opacity="0.7" />
          <circle cx="14" cy="-20" r="4" fill="#e8967a" opacity="0.7" />
          {/* 눈 */}
          <circle cx="-9" cy="-24" r="3.2" fill="#2c2418" />
          <circle cx="9" cy="-24" r="3.2" fill="#2c2418" />
          {/* 웃는 입 */}
          <path d="M-7,-14 C-3,-9 3,-9 7,-14" stroke="#2c2418" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* 팔(짧고 통통) */}
          <path d="M-30,-8 C-38,-6 -40,2 -34,6" stroke="#8a4525" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M30,-8 C38,-6 40,2 34,6" stroke="#8a4525" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
