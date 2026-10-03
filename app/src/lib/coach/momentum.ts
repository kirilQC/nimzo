import type { MoveFeatures } from "@/lib/analysis/features";

/**
 * How the game flowed from Kiril's side, in numbers Arthur turns into one
 * sentence ("you had the edge for the first half, then..."). Computed from the
 * engine's winning chances after every move.
 */
export function momentum(feats: MoveFeatures[]) {
  if (!feats.length) return null;
  // Kiril's winning chances after each ply.
  const pts = feats.map((f) => ({ move: f.move_number, w: Math.round(f.mine ? f.win_after : 100 - f.win_after) }));
  const at = (move: number) => pts.filter((p) => p.move <= move).at(-1)?.w ?? null;
  const best = pts.reduce((a, b) => (b.w > a.w ? b : a));
  const worst = pts.reduce((a, b) => (b.w < a.w ? b : a));
  const ahead = pts.filter((p) => p.w >= 60).length, behind = pts.filter((p) => p.w <= 40).length;
  const half = Math.floor(pts.length / 2);
  const avg = (xs: { w: number }[]) => (xs.length ? Math.round(xs.reduce((s, p) => s + p.w, 0) / xs.length) : null);

  // Swings: crossing from clearly better to clearly worse (or back).
  const swings: { from: number; to: number; at_move: number; kind: "lost_the_lead" | "came_back" }[] = [];
  let state: "ahead" | "behind" | null = null;
  for (const p of pts) {
    const s = p.w >= 65 ? "ahead" : p.w <= 35 ? "behind" : null;
    if (s && state && s !== state) swings.push({ from: state === "ahead" ? 65 : 35, to: p.w, at_move: p.move, kind: s === "behind" ? "lost_the_lead" : "came_back" });
    if (s) state = s;
  }
  return {
    winning_chances_at: { move_10: at(10), move_20: at(20), move_30: at(30), end: pts.at(-1)!.w },
    average_first_half: avg(pts.slice(0, half)),
    average_second_half: avg(pts.slice(half)),
    best_moment: { move: best.move, chances: best.w },
    worst_moment: { move: worst.move, chances: worst.w },
    share_of_game_ahead_pct: Math.round((ahead / pts.length) * 100),
    share_of_game_behind_pct: Math.round((behind / pts.length) * 100),
    big_swings: swings.slice(0, 6),
  };
}
