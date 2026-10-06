"use client";

import { Fragment } from "react";

/**
 * Arthur's text with every move reference clickable: "move 5", "moves 12 and 13",
 * "moves 18 to 20" (each number becomes a link). Move numbers mean the player's
 * own moves, which is how Arthur writes them; clicking jumps the board there.
 */
const REF = /\b(moves?)\s+(\d{1,3})((?:\s*(?:,|and|to|&|or)\s*\d{1,3})*)/gi;

export function MoveText({ text, onJump, animate = false }: { text: string; onJump?: (moveNumber: number) => void; animate?: boolean }) {
  // `animate`: words arrive one by one, as if Arthur is saying them.
  let word = 0;
  const words = (chunk: string, key: string | number): React.ReactNode =>
    animate
      ? chunk.split(/(s+)/).map((w, i) =>
          /^s*$/.test(w) ? w : (
            <span key={`${key}-${i}`} className="word-in" style={{ animationDelay: `${Math.min(word++, 40) * 45}ms` }}>
              {w}
            </span>
          ),
        )
      : chunk;
  if (!onJump) return <>{words(text, "t")}</>;
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(REF)) {
    const start = m.index!;
    out.push(<Fragment key={`p${start}`}>{words(text.slice(last, start), `p${start}`)}</Fragment>);
    // "Move 5" / "moves 12 and 13": keep the words, link each number.
    const chunk = m[0];
    const parts = chunk.split(/(\d{1,3})/);
    out.push(
      <Fragment key={start}>
        {parts.map((p, i) =>
          /^\d+$/.test(p) ? (
            <button
              key={i}
              type="button"
              onClick={() => onJump(Number(p))}
              className={`font-semibold text-walnut underline decoration-dotted underline-offset-2 hover:decoration-solid ${animate ? "word-in" : ""}`}
              style={animate ? { animationDelay: `${Math.min(word++, 40) * 45}ms` } : undefined}
              title={`Show move ${p} on the board`}
            >
              {p}
            </button>
          ) : (
            <Fragment key={i}>{words(p, `${start}-${i}`)}</Fragment>
          ),
        )}
      </Fragment>,
    );
    last = start + chunk.length;
  }
  out.push(<Fragment key="end">{words(text.slice(last), "end")}</Fragment>);
  return <>{out}</>;
}
