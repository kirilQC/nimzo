/**
 * Maia 3 input/output encoding, ported from the Maia team's own browser
 * implementation (CSSLab/maia-platform-frontend, src/lib/engine/tensor.ts and
 * maia.ts, GPLv3). Kept runtime-agnostic so the same code runs in the browser
 * (onnxruntime-web) and in Node tests (onnxruntime-node).
 */
import { Chess } from "chess.js";
import movesDict from "./all_moves_maia3.json";
import movesReversedDict from "./all_moves_maia3_reversed.json";

const MOVES = movesDict as Record<string, number>;
const MOVES_REVERSED = movesReversedDict as Record<string, string>;
export const MOVE_SPACE = 4352;

const PIECES = ["P", "N", "B", "R", "Q", "K", "p", "n", "b", "r", "q", "k"];

function mirrorSquare(sq: string): string {
  return sq[0] + String(9 - Number(sq[1]));
}

export function mirrorMove(uci: string): string {
  return mirrorSquare(uci.slice(0, 2)) + mirrorSquare(uci.slice(2, 4)) + uci.slice(4);
}

function swapCase(rank: string): string {
  let out = "";
  for (const ch of rank) out += /[A-Z]/.test(ch) ? ch.toLowerCase() : /[a-z]/.test(ch) ? ch.toUpperCase() : ch;
  return out;
}

function swapCastling(c: string): string {
  if (c === "-") return "-";
  let out = "";
  if (c.includes("k")) out += "K";
  if (c.includes("q")) out += "Q";
  if (c.includes("K")) out += "k";
  if (c.includes("Q")) out += "q";
  return out || "-";
}

/** Flips the board vertically and swaps colours, so the side to move is always "White". */
export function mirrorFen(fen: string): string {
  const [pos, turn, castling, ep, half, full] = fen.split(" ");
  const ranks = pos!.split("/").reverse().map(swapCase).join("/");
  return `${ranks} ${turn === "w" ? "b" : "w"} ${swapCastling(castling!)} ${ep !== "-" ? mirrorSquare(ep!) : "-"} ${half} ${full}`;
}

/** Board as 64 squares x 12 piece planes, square index = rank * 8 + file. */
function boardTokens(fen: string): Float32Array {
  const t = new Float32Array(64 * 12);
  const rows = fen.split(" ")[0]!.split("/");
  for (let r = 0; r < 8; r++) {
    const row = 7 - r;
    let file = 0;
    for (const ch of rows[r]!) {
      const n = Number(ch);
      if (Number.isNaN(n)) {
        const idx = PIECES.indexOf(ch);
        if (idx >= 0) t[(row * 8 + file) * 12 + idx] = 1;
        file += 1;
      } else file += n;
    }
  }
  return t;
}

export type MaiaInput = { tokens: Float32Array; legal: number[]; mirrored: boolean };

export function encode(fen: string): MaiaInput {
  const mirrored = fen.split(" ")[1] === "b";
  const f = mirrored ? mirrorFen(fen) : fen;
  const legal: number[] = [];
  for (const mv of new Chess(f).moves({ verbose: true })) {
    const idx = MOVES[mv.from + mv.to + (mv.promotion ?? "")];
    if (idx !== undefined) legal.push(idx);
  }
  return { tokens: boardTokens(f), legal, mirrored };
}

export type MaiaOutput = {
  /** Probability per legal move (UCI, real board orientation), sorted high to low. */
  policy: Record<string, number>;
  /** Expected score for the side to move, 0..1. */
  value: number;
};

export function decode(input: MaiaInput, logitsMove: Float32Array, logitsValue: Float32Array): MaiaOutput {
  const mx = Math.max(logitsValue[0]!, logitsValue[1]!, logitsValue[2]!);
  const [l, d, w] = [0, 1, 2].map((i) => Math.exp(logitsValue[i]! - mx)) as [number, number, number];
  const value = (w + 0.5 * d) / (l + d + w); // channels: 0 loss, 1 draw, 2 win (side to move)

  const legalLogits = input.legal.map((i) => logitsMove[i]!);
  const maxL = Math.max(...legalLogits);
  const exps = legalLogits.map((x) => Math.exp(x - maxL));
  const sum = exps.reduce((a, b) => a + b, 0);
  const entries = input.legal.map((idx, k) => {
    const uci = MOVES_REVERSED[String(idx)]!;
    return [input.mirrored ? mirrorMove(uci) : uci, exps[k]! / sum] as const;
  });
  entries.sort((a, b) => b[1] - a[1]);
  return { policy: Object.fromEntries(entries), value };
}

/** Minimal ONNX session shape shared by onnxruntime-web and onnxruntime-node. */
export type OrtLike = {
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown;
};
export type SessionLike = {
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: unknown }>>;
};

export async function predict(
  ort: OrtLike,
  session: SessionLike,
  fen: string,
  eloSelf: number,
  eloOppo: number,
): Promise<MaiaOutput> {
  const input = encode(fen);
  const out = await session.run({
    tokens: new ort.Tensor("float32", input.tokens, [1, 64, 12]),
    elo_self: new ort.Tensor("float32", Float32Array.from([eloSelf]), [1]),
    elo_oppo: new ort.Tensor("float32", Float32Array.from([eloOppo]), [1]),
  });
  return decode(input, out.logits_move!.data as Float32Array, out.logits_value!.data as Float32Array);
}
