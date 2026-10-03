"use client";

import { useEffect, useRef, useState } from "react";
import { COACH } from "@/lib/coach/persona";
import { EXPRESSIONS, expressionSrc, type Expression } from "@/lib/coach/expressions";

export type ArthurSay = { text: string; expression: Expression };
type Line = { who: "arthur" | "you"; text: string; expression?: Expression };

const SETTLE_MS = 12_000; // back to a warm smile after reacting
const SLEEPY_MS = 4 * 60_000; // nods off if you've been away a while

/**
 * Arthur's corner of the review page: his portrait (whose expression follows
 * the moment), what he's saying now, and the back-and-forth. He opens with the
 * game summary, explains each flagged move as you step to it, and answers
 * questions about the game.
 */
export function ArthurPanel({
  gameId,
  opening,
  focus,
  ply,
  placeholder,
}: {
  gameId: string | null;
  opening: ArthurSay | null; // first thing Arthur says (game summary)
  focus: ArthurSay | null; // explanation of the flagged move you're looking at
  ply: number;
  placeholder: string;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [question, setQuestion] = useState("");
  const [typing, setTyping] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [face, setFace] = useState<Expression>(opening ? "cap_tip" : "warm_smile");
  const [activity, setActivity] = useState(0);
  const [current, setCurrent] = useState<string | null>(null); // the line on show
  const said = useRef(new Set<string>());
  const threadRef = useRef<HTMLOListElement>(null);

  // `log`: keep it in the conversation thread (the summary and answers). Per-move notes only show in the bubble.
  const say = (s: ArthurSay, log = true) => {
    if (log && !said.current.has(s.text)) {
      said.current.add(s.text);
      setLines((l) => [...l, { who: "arthur", text: s.text, expression: s.expression }]);
    }
    setCurrent(s.text);
    setFace(s.expression);
    setActivity((n) => n + 1);
  };

  // Preload every expression so switching never flickers.
  useEffect(() => {
    for (const e of Object.keys(EXPRESSIONS)) {
      const img = new Image();
      img.src = expressionSrc(e as Expression);
    }
  }, []);

  // Arthur reacting to what's on screen (new line + face) is a side effect of navigation, so it lives in effects.
  /* eslint-disable react-hooks/set-state-in-effect */
  // Opening: the game summary, once.
  useEffect(() => {
    if (opening) say(opening);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening?.text]);

  // Stepping onto a move: Arthur reacts and says his one line about it.
  useEffect(() => {
    if (focus) say(focus, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.text]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Settle back to a smile after a while; nod off if nothing happens for a long while.
  useEffect(() => {
    if (asking || typing) return;
    const settle = setTimeout(() => setFace("warm_smile"), SETTLE_MS);
    const sleepy = setTimeout(() => setFace("sleepy"), SLEEPY_MS);
    return () => {
      clearTimeout(settle);
      clearTimeout(sleepy);
    };
  }, [asking, typing, activity]);

  useEffect(() => {
    const el = threadRef.current; // scroll the conversation box only, never the page
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || !gameId) return;
    setQuestion("");
    setTyping(false);
    setError(null);
    setLines((l) => [...l, { who: "you", text: q }]);
    setAsking(true);
    try {
      const res = await fetch(`/api/games/${gameId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, ply }),
      });
      const json = (await res.json().catch(() => ({}))) as { answer?: string; expression?: Expression; error?: string };
      if (!res.ok || !json.answer) throw new Error(json.error ?? "Arthur couldn't answer that just now.");
      say({ text: json.answer, expression: json.expression && json.expression in EXPRESSIONS ? json.expression : "explaining" });
    } catch (err) {
      setError((err as Error).message);
      setFace("shrug");
    } finally {
      setAsking(false);
    }
  }

  const arthurLines = lines.filter((l) => l.who === "arthur");
  const bubble = current ?? arthurLines.at(-1)?.text ?? null;
  const shown: Expression = asking ? "thinking" : typing && question.trim() ? "listening" : face;

  return (
    <section className="card p-0" aria-labelledby="arthur-h">
      <div className="flex gap-4 p-4">
        <div className="relative w-[150px] shrink-0 self-start overflow-hidden rounded-[10px] border-2 border-brass">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={shown}
            src={expressionSrc(shown)}
            alt={`${COACH.name}: ${EXPRESSIONS[shown]}`}
            width={150}
            height={188}
            className="arthur-face block h-[188px] w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 id="arthur-h" className="text-xl">
              {COACH.name}
            </h2>
            {asking && <span className="text-sm text-muted">thinking…</span>}
          </div>
          <p className="serif mt-2 text-[1.0625rem] leading-relaxed text-ink" aria-live="polite">
            {bubble ?? placeholder}
          </p>
        </div>
      </div>

      {lines.some((l) => l.text !== bubble) && (
        <ol ref={threadRef} className="max-h-[220px] space-y-2 overflow-y-auto border-t border-line-soft px-4 py-3" aria-label="Conversation with Arthur">
          {/* Everything said so far except the line already in the bubble, so nothing shows twice. */}
          {lines.filter((l) => !(l.who === "arthur" && l.text === bubble)).map((l, i) => (
            <li key={i} className={`text-sm ${l.who === "you" ? "text-right" : ""}`}>
              <span className={`inline-block max-w-[90%] rounded-[8px] px-3 py-1.5 text-left ${l.who === "you" ? "bg-chip text-ink" : "bg-parchment text-body2"}`}>
                {l.text}
              </span>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={ask} className="flex gap-2 border-t border-line-soft p-4">
        <label htmlFor="ask-arthur" className="sr-only">
          Ask Arthur about this game
        </label>
        <input
          id="ask-arthur"
          className="input"
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            setTyping(true);
            setActivity((n) => n + 1);
          }}
          onBlur={() => setTyping(false)}
          placeholder={gameId ? `Ask ${COACH.name} about this game` : "Available on your own games"}
          disabled={!gameId || asking}
        />
        <button type="submit" className="btn btn-primary" disabled={!gameId || asking || !question.trim()}>
          Ask
        </button>
      </form>
      {error && (
        <p className="px-4 pb-3 text-sm text-[color:var(--blunder-bg)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
