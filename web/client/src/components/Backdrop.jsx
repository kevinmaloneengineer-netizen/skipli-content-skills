// Fixed background behind every page: a dot grid and soft colour blobs, each
// moving at its own depth (--d) with scroll and pointer (see useParallax).
const BLOBS = [
  { cls: "blob-coral", d: 0.35 },
  { cls: "blob-lime", d: 0.6 },
  { cls: "blob-green", d: 0.25 },
  { cls: "blob-mustard", d: 0.5 },
  { cls: "blob-rose", d: 0.18 },
];

export default function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="bg-dots" />
      {BLOBS.map((b) => (
        <div key={b.cls} className={`blob ${b.cls}`} style={{ "--d": b.d }} />
      ))}
      <div className="bg-grain" />
    </div>
  );
}
