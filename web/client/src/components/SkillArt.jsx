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

function Clone() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(40 34)">
        <rect width="78" height="84" rx="10" className="art-fg" />
        {[14, 28, 42].map((y, i) => (
          <rect key={y} x="12" y={y} width={[54, 40, 48][i]} height="6" rx="3" className="art-mid" />
        ))}
        <rect x="12" y="60" width="30" height="12" rx="6" className="art-hi" />
      </g>
      <path d="M132 76 h34 m-10 -10 l10 10 l-10 10" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="art-stroke" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${184 + i * 14} ${20 + i * 22})`}>
          <rect width="86" height="62" rx="10" className={i === 2 ? "art-card" : "art-mid"} />
          {i === 2 && (
            <>
              <rect x="12" y="14" width="56" height="6" rx="3" className="art-mid" />
              <rect x="12" y="28" width="40" height="6" rx="3" className="art-mid" />
              <circle cx="70" cy="46" r="7" className="art-hi" />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

function Video() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(62 22)">
        <rect width="196" height="106" rx="14" className="art-fg" />
        <rect x="10" y="10" width="176" height="74" rx="8" className="art-mid" />
        <path d="M86 32 l28 15 l-28 15z" className="art-card" />
        <rect x="10" y="92" width="176" height="5" rx="2.5" className="art-mid" />
        <rect x="10" y="92" width="74" height="5" rx="2.5" className="art-hi" />
      </g>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={28 + i * 0} y={34 + i * 30} width="22" height="18" rx="4" className={i === 1 ? "art-hi" : "art-card"} />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x="270" y={34 + i * 30} width="22" height="18" rx="4" className="art-card" />
      ))}
    </svg>
  );
}

function Maps() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(40 20)">
        <rect width="120" height="110" rx="14" className="art-card" />
        <path d="M0 70 C30 60 50 90 120 64 V96 a14 14 0 0 1 -14 14 H14 A14 14 0 0 1 0 96z" className="art-mid" />
        <path d="M60 18 a18 18 0 0 1 18 18 c0 14 -18 32 -18 32 s-18 -18 -18 -32 a18 18 0 0 1 18 -18z" className="art-fg" />
        <circle cx="60" cy="36" r="7" className="art-hi" />
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(182 ${26 + i * 34})`}>
          <rect width="104" height="26" rx="13" className={i === 0 ? "art-hi" : "art-card"} />
          {[0, 1, 2, 3, 4].map((k) => (
            <path key={k} transform={`translate(${12 + k * 15} 13)`} d="M0 -6 l1.8 3.8 4.2 .5 -3.1 2.9 .8 4.1 -3.7 -2 -3.7 2 .8 -4.1 -3.1 -2.9 4.2 -.5z" className={k < 5 - i * 2 ? "art-fg" : "art-mid"} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function Menu() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(70 12) rotate(-3 60 63)">
        <rect width="120" height="126" rx="12" className="art-card" />
        <rect x="34" y="12" width="52" height="9" rx="4.5" className="art-fg" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(14 ${36 + i * 22})`}>
            <rect width={[58, 46, 64, 50][i]} height="7" rx="3.5" className="art-mid" />
            <rect x="74" width="18" height="7" rx="3.5" className={i === 1 ? "art-hi" : "art-mid"} />
          </g>
        ))}
      </g>
      <g transform="translate(232 76)">
        <circle r="36" className="art-hi" />
        <circle r="26" className="art-card" />
        <path d="M-14 4 h28 a14 14 0 0 1 -28 0z" className="art-fg" />
        <path d="M-6 -4 c0 -6 6 -6 6 -12 M4 -4 c0 -6 6 -6 6 -12" fill="none" strokeWidth="3" strokeLinecap="round" className="art-stroke-fg" />
      </g>
    </svg>
  );
}

function Review() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(36 22)">
        <rect width="150" height="58" rx="16" className="art-card" />
        {[0, 1, 2, 3, 4].map((k) => (
          <path key={k} transform={`translate(${20 + k * 18} 20)`} d="M0 -7 l2.1 4.4 4.9 .6 -3.6 3.4 .9 4.8 -4.3 -2.3 -4.3 2.3 .9 -4.8 -3.6 -3.4 4.9 -.6z" className={k < 2 ? "art-fg" : "art-mid"} />
        ))}
        <rect x="14" y="36" width="108" height="8" rx="4" className="art-mid" />
      </g>
      <g transform="translate(124 74)">
        <rect width="160" height="54" rx="16" className="art-fg" />
        <rect x="16" y="16" width="112" height="8" rx="4" className="art-hi" />
        <rect x="16" y="31" width="80" height="8" rx="4" className="art-mid" />
        <path d="M136 54 l10 12 v-12z" className="art-fg" />
      </g>
    </svg>
  );
}

function Inbox() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(108 10)">
        <rect width="104" height="132" rx="16" className="art-fg" />
        <rect x="7" y="9" width="90" height="114" rx="11" className="art-card" />
        <rect x="16" y="24" width="50" height="16" rx="8" className="art-mid" />
        <rect x="38" y="48" width="50" height="16" rx="8" className="art-hi" />
        <rect x="16" y="72" width="60" height="16" rx="8" className="art-mid" />
        <rect x="46" y="96" width="42" height="16" rx="8" className="art-hi" />
      </g>
      <g transform="translate(250 50)">
        <circle r="22" className="art-card" />
        <path d="M-9 0 l6 6 12 -12" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="art-stroke-fg" />
      </g>
      <circle cx="66" cy="96" r="14" className="art-mid" />
    </svg>
  );
}

function Hashtag() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(58 22) rotate(-8 50 52)">
        <rect width="104" height="104" rx="24" className="art-fg" />
        <path d="M38 24 l-8 58 M66 24 l-8 58 M24 42 h58 M20 66 h58" fill="none" strokeWidth="9" strokeLinecap="round" className="art-stroke-hi" />
      </g>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={186} y={30 + i * 32} width={[92, 70, 82][i]} height="22" rx="11" className={i === 1 ? "art-card" : "art-mid"} />
      ))}
      <g transform="translate(268 120)">
        <circle r="16" className="art-card" />
        <path d="M0 -8 V0 l6 4" fill="none" strokeWidth="3.5" strokeLinecap="round" className="art-stroke-fg" />
      </g>
    </svg>
  );
}

function Compare() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      {[0, 1, 2].map((g) => (
        <g key={g} transform={`translate(${58 + g * 74} 20)`}>
          <rect width="58" height="110" rx="12" className="art-card" />
          {[0, 1, 2].map((b) => (
            <rect key={b} x={8 + b * 15} y={96 - [[50, 70, 40], [30, 82, 58], [64, 44, 76]][g][b]} width="11" height={[[50, 70, 40], [30, 82, 58], [64, 44, 76]][g][b]} rx="3" className={b === 1 ? "art-hi" : "art-mid"} />
          ))}
        </g>
      ))}
      <path d="M40 140h240" strokeWidth="4" strokeLinecap="round" className="art-stroke-fg" fill="none" />
    </svg>
  );
}

function Campaign() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${36 + i * 92} 40)`}>
          <circle cx="30" cy="34" r="30" className={i === 1 ? "art-hi" : "art-card"} />
          <text x="30" y="42" textAnchor="middle" className="art-live" style={{ fontSize: 22 }}>{i + 1}</text>
          {i < 2 && <path d="M66 34h22m-6-6 6 6-6 6" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="art-stroke-fg" />}
        </g>
      ))}
      <rect x="44" y="112" width="232" height="14" rx="7" className="art-mid" />
      <rect x="44" y="112" width="150" height="14" rx="7" className="art-card" />
    </svg>
  );
}

