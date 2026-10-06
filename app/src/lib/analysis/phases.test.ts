import { describe, expect, it } from "vitest";
import { phaseSegments, phaseStory, type PhasePoint } from "./phases";
import type { LabelId } from "./labels";

// The Scandinavian loss on time (you were White): [ply, your win %, label].
const GAME: [number, number, LabelId][] = [[1,52.4,"book"],[2,56.8,"book"],[3,49.9,"good"],[4,53.3,"good"],[5,52.3,"best"],[6,52.3,"best"],[7,52.2,"best"],[8,55.6,"good"],[9,53.8,"excellent"],[10,61.1,"good"],[11,55.3,"good"],[12,55.8,"best"],[13,55.7,"best"],[14,59.2,"good"],[15,59,"excellent"],[16,59.4,"best"],[17,60.4,"best"],[18,61.8,"excellent"],[19,61.6,"excellent"],[20,86.9,"mistake"],[21,75.4,"inaccuracy"],[22,86.3,"inaccuracy"],[23,71,"miss"],[24,74.4,"good"],[25,74.9,"best"],[26,97.5,"mistake"],[27,47.3,"blunder"],[28,58.8,"inaccuracy"],[29,18.2,"blunder"],[30,92.9,"blunder"],[31,90.9,"great"],[32,90.5,"best"],[33,90,"excellent"],[34,90,"best"],[35,89.3,"excellent"],[36,93.3,"good"],[37,92.3,"excellent"],[38,95.4,"good"],[39,96,"best"],[40,97.5,"excellent"],[41,95.3,"excellent"],[42,97.5,"excellent"]];
const phase = (ply: number) => (ply <= 20 ? "opening" : ply <= 33 ? "middlegame" : "endgame") as PhasePoint["phase"];
const points: PhasePoint[] = GAME.map(([ply, myPct, label]) => ({ ply, myPct, label, isMine: ply % 2 === 1, phase: phase(ply) }));

describe("phaseSegments", () => {
  const segs = phaseSegments(points, { result: "loss", ending: "Timeout" });

  it("splits into opening, middlegame and endgame with move ranges", () => {
    expect(segs.map((s) => [s.title, s.fromMove, s.toMove])).toEqual([["Opening", 1, 10], ["Middlegame", 11, 17], ["Endgame", 18, 21]]);
  });

  it("tells each part in a plain line", () => {
    expect(segs[0]!.story).toBe("They slipped and you took over.");
    expect(segs[1]!.story).toBe("Wild swings: two blunders and a missed chance, then a great find.");
    expect(segs[2]!.story).toBe("You stayed in control, but your clock ran out.");
  });

  it("never uses dashes", () => {
    for (const s of segs) expect(s.story).not.toMatch(/[-–—]/);
  });

  it("only moves forward: once the endgame starts it stays", () => {
    const wobbly = points.map((p) => ({ ...p, phase: (p.ply === 25 ? "endgame" : p.ply === 26 ? "middlegame" : phase(p.ply)) as PhasePoint["phase"] }));
    const s = phaseSegments(wobbly, { result: "loss", ending: "Timeout" });
    expect(s.map((x) => x.title)).toEqual(["Opening", "Middlegame", "Endgame"]);
    expect([s[1]!.toPly, s[2]!.fromPly]).toEqual([24, 25]); // once the endgame starts it stays, even if ply 26 looks like a middlegame
  });
});

describe("phaseStory", () => {
  it("describes a quiet first part as an even start", () => {
    expect(phaseStory(points.slice(0, 9), 50, true, false, { result: null, ending: null })).toBe("An even, calm start.");
  });
  it("ends a winning game", () => {
    expect(phaseStory(points.slice(32), 90, false, true, { result: "win", ending: "Resignation" })).toBe("You stayed in control, and you finished it.");
  });
});
