/* eslint-disable @next/next/no-img-element -- decorative, fixed size, already optimized webp */

const KINDS = ["wN", "bB", "wR", "bQ", "wK", "bN", "wB", "bR", "wQ", "bP", "wP", "bK"];

// Fixed pseudo random layout so server and client render the same thing.
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const PIECES = Array.from({ length: 22 }, (_, i) => {
  const depth = rnd(); // 0 far, 1 near
  const size = Math.round(70 + depth * 230);
  const duration = Math.round(150 - depth * 80); // near pieces move a little faster
  return {
    kind: KINDS[i % KINDS.length]!,
    top: Math.round(rnd() * 96 - 8),
    size,
    opacity: (0.03 + depth * 0.03).toFixed(3),
    blur: depth < 0.3 ? 1.5 : 0,
    duration,
    delay: -Math.round(rnd() * duration),
    bob: Math.round(9 + rnd() * 9),
    bobDelay: -Math.round(rnd() * 10),
    reverse: rnd() < 0.4,
  };
});

/** Faint chess pieces drifting across the whole site, very slowly, behind everything. */
export function GhostPieces() {
  return (
    <div className="ghosts pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {PIECES.map((p, i) => (
        <img
          key={i}
          src={`/board/wood/${p.kind}.webp`}
          alt=""
          width={p.size}
          height={p.size}
          className="ghost"
          style={{
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            opacity: Number(p.opacity),
            filter: `grayscale(1) brightness(${p.kind.startsWith("b") ? 2.2 : 1.3})${p.blur ? ` blur(${p.blur}px)` : ""}`,
            animationDuration: `${p.duration}s, ${p.bob}s`,
            animationDelay: `${p.delay}s, ${p.bobDelay}s`,
            animationDirection: `${p.reverse ? "reverse" : "normal"}, alternate`,
          }}
        />
      ))}
    </div>
  );
}
