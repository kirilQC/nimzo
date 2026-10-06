import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { GamesExplorer, type ExplorerGame } from "@/components/games/GamesExplorer";
import { getAllGames } from "@/lib/data";
import { describeEnding } from "@/lib/chess/ending";
import { getPlayers } from "@/lib/chesscom/players";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "My games" };

/** Opponent accuracy for every analyzed game (paged past the API's 1,000 row cap). */
async function opponentAccuracy(): Promise<Map<string, number | null>> {
  const db = await getDb();
  const out = new Map<string, number | null>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(T.game_analysis).select("game_id, accuracy_opponent").range(from, from + 999);
    if (error) throw new Error(`opponentAccuracy: ${error.message}`);
    for (const r of data ?? []) out.set(r.game_id as string, r.accuracy_opponent === null ? null : Number(r.accuracy_opponent));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default async function GamesPage() {
  const me = env().CHESSCOM_USERNAME;
  const games = await getAllGames();
  const [players, oppAcc] = await Promise.all([getPlayers([me, ...games.map((g) => g.opponent)]), opponentAccuracy()]);
  const rows: ExplorerGame[] = games.map((g) => {
    const ending = describeEnding(g.result, g.result_detail);
    return {
      id: g.id,
      end: g.end_time,
      color: g.my_color,
      opponent: g.opponent,
      oppLook: players.get(g.opponent.toLowerCase()) ?? null,
      oppRating: g.opponent_rating,
      myRating: g.my_rating,
      result: g.result,
      ending: ending.long,
      endingShort: ending.short,
      moves: g.move_count,
      timeClass: g.time_class ?? "other",
      timeControl: g.time_control,
      opening: g.opening_name && g.opening_name !== "Undefined" ? g.opening_name : null,
      eco: g.eco,
      accuracy: g.accuracy_ours === null ? null : Number(g.accuracy_ours),
      oppAccuracy: oppAcc.get(g.id) ?? null,
      status: g.analysis_status,
    };
  });
  return (
    <div>
      <PageHeader title="My games" subtitle={`Every game imported from chess.com: ${rows.length.toLocaleString("en-US")} so far.`} />
      <GamesExplorer games={rows} me={me} myLook={players.get(me.toLowerCase()) ?? null} />
    </div>
  );
}
