"use client";

import { useEffect, useRef, useState } from "react";

const blobs = new Map<string, string>(); // text -> object URL, for this page session

/** Tap to hear the coach read `text`. Audio is generated once and cached server-side. */
export function SpeakButton({ text, label = "Listen" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  async function toggle() {
    if (state === "playing") {
      audioRef.current?.pause();
      setState("idle");
      return;
    }
    setState("loading");
    setError(null);
    try {
      let url = blobs.get(text);
      if (!url) {
        const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Voice unavailable");
        url = URL.createObjectURL(await res.blob());
        blobs.set(text, url);
      }
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => setState("idle");
      await a.play();
      setState("playing");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={state === "loading"}
        aria-label={state === "playing" ? "Stop" : label}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[8px] border border-line bg-card px-2.5 text-[0.8125rem] font-semibold text-walnut hover:bg-chip disabled:opacity-60"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {state === "playing" ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
        </svg>
        {state === "loading" ? "Loading…" : state === "playing" ? "Stop" : label}
      </button>
      {error && <span className="text-xs text-muted">{error}</span>}
    </span>
  );
}
