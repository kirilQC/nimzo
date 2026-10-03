"use client";

import { useEffect, useRef, useState } from "react";
import { useVoice } from "./VoiceProvider";
import { COACH } from "@/lib/coach/persona";

export type ArthurLine = { who: "arthur" | "you"; text: string };

/**
 * Arthur's corner of the review page: his portrait, what he's saying now, and
 * the back-and-forth. He opens with the game summary, explains each flagged
 * move as you step to it, and answers questions about the game out loud.
 */
export function ArthurPanel({
  gameId,
  opening,
  focus,
  ply,
  placeholder,
}: {
  gameId: string | null;
  opening: string | null; // first thing Arthur says (game summary)
  focus: string | null; // explanation of the flagged move you're looking at
  ply: number;
  placeholder: string;
}) {
  const { speak, speaking, current, muted } = useVoice();
  const [lines, setLines] = useState<ArthurLine[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const said = useRef(new Set<string>());
  const threadRef = useRef<HTMLOListElement>(null);

  const say = (text: string, interrupt: boolean) => {
    if (!said.current.has(text)) {
      said.current.add(text);
      setLines((l) => [...l, { who: "arthur", text }]);
    }
    speak(text, { interrupt });
  };

  // Opening: the game summary, once.
  useEffect(() => {
    // Interrupt whatever Arthur was saying on the previous page.
    if (opening) say(opening, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening]);

  // Stepping onto a flagged move: Arthur explains it.
  useEffect(() => {
    if (focus) say(focus, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useEffect(() => {
    threadRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [lines]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || !gameId) return;
    setQuestion("");
    setError(null);
    setLines((l) => [...l, { who: "you", text: q }]);
    setAsking(true);
    try {
      const res = await fetch(`/api/games/${gameId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, ply }),
      });
      const json = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
      if (!res.ok || !json.answer) throw new Error(json.error ?? "Arthur couldn't answer that just now.");
      say(json.answer, true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAsking(false);
    }
  }

  const mine = new Set(lines.filter((l) => l.who === "arthur").map((l) => l.text));
  const sayingHere = !!current && mine.has(current);

  return (
    <section className="card p-0" aria-labelledby="arthur-h">
      <div className="flex gap-4 p-4">
        <div className={`relative w-[150px] shrink-0 self-start overflow-hidden rounded-[10px] border-2 border-brass ${speaking && sayingHere ? "arthur-speaking" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/arthur-panel.webp" alt={`${COACH.name}, your coach`} width={150} height={188} className="block h-[188px] w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 id="arthur-h" className="text-xl">
              {COACH.name}
            </h2>
            {speaking && sayingHere ? (
              <span className="arthur-bars inline-flex items-end" aria-label="Arthur is speaking">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </span>
            ) : asking ? (
              <span className="text-sm text-muted">thinking…</span>
            ) : muted ? (
              <span className="text-sm text-muted">muted</span>
            ) : null}
          </div>
          <p className="serif mt-2 text-[1.0625rem] leading-relaxed text-ink" aria-live="polite">
            {(sayingHere ? current : null) ?? lines.filter((l) => l.who === "arthur").at(-1)?.text ?? placeholder}
          </p>
        </div>
      </div>

      {lines.length > 1 && (
        <ol ref={threadRef} className="max-h-[220px] space-y-2 overflow-y-auto border-t border-line-soft px-4 py-3" aria-label="Conversation with Arthur">
          {lines.slice(0, -1).map((l, i) => (
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
          onChange={(e) => setQuestion(e.target.value)}
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
