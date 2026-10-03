import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addMonths,
  archiveComplete,
  backfillArchives,
  mapGame,
  monthsToCheck,
  myColor,
  newGamesOnly,
  openingNameFromUrl,
  ratingsFromStats,
  resultFor,
  type GameRow,
} from "./map";

const pgn = readFileSync(new URL("../chess/__fixtures__/blunder.pgn", import.meta.url), "utf8");

// Shape copied from a live /games/{YYYY}/{MM} response (Oct 2026).
function rawGame(over: Record<string, unknown> = {}) {
  return {
    url: "https://www.chess.com/game/live/184763428174",
    pgn,
    time_control: "600",
    end_time: 1791045850,
    rated: true,
    uuid: "b988b2c6-bf48-11f1-8bef-2a4af901000f",
    time_class: "rapid",
    rules: "chess",
    white: { rating: 468, result: "checkmated", username: "NimzoUser" },
    black: { rating: 493, result: "win", username: "shilling_fan" },
    eco: "https://www.chess.com/openings/Italian-Game-Blackburne-Shilling-Gambit-4.Nxe5",
    ...over,
  };
}

describe("mapGame", () => {
  it("maps a real-shaped game", () => {
    const out = mapGame(rawGame(), "nimzouser", null);
    expect("row" in out).toBe(true);
    const row = (out as { row: GameRow }).row;
    expect(row).toMatchObject({
      my_color: "white",
      opponent: "shilling_fan",
      opponent_rating: 493,
      my_rating: 468,
      result: "loss",
      result_detail: "checkmated",
      time_class: "rapid",
      eco: "C50",
      opening_name: "Italian Game Blackburne Shilling Gambit",
      end_time: "2026-10-03T16:44:10.000Z",
      session_id: null,
    });
  });

  it("attaches the game to the active session only if it ended after the session started", () => {
    const before = mapGame(rawGame(), "NimzoUser", { id: "s1", started_at: "2026-10-03T17:00:00Z" });
    const after = mapGame(rawGame(), "NimzoUser", { id: "s1", started_at: "2026-10-03T16:00:00Z" });
    expect((before as { row: GameRow }).row.session_id).toBeNull();
    expect((after as { row: GameRow }).row.session_id).toBe("s1");
  });

  it("skips variants, other people's games and broken PGNs", () => {
    expect(mapGame(rawGame({ rules: "chess960" }), "NimzoUser", null)).toEqual({ skip: "variant chess960" });
    expect(mapGame(rawGame(), "someone_else", null)).toEqual({ skip: "not my game" });
    expect("skip" in mapGame(rawGame({ pgn: "1. e4 e5 2. Ke3 Ke6 3. Qh8" }), "NimzoUser", null)).toBe(true);
    expect("skip" in mapGame({ nope: true }, "NimzoUser", null)).toBe(true);
  });

  it("stores chess.com accuracy for my side when present", () => {
    const out = mapGame(rawGame({ accuracies: { white: 61.2, black: 80.1 } }), "NimzoUser", null) as { row: GameRow };
    expect(out.row.accuracy_chesscom).toBe(61.2);
  });
});

describe("myColor and resultFor", () => {
  it("matches username case-insensitively", () => {
    const g = { white: { username: "KivLev3000", result: "win" }, black: { username: "x", result: "resigned" } };
    expect(myColor(g, "kivlev3000")).toBe("white");
    expect(myColor(g, "X")).toBe("black");
    expect(myColor(g, "nobody")).toBeNull();
  });
  it("maps chess.com result codes", () => {
    expect(resultFor("win")).toBe("win");
    for (const d of ["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]) expect(resultFor(d)).toBe("draw");
    for (const l of ["checkmated", "resigned", "timeout", "abandoned"]) expect(resultFor(l)).toBe("loss");
  });
});

describe("openingNameFromUrl", () => {
  it("strips the move sequence", () => {
    expect(openingNameFromUrl("https://www.chess.com/openings/Sicilian-Defense-Alapin-Variation-2...Nf6-3.e5")).toBe(
      "Sicilian Defense Alapin Variation",
    );
    expect(openingNameFromUrl("https://www.chess.com/openings/Italian-Game")).toBe("Italian Game");
    expect(openingNameFromUrl(undefined)).toBeNull();
  });
});

describe("dedupe", () => {
  const row = (uuid: string | null, url: string) => ({ chesscom_uuid: uuid, chesscom_url: url }) as GameRow;
  it("drops games already stored by uuid or url, and repeats within a batch", () => {
    const incoming = [row("a", "u1"), row("b", "u2"), row(null, "u3"), row(null, "u3"), row("d", "u4")];
    const existing = [{ chesscom_uuid: "a", chesscom_url: "u1" }, { chesscom_uuid: null, chesscom_url: "u4" }];
    expect(newGamesOnly(incoming, existing).map((r) => r.chesscom_url)).toEqual(["u2", "u3"]);
  });
});

describe("month rollover", () => {
  it("wraps across years", () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 });
  });

  it("checks only the current month mid-month once last month was checked after it ended", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(monthsToCheck(now, new Date("2026-10-02T00:00:00Z"))).toEqual([{ year: 2026, month: 10 }]);
  });

  it("also checks last month in the first days of a month", () => {
    const now = new Date("2026-11-02T08:00:00Z");
    expect(monthsToCheck(now, new Date("2026-11-01T09:00:00Z"))).toEqual([
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
    ]);
  });

  it("also checks last month if it was never checked after it ended", () => {
    const now = new Date("2027-01-20T08:00:00Z");
    expect(monthsToCheck(now, new Date("2026-12-31T23:30:00Z"))).toEqual([
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ]);
    expect(monthsToCheck(now, null)).toHaveLength(2);
  });

  it("backfills the last N calendar months from the archive list, skipping missing months", () => {
    const base = "https://api.chess.com/pub/player/kivlev3000/games/";
    const archives = ["2026/06", "2026/07", "2026/09", "2026/10"].map((m) => base + m);
    expect(backfillArchives(archives, new Date("2026-10-03T00:00:00Z"), 3)).toEqual([base + "2026/09", base + "2026/10"]);
  });
});

describe("ratingsFromStats", () => {
  it("reads the last rating per time class", () => {
    expect(
      ratingsFromStats({ chess_rapid: { last: { rating: 468, date: 1 } }, chess_blitz: { last: { rating: 217, date: 1 } } }),
    ).toEqual({ rapid: 468, blitz: 217 });
  });
});

describe("history import", () => {
  const u = "https://api.chess.com/pub/player/kivlev3000/games/2026/09";
  it("treats a month as complete only if checked after it ended", () => {
    expect(archiveComplete(u, "2026-10-01T00:00:01Z")).toBe(true);
    expect(archiveComplete(u, "2026-09-30T23:59:00Z")).toBe(false);
    expect(archiveComplete(u, null)).toBe(false);
  });
});
