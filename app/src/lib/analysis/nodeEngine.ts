// Test/calibration helper: the real Stockfish lite build under Node.
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Engine } from "./runGame";
import { parseBestMove, parseInfo, type UciLine } from "./uci";

// The app package is "type": "module", so run a .cjs copy (the wasm is found by basename).
function engineScript(): string {
  const dir = mkdtempSync(join(tmpdir(), "nimzo-sf-"));
  const src = (f: string) => fileURLToPath(new URL(`../../../public/engine/${f}`, import.meta.url));
  copyFileSync(src("stockfish-19-lite-single.js"), join(dir, "sf.cjs"));
  copyFileSync(src("stockfish-19-lite-single.wasm"), join(dir, "sf.wasm"));
  return join(dir, "sf.cjs");
}

export class NodeEngine implements Engine {
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

