"use client";

import { Fragment } from "react";

/**
 * Arthur's text with every move reference clickable: "move 5", "moves 12 and 13",
 * "moves 18 to 20" (each number becomes a link). Move numbers mean the player's
 * own moves, which is how Arthur writes them; clicking jumps the board there.
 */
const REF = /\b(moves?)\s+(\d{1,3})((?:\s*(?:,|and|to|&|or)\s*\d{1,3})*)/gi;

export function MoveText({ text, onJump }: { text: string; onJump?: (moveNumber: number) => void }) {
  if (!onJump) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(REF)) {
    const start = m.index!;
    out.push(text.slice(last, start));
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
              className="font-semibold text-walnut underline decoration-dotted underline-offset-2 hover:decoration-solid"
              title={`Show move ${p} on the board`}
            >
              {p}
            </button>
          ) : (
            <Fragment key={i}>{p}</Fragment>
          ),
        )}
      </Fragment>,
    );
    last = start + chunk.length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}
