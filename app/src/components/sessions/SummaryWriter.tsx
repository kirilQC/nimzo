"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Writes the session summary on first visit (or on demand) and refreshes the page. */
export function SummaryWriter({ sessionId, hasSummary, hasGames }: { sessionId: string; hasSummary: boolean; hasGames: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "writing" | "error">("idle");
  const started = useRef(false);

  const write = async () => {
    setState("writing");
    const res = await fetch(`/api/sessions/${sessionId}/summary`, { method: "POST" });
    if (!res.ok) {
      setState("error");
      return;
    }
    setState("idle");
    router.refresh();
  };

  useEffect(() => {
    if (started.current || hasSummary || !hasGames) return;
    started.current = true;
    void write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSummary, hasGames]);

  if (!hasGames) return null;
  if (state === "writing") return <p className="text-sm text-muted" role="status">The coach is writing your summary…</p>;
  return (
    <div className="flex items-center gap-3 text-sm">
      {state === "error" && <span className="text-[color:var(--blunder-bg)]">Couldn&apos;t write the summary.</span>}
      <button type="button" className="btn btn-ghost min-h-[36px] px-2 text-sm" onClick={() => void write()}>
        {hasSummary ? "Rewrite summary" : "Write summary"}
      </button>
    </div>
  );
}
