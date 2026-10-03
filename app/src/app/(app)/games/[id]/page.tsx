import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameReview, type ReviewData } from "@/components/review/GameReview";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { pgnToPositions } from "@/lib/chess/pgn";
import { SAMPLE_PGN } from "@/lib/chess/sample";
import { formatDate } from "@/lib/format";

const RESULT_TEXT = { win: "Win", loss: "Loss", draw: "Draw" } as const;

function timeLabel(tc: string | null, timeClass: string | null): string | null {
  const m = tc ? /^(\d+)(?:\+(\d+))?$/.exec(tc) : null;
  if (!m) return timeClass;
  const mins = Math.round(Number(m[1]) / 60);
  return `${mins}${m[2] ? `+${m[2]}` : ""} min ${timeClass ?? ""}`.trim();
}

export const metadata: Metadata = { title: "Game review" };

type Header = { title: string; meta: string[] };

function buildReview(pgn: string, myColor: "white" | "black"): ReviewData {
  const parsed = pgnToPositions(pgn);
  const mine = myColor === "white" ? "w" : "b";
  return {
    startFen: parsed.startFen,
    myColor,
    analyzed: false,
    coach: {},
    plies: parsed.plies.map((p) => ({
      ply: p.ply,
      san: p.san,
      from: p.from,
      to: p.to,
      color: p.color,
      fenAfter: p.fenAfter,
      clockMs: p.clockMs,
      isMine: p.color === mine,
      severity: null,
      whitePct: null,
    })),
  };
}

export default async function GamePage({ params }: PageProps<"/games/[id]">) {
  const { id } = await params;

  let header: Header;
  let data: ReviewData;

  if (id === "sample") {
    data = buildReview(SAMPLE_PGN, "white");
    header = { title: "You (White) vs shilling_fan", meta: ["Sample", "Loss", "10 min rapid", "Italian Game: Blackburne–Shilling Gambit"] };
  } else {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const db = await getDb();
    const { data: game } = await db
      .from(T.games)
      .select("id, pgn, my_color, opponent, result, time_class, time_control, end_time, eco, opening_name, accuracy_ours")
      .eq("id", id)
      .maybeSingle();
    if (!game) notFound();
    data = buildReview(game.pgn, game.my_color);
    const color = game.my_color === "white" ? "White" : "Black";
    header = {
      title: `You (${color}) vs ${game.opponent}`,
      meta: [
        RESULT_TEXT[game.result as keyof typeof RESULT_TEXT],
        timeLabel(game.time_control, game.time_class),
        game.opening_name,
        game.accuracy_ours !== null ? `Accuracy ${Number(game.accuracy_ours).toFixed(1)}` : null,
        formatDate(game.end_time, { month: "short", day: "numeric", year: "numeric" }),
      ].filter((x): x is string => !!x),
    };
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Link href="/" className="arrow-link font-normal">
          ← All games
        </Link>
        <h1 className="text-[1.75rem]">{header.title}</h1>
        <p className="text-sm text-muted">{header.meta.join(" · ")}</p>
      </div>
      <GameReview data={data} />
    </div>
  );
}
