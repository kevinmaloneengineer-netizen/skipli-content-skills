import { useEffect, useState } from "react";

const POSES = ["idle", "blink", "wave", "think", "happy"];
const src = (p) => `/assistant/${p}.webp`;

// Warm the cache so switching poses never flashes an empty frame.
if (typeof window !== "undefined") for (const p of POSES) new Image().src = src(p);

/** The assistant character. mood: idle | wave | think | happy. Blinks by itself while idle. */
export default function Mascot({ mood = "idle", size = 64, className = "" }) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (mood !== "idle") return;
    let t;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        t = setTimeout(() => {
          setBlink(false);
          loop();
        }, 160);
      }, 2600 + Math.random() * 2600);
    };
    loop();
    return () => clearTimeout(t);
  }, [mood]);

  const pose = mood === "idle" && blink ? "blink" : mood;
  return (
    <span className={`mascot mood-${mood} ${className}`} style={{ "--m": `${size}px` }} aria-hidden="true">
      <img src={src(pose)} alt="" width={size} height={size} draggable="false" />
    </span>
  );
}
