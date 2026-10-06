import Link from "next/link";
import type { GameRow } from "@/lib/data";
import { Avatar, Flag, type PlayerLook } from "@/components/PlayerBadge";

type Side = { name: string; rating: number | null; look?: PlayerLook; accuracy: number | null; score: string };

const CLASS_LABEL: Record<string, string> = { rapid: "Rapid", blitz: "Blitz", bullet: "Bullet", daily: "Daily" };

function tcLabel(tc: string | null, timeClass: string | null): string {
  if (timeClass === "daily") {
    const d = tc ? /^1\/(\d+)$/.exec(tc) : null;
    return d ? `${Math.round(Number(d[1]) / 86400)} days` : "Daily";
  }
  const m = tc ? /^(\d+)(?:\+(\d+))?$/.exec(tc) : null;
  if (!m) return CLASS_LABEL[timeClass ?? ""] ?? "";
  const secs = Number(m[1]);
  const base = secs < 60 ? `${secs} sec` : `${Math.round(secs / 60)} min`;
  return m[2] ? `${base} | ${m[2]}` : base;
}

/** Time control icons, drawn here: stopwatch (rapid), lightning (blitz), bullet, sun (daily). */
function TimeIcon({ timeClass }: { timeClass: string | null }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (timeClass) {
    case "blitz":
      return (
        <svg {...common}>
          <path d="M13.5 2 5 13.5h6L9.5 22 19 9.8h-6.2z" fill="#F7C631" />
        </svg>
      );
    case "bullet":
      return (
        <svg {...common}>
          <path d="M8 21h8v-9a4 4 0 0 0-8 0z" fill="#E3A23C" />
          <rect x="7" y="18" width="10" height="3" rx="1" fill="#B97B1F" />
        </svg>
      );
    case "daily":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4.5" fill="#F7C631" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="#F7C631" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="13.5" r="7.5" fill="none" stroke="#81B64C" strokeWidth="2.4" />
          <path d="M12 9.5v4.2l2.6 1.6" fill="none" stroke="#81B64C" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M9.5 2.5h5M12 2.5v3" stroke="#81B64C" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
  }
}

function ResultIcon({ result }: { result: GameRow["result"] }) {
  const s =
    result === "win"
      ? { bg: "#81B64C", d: "M12 7v10M7 12h10", label: "Won" }
      : result === "loss"
        ? { bg: "#E2412F", d: "M7 12h10", label: "Lost" }
        : { bg: "#8B8F87", d: "M7 9.5h10M7 14.5h10", label: "Draw" };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" role="img" aria-label={s.label} className="shrink-0">
      <rect x="1" y="1" width="22" height="22" rx="4" fill={s.bg} />
      <path d={s.d} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function PlayerLine({ side, color }: { side: Side; color: "white" | "black" }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar src={side.look?.avatar_url} name={side.name} size={26} />
      <span
        role="img"
        aria-label={color === "white" ? "White" : "Black"}
        className={`h-3 w-3 shrink-0 rounded-[2px] border ${color === "white" ? "border-[#cfc6a8] bg-white" : "border-[#4a5a50] bg-[#111]"}`}
      />
      {side.look?.title && <span className="rounded-[3px] bg-[#7c2d22] px-1 text-[0.6875rem] font-bold leading-[1.35] text-white">{side.look.title}</span>}
      <span className="truncate font-semibold text-ink">{side.name}</span>
      {side.rating !== null && <span className="shrink-0 text-muted">({side.rating})</span>}
      <Flag code={side.look?.country_code} size={18} />
    </span>
  );
}

/** One game as the history table shows it, from either the home page's rows or My games' rows. */
export type HistoryRow = {
  id: string;
  end: string;
  timeClass: string | null;
  timeControl: string | null;
  color: "white" | "black";
  result: GameRow["result"];
  opponent: string;
  oppRating: number | null;
  myRating: number | null;
  oppLook?: PlayerLook | null;
  myAcc: number | null;
  oppAcc: number | null;
  moves: number | null;
  opening?: string | null;
  ending?: string | null;
};

const TINT = { win: "bg-[rgba(143,211,168,0.07)] shadow-[inset_3px_0_0_var(--win)]", loss: "bg-[rgba(255,122,98,0.07)] shadow-[inset_3px_0_0_var(--loss)]", draw: "" } as const;

/**
 * Games laid out the way chess.com's Game History shows them: White over Black
 * with avatars and flags, scores with a result square, both accuracies, moves
 * and date. `details` adds the opening and how it ended; `tint` colours each
 * row by result. The whole row opens the review.
 */
