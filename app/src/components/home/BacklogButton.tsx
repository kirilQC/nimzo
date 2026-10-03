"use client";

import { useAnalysis } from "@/components/analysis/AnalysisProvider";

/** Works through every imported-but-unanalyzed game while this tab stays open. */
export function BacklogButton() {
  const { backlog, current, queueLength, analyzeBacklog } = useAnalysis();
  if (backlog === 0 && !current) return null;
  const busy = current !== null;
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      {busy && <span>{queueLength + 1} left · keep this tab open</span>}
      {backlog > 0 && (
        <button type="button" className="btn btn-secondary min-h-[36px] px-3 text-sm" onClick={() => void analyzeBacklog()}>
          Analyze backlog ({backlog})
        </button>
      )}
    </div>
  );
}
