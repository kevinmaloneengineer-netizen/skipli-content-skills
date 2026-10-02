// Floating line icons behind a category scene. Each sits at its own depth (--d):
// near ones are big, sharp and fast; far ones small, blurred and slow.

const ICONS = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  heart: <path d="M12 20s-7-4.4-8.8-8.6C1.9 8.2 3.9 5 7.2 5c2 0 3.4 1.1 4.8 2.8C13.4 6.1 14.8 5 16.8 5c3.3 0 5.3 3.2 4 6.4C19 15.6 12 20 12 20z" />,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  play: <><rect x="3" y="4" width="18" height="16" rx="4" /><path d="M10 9l5 3-5 3z" /></>,
  trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  comment: <path d="M4 5h16v11H9l-5 4z" />,
  pen: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,
  spark: <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="15.5" cy="9.5" r="1.8" /><path d="M3 17l5-5 4 4 3-3 6 6" /></>,
  quote: <path d="M5 11h4v6H4v-5c0-3 1.5-5 4-6M15 11h4v6h-5v-5c0-3 1.5-5 4-6" />,
  lines: <path d="M4 6h16M4 11h16M4 16h10" />,
  wand: <><path d="M4 20L16 8" /><path d="M15 3v3M18 5h3M19 2l-1 1M20 9l-1-1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
};

// Hand-placed slots (x %, y %, size px, depth, spin): around the heading (top-left) and card row, not on them.
const SLOTS = [
  [62, 13, 64, 1.6, 40],
  [90, 9, 50, 1.1, -30],
  [67, 40, 80, 2, 25],
  [95, 55, 40, 0.5, -60],
  [1.5, 50, 46, 0.4, 80],
  [52, 3, 34, 0.7, -45],
  [28, 92, 70, 1.8, 30],
  [70, 90, 30, 0.3, -90],
];

export default function CategoryDeco({ icons }) {
  return (
    <div className="cat-deco" aria-hidden="true">
      {icons.map((name, i) => {
        const [x, y, size, d, spin] = SLOTS[i % SLOTS.length];
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className={d < 0.8 ? "deco far" : "deco"}
            style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, "--d": d, "--spin": spin }}
          >
            {ICONS[name]}
          </svg>
        );
      })}
    </div>
  );
}
