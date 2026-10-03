"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAnalysis } from "@/components/analysis/AnalysisProvider";

/** Throws away this game's analysis and runs the engine, tagging and Arthur's review again. */
export function ReanalyzeButton({ gameId }: { gameId: string }) {
  const { enqueue } = useAnalysis();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reanalyze" }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't reset this game.");
      enqueue([gameId], { front: true, force: true });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn btn-secondary" onClick={() => void run()} disabled={busy}>
        {busy ? "Resetting…" : "Reanalyze"}
      </button>
      {error && (
        <span className="text-sm text-[color:var(--blunder-bg)]" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
