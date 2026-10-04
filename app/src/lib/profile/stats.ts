import "server-only";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { TAG_BY_ID, PRINCIPLES, KB_CATEGORIES, ROOT_CAUSES_V2, INTENTS } from "@/lib/tags/catalog";

/**
 * The player model's numbers: everything Nimzo has learned about how the
 * player plays, computed from every analyzed game (nimzo_game_analysis) and
 * every one of his moves (nimzo_move_features). Deterministic: no model here.
 * Arthur's written profile and memory are built from this.
 */

type GameRow = Record<string, unknown> & {
  game_id: string;
  end_time: string;
  result: "win" | "loss" | "draw";
  my_color: "white" | "black";
  my_rating: number | null;
  rating_diff: number | null;
  accuracy: number | null;
  tag_counts: Record<string, number>;
};
type MoveRow = { game_id: string; ply: number; is_mine: boolean; label: string | null; phase: string | null; tags: string[] | null; clock: { left_s: number | null; spent_s: number | null } | null; win_before: number | null; win_lost: number | null; move_number: number | null; intent: string | null };

const ERR = new Set(["inaccuracy", "mistake", "miss", "blunder"]);
const BIG = new Set(["mistake", "miss", "blunder"]);
const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null && !Number.isNaN(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
const score = (rows: GameRow[]) => (rows.length ? Math.round(((rows.filter((r) => r.result === "win").length + rows.filter((r) => r.result === "draw").length / 2) / rows.length) * 1000) / 10 : null);

/** Wilson 95% interval for a rate. */
function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** Pages through a query 1,000 rows at a time (the API's cap). */
async function pageAll<R>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<R[]> {
  const out: R[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as R[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export type ProfileStats = Awaited<ReturnType<typeof computeProfileStats>>;

export async function computeProfileStats(timeClass = "rapid") {
  const db = await getDb();
  const games = (await pageAll<GameRow>((a, b) => db.from(T.game_analysis).select("*").eq("time_class", timeClass).order("end_time").range(a, b))).map((g) => ({ ...g, accuracy: num(g.accuracy) }) as GameRow);
  if (!games.length) throw new Error("no analyzed games yet");
  const ids = new Set(games.map((g) => g.game_id));
  const gameById = new Map(games.map((g) => [g.game_id, g]));

  // Moves: both sides (the opponent's labels tell us when they handed over a chance).
  const moves: MoveRow[] = [];
  const idList = [...ids];
  for (let i = 0; i < idList.length; i += 60) {
    const chunk = idList.slice(i, i + 60);
    moves.push(
      ...(await pageAll<MoveRow>((a, b) =>
        db
          .from(T.move_features)
          .select("game_id, ply, is_mine, label, phase, tags, intent, clock:features->clock, win_before:features->win_before, win_lost:features->win_lost, move_number:features->move_number")
          .in("game_id", chunk)
          .order("game_id")
          .order("ply")
          .range(a, b),
      )),
    );
  }
  type MaiaRow = { game_id: string; ply: number; maia: { p_played: number } | null };
  const maiaRows: MaiaRow[] = [];
  for (let i = 0; i < idList.length; i += 60) {
    maiaRows.push(...(await pageAll<MaiaRow>((a, b) => db.from(T.mistakes).select("game_id, ply, maia").in("game_id", idList.slice(i, i + 60)).range(a, b))));
  }
  const maiaAt = new Map(maiaRows.map((m) => [`${m.game_id}:${m.ply}`, m.maia?.p_played ?? null]));

  const byGame = new Map<string, MoveRow[]>();
  for (const m of moves) (byGame.get(m.game_id) ?? byGame.set(m.game_id, []).get(m.game_id)!).push(m);
  const mine = moves.filter((m) => m.is_mine && m.label && m.label !== "book" && m.label !== "forced");
  const recentIds = new Set(games.slice(-100).map((g) => g.game_id));
  const n = games.length;

  // ---- Results, rating, accuracy over time ----
  const months = new Map<string, GameRow[]>();
  for (const g of games) {
    const k = g.end_time.slice(0, 7);
    (months.get(k) ?? months.set(k, []).get(k)!).push(g);
  }
  const perGame = (rows: GameRow[], col: string) => avg(rows.map((r) => num(r[col])));
  const byMonth = [...months].map(([month, rows]) => ({
    month,
    games: rows.length,
    rating: rows.at(-1)!.my_rating,
    score: score(rows),
    accuracy: avg(rows.map((r) => r.accuracy)),
    blunders_per_game: perGame(rows, "n_blunder"),
    errors_per_game: perGame(rows, "n_errors"),
  }));
  const ratings = games.map((g) => g.my_rating).filter((r): r is number => r !== null);

  // ---- Tags: how often, trend, examples ----
  const tagGames = new Map<string, Set<string>>();
  const tagMoves = new Map<string, MoveRow[]>();
  for (const m of moves.filter((x) => x.is_mine)) for (const t of m.tags ?? []) {
    (tagGames.get(t) ?? tagGames.set(t, new Set()).get(t)!).add(m.game_id);
    (tagMoves.get(t) ?? tagMoves.set(t, []).get(t)!).push(m);
  }
  const recentN = recentIds.size, earlierN = n - recentN;
  const tags = [...tagMoves].map(([id, ms]) => {
    const def = TAG_BY_ID.get(id);
    const recent = ms.filter((m) => recentIds.has(m.game_id)).length;
    const earlier = ms.length - recent;
    const recentRate = recentN ? recent / recentN : 0;
    const earlierRate = earlierN ? earlier / earlierN : null;
    const trend = earlierRate === null || earlierN < 50 ? "new" : recentRate < earlierRate * 0.8 ? "improving" : recentRate > earlierRate * 1.2 ? "worse" : "steady";
    // The most recent example from each of four different games, so the pattern shows up across games.
    const seenGames = new Set<string>();
    const examples = [...ms]
      .sort((a, b) => (gameById.get(b.game_id)!.end_time > gameById.get(a.game_id)!.end_time ? 1 : -1))
      .filter((m) => (seenGames.has(m.game_id) ? false : (seenGames.add(m.game_id), true)))
      .slice(0, 4)
      .map((m) => ({ game_id: m.game_id, ply: m.ply, move_number: m.move_number, date: gameById.get(m.game_id)!.end_time.slice(0, 10) }));
    // What the pattern costs: winning chances lost on the moves where it appears, per game.
    const lost = ms.reduce((a, m) => a + (Number(m.win_lost) || 0), 0);
    return {
      id,
      label: def?.label ?? id,
      avg_lost: Math.round((lost / ms.length) * 10) / 10,
      lost_per_game: Math.round((lost / n) * 10) / 10,
      plain: def?.plain ?? id,
      group: def?.group ?? "other",
      polarity: def?.polarity ?? "neutral",
      source: def?.source ?? "rule",
      times: ms.length,
      games: tagGames.get(id)!.size,
      games_pct: pct(tagGames.get(id)!.size, n),
      per_game: Math.round((ms.length / n) * 100) / 100,
      recent_per_game: Math.round(recentRate * 100) / 100,
      earlier_per_game: earlierRate === null ? null : Math.round(earlierRate * 100) / 100,
      trend,
      examples,
    };
  });
  // Ranked by what they cost (winning chances lost per game), not just by how often they show up.
  const badTags = tags.filter((t) => t.polarity === "bad").sort((a, b) => b.lost_per_game - a.lost_per_game);
  const goodTags = tags.filter((t) => t.polarity === "good").sort((a, b) => b.games - a.games);

  // ---- When mistakes happen: conditional error rates with lift ----
  const baseErr = mine.filter((m) => ERR.has(m.label!)).length / Math.max(1, mine.length);
  const baseBig = mine.filter((m) => BIG.has(m.label!)).length / Math.max(1, mine.length);
  const prevOf = (m: MoveRow) => (byGame.get(m.game_id) ?? []).find((x) => x.ply === m.ply - 1);
  const ownPrev = (m: MoveRow) => (byGame.get(m.game_id) ?? []).filter((x) => x.is_mine && x.ply < m.ply).slice(-2);
  const dims: { dimension: string; bucket: (m: MoveRow) => string | null; order: string[] }[] = [
    { dimension: "Game phase", bucket: (m) => m.phase, order: ["opening", "middlegame", "endgame"] },
    {
      dimension: "Time left on your clock",
      bucket: (m) => {
        const s = m.clock?.left_s;
        if (s === null || s === undefined) return null;
        return s > 300 ? "over 5 min" : s > 120 ? "2 to 5 min" : s > 60 ? "1 to 2 min" : s > 30 ? "30 to 60 s" : "under 30 s";
      },
      order: ["over 5 min", "2 to 5 min", "1 to 2 min", "30 to 60 s", "under 30 s"],
    },
    {
      dimension: "Time spent on the move",
      bucket: (m) => {
        const s = m.clock?.spent_s;
        if (s === null || s === undefined) return null;
        return s <= 2 ? "2 s or less" : s <= 10 ? "3 to 10 s" : s <= 30 ? "11 to 30 s" : "over 30 s";
      },
      order: ["2 s or less", "3 to 10 s", "11 to 30 s", "over 30 s"],
    },
    {
      dimension: "Position before the move",
      bucket: (m) => {
        const w = m.win_before;
        if (w === null || w === undefined) return null;
        return w >= 75 ? "winning" : w >= 58 ? "better" : w > 42 ? "equal" : w > 25 ? "worse" : "losing";
      },
      order: ["winning", "better", "equal", "worse", "losing"],
    },
    { dimension: "Your colour", bucket: (m) => gameById.get(m.game_id)!.my_color, order: ["white", "black"] },
    {
      dimension: "Right after their mistake",
      bucket: (m) => {
        const p = prevOf(m);
        return p && !p.is_mine ? (BIG.has(p.label ?? "") ? "they just slipped" : "normal") : null;
      },
      order: ["they just slipped", "normal"],
    },
    {
      dimension: "Right after your own mistake",
      bucket: (m) => (ownPrev(m).some((x) => BIG.has(x.label ?? "")) ? "within 2 moves of yours" : "no recent mistake"),
      order: ["within 2 moves of yours", "no recent mistake"],
    },
    {
      dimension: "Move number",
      bucket: (m) => {
        const k = m.move_number ?? 0;
        return k <= 10 ? "1 to 10" : k <= 20 ? "11 to 20" : k <= 30 ? "21 to 30" : k <= 40 ? "31 to 40" : "41+";
      },
      order: ["1 to 10", "11 to 20", "21 to 30", "31 to 40", "41+"],
    },
  ];
  const conditions = dims.flatMap((d) => {
    const groups = new Map<string, MoveRow[]>();
    for (const m of mine) {
      const b = d.bucket(m);
      if (b) (groups.get(b) ?? groups.set(b, []).get(b)!).push(m);
    }
    return d.order
      .filter((b) => groups.has(b))
      .map((b) => {
        const ms = groups.get(b)!;
        const errs = ms.filter((m) => ERR.has(m.label!)).length;
        const big = ms.filter((m) => BIG.has(m.label!)).length;
        const [lo, hi] = wilson(big, ms.length);
        return {
          dimension: d.dimension,
          bucket: b,
          moves: ms.length,
          error_rate: pct(errs, ms.length),
          big_error_rate: pct(big, ms.length),
          lift: baseBig ? Math.round((big / ms.length / baseBig) * 100) / 100 : null,
          // A pattern only counts when the whole 95% interval sits clearly above or below the average.
          significant: ms.length >= 40 && (lo > baseBig * 1.15 || hi < baseBig * 0.85),
        };
      });
  });

  // ---- Game-level conditions: opponents, sessions, time of day ----
  const sessions: GameRow[][] = [];
  for (const g of games) {
    const last = sessions.at(-1)?.at(-1);
    if (last && new Date(g.end_time).getTime() - new Date(last.end_time).getTime() <= 35 * 60_000) sessions.at(-1)!.push(g);
    else sessions.push([g]);
  }
  const sessionInfo = new Map<string, { index: number; prev: GameRow | null }>();
  for (const s of sessions) s.forEach((g, i) => sessionInfo.set(g.game_id, { index: i + 1, prev: s[i - 1] ?? null }));
  const gameDims: { dimension: string; bucket: (g: GameRow) => string | null; order: string[] }[] = [
    { dimension: "Colour", bucket: (g) => g.my_color, order: ["white", "black"] },
    {
      dimension: "Opponent's rating",
      bucket: (g) => (g.rating_diff === null ? null : g.rating_diff <= -100 ? "100+ higher" : g.rating_diff <= -30 ? "30 to 100 higher" : g.rating_diff < 30 ? "about equal" : g.rating_diff < 100 ? "30 to 100 lower" : "100+ lower"),
      order: ["100+ higher", "30 to 100 higher", "about equal", "30 to 100 lower", "100+ lower"],
    },
    {
      dimension: "Game in the session",
      bucket: (g) => {
        const i = sessionInfo.get(g.game_id)!.index;
        return i === 1 ? "1st game" : i === 2 ? "2nd game" : i <= 4 ? "3rd or 4th" : "5th or later";
      },
      order: ["1st game", "2nd game", "3rd or 4th", "5th or later"],
    },
    {
      dimension: "Previous game in the session",
      bucket: (g) => {
        const p = sessionInfo.get(g.game_id)!.prev;
        return p ? `after a ${p.result}` : null;
      },
      order: ["after a win", "after a draw", "after a loss"],
    },
    {
      dimension: "Time of day (UTC)",
      bucket: (g) => {
        const h = new Date(g.end_time).getUTCHours();
        return h < 6 ? "00 to 06" : h < 12 ? "06 to 12" : h < 18 ? "12 to 18" : "18 to 24";
      },
      order: ["00 to 06", "06 to 12", "12 to 18", "18 to 24"],
    },
  ];
  const gameConditions = gameDims.flatMap((d) => {
    const groups = new Map<string, GameRow[]>();
    for (const g of games) {
      const b = d.bucket(g);
      if (b) (groups.get(b) ?? groups.set(b, []).get(b)!).push(g);
    }
    return d.order.filter((b) => groups.has(b)).map((b) => {
      const rows = groups.get(b)!;
      return { dimension: d.dimension, bucket: b, games: rows.length, score: score(rows), accuracy: avg(rows.map((r) => r.accuracy)), blunders_per_game: perGame(rows, "n_blunder") };
    });
  });

  // ---- Openings ----
  const openGroups = new Map<string, GameRow[]>();
  for (const g of games) {
    const k = `${g.my_color}|${(g.opening_family as string | null) ?? "Unknown"}`;
    (openGroups.get(k) ?? openGroups.set(k, []).get(k)!).push(g);
  }
  const openings = [...openGroups]
    .map(([k, rows]) => {
      const [color, family] = k.split("|") as [string, string];
      const names = new Map<string, number>();
      for (const r of rows) if (r.opening_name) names.set(r.opening_name as string, (names.get(r.opening_name as string) ?? 0) + 1);
      return {
        color,
        family,
        games: rows.length,
        score: score(rows),
        accuracy: avg(rows.map((r) => r.accuracy)),
        opening_accuracy: avg(rows.map((r) => num(r.accuracy_opening))),
        errors_in_opening: perGame(rows, "errors_opening"),
        left_book_move: avg(rows.map((r) => num(r.left_book_move))),
        top_lines: [...names].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, c]) => ({ name, games: c })),
      };
    })
    .filter((o) => o.games >= 3)
    .sort((a, b) => b.games - a.games);

  // ---- Conversion, comebacks, how games end ----
  const winning = games.filter((g) => (num(g.best_win) ?? 0) >= 75);
  const losingSpots = games.filter((g) => (num(g.worst_win) ?? 100) <= 25);
  const endingCounts = (result: string) => {
    const c: Record<string, number> = {};
    for (const g of games.filter((x) => x.result === result)) c[(g.ending_text as string) ?? "unknown"] = (c[(g.ending_text as string) ?? "unknown"] ?? 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([how, count]) => ({ how, count }));
  };
  const resignedLosses = games.filter((g) => g.result === "loss" && g.ending === "resigned");

  // ---- Clock ----
  const clock = {
    avg_move_time_s: perGame(games, "avg_move_time_s"),
    games_with_time_trouble_pct: pct(games.filter((g) => (num(g.moves_under_60s) ?? 0) > 0).length, n),
    losses_on_time: games.filter((g) => g.result === "loss" && g.ending === "timeout").length,
    errors_under_60s_share: pct(games.reduce((s, g) => s + (num(g.errors_under_60s) ?? 0), 0), games.reduce((s, g) => s + (num(g.n_errors) ?? 0), 0)),
    instant_error_share: pct(games.reduce((s, g) => s + (num(g.instant_errors) ?? 0), 0), games.reduce((s, g) => s + (num(g.n_errors) ?? 0), 0)),
    instant_moves_per_game: perGame(games, "instant_moves"),
    avg_time_left_end_s: perGame(games, "my_time_left_end_s"),
  };

  // ---- Maia: blind spots vs normal-for-your-level ----
  const mistakesWithMaia = mine.filter((m) => BIG.has(m.label!) && maiaAt.get(`${m.game_id}:${m.ply}`) !== undefined && maiaAt.get(`${m.game_id}:${m.ply}`) !== null);
  const rare = mistakesWithMaia.filter((m) => maiaAt.get(`${m.game_id}:${m.ply}`)! <= 0.1);
  const common = mistakesWithMaia.filter((m) => maiaAt.get(`${m.game_id}:${m.ply}`)! >= 0.3);
  const tagShare = (ms: MoveRow[]) => {
    const c = new Map<string, number>();
    for (const m of ms) for (const t of m.tags ?? []) if (TAG_BY_ID.get(t)?.polarity === "bad") c.set(t, (c.get(t) ?? 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, count]) => ({ id, label: TAG_BY_ID.get(id)?.label ?? id, count }));
  };

  // ---- Jev's judgments over mistakes ----
  const sumCounts = (col: string, labels: readonly { id: string; label: string }[]) => {
    const c: Record<string, number> = {};
    for (const g of games) for (const [k, v] of Object.entries((g[col] as Record<string, number>) ?? {})) c[k] = (c[k] ?? 0) + v;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, label: labels.find((l) => l.id === id)?.label ?? id, count }));
  };

  return {
    generated_at: new Date().toISOString(),
    time_class: timeClass,
    games: n,
    moves: mine.length,
    period: { from: games[0]!.end_time, to: games.at(-1)!.end_time },
    results: { wins: games.filter((g) => g.result === "win").length, losses: games.filter((g) => g.result === "loss").length, draws: games.filter((g) => g.result === "draw").length, score: score(games) },
    rating: { start: ratings[0] ?? null, current: ratings.at(-1) ?? null, peak: ratings.length ? Math.max(...ratings) : null, low: ratings.length ? Math.min(...ratings) : null },
    by_month: byMonth,
    accuracy: {
      overall: avg(games.map((g) => g.accuracy)),
      opening: avg(games.map((g) => num(g.accuracy_opening))),
      middlegame: avg(games.map((g) => num(g.accuracy_middlegame))),
      endgame: avg(games.map((g) => num(g.accuracy_endgame))),
      as_white: avg(games.filter((g) => g.my_color === "white").map((g) => g.accuracy)),
      as_black: avg(games.filter((g) => g.my_color === "black").map((g) => g.accuracy)),
      recent_100: avg(games.slice(-100).map((g) => g.accuracy)),
    },
    per_game: {
      blunders: perGame(games, "n_blunder"),
      misses: perGame(games, "n_miss"),
      mistakes: perGame(games, "n_mistake"),
      inaccuracies: perGame(games, "n_inaccuracy"),
      great_or_brilliant: avg(games.map((g) => (num(g.n_great) ?? 0) + (num(g.n_brilliant) ?? 0))),
      opponent_blunders: avg(games.map((g) => (num(g.opp_n_blunder) ?? 0) + (num(g.opp_n_miss) ?? 0))),
      opponent_blunders_punished: perGame(games, "opp_blunders_punished"),
    },
    errors_by_phase: {
      opening: games.reduce((s, g) => s + (num(g.errors_opening) ?? 0), 0),
      middlegame: games.reduce((s, g) => s + (num(g.errors_middlegame) ?? 0), 0),
      endgame: games.reduce((s, g) => s + (num(g.errors_endgame) ?? 0), 0),
    },
    first_blunder_move_avg: avg(games.map((g) => num(g.first_blunder_move))),
    weaknesses: badTags.slice(0, 30),
    strengths: goodTags.slice(0, 12),
    base_rates: { error_rate: Math.round(baseErr * 1000) / 10, big_error_rate: Math.round(baseBig * 1000) / 10 },
    conditions,
    game_conditions: gameConditions,
    openings: openings.slice(0, 16),
    conversion: {
      had_winning_position: winning.length,
      won_from_winning: winning.filter((g) => g.result === "win").length,
      conversion_rate: pct(winning.filter((g) => g.result === "win").length, winning.length),
      threw_winning_games: games.filter((g) => g.threw_winning).length,
      had_losing_position: losingSpots.length,
      saved_from_losing: losingSpots.filter((g) => g.result !== "loss").length,
      comeback_rate: pct(losingSpots.filter((g) => g.result !== "loss").length, losingSpots.length),
    },
    endings: {
      losses: endingCounts("loss"),
      wins: endingCounts("win"),
      draws: endingCounts("draw"),
      resigned_while_still_fighting: resignedLosses.filter((g) => (num(g.win_end) ?? 0) >= 20).length,
      resigned_losses: resignedLosses.length,
    },
    clock,
    maia: {
      mistakes_checked: mistakesWithMaia.length,
      blind_spot_share: pct(rare.length, mistakesWithMaia.length),
      normal_for_level_share: pct(common.length, mistakesWithMaia.length),
      blind_spot_tags: tagShare(rare),
      normal_for_level_tags: tagShare(common),
    },
    principles: sumCounts("principle_counts", PRINCIPLES),
    categories: sumCounts("category_counts", KB_CATEGORIES),
    root_causes: sumCounts("root_cause_counts", ROOT_CAUSES_V2),
    intents: sumCounts("intent_counts", INTENTS),
    habits: {
      castled_pct: pct(games.filter((g) => g.castled).length, n),
      castled_move_avg: avg(games.map((g) => num(g.castled_move))),
      minors_developed_by_10_avg: avg(games.map((g) => num(g.minors_developed_by_10))),
      early_queen_games_pct: pct(games.filter((g) => (num(g.queen_moves_first_10) ?? 0) >= 2).length, n),
      left_book_move_avg: avg(games.map((g) => num(g.left_book_move))),
      traps_fallen: games.filter((g) => g.fell_for_trap).map((g) => g.fell_for_trap as string),
      traps_sprung: games.filter((g) => g.sprang_trap).map((g) => g.sprang_trap as string),
    },
  };
}
