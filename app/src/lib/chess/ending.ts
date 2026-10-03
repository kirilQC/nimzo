/**
 * How a game ended, in words, from my side. `detail` is chess.com's result code
 * for the side that lost (or for me on a draw), as stored in result_detail.
 */
export type Ending = { short: string; long: string; by: "you" | "opponent" | null };

const DRAWS: Record<string, string> = {
  agreed: "Draw by agreement",
  repetition: "Draw by repetition",
  stalemate: "Stalemate",
  insufficient: "Draw, insufficient material",
  "50move": "Draw by 50-move rule",
  timevsinsufficient: "Draw, timeout vs insufficient material",
};

const LOSSES: Record<string, { short: string; you: string; opponent: string }> = {
  checkmated: { short: "Checkmate", you: "You were checkmated", opponent: "You checkmated them" },
  resigned: { short: "Resignation", you: "You resigned", opponent: "Opponent resigned" },
  timeout: { short: "Timeout", you: "You ran out of time", opponent: "Opponent ran out of time" },
  abandoned: { short: "Abandoned", you: "You abandoned the game", opponent: "Opponent abandoned the game" },
  lose: { short: "Loss", you: "You lost", opponent: "Opponent lost" },
};

export function describeEnding(result: "win" | "loss" | "draw", detail: string | null): Ending {
  const code = detail ?? "";
  if (result === "draw") {
    const text = DRAWS[code] ?? "Draw";
    return { short: text.replace(/^Draw,? (by )?/i, "").replace(/^./, (c) => c.toUpperCase()) || "Draw", long: text, by: null };
  }
  const by = result === "win" ? "opponent" : "you"; // who resigned / flagged / got mated
  const l = LOSSES[code];
  if (!l) return { short: result === "win" ? "Win" : "Loss", long: result === "win" ? "You won" : "You lost", by };
  return { short: l.short, long: by === "you" ? l.you : l.opponent, by };
}