function Yelp() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(48 18)">
        <rect width="150" height="114" rx="14" className="art-card" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(14 ${16 + i * 32})`}>
            {[0, 1, 2, 3, 4].map((k) => <rect key={k} x={k * 15} width="12" height="12" rx="3" className={k < 5 - i * 2 ? "art-hi" : "art-mid"} />)}
            <rect x="84" y="2" width="44" height="8" rx="4" className="art-mid" />
          </g>
        ))}
      </g>
      <g transform="translate(214 30)">
        <circle cx="34" cy="34" r="34" className="art-fg" />
        <text x="34" y="44" textAnchor="middle" className="art-label" style={{ fontSize: 28 }}>★</text>
      </g>
    </svg>
  );
}

function Instagram() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(70 14)">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={(i % 3) * 42} y={Math.floor(i / 3) * 42} width="38" height="38" rx="8" className={i === 1 || i === 5 ? "art-hi" : "art-card"} />
        ))}
        <rect x="0" y="88" width="122" height="34" rx="10" className="art-card" />
        <circle cx="18" cy="105" r="8" className="art-mid" />
        <rect x="34" y="99" width="70" height="7" rx="3.5" className="art-mid" />
      </g>
      <g transform="translate(212 34)">
        <rect width="62" height="62" rx="18" className="art-fg" />
        <circle cx="31" cy="31" r="13" fill="none" stroke="var(--art-card)" strokeWidth="5" />
        <circle cx="47" cy="15" r="4" className="art-card" />
      </g>
    </svg>
  );
}

// ---- the newer tools: each one its own picture ----

/** Cắt Reels: a long film strip, scissors, and the short vertical clips cut from it. */
function ReelCut() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(26 50)">
        <rect width="150" height="50" rx="8" className="art-card" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={8 + i * 20} y="6" width="12" height="6" rx="2" className="art-mid" />)}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={`b${i}`} x={8 + i * 20} y="38" width="12" height="6" rx="2" className="art-mid" />)}
        <rect x="8" y="16" width="134" height="18" rx="4" className="art-mid" />
        <path d="M96 4 v42" strokeWidth="3" strokeDasharray="5 4" className="art-stroke" />
      </g>
      <g transform="translate(150 22) rotate(-20)">
        <circle cx="8" cy="8" r="8" fill="none" strokeWidth="4" className="art-stroke" />
        <circle cx="8" cy="34" r="8" fill="none" strokeWidth="4" className="art-stroke" />
        <path d="M14 13 l30 14 M14 29 l30 -14" strokeWidth="4" strokeLinecap="round" className="art-stroke" />
      </g>
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${212 + i * 46} ${24 + i * 8}) rotate(${i ? 6 : -4} 20 50)`}>
          <rect width="40" height="96" rx="8" className={i ? "art-hi" : "art-card"} />
          <path d="M14 40 l14 8 -14 8z" className="art-fg" />
        </g>
      ))}
    </svg>
  );
}

