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
        {/* 마스코트 "담이" 움직임 — 통통 뛰기·새싹 살랑·눈 깜빡임, 마우스를 올리면 손 흔들기.
            움직임 줄이기 설정(prefers-reduced-motion)이면 멈춘다. transform-box: fill-box로 각 부위 기준점을 잡음. */}
        <style>{`
          .dami { cursor: pointer; }
          .dami-bounce, .dami-shadow, .dami-sprout, .dami-eye, .dami-arm-up {
            transform-box: fill-box;
          }
          .dami-bounce { transform-origin: 50% 100%; animation: dami-bounce 2.4s ease-in-out infinite; }
          .dami-shadow { transform-origin: 50% 50%; animation: dami-shadow 2.4s ease-in-out infinite; }
          .dami-sprout { transform-origin: 50% 100%; animation: dami-sway 3s ease-in-out infinite; }
          .dami-eye { transform-origin: 50% 50%; animation: dami-blink 4.5s infinite; }
          /* 평소엔 내린 팔, 마우스를 올리면 든 팔로 바꿔 어깨(든 팔의 왼쪽 아래)를 축으로 좌우로 흔든다 */
          .dami-arm-up, .dami-hello { opacity: 0; transition: opacity 0.15s; }
          .dami-arm-up { transform-origin: 0% 100%; }
          .dami:hover .dami-arm-r { opacity: 0; }
          .dami:hover .dami-arm-up { opacity: 1; animation: dami-wave 0.45s ease-in-out infinite alternate; }
          .dami:hover .dami-hello { opacity: 1; }
          .dami:hover .dami-bounce { animation-duration: 0.9s; }
          .dami:hover .dami-shadow { animation-duration: 0.9s; }
          @keyframes dami-bounce {
            0%, 100% { transform: translateY(0) scale(1.03, 0.97); }
            50% { transform: translateY(-7px) scale(0.98, 1.02); }
          }
          @keyframes dami-shadow {
            0%, 100% { transform: scale(1); opacity: 0.25; }
            50% { transform: scale(0.8); opacity: 0.15; }
          }
          @keyframes dami-sway {
            0%, 100% { transform: rotate(-7deg); }
            50% { transform: rotate(7deg); }
          }
          @keyframes dami-blink {
            0%, 92%, 100% { transform: scaleY(1); }
            95% { transform: scaleY(0.1); }
          }
          @keyframes dami-wave {
            from { transform: rotate(-12deg); }
            to { transform: rotate(22deg); }
          }
          @media (prefers-reduced-motion: reduce) {
            .dami-bounce, .dami-shadow, .dami-sprout, .dami-eye, .dami:hover .dami-arm-up { animation: none; }
          }
        `}</style>
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
        <g transform="translate(455, 118)" className="dami">
          <title>담이</title>
          {/* 그림자 */}
          <ellipse className="dami-shadow" cx="0" cy="4" rx="34" ry="6" fill="#5a4a2e" opacity="0.25" />
          <g className="dami-bounce">
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
          <g className="dami-sprout">
            <line x1="0" y1="-46" x2="0" y2="-62" stroke="#5f7048" strokeWidth="3" strokeLinecap="round" />
            <path d="M0,-58 C-11,-62 -15,-72 -10,-80 C0,-75 3,-64 0,-58 Z" fill="#6f8256" />
            <path d="M0,-54 C11,-58 16,-69 11,-77 C1,-71 -2,-60 0,-54 Z" fill="#5f7048" />
          </g>
          {/* 볼터치 */}
          <circle cx="-14" cy="-20" r="4" fill="#e8967a" opacity="0.7" />
          <circle cx="14" cy="-20" r="4" fill="#e8967a" opacity="0.7" />
          {/* 눈 */}
          <circle className="dami-eye" cx="-9" cy="-24" r="3.2" fill="#2c2418" />
          <circle className="dami-eye" cx="9" cy="-24" r="3.2" fill="#2c2418" />
          {/* 웃는 입 */}
          <path d="M-7,-14 C-3,-9 3,-9 7,-14" stroke="#2c2418" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* 팔(짧고 통통) */}
          <path d="M-30,-8 C-38,-6 -40,2 -34,6" stroke="#8a4525" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path className="dami-arm-r" d="M30,-8 C38,-6 40,2 34,6" stroke="#8a4525" strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* 마우스를 올리면: 위로 든 팔(끝에 손) + "반가워요!" 말풍선 */}
          <g className="dami-arm-up">
            <path d="M29,-14 C38,-20 42,-30 43,-40" stroke="#8a4525" strokeWidth="5" fill="none" strokeLinecap="round" />
            <circle cx="43" cy="-43" r="5" fill="#a8562f" stroke="#8a4525" strokeWidth="2" />
          </g>
          <g className="dami-hello">
            <rect x="48" y="-86" width="76" height="26" rx="13" fill="#ffffff" stroke="#8a4525" strokeWidth="1.5" />
            <path d="M58,-61 L54,-52 L66,-61 Z" fill="#ffffff" stroke="#8a4525" strokeWidth="1.5" strokeLinejoin="round" />
            <rect x="57" y="-63" width="10" height="3" fill="#ffffff" />
            <text x="86" y="-68" textAnchor="middle" fontSize="13" fontWeight="700" fill="#5a3a22">반가워요!</text>
          </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
