export function TopoBackground() {
  const lines = Array.from({ length: 16 }).map((_, i) => {
    const y = 60 + i * 110;
    const sway = i % 2 === 0 ? -45 : 30;
    return (
      <path
        key={i}
        d={`M-50,${y} Q260,${y + sway} 520,${y + 20} T1080,${y - 25} T1400,${y + 35}`}
      />
    );
  });
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-[0.07]"
      viewBox="0 0 1200 1800"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="topoStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="50%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#A3E635" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#topoStroke)" strokeWidth="1.4">
        {lines}
      </g>
    </svg>
  );
}

function Motorcycle() {
  return (
    <svg
      viewBox="0 0 220 110"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-auto w-full text-[#60A5FA]"
      style={{ filter: "drop-shadow(0 0 6px rgba(96,165,250,0.55))" }}
    >
      <circle cx="38" cy="80" r="22" />
      <circle cx="38" cy="80" r="9" strokeOpacity="0.5" />
      <circle cx="38" cy="80" r="2" fill="currentColor" stroke="none" />
      <circle cx="180" cy="80" r="22" />
      <circle cx="180" cy="80" r="9" strokeOpacity="0.5" />
      <circle cx="180" cy="80" r="2" fill="currentColor" stroke="none" />
      <path d="M38 80 L70 50 L110 42 L150 32" />
      <path d="M150 32 L180 80" />
      <path d="M70 50 L110 42 L150 50 L160 62 L110 56 Z" />
      <rect x="86" y="56" width="36" height="22" rx="3" />
      <path d="M86 62 L78 70 M86 70 L78 78 M86 78 L78 86" strokeOpacity="0.6" />
      <path d="M150 32 L162 24 L178 20" />
      <path d="M178 20 L184 18" strokeWidth="3" />
      <path d="M38 80 L18 84 L6 82" />
      <path d="M150 50 L160 28" strokeOpacity="0.6" />
    </svg>
  );
}

function Pin({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 32"
      fill="none"
      className="h-auto w-6"
      style={{ filter: `drop-shadow(0 0 6px ${color})` }}
    >
      <path
        d="M12 2 C6 2 3 6 3 11 C3 17 12 30 12 30 C12 30 21 17 21 11 C21 6 18 2 12 2 Z"
        fill={color}
        stroke="#08080F"
        strokeWidth="1.2"
      />
      <circle cx="12" cy="11" r="3" fill="#08080F" />
    </svg>
  );
}

function CompassRose() {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className="h-auto w-full text-[#22D3EE]"
      style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.5))" }}
    >
      <circle cx="60" cy="60" r="50" />
      <circle cx="60" cy="60" r="40" strokeOpacity="0.5" />
      <circle cx="60" cy="60" r="3" fill="currentColor" stroke="none" />
      <path d="M60 14 L65 60 L60 56 L55 60 Z" fill="currentColor" stroke="none" />
      <path d="M60 106 L55 60 L60 64 L65 60 Z" strokeOpacity="0.7" />
      <path d="M106 60 L60 65 L64 60 L60 55 Z" strokeOpacity="0.5" />
      <path d="M14 60 L60 55 L56 60 L60 65 Z" strokeOpacity="0.5" />
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i * 15 * Math.PI) / 180;
        const r1 = 50;
        const r2 = i % 2 === 0 ? 46 : 48;
        const x1 = 60 + r1 * Math.sin(a);
        const y1 = 60 - r1 * Math.cos(a);
        const x2 = 60 + r2 * Math.sin(a);
        const y2 = 60 - r2 * Math.cos(a);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            strokeOpacity={i % 6 === 0 ? 1 : 0.5}
          />
        );
      })}
      <text
        x="60"
        y="11"
        textAnchor="middle"
        fontSize="9"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        N
      </text>
    </svg>
  );
}

function Mountains() {
  return (
    <svg
      viewBox="0 0 240 120"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-auto w-full"
      style={{ filter: "drop-shadow(0 0 10px rgba(167,139,250,0.35))" }}
    >
      <path
        d="M0 110 L40 70 L72 88 L108 50 L150 80 L188 40 L240 90 L240 120 L0 120 Z"
        fill="#A78BFA"
        fillOpacity="0.08"
        stroke="#A78BFA"
        strokeOpacity="0.5"
        strokeWidth="1.2"
      />
      <path
        d="M0 115 L36 96 L70 105 L108 78 L142 100 L184 72 L220 96 L240 88 L240 120 L0 120 Z"
        fill="#A3E635"
        fillOpacity="0.06"
        stroke="#A3E635"
        strokeOpacity="0.45"
        strokeWidth="1.2"
      />
      <circle cx="108" cy="50" r="2" fill="#F472B6" />
      <circle cx="188" cy="40" r="2" fill="#22D3EE" />
    </svg>
  );
}

export function LeftRail() {
  return (
    <aside className="pointer-events-none absolute left-0 top-0 hidden h-full w-[230px] xl:block">
      {/* Dashed route arc */}
      <svg
        viewBox="0 0 230 1200"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        <path
          d="M40 60 C 180 200, 60 360, 170 520 S 60 760, 180 920 S 80 1100, 130 1180"
          stroke="#60A5FA"
          strokeWidth="1.5"
          strokeOpacity="0.45"
          strokeDasharray="4 8"
          strokeLinecap="round"
        />
      </svg>

      {/* Pin markers along the route */}
      <div className="absolute left-[36px] top-[55px]">
        <Pin color="#60A5FA" />
      </div>
      <div className="absolute left-[166px] top-[515px]">
        <Pin color="#F472B6" />
      </div>
      <div className="absolute left-[176px] top-[915px]">
        <Pin color="#A3E635" />
      </div>

      {/* Motorcycle near the bottom */}
      <div className="absolute bottom-12 left-4 w-[200px]">
        <Motorcycle />
      </div>
    </aside>
  );
}

export function RightRail() {
  return (
    <aside className="pointer-events-none absolute right-0 top-0 hidden h-full w-[230px] xl:block">
      {/* Compass at the top */}
      <div className="absolute right-8 top-12 w-[120px]">
        <CompassRose />
      </div>

      {/* Coordinate stack */}
      <div className="absolute right-8 top-[260px] text-right font-mono text-[10px] tracking-[0.18em] text-gray-500">
        <p>LAT 12.97° N</p>
        <p className="mt-0.5">LON 77.59° E</p>
      </div>

      {/* Vertical neon trail */}
      <svg
        viewBox="0 0 230 600"
        className="absolute right-0 top-[400px] h-[600px] w-full"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d="M180 0 C 60 120, 200 280, 100 400 S 220 580, 140 600"
          stroke="#A3E635"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeDasharray="3 6"
          strokeLinecap="round"
        />
        <circle cx="180" cy="0" r="3" fill="#A3E635" />
        <circle cx="100" cy="400" r="3" fill="#22D3EE" />
        <circle cx="140" cy="600" r="3" fill="#F472B6" />
      </svg>

      {/* Mountains at the bottom */}
      <div className="absolute bottom-8 left-0 w-full px-4">
        <Mountains />
      </div>
    </aside>
  );
}
