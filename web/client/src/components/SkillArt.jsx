// Illustrations for the skill cards. Colours come from the card's [data-tone]
// CSS variables (--art-bg, --art-fg, --art-mid, --art-hi), so they follow dark mode.

function Reels() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${70 + i * 66} ${i === 1 ? 14 : 28}) rotate(${(i - 1) * 6} 30 55)`}>
          <rect width="60" height="108" rx="10" className="art-card" />
          <rect x="6" y="6" width="48" height="66" rx="6" className={i === 1 ? "art-hi" : "art-mid"} />
          <path d={`M25 ${30} l14 9 -14 9z`} className="art-fg" />
          <rect x="6" y="80" width="34" height="5" rx="2.5" className="art-mid" />
          <rect x="6" y="90" width="22" height="5" rx="2.5" className="art-mid" />
        </g>
      ))}
      <g transform="translate(208 18)">
        <rect width="74" height="26" rx="13" className="art-fg" />
        <text x="37" y="17.5" textAnchor="middle" className="art-label">♥ 3.2K</text>
      </g>
    </svg>
  );
}

function Threads() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(46 22)">
        <rect width="168" height="46" rx="14" className="art-card" />
        <circle cx="22" cy="23" r="11" className="art-mid" />
        <rect x="42" y="14" width="92" height="7" rx="3.5" className="art-mid" />
        <rect x="42" y="27" width="60" height="7" rx="3.5" className="art-mid" />
      </g>
      <g transform="translate(106 80)">
        <rect width="168" height="46" rx="14" className="art-hi" />
        <circle cx="22" cy="23" r="11" className="art-fg" />
        <rect x="42" y="14" width="98" height="7" rx="3.5" className="art-fg" />
        <rect x="42" y="27" width="54" height="7" rx="3.5" className="art-fg" />
      </g>
      <path d="M232 66 l14 -22 12 10 16 -28" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="art-stroke" />
      <circle cx="274" cy="26" r="6" className="art-fg" />
    </svg>
  );
}

function Write() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(64 18)">
        <rect width="150" height="116" rx="12" className="art-card" />
        {[18, 34, 50, 66].map((y, i) => (
          <rect key={y} x="16" y={y} width={[118, 96, 110, 70][i]} height="7" rx="3.5" className="art-mid" />
        ))}
        <rect x="16" y="88" width="56" height="16" rx="8" className="art-hi" />
      </g>
      <g transform="translate(196 22) rotate(32)">
        <rect width="18" height="96" rx="4" className="art-fg" />
        <path d="M0 96 h18 l-9 18z" className="art-hi" />
        <rect width="18" height="14" rx="4" className="art-mid" />
      </g>
      <path d="M232 112 q10 -10 20 0 t20 0" fill="none" strokeWidth="4" strokeLinecap="round" className="art-stroke" />
    </svg>
  );
}

function Library() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${74 + i * 22} ${44 - i * 12})`}>
          <rect width="130" height="88" rx="12" className={i === 2 ? "art-card" : "art-mid"} />
          {i === 2 && (
            <>
              <rect x="14" y="16" width="44" height="14" rx="7" className="art-hi" />
              <rect x="14" y="40" width="98" height="6" rx="3" className="art-mid" />
              <rect x="14" y="52" width="80" height="6" rx="3" className="art-mid" />
              <rect x="14" y="64" width="90" height="6" rx="3" className="art-mid" />
            </>
          )}
        </g>
      ))}
      <path d="M262 30 l6 12 13 2 -9 9 2 13 -12 -6 -12 6 2 -13 -9 -9 13 -2z" className="art-fg" />
    </svg>
  );
}

function Tiktok() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(118 14)">
        <rect width="72" height="124" rx="14" className="art-fg" />
        <rect x="6" y="8" width="60" height="108" rx="9" className="art-mid" />
        <path d="M30 46 v30 a8 8 0 1 1 -6 -7.7 V40 h16 v8 h-10z" className="art-card" />
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(206 ${30 + i * 32})`}>
          <circle cx="12" cy="12" r="12" className={i === 0 ? "art-hi" : "art-card"} />
          <rect x="30" y="8" width={[40, 30, 34][i]} height="8" rx="4" className="art-card" />
        </g>
      ))}
    </svg>
  );
}

function Fanpage() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(52 16)">
        <rect width="132" height="118" rx="14" className="art-card" />
        <circle cx="20" cy="20" r="9" className="art-mid" />
        <rect x="36" y="15" width="56" height="7" rx="3.5" className="art-mid" />
        <rect x="12" y="38" width="108" height="48" rx="8" className="art-mid" />
        <rect x="12" y="96" width="30" height="10" rx="5" className="art-hi" />
        <rect x="48" y="96" width="24" height="10" rx="5" className="art-mid" />
      </g>
      {[46, 74, 30, 92].map((h, i) => (
        <rect key={i} x={204 + i * 20} y={128 - h} width="14" height={h} rx="4" className={i === 3 ? "art-hi" : "art-card"} />
      ))}
    </svg>
  );
}

function ImageArt() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(78 18) rotate(-4 80 56)">
        <rect width="160" height="112" rx="14" className="art-card" />
        <rect x="10" y="10" width="140" height="92" rx="9" className="art-mid" />
        <circle cx="114" cy="38" r="12" className="art-hi" />
        <path d="M10 102 l46 -46 34 32 18 -16 42 30z" className="art-fg" />
      </g>
      <path d="M60 30 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5z" className="art-hi" />
      <path d="M262 104 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z" className="art-card" />
    </svg>
  );
}

function Schedule() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(66 18)">
        <rect width="150" height="116" rx="14" className="art-card" />
        <rect width="150" height="26" rx="13" className="art-fg" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={14 + (i % 4) * 32} y={38 + Math.floor(i / 4) * 24} width="24" height="16" rx="5" className={i === 5 || i === 10 ? "art-hi" : "art-mid"} />
        ))}
      </g>
      <g transform="translate(240 70)">
        <circle r="30" className="art-hi" />
        <circle r="24" className="art-card" />
        <path d="M0 -14 V0 l10 8" fill="none" strokeWidth="5" strokeLinecap="round" className="art-stroke-fg" />
      </g>
    </svg>
  );
}

function Livestream() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(46 18)">
        <rect width="150" height="104" rx="14" className="art-card" />
        <rect x="10" y="10" width="130" height="84" rx="9" className="art-mid" />
        <rect x="18" y="18" width="44" height="18" rx="9" className="art-hi" />
        <text x="40" y="31" textAnchor="middle" className="art-live">LIVE</text>
        <circle cx="75" cy="62" r="16" className="art-fg" />
      </g>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={208} y={28 + i * 30} width={[78, 58, 70][i]} height="22" rx="11" className={i === 1 ? "art-hi" : "art-card"} />
      ))}
    </svg>
  );
}

const ART = { reels: Reels, threads: Threads, write: Write, library: Library, tiktok: Tiktok, fanpage: Fanpage, image: ImageArt, schedule: Schedule, livestream: Livestream };

export default function SkillArt({ id }) {
  const Art = ART[id];
  return <div className="skill-art">{Art && <Art />}</div>;
}
