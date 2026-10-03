// Calibration data: Nimzo's engine pass over a list of chess.com games.
//   CALIBRATE_GAMES=<games.json> CALIBRATE_OUT=<out.jsonl> npx vitest run src/lib/analysis/calibrate.run.test.ts
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { NodeEngine } from "./nodeEngine";
import { runEngineAnalysis } from "./runGame";

const run = process.env.CALIBRATE_GAMES ? describe : describe.skip;

run("calibration engine pass", () => {
  it("analyzes every game", async () => {
    const games = JSON.parse(readFileSync(process.env.CALIBRATE_GAMES!, "utf8")) as { url: string; pgn: string; white: { username: string } }[];
    const out = process.env.CALIBRATE_OUT!;
    const done = new Set(existsSync(out) ? readFileSync(out, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);
    const user = (process.env.CHESSCOM_USERNAME ?? "kivlev3000").toLowerCase();
    const engine = new NodeEngine();
    await engine.init();
    for (const g of games) {
      const id = g.url.split("/").pop()!;
      if (done.has(id)) continue;
      const myColor = g.white.username.toLowerCase() === user ? "white" : "black";
      const payload = await runEngineAnalysis({ pgn: g.pgn, myColor, engine, depth: Number(process.env.CALIBRATE_DEPTH ?? 16) });
      appendFileSync(out, JSON.stringify({ id, myColor, ...payload }) + "\n");
      console.log("done", id);
    }
    engine.quit();
  }, 3_600_000);
});
