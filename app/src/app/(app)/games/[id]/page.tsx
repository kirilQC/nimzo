import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameReview, type ReviewData } from "@/components/review/GameReview";
import { buildReviewData, type MistakeRecord, type PositionRecord } from "@/lib/review";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { SAMPLE_PGN } from "@/lib/chess/sample";
import { formatDate } from "@/lib/format";
import { describeEnding } from "@/lib/chess/ending";
import { ReanalyzeButton } from "@/components/review/ReanalyzeButton";
import { env } from "@/lib/env";

const RESULT_TEXT = { win: "Win", loss: "Loss", draw: "Draw" } as const;

function timeLabel(tc: string | null, timeClass: string | null): string | null {
  const m = tc ? /^(\d+)(?:\+(\d+))?$/.exec(tc) : null;
  if (!m) return timeClass;
  const mins = Math.round(Number(m[1]) / 60);
  return `${mins}${m[2] ? `+${m[2]}` : ""} min ${timeClass ?? ""}`.trim();
}

export const metadata: Metadata = { title: "Game review" };

type Header = { title: string; meta: string[]; ending: string | null; gameId: string | null };

export default async function GamePage({ params }: PageProps<"/games/[id]">) {
  const { id } = await params;

  let header: Header;
  let data: ReviewData;

  if (id === "sample") {
    data = buildReviewData({ gameId: null, pgn: SAMPLE_PGN, myColor: "white", status: "imported", error: null, positions: [] });
    header = { title: "You (White) vs shilling_fan", meta: ["Sample", "Loss", "10 min rapid", "Italian Game: Blackburne–Shilling Gambit"], ending: null, gameId: null };
  } else {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const db = await getDb();
    const { data: game } = await db
      .from(T.games)
      .select("id, pgn, my_color, opponent, opponent_rating, my_rating, result, result_detail, move_count, time_class, time_control, end_time, eco, opening_name, accuracy_ours, accuracy_chesscom, analysis_status, analysis_error")
      .eq("id", id)
      .maybeSingle();
    if (!game) notFound();
    const { data: positions } = await db
      .from(T.positions)
      .select("ply, eval_cp, eval_mate, win_pct, classification, accuracy, best_move_san, best_move_uci, pv_san, multipv, clock_ms")
      .eq("game_id", id)
      .order("ply");
    const [{ data: mistakes }, { data: review }, { data: notes }] = await Promise.all([
      db.from(T.mistakes).select("ply, tags, maia, explanation").eq("game_id", id),
      db.from(T.game_reviews).select("summary").eq("game_id", id).maybeSingle(),
      db.from(T.move_features).select("ply, note, tags").eq("game_id", id),
    ]);
    data = buildReviewData({
      mistakes: (mistakes ?? []) as MistakeRecord[],
      summary: (review?.summary as ReviewData["summary"]) ?? null,
      notes: new Map((notes ?? []).filter((n) => n.note).map((n) => [n.ply as number, n.note as string])),
      moveTags: new Map((notes ?? []).map((n) => [n.ply as number, (n.tags as string[] | null) ?? []])),
      result: game.result as ReviewData["result"],
      accuracy: game.accuracy_ours === null ? null : Number(game.accuracy_ours),
      gameId: game.id,
      pgn: game.pgn,
      myColor: game.my_color,
      status: game.analysis_status,
      error: game.analysis_error,
      positions: (positions ?? []) as PositionRecord[],
    });
    const me = env().CHESSCOM_USERNAME;
    data.players = {
      me: game.my_rating ? `${me} (${game.my_rating})` : me,
      opponent: game.opponent_rating ? `${game.opponent} (${game.opponent_rating})` : game.opponent,
    };
    const color = game.my_color === "white" ? "White" : "Black";
    const ending = describeEnding(game.result as "win" | "loss" | "draw", game.result_detail);
    const moves = game.move_count ?? Math.ceil(data.plies.length / 2);
    header = {
      title: `You (${color}${game.my_rating ? `, ${game.my_rating}` : ""}) vs ${game.opponent}${game.opponent_rating ? ` (${game.opponent_rating})` : ""}`,
      meta: [
        RESULT_TEXT[game.result as keyof typeof RESULT_TEXT],
        `${moves} moves`,
        timeLabel(game.time_control, game.time_class),
        game.opening_name,
        game.accuracy_ours !== null ? `Accuracy ${Number(game.accuracy_ours).toFixed(1)}` : null,
        game.accuracy_chesscom !== null ? `chess.com ${Number(game.accuracy_chesscom).toFixed(1)}` : null,
        formatDate(game.end_time, { month: "short", day: "numeric", year: "numeric" }),
      ].filter((x): x is string => !!x),
      ending: ending.long,
      gameId: game.id,
    };
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Link href="/games" className="arrow-link font-normal">
          ← All games
        </Link>
        <h1 className="text-[1.75rem]">{header.title}</h1>
        <p className="text-sm text-muted">
          {header.ending && <span className="font-semibold text-ink">{header.ending} · </span>}
          {header.meta.join(" · ")}
        </p>
        {header.gameId && (
          <span className="ml-auto">
            <ReanalyzeButton gameId={header.gameId} />
          </span>
        )}
      </div>
      <GameReview data={data} />
    </div>
  );
}