export function HistoryTable({ rows, me, myLook, details = false, tint = false, caption }: { rows: HistoryRow[]; me: string; myLook?: PlayerLook; details?: boolean; tint?: boolean; caption: string }) {
  return (
    <div className="table-scroll rounded-[14px] border border-line bg-card">
      <table className="w-full border-collapse text-[0.9375rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-[0.8125rem] text-muted">
            <th scope="col" className="w-[84px] py-3 font-semibold">
              <span className="sr-only">Time control</span>
            </th>
            <th scope="col" className="py-3 text-left font-semibold">
              Players
            </th>
            {details && (
              <th scope="col" className="py-3 text-left font-semibold">
                Opening and ending
              </th>
            )}
            <th scope="col" className="w-[96px] py-3 font-semibold">
              Result
            </th>
            <th scope="col" className="w-[110px] py-3 font-semibold">
              Accuracy
            </th>
            <th scope="col" className="w-[80px] py-3 font-semibold">
              Moves
            </th>
            <th scope="col" className="w-[140px] py-3 pr-5 text-right font-semibold">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const mine: Side = { name: me, rating: g.myRating, look: myLook, accuracy: g.myAcc, score: g.result === "win" ? "1" : g.result === "loss" ? "0" : "½" };
            const theirs: Side = { name: g.opponent, rating: g.oppRating, look: g.oppLook ?? undefined, accuracy: g.oppAcc, score: g.result === "win" ? "0" : g.result === "loss" ? "1" : "½" };
            const [white, black] = g.color === "white" ? [mine, theirs] : [theirs, mine];
            const date = new Date(g.end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            return (
              <tr key={g.id} className={`row-lift relative border-t border-line ${tint ? TINT[g.result] : ""}`}>
                <td className="py-3 text-center">
                  <span className="flex flex-col items-center gap-0.5">
                    <TimeIcon timeClass={g.timeClass} />
                    <span className="text-[0.75rem] text-muted">{tcLabel(g.timeControl, g.timeClass)}</span>
                  </span>
                </td>
                <td className={`py-3 ${details ? "w-[30%]" : "max-w-0"}`}>
                  {/* The whole row opens the review. */}
                  <Link href={`/games/${g.id}`} className="absolute inset-0 z-0" aria-label={`Review your ${g.result} against ${g.opponent}, ${date}`} />
                  <span className="flex flex-col gap-1.5">
                    <PlayerLine side={white} color="white" />
                    <PlayerLine side={black} color="black" />
                  </span>
                </td>
                {details && (
                  <td className="max-w-0 py-3 pr-4">
                    <span className="block truncate text-[0.875rem] text-gold" title={g.opening ?? undefined}>
                      {g.opening ?? "Unknown opening"}
                    </span>
                    <span className="block truncate text-[0.875rem] text-body2">{g.ending}</span>
                  </td>
                )}
                <td className="py-3">
                  <span className="flex items-center justify-center gap-3">
                    <span className="mono flex flex-col text-center text-[1rem] leading-[1.9rem] text-ink">
                      <span>{white.score}</span>
                      <span>{black.score}</span>
                    </span>
                    <ResultIcon result={g.result} />
                  </span>
                </td>
                <td className="py-3 text-center">
                  {mine.accuracy !== null ? (
                    <span className="mono flex flex-col text-[1rem] leading-[1.9rem] text-ink">
                      <span>{white.accuracy !== null ? white.accuracy.toFixed(1) : "?"}</span>
                      <span>{black.accuracy !== null ? black.accuracy.toFixed(1) : "?"}</span>
                    </span>
                  ) : (
                    <span className="inline-flex min-h-[38px] items-center rounded-[6px] bg-chip px-4 font-bold text-ink">Review</span>
                  )}
                </td>
                <td className="mono py-3 text-center text-[1rem] text-ink">{g.moves ?? ""}</td>
                <td className="py-3 pr-5 text-right text-body2">{date}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The home page's recent games. */
export function GameHistory({ games, me, looks, oppAccuracy }: { games: GameRow[]; me: string; looks: Map<string, PlayerLook>; oppAccuracy: Map<string, number | null> }) {
  const rows: HistoryRow[] = games.map((g) => ({
    id: g.id,
    end: g.end_time,
    timeClass: g.time_class,
    timeControl: g.time_control,
    color: g.my_color,
    result: g.result,
    opponent: g.opponent,
    oppRating: g.opponent_rating,
    myRating: g.my_rating,
    oppLook: looks.get(g.opponent.toLowerCase()),
    myAcc: g.accuracy_ours === null ? null : Number(g.accuracy_ours),
    oppAcc: oppAccuracy.get(g.id) ?? null,
    moves: g.move_count,
  }));
  return <HistoryTable rows={rows} me={me} myLook={looks.get(me.toLowerCase())} caption={`Your last ${games.length} games, newest first`} />;
}
