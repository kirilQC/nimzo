import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { GamesExplorer, type ExplorerGame } from "@/components/games/GamesExplorer";
import { getAllGames } from "@/lib/data";
import { describeEnding } from "@/lib/chess/ending";

export const metadata: Metadata = { title: "My games" };

export default async function GamesPage() {
  const games = await getAllGames();
  const rows: ExplorerGame[] = games.map((g) => {
    const ending = describeEnding(g.result, g.result_detail);
    return {
      id: g.id,
      end: g.end_time,
      color: g.my_color,
      opponent: g.opponent,
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
      accuracyChesscom: g.accuracy_chesscom === null ? null : Number(g.accuracy_chesscom),
      status: g.analysis_status,
      blunders: g.blunders,
      misses: g.misses,
      mistakes: g.mistakes,
    };
  });
  return (
    <div>
      <PageHeader title="My games" subtitle={`Every game imported from chess.com: ${rows.length.toLocaleString("en-US")} so far. Click an opponent to open the game.`} />
      <GamesExplorer games={rows} />
    </div>
  );
}
