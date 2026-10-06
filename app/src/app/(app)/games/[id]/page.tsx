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
import { GameReadouts, type Readouts } from "@/components/review/GameReadouts";
import { env } from "@/lib/env";
import { getPlayers } from "@/lib/chesscom/players";
import type { PlayerLook } from "@/components/PlayerBadge";

const RESULT_TEXT = { win: "Win", loss: "Loss", draw: "Draw" } as const;
const TIME_CLASS = { rapid: "Rapid", blitz: "Blitz", bullet: "Bullet", daily: "Daily" } as Record<string, string>;

/** "Italian Game: Two Knights Defense" → "Italian" for the compact readout. */
function shortOpening(name: string | null): string | null {
  if (!name) return null;
  return (name.split(":")[0] ?? name).replace(/\s+(Game|Opening|Defense|Defence|Attack)$/i, "").trim() || name;
}

function timeLabel(tc: string | null, timeClass: string | null): string | null {
  const m = tc ? /^(\d+)(?:\+(\d+))?$/.exec(tc) : null;
  if (!m) return timeClass;
  const mins = Math.round(Number(m[1]) / 60);
  return `${mins}${m[2] ? `+${m[2]}` : ""} min ${timeClass ?? ""}`.trim();
}

export const metadata: Metadata = { title: "Game review" };

type Header = {
  title: string;
  meta: string[];
  ending: string | null;
  gameId: string | null;
  players?: { me: { name: string; rating: number | null; color: string; look?: PlayerLook }; opp: { name: string; rating: number | null; look?: PlayerLook } };
};

export default async function GamePage({ params, searchParams }: PageProps<"/games/[id]">) {
  const { id } = await params;
  const plyParam = Number((await searchParams).ply); // ?ply=N opens the game at that move (links from the Profile tab)

  let header: Header;
  let data: ReviewData;
  let readouts: Readouts;

  if (id === "sample") {
    data = buildReviewData({ gameId: null, pgn: SAMPLE_PGN, myColor: "white", status: "imported", error: null, positions: [] });
    header = { title: "You (White) vs shilling_fan", meta: ["Sample", "Loss", "10 min rapid", "Italian Game: Blackburne Shilling Gambit"], ending: null, gameId: null };
    readouts = {
      gameId: null,
      opponent: null,
      me: null,
      result: null,
      game: { main: "Sample · 10 min · Italian", sub: "Blackburne Shilling Gambit" },
      accuracy: { mine: data.accuracy, theirs: data.accuracyOpponent, chesscom: null },
      fallbackTitle: "You vs shilling_fan",
    };
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
    const looks = await getPlayers([me, game.opponent]);
    data.players = {
      me: game.my_rating ? `${me} (${game.my_rating})` : me,
      opponent: game.opponent_rating ? `${game.opponent} (${game.opponent_rating})` : game.opponent,
    };
    const color = game.my_color === "white" ? "White" : "Black";
    const ending = describeEnding(game.result as "win" | "loss" | "draw", game.result_detail);
    data.ending = ending.short;
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
      players: {
        me: { name: me, rating: game.my_rating, color, look: looks.get(me.toLowerCase()) },
        opp: { name: game.opponent, rating: game.opponent_rating, look: looks.get(game.opponent.toLowerCase()) },
      },
    };
    const result = game.result as "win" | "loss" | "draw";
    const tc = timeLabel(game.time_control, null);
    readouts = {
      gameId: game.id,
      opponent: { name: game.opponent, rating: game.opponent_rating, look: looks.get(game.opponent.toLowerCase()), color: color === "White" ? "Black" : "White" },
      me: { rating: game.my_rating, color },
      result: { text: result === "draw" ? ending.short : `${RESULT_TEXT[result]} · ${ending.short}`, tone: result },
      game: {
        main: [`${moves} moves`, tc, shortOpening(game.opening_name)].filter(Boolean).join(" · "),
        sub: [game.time_class ? (TIME_CLASS[game.time_class] ?? game.time_class) : null, game.opening_name, formatDate(game.end_time, { month: "short", day: "numeric", year: "numeric" })].filter(Boolean).join(" · "),
      },
      accuracy: {
        mine: game.accuracy_ours === null ? null : Number(game.accuracy_ours),
        theirs: data.accuracyOpponent,
        chesscom: game.accuracy_chesscom === null ? null : Number(game.accuracy_chesscom),
      },
    };
  }

  return (
    <div>
      <p className="mb-3 text-sm">
        <Link href="/games" className="arrow-link font-normal">
          ← All games
        </Link>
        {header.ending && <span className="sr-only">. {header.ending}. {header.meta.join(", ")}</span>}
      </p>
      <GameReadouts r={readouts} />
      <GameReview data={Number.isInteger(plyParam) && plyParam > 0 ? { ...data, initialPly: plyParam } : data} />
    </div>
  );
}