/** Lồng tiếng: a video with a subtitle bar, the speech turning from VI into EN. */
function Dub() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(40 22)">
        <rect width="150" height="106" rx="14" className="art-card" />
        <rect x="10" y="10" width="130" height="64" rx="9" className="art-mid" />
        <path d="M66 30 l18 12 -18 12z" className="art-fg" />
        <rect x="22" y="82" width="106" height="12" rx="6" className="art-hi" />
      </g>
      <g transform="translate(206 26)">
        <rect width="62" height="34" rx="12" className="art-card" />
        <text x="31" y="23" textAnchor="middle" className="art-label" style={{ fill: "var(--art-fg)" }}>VI</text>
      </g>
      <path d="M236 66 v16 m-8 -8 l8 8 l8 -8" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="art-stroke" />
      <g transform="translate(206 90)">
        <rect width="62" height="34" rx="12" className="art-fg" />
        <text x="31" y="23" textAnchor="middle" className="art-label" style={{ fill: "var(--art-card)" }}>EN</text>
      </g>
    </svg>
  );
}

/** Đoán món: a bowl under a big question mark, three answers to pick from. */
function DishRiddle() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(48 30)">
        <path d="M0 50 h120 a60 44 0 0 1 -120 0z" className="art-card" />
        <ellipse cx="60" cy="50" rx="60" ry="10" className="art-mid" />
        <path d="M30 34 q8 -16 0 -30 M58 30 q8 -16 0 -30 M86 34 q8 -16 0 -30" fill="none" strokeWidth="4" strokeLinecap="round" className="art-stroke" />
      </g>
      <text x="196" y="74" textAnchor="middle" className="art-big">?</text>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(222 ${26 + i * 34})`}>
          <rect width="68" height="24" rx="12" className={i === 1 ? "art-hi" : "art-card"} />
          <circle cx="12" cy="12" r="5" className={i === 1 ? "art-fg" : "art-mid"} />
          <rect x="22" y="9" width={[34, 28, 38][i]} height="6" rx="3" className="art-mid" />
        </g>
      ))}
    </svg>
  );
}

/** Câu chuyện công thức: an open recipe book with a heart and a quote. */
function RecipeStory() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(56 26)">
        <path d="M0 8 q50 -16 100 4 v96 q-50 -20 -100 -4z" className="art-card" />
        <path d="M100 12 q50 -20 100 -4 v96 q-50 -16 -100 4z" className="art-mid" />
        {[24, 38, 52, 66].map((y, i) => <rect key={y} x="16" y={y} width={[66, 58, 70, 44][i]} height="6" rx="3" className="art-mid" />)}
        <text x="150" y="62" textAnchor="middle" className="art-big" style={{ fontSize: 46 }}>“</text>
        <path d="M150 88 c-10 -10 -20 -2 -10 8 l10 9 10 -9 c10 -10 0 -18 -10 -8z" className="art-hi" />
      </g>
    </svg>
  );
}

/** Thời tiết thành bài đăng: sun and a rain cloud beside a post card. */
function WeatherPost() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(40 24)">
        <circle cx="40" cy="36" r="22" className="art-hi" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect key={a} x="38" y="2" width="4" height="9" rx="2" className="art-hi" transform={`rotate(${a} 40 36)`} />
        ))}
        <path d="M30 86 a18 18 0 0 1 16 -26 a24 24 0 0 1 44 6 a14 14 0 0 1 4 28 h-58 a14 14 0 0 1 -6 -8z" className="art-card" />
        {[0, 1, 2].map((i) => <path key={i} d={`M${42 + i * 18} 102 l-5 12`} strokeWidth="4" strokeLinecap="round" className="art-stroke" />)}
      </g>
      <g transform="translate(176 24)">
        <rect width="110" height="102" rx="12" className="art-card" />
        <rect x="12" y="12" width="86" height="40" rx="8" className="art-mid" />
        <rect x="12" y="62" width="70" height="7" rx="3.5" className="art-mid" />
        <rect x="12" y="76" width="52" height="7" rx="3.5" className="art-mid" />
        <text x="96" y="88" textAnchor="end" className="art-label" style={{ fill: "var(--art-fg)" }}>31°</text>
      </g>
    </svg>
  );
}

/** Google Business: a map pin card with a post and a button. */
function GbpPost() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(46 22)">
        <rect width="110" height="106" rx="12" className="art-card" />
        <path d="M55 20 a20 20 0 0 1 20 20 c0 15 -20 34 -20 34 s-20 -19 -20 -34 a20 20 0 0 1 20 -20z" className="art-hi" />
        <circle cx="55" cy="40" r="7" className="art-card" />
        <rect x="16" y="84" width="78" height="8" rx="4" className="art-mid" />
      </g>
      <g transform="translate(170 30)">
        <rect width="112" height="90" rx="12" className="art-card" />
        <rect x="12" y="12" width="88" height="8" rx="4" className="art-mid" />
        <rect x="12" y="28" width="70" height="8" rx="4" className="art-mid" />
        <rect x="12" y="44" width="80" height="8" rx="4" className="art-mid" />
        <rect x="12" y="62" width="52" height="18" rx="9" className="art-hi" />
      </g>
    </svg>
  );
}

/** Tin Zalo: a phone with chat bubbles and a button. */
function ZaloArt() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(112 10)">
        <rect width="96" height="132" rx="16" className="art-card" />
        <rect x="12" y="18" width="58" height="22" rx="11" className="art-mid" />
        <rect x="26" y="48" width="58" height="30" rx="12" className="art-hi" />
        <rect x="12" y="86" width="46" height="18" rx="9" className="art-mid" />
        <rect x="24" y="112" width="48" height="12" rx="6" className="art-hi" />
      </g>
      <circle cx="74" cy="52" r="16" className="art-hi" />
      <circle cx="248" cy="96" r="12" className="art-mid" />
    </svg>
  );
}

/** Gợi ý khuyến mãi: a coupon with a percent sign and profit bars. */
function PromoArt() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(36 34)">
        <rect width="136" height="82" rx="12" className="art-card" />
        <rect x="100" y="0" width="36" height="82" rx="12" className="art-hi" />
        <circle cx="34" cy="30" r="9" className="art-hi" />
        <circle cx="66" cy="56" r="9" className="art-hi" />
        <path d="M70 22 L30 64" fill="none" strokeWidth="7" strokeLinecap="round" className="art-stroke" />
      </g>
      <g transform="translate(196 30)">
        <rect x="0" y="50" width="20" height="40" rx="5" className="art-mid" />
        <rect x="30" y="30" width="20" height="60" rx="5" className="art-mid" />
        <rect x="60" y="8" width="20" height="82" rx="5" className="art-hi" />
      </g>
    </svg>
  );
}

/** Gói chạy liền: three tool cards joined by arrows. */
function CombosArt() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${28 + i * 98} ${i === 1 ? 30 : 44})`}>
          <rect width="72" height="72" rx="14" className={i === 1 ? "art-hi" : "art-card"} />
          <rect x="14" y="16" width="44" height="8" rx="4" className="art-mid" />
          <rect x="14" y="32" width="32" height="8" rx="4" className="art-mid" />
          <circle cx="50" cy="54" r="8" className={i === 1 ? "art-card" : "art-hi"} />
        </g>
      ))}
      <path d="M104 80 h18 m-6 -6 l6 6 -6 6 M202 80 h18 m-6 -6 l6 6 -6 6" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="art-stroke" />
    </svg>
  );
}

