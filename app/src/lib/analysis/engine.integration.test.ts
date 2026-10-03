// Runs the real Stockfish lite build under Node. Slow, so opt-in:
//   RUN_ENGINE=1 npx vitest run src/lib/analysis/engine.integration.test.ts
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatScore, gameAccuracy, judgeMove } from "./math";
import { pgnToPositions } from "../chess/pgn";
import { runEngineAnalysis, type Engine } from "./runGame";
import { parseBestMove, parseInfo, type UciLine } from "./uci";

// The app package is "type": "module", so run a .cjs copy (the wasm is found by basename).
function engineScript(): string {
  const dir = mkdtempSync(join(tmpdir(), "nimzo-sf-"));
  const src = (f: string) => fileURLToPath(new URL(`../../../public/engine/${f}`, import.meta.url));
  copyFileSync(src("stockfish-19-lite-single.js"), join(dir, "sf.cjs"));
  copyFileSync(src("stockfish-19-lite-single.wasm"), join(dir, "sf.wasm"));
  return join(dir, "sf.cjs");
}

class NodeEngine implements Engine {
  private proc = spawn(process.execPath, [engineScript()]);
  private buf = "";
  private waiters: ((line: string) => void)[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  constructor() {
    this.proc.stdout.on("data", (d: Buffer) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this.waiters.forEach((w) => w(line));
      }
    });
  }
  private send(c: string) {
    this.proc.stdin.write(c + "\n");
  }
  private until(pred: (l: string) => boolean, on?: (l: string) => void) {
    return new Promise<void>((res) => {
      const w = (l: string) => {
        on?.(l);
        if (pred(l)) {
          this.waiters = this.waiters.filter((x) => x !== w);
          res();
        }
      };
      this.waiters.push(w);
    });
  }
  async init() {
    const p = this.until((l) => l === "uciok");
    this.send("uci");
    await p;
    const r = this.until((l) => l === "readyok");
    this.send("isready");
    await r;
  }
  search(fen: string, o: { depth: number; multipv: number }) {
    const run = async () => {
      const best = new Map<number, UciLine>();
      this.send(`setoption name MultiPV value ${o.multipv}`);
      this.send(`position fen ${fen}`);
      const done = this.until(
        (l) => l.startsWith("bestmove"),
        (l) => {
          const i = parseInfo(l);
          if (i) best.set(i.multipv, i);
          else parseBestMove(l);
        },
      );
      this.send(`go depth ${o.depth}`);
      await done;
      return [...best.values()].sort((a, b) => a.multipv - b.multipv);
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }
  quit() {
    this.send("quit");
    this.proc.kill();
  }
}

const run = process.env.RUN_ENGINE ? describe : describe.skip;

run("Stockfish lite under Node", () => {
  it("flags Nxf7 in the Blackburne–Shilling trap as a blunder", async () => {
    const engine = new NodeEngine();
    await engine.init();
    const pgn = readFileSync(new URL("../chess/__fixtures__/blunder.pgn", import.meta.url), "utf8");
    const t0 = Date.now();
    const out = await runEngineAnalysis({ pgn, myColor: "white", engine, depth: 14 });
    engine.quit();
    console.log(`analyzed ${out.positions.length} positions in ${Date.now() - t0} ms`);
    const judged = out.positions.slice(1).map((p, i) => {
      const before = out.positions[i]!;
      return { ply: p.ply, j: judgeMove({ before: before.score, after: p.score, mover: i % 2 === 0 ? "w" : "b", playedBest: false, deliversMate: p.terminal === "checkmate" }) };
    });
    for (const { ply, j } of judged) if (ply % 2 === 1) console.log(ply, j.classification, j.winBefore.toFixed(1), "->", j.winAfter.toFixed(1));
    const nxf7 = judged.find((x) => x.ply === 9)!;
    expect(nxf7.j.classification).toBe("blunder");
    expect(out.positions.at(-1)!.terminal).toBe("checkmate");
    expect(out.multipv.some((m) => m.ply === 8 && m.lines.length === 3)).toBe(true);
  }, 120_000);
});

// Optional: REAL_GAMES=<path to a chess.com month JSON> prints flags for each game of mine.
const realRun = process.env.RUN_ENGINE && process.env.REAL_GAMES ? describe : describe.skip;
realRun("real games", () => {
  it("prints flags and accuracy", async () => {
    const engine = new NodeEngine();
    await engine.init();
    const month = JSON.parse(readFileSync(process.env.REAL_GAMES!, "utf8")) as { games: { pgn: string; white: { username: string } ; url: string }[] };
    const user = (process.env.CHESSCOM_USERNAME ?? "kivlev3000").toLowerCase();
    for (const g of month.games) {
      const myColor = g.white.username.toLowerCase() === user ? "white" : "black";
      const t0 = Date.now();
      const out = await runEngineAnalysis({ pgn: g.pgn, myColor, engine, depth: 16 });
      const plies = pgnToPositions(g.pgn).plies;
      const mine = myColor === "white" ? "w" : "b";
      const accs: number[] = [];
      const flags: string[] = [];
      for (const p of plies) {
        const before = out.positions[p.ply - 1]!;
        const after = out.positions[p.ply]!;
        const j = judgeMove({ before: before.score, after: after.score, mover: p.color, playedBest: before.bestUci === p.uci, deliversMate: after.terminal === "checkmate" });
        if (p.color !== mine) continue;
        accs.push(j.accuracy);
        if (["inaccuracy", "mistake", "blunder"].includes(j.classification))
          flags.push(`${Math.ceil(p.ply / 2)}${p.color === "w" ? "." : "..."}${p.san} ${j.classification} (${formatScore(before.score)} -> ${formatScore(after.score)})`);
      }
      console.log(`${g.url} as ${myColor}: ${plies.length} plies, ${Date.now() - t0} ms, accuracy ${gameAccuracy(accs)?.toFixed(1)}`);
      for (const f of flags) console.log(`  ${f}`);
    }
    engine.quit();
  }, 600_000);
});
