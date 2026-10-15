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
        {/* 배경(B2 "따뜻한 아침" 시안): 크림빛 하늘, 은은한 해, 세이지 능선 두 겹, 아래 얇은 흙 띠.
            예전엔 진한 흙층 세 줄이 배너의 40%를 차지해 무겁고 촌스러워 보여서 바꿈 — 토양 느낌은 흙 띠로만. */}
        <rect x="0" y="0" width="1200" height="200" fill="#fbf4ea" />

        {/* 해 */}
        <circle cx="1050" cy="58" r="30" fill="#f8d9b0" opacity="0.9" />
        <circle cx="1050" cy="58" r="20" fill="#f4c27f" opacity="0.9" />

        {/* 먼 능선 / 가까운 능선 */}
        <path
          d="M0,112 C180,88 340,118 540,100 C740,82 920,112 1100,94 C1150,90 1180,94 1200,92 L1200,176 L0,176 Z"
          fill="#dbe6cb"
        />
        <path
          d="M0,146 C220,126 400,154 620,136 C840,120 1010,148 1200,134 L1200,178 L0,178 Z"
          fill="#b5cf9e"
        />

        {/* 흙 띠 두 겹 + 흙 알갱이 */}
        <rect x="0" y="150" width="1200" height="24" fill="#d2b893" />
        <rect x="0" y="174" width="1200" height="26" fill="#b39672" />
        <g fill="#9c7e5d" opacity="0.35">
          {[120, 380, 660, 940].map((x, i) => (
            <circle key={i} cx={x} cy={i % 2 ? 190 : 184} r="2" />
          ))}
        </g>

        {/* 새싹 3개 */}
        {[170, 790, 1010].map((x, i) => (
          <g key={i} transform={`translate(${x}, 150)`}>
            <line x1="0" y1="0" x2="0" y2="-20" stroke="#5f7048" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M0,-15 C-11,-18 -15,-29 -11,-37 C-2,-32 2,-21 0,-15 Z" fill="#6f8256" />
            <path d="M0,-10 C11,-13 17,-24 12,-32 C3,-27 -2,-17 0,-10 Z" fill="#5f7048" />
          </g>
        ))}

        {/* 마스코트: 흙덩이 캐릭터 "담이" */}
        <g transform="translate(455, 150)" className="dami">
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