/** Mã QR: a QR code with a logo square and a phone scanning it. */
function MenuBoardArt() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(58 14) rotate(-4 50 62)">
        <rect width="100" height="124" rx="8" className="art-card" />
        <rect x="26" y="12" width="48" height="8" rx="4" className="art-fg" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(12 ${34 + i * 17})`}>
            <rect width={[44, 36, 50, 40, 46][i]} height="6" rx="3" className="art-mid" />
            <rect x="62" width="14" height="6" rx="3" className={i === 0 ? "art-hi" : "art-mid"} />
          </g>
        ))}
      </g>
      <g transform="translate(184 18)">
        <rect width="64" height="116" rx="12" className="art-fg" />
        <rect x="5" y="9" width="54" height="98" rx="7" className="art-card" />
        <rect x="14" y="20" width="36" height="6" rx="3" className="art-fg" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x="12" y={36 + i * 15} width={[40, 32, 38, 28][i]} height="5" rx="2.5" className="art-mid" />)}
      </g>
      <g transform="translate(244 96)">
        <rect width="40" height="40" rx="7" className="art-hi" />
        <path d="M9 9h8v8H9zM23 9h8v8h-8zM9 23h8v8H9zM24 24h3v3h-3zM29 29h3v3h-3z" className="art-fg" />
      </g>
    </svg>
  );
}

function EventBannerArt() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(62 16)">
        <rect width="196" height="118" rx="14" className="art-card" />
        <circle cx="140" cy="60" r="38" className="art-mid" />
        <circle cx="140" cy="60" r="28" className="art-hi" />
        <rect x="18" y="38" width="76" height="12" rx="6" className="art-fg" />
        <rect x="18" y="58" width="56" height="7" rx="3.5" className="art-mid" />
        <rect x="18" y="78" width="48" height="16" rx="8" className="art-hi" />
      </g>
      <g className="art-fg">
        <path d="M86 6v12" stroke="currentColor" strokeWidth="2" className="art-stroke" fill="none" />
        <ellipse cx="86" cy="28" rx="10" ry="12" className="art-hi" />
        <path d="M232 4v14" strokeWidth="2" className="art-stroke" fill="none" />
        <ellipse cx="232" cy="28" rx="9" ry="11" className="art-hi" />
      </g>
    </svg>
  );
}

function QrArt() {
  const cells = [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2],[4,0],[5,1],[4,2],[6,0],[6,2],[0,4],[1,5],[2,4],[0,6],[2,6],[4,4],[6,4],[5,5],[4,6],[6,6]];
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(70 18)">
        <rect width="114" height="114" rx="12" className="art-card" />
        {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={12 + x * 13} y={12 + y * 13} width="11" height="11" rx="2" className="art-mid" />)}
        <rect x="44" y="44" width="26" height="26" rx="6" className="art-hi" />
      </g>
      <g transform="translate(206 30)">
        <rect width="54" height="96" rx="10" className="art-card" />
        <rect x="8" y="12" width="38" height="56" rx="4" className="art-hi" />
        <path d="M14 30 v-8 h8 M40 30 v-8 h-8 M14 50 v8 h8 M40 50 v8 h-8" fill="none" strokeWidth="3" strokeLinecap="round" className="art-stroke" />
      </g>
    </svg>
  );
}

/** Chỉnh ảnh: a dull photo turning bright, with a slider between them. */
function PhotoFix() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(60 20)">
        <rect width="200" height="110" rx="14" className="art-card" />
        <rect x="10" y="10" width="90" height="90" rx="9" className="art-mid" opacity=".55" />
        <rect x="100" y="10" width="90" height="90" rx="9" className="art-hi" />
        <circle cx="55" cy="58" r="26" className="art-card" opacity=".6" />
        <circle cx="145" cy="58" r="26" className="art-card" />
        <circle cx="145" cy="58" r="14" className="art-mid" />
        <rect x="97" y="4" width="6" height="102" rx="3" className="art-card" />
        <circle cx="100" cy="55" r="11" className="art-card" />
        <path d="M95 55 l-3 0 M105 55 l3 0" strokeWidth="3" strokeLinecap="round" className="art-stroke" />
      </g>
    </svg>
  );
}

/** Chấm điểm bài: a post with a score badge and ticks on its lines. */
function PostScore() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(52 20)">
        <rect width="148" height="110" rx="12" className="art-card" />
        {[18, 40, 62, 84].map((y, i) => (
          <g key={y}>
            <path d={`M14 ${y + 4} l5 5 9 -10`} fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className={i === 2 ? "art-stroke-hi" : "art-stroke"} />
            <rect x="36" y={y} width={[96, 80, 88, 60][i]} height="8" rx="4" className="art-mid" />
          </g>
        ))}
      </g>
      <g transform="translate(214 36)">
        <circle cx="38" cy="38" r="38" className="art-fg" />
        <circle cx="38" cy="38" r="30" fill="none" strokeWidth="6" strokeDasharray="150 190" transform="rotate(-90 38 38)" style={{ stroke: "var(--art-hi)" }} />
        <text x="38" y="45" textAnchor="middle" className="art-label" style={{ fill: "var(--art-card)", fontSize: 20 }}>8/10</text>
      </g>
    </svg>
  );
}

/** Tóm tắt sau livestream: the finished live (dimmed), an arrow, and the clips and recap made from it. */
function LiveRecap() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g transform="translate(30 28)" opacity=".75">
        <rect width="112" height="84" rx="12" className="art-card" />
        <rect x="8" y="8" width="96" height="58" rx="8" className="art-mid" />
        <rect x="14" y="14" width="38" height="16" rx="8" className="art-hi" />
        <text x="33" y="26" textAnchor="middle" className="art-live">LIVE</text>
        <rect x="8" y="72" width="96" height="5" rx="2.5" className="art-hi" />
      </g>
      <path d="M152 70 h26 m-9 -9 l9 9 -9 9" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="art-stroke" />
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${190 + i * 38} ${22 + i * 6})`}>
          <rect width="32" height="62" rx="7" className={i ? "art-hi" : "art-card"} />
          <path d="M11 24 l12 7 -12 7z" className="art-fg" />
        </g>
      ))}
      <g transform="translate(190 96)">
        <rect width="96" height="30" rx="10" className="art-card" />
        <path d="M12 15 l5 5 9 -10" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="art-stroke" />
        <rect x="34" y="12" width="48" height="6" rx="3" className="art-mid" />
      </g>
    </svg>
  );
}

const ART = { "zalo-message": ZaloArt, "promo-plan": PromoArt, combos: CombosArt, qr: QrArt, "menu-board": MenuBoardArt, "event-banner": EventBannerArt, "gbp-post": GbpPost, "photo-fix": PhotoFix, "reel-cut": ReelCut, dub: Dub, "dish-riddle": DishRiddle, "story-behind": RecipeStory, "weather-post": WeatherPost, "post-score": PostScore, "live-recap": LiveRecap, yelp: Yelp, instagram: Instagram, reels: Reels, threads: Threads, write: Write, clone: Clone, video: Video, library: Library, tiktok: Tiktok, fanpage: Fanpage, image: ImageArt, schedule: Schedule, livestream: Livestream, maps: Maps, menu: Menu, review: Review, inbox: Inbox, hashtag: Hashtag, compare: Compare, campaign: Campaign };

export default function SkillArt({ id }) {
  const Art = ART[id];
  return <div className="skill-art">{Art && <Art />}</div>;
}
