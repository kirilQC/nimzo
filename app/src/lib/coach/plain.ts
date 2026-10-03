import type { MoveFeatures } from "@/lib/analysis/features";
import { TAG_BY_ID } from "@/lib/tags/catalog";

/**
 * One move's facts in words with no notation or squares, for Arthur's notes.
 * Written from the point of view of Kiril ("you"/"they").
 */
export function plainMove(f: MoveFeatures, tags: string[], extra: { intent?: string | null; root_cause?: string | null; maia?: { p_played: number; p_best: number | null } | null } = {}) {
  const you = f.mine;
  const who = you ? "you" : "they";
  const whose = you ? "your" : "their";
  const pts: string[] = [];
  const P = f.played;
  pts.push(
    `${who} moved ${whose} ${f.piece}${P?.captures ? `, taking a ${P.captures}` : ""}${P?.check ? ", with check" : ""}${f.san.startsWith("O-O") ? " (castling)" : ""}${P?.promotes ? ", promoting a pawn" : ""}`,
  );
  if (f.delivers_mate) pts.push("this was checkmate");
  const yourWin = (w: number) => Math.round(you ? w : 100 - w);
  pts.push(`your winning chances: ${yourWin(f.win_before)}% before, ${yourWin(f.win_after)}% after`);

  if (!f.played_best && f.best.piece && f.label && !["book", "forced", "best"].includes(f.label)) {
    const b = f.best.pattern;
    const idea = [
      b?.mate && "checkmate",
      b?.fork.length && `a fork hitting the ${b.fork.join(" and ")}`,
      b?.pin && "a pin",
      b?.skewer && "a skewer",
      b?.discovered && "a discovered attack",
      b?.captures && `taking a ${b.captures}${b.captures_free ? " for free" : ""}`,
      b?.check && "a check",
      b?.traps_piece && `trapping the ${b.traps_piece}`,
      b?.promotes && "promoting a pawn",
    ].filter(Boolean);
    pts.push(`the engine preferred a ${f.best.piece} move${idea.length ? ` (${idea.join(", ")})` : " (a quiet improving move)"}${f.best.material_gain && f.best.material_gain >= 2 ? `, winning about ${f.best.material_gain} points of material` : ""}`);
  }
  if (you && f.hanging_after.some((h) => h.piece !== "pawn")) pts.push(`after it, ${f.hanging_after.filter((h) => h.piece !== "pawn").map((h) => `your ${h.piece}`).join(" and ")} could be taken`);
  if (!you && f.hanging_after.some((h) => h.piece !== "pawn")) pts.push(`after it, ${f.hanging_after.filter((h) => h.piece !== "pawn").map((h) => `their ${h.piece}`).join(" and ")} could be taken by you`);
  if (f.reply.pattern && (f.label === "mistake" || f.label === "blunder" || f.label === "miss" || f.label === "inaccuracy")) {
    const r = f.reply.pattern;
    const other = you ? "their" : "your";
    const idea = [r.mate && "checkmate", r.captures && `taking a ${r.captures}`, r.fork.length && `a fork of the ${r.fork.join(" and ")}`, r.pin && "a pin", r.check && "a check"].filter(Boolean);
    if (idea.length) pts.push(`${other} best answer is a ${f.reply.piece} move: ${idea.join(", ")}`);
  }
  if (you && f.clock.left_s !== null && f.clock.left_s < 60) pts.push(`you had ${Math.round(f.clock.left_s)} seconds left`);
  if (you && f.clock.spent_s !== null && f.clock.spent_s <= 2 && (f.label === "blunder" || f.label === "mistake")) pts.push("you played it almost instantly");
  if (extra.maia) pts.push(`${Math.round(extra.maia.p_played * 100)}% of players at your level play this move`);

  const tagWords = tags
    .map((t) => TAG_BY_ID.get(t))
    .filter((t) => t && t.id !== "book_move")
    .map((t) => (you ? t!.plain : t!.label));
  return {
    ply: f.ply,
    move: f.move_number,
    who: you ? "Kiril" : "opponent",
    rating: f.label ?? "unrated",
    facts: pts,
    tags: tagWords.slice(0, 6),
    ...(you && extra.intent ? { trying_to: extra.intent.replace(/_/g, " ") } : {}),
    ...(you && extra.root_cause && extra.root_cause !== "unclear" ? { likely_cause: extra.root_cause.replace(/_/g, " ") } : {}),
  };
}
