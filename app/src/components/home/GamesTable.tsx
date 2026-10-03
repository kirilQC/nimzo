import Link from "next/link";
import { flagsSummary } from "@/components/ui";
import type { GameRow } from "@/lib/data";
import { RESULT_LABEL } from "@/lib/format";

const RESULT_TEXT = { win: "Win", loss: "Loss", draw: "Draw" } as const;

export function GamesTable({ games, caption }: { games: GameRow[]; caption: string }) {
  return (
    <div className="card table-scroll p-0">
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Opponent</th>
            <th scope="col">Result</th>
            <th scope="col">Opening</th>
            <th scope="col">Accuracy</th>
            <th scope="col">Flags</th>
            <th scope="col">
              <span className="sr-only">Review</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id}>
              <td className="font-semibold text-ink" title={`${g.time_class ?? ""} · ${g.my_color}`}>
                {g.opponent}
              </td>
              <td className="text-body2" aria-label={RESULT_LABEL[g.result]}>
                {RESULT_TEXT[g.result]}
              </td>
              <td className="max-w-[180px] truncate text-walnut" title={[g.eco, g.opening_name].filter(Boolean).join(" ")}>
                {g.opening_name ?? "—"}
              </td>
              <td className="mono text-ink">{g.accuracy_ours !== null ? Number(g.accuracy_ours).toFixed(1) : "—"}</td>
              <td className="min-w-[120px] whitespace-normal text-walnut">
                {g.analysis_status === "imported" ? (
                  <span className="text-muted">Not analyzed</span>
                ) : g.analysis_status === "failed" ? (
                  <span className="text-[color:var(--blunder-bg)]">Analysis failed</span>
                ) : (
                  flagsSummary(g) ?? "Clean"
                )}
              </td>
              <td className="text-right">
                <Link href={`/games/${g.id}`} className="arrow-link">
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
