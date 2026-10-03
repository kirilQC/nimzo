"use client";

import { parseBestMove, parseInfo, type UciLine } from "@/lib/analysis/uci";
import type { Engine } from "@/lib/analysis/runGame";

const WORKER_URL = "/engine/stockfish-19-lite-single.js";

/**
 * Stockfish 19 (lite, single-threaded WASM) in a Web Worker. Single-threaded
 * means no cross-origin isolation headers are needed. Searches run one at a time.
 * Used ONLY for Nimzo's own analysis of finished games and Practice mode.
 */
export class StockfishEngine implements Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private listeners = new Set<(line: string) => void>();
  private chain: Promise<unknown> = Promise.resolve();

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.worker = new Worker(WORKER_URL);
    this.worker.onmessage = (e: MessageEvent) => {
      const text = typeof e.data === "string" ? e.data : String(e.data);
      for (const line of text.split("\n")) for (const l of this.listeners) l(line.trim());
    };
    this.ready = (async () => {
      await this.command("uci", (l) => l === "uciok");
      this.send("setoption name Hash value 32");
      await this.command("isready", (l) => l === "readyok");
    })();
    return this.ready;
  }

  private send(cmd: string) {
    this.worker!.postMessage(cmd);
  }

  private command(cmd: string, done: (line: string) => boolean, onLine?: (line: string) => void): Promise<void> {
    return new Promise((resolve) => {
      const listener = (line: string) => {
        onLine?.(line);
        if (done(line)) {
          this.listeners.delete(listener);
          resolve();
        }
      };
      this.listeners.add(listener);
      this.send(cmd);
    });
  }

  search(fen: string, opts: { depth: number; multipv: number }): Promise<UciLine[]> {
    const run = async () => {
      await this.start();
      this.send(`setoption name MultiPV value ${opts.multipv}`);
      this.send(`position fen ${fen}`);
      const best = new Map<number, UciLine>();
      let bestMove: string | null = null;
      await this.command(
        `go depth ${opts.depth}`,
        (l) => l.startsWith("bestmove"),
        (l) => {
          const info = parseInfo(l);
          if (info) {
            const prev = best.get(info.multipv);
            if (!prev || info.depth >= prev.depth) best.set(info.multipv, info);
          } else if (l.startsWith("bestmove")) bestMove = parseBestMove(l);
        },
      );
      const lines = [...best.values()].sort((a, b) => a.multipv - b.multipv);
      // Keep the reported best move first even if the last info line was shallower.
      if (bestMove && lines[0] && lines[0].pv[0] !== bestMove) {
        const i = lines.findIndex((l) => l.pv[0] === bestMove);
        if (i > 0) lines.unshift(...lines.splice(i, 1));
      }
      return lines;
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  newGame() {
    if (this.worker) this.send("ucinewgame");
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.listeners.clear();
  }
}

let shared: StockfishEngine | null = null;
export function getEngine(): StockfishEngine {
  shared ??= new StockfishEngine();
  return shared;
}
