import type { ReviewSummary } from "./GameReview";
import { MoveText } from "./MoveText";

const VERDICT: Record<string, { label: string; className: string }> = {
  excellent: { label: "Excellent game", className: "bg-[color:var(--good-bg)] text-good" },
  good: { label: "Good game", className: "bg-[color:var(--good-bg)] text-good" },
  mixed: { label: "Mixed game", className: "bg-[color:var(--inacc-bg)] text-[color:var(--inacc-fg)]" },
  rough: { label: "Rough game", className: "bg-[color:var(--bad-bg)] text-[color:var(--bad-fg)]" },
};

/** Arthur's game summary in a fixed shape: story, how the advantage moved, where you fell short, what went well, the one lesson. */
export function GameSummary({ summary, onJump }: { summary: ReviewSummary; onJump?: (moveNumber: number) => void }) {
  const wentWell = Array.isArray(summary.went_well) ? summary.went_well : summary.went_well ? [summary.went_well] : [];
  const v = summary.verdict ? VERDICT[summary.verdict] : undefined;

  // Older reviews (before the structured format) only have an overview.
  if (!summary.story) {
    return (
      <section className="card p-6" aria-labelledby="summary-card-h">
        <h2 id="summary-card-h" className="text-xl">
          {summary.headline ?? "Game summary"}
        </h2>
        <p className="mt-2 text-body2">{summary.overview ?? summary.key_moment}</p>
        {summary.work_on && <p className="mt-3 font-semibold text-ink">{summary.work_on}</p>}
        <p className="mt-3 text-sm text-muted">Reanalyze this game to get the newer, fuller summary.</p>
      </section>
    );
  }

  return (
    <section className="card p-6" aria-labelledby="summary-card-h">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id="summary-card-h" className="text-xl">
          {summary.headline}
        </h2>
        {v && <span className={`chip ${v.className}`}>{v.label}</span>}
      </div>
      <div className="mt-3 space-y-3 text-[0.9875rem] leading-relaxed text-body2">
        {summary.story.map((p, i) => (
          <p key={i}>
            <MoveText text={p} onJump={onJump} />
          </p>
        ))}
      </div>
      {summary.momentum && (
        <p className="mt-4 rounded-[8px] bg-parchment px-3 py-2 text-sm text-ink">
          <span className="font-semibold">How the game went: </span>
          <MoveText text={summary.momentum} onJump={onJump} />
        </p>
      )}
      {!!summary.fell_short?.length && (
        <div className="mt-4">
          <h3 className="eyebrow mb-1.5">Where you fell short</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-body2 marker:text-[color:var(--blunder-bg)]">
            {summary.fell_short.map((b, i) => (
              <li key={i}>
                <MoveText text={b} onJump={onJump} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!wentWell.length && (
        <div className="mt-4">
          <h3 className="eyebrow mb-1.5">What went well</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-body2 marker:text-good">
            {wentWell.map((b, i) => (
              <li key={i}>
                <MoveText text={b} onJump={onJump} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.conclusion && (
        <p className="mt-4 border-t border-line-soft pt-3 font-semibold text-ink">
          <MoveText text={summary.conclusion} onJump={onJump} />
        </p>
      )}
    </section>
  );
}
