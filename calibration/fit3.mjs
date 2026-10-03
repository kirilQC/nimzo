// Fits all ten chess.com move labels (Brilliant … Blunder) from Nimzo's own
// engine data. Fit on even-indexed games, report on the odd ones.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../app/package.json", import.meta.url));
const { Chess } = require("chess.js");

const read = (f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const cc = new Map(read("chesscom-reviews.jsonl").map((r) => [r.id, r]));
const nz = new Map(read("nimzo-evals.jsonl").map((r) => [r.id, r]));
const pgns = new Map(JSON.parse(readFileSync("games.json", "utf8")).map((g) => [g.url.split("/").pop(), g.pgn]));
const ids = [...cc.keys()].filter((id) => nz.has(id) && pgns.has(id)).sort();
const train = ids.filter((_, i) => i % 2 === 0), test = ids.filter((_, i) => i % 2 === 1);

// Book positions: every prefix of every named line in the Lichess openings list.
const epd = (fen) => fen.split(" ").slice(0, 4).join(" ");
const book = new Set();
for (const f of "abcde") for (const line of readFileSync(`../scripts/openings-src/${f}.tsv`, "utf8").split("\n").slice(1)) {
  const pgn = line.split("\t")[2];
  if (!pgn) continue;
  const c = new Chess();
  for (const san of pgn.replace(/\d+\.\s*/g, "").trim().split(/\s+/)) { c.move(san); book.add(epd(c.fen())); }
}

const CLAMP = 1000, K = 0.00368208;
const cp = (s) => (s.mate !== undefined ? (s.mate > 0 ? CLAMP : -CLAMP) : Math.max(-CLAMP, Math.min(CLAMP, s.cp)));
const win = (c) => 50 + 50 * (2 / (1 + Math.exp(-K * c)) - 1);
const MAP = { book: "book", best: "best", excellent: "excellent", good: "good", inaccuracy: "inaccuracy", mistake: "mistake", blunder: "blunder", incorrect: "miss", great_find: "great", Brilliant: "brilliant", forced: "forced" };

const rows = new Map();
for (const id of ids) {
  const n = nz.get(id), c = new Chess();
  c.loadPgn(pgns.get(id));
  const hist = c.history({ verbose: true });
  const list = [];
  const ccBy = new Map(cc.get(id).moves.map((m) => [m.ply, m]));
  let inBook = true;
  for (let i = 1; i <= hist.length; i++) {
    const mv = hist[i - 1], b = n.positions[i - 1], a = n.positions[i];
    if (!a || !b) break;
    const mover = mv.color;
    const wW = (p) => (p.terminal === "checkmate" ? (mover === "w" ? 100 : 0) : win(cp(p.score)));
    const side = (w) => (mover === "w" ? w : 100 - w);
    const wb = side(win(cp(b.score))), wa = side(wW(a));
    // Mover's win% before the opponent's previous move (what they had before the "gift").
    const pp = n.positions[i - 2];
    const wPrev = pp ? side(win(cp(pp.score))) : wb;
    inBook = inBook && book.has(epd(mv.after));
    const legal = new Chess(mv.before).moves().length;
    const t = ccBy.get(i);
    list.push({ ply: i, wb, wa, drop: Math.max(0, wb - wa), gift: wb - wPrev, wPrev, best: b.bestUci === mv.from + mv.to + (mv.promotion ?? ""), inBook, legal, truth: t ? MAP[t.cls] : null });
  }
  rows.set(id, list);
}

function label(r, p) {
  if (r.inBook) return "book";
  if (r.legal === 1) return "forced";
  const d = r.drop;
  // Miss: the opponent just gave something away and you didn't take it (but didn't lose more than they gave).
  if (r.gift >= p.missGift && d >= p.missDrop && r.wa >= r.wPrev - p.missTol) return "miss";
  if (d >= p.blunder) return "blunder";
  if (d >= p.mistake) return "mistake";
  if (d >= p.inaccuracy) return "inaccuracy";
  if (r.best && r.gift >= p.greatGift && r.wb - r.wPrev >= 0 && r.wa >= p.greatFloor) return "great";
  if (r.best || d <= p.bestEps) return "best";
  if (d <= p.excellent) return "excellent";
  return "good";
}

function evaluate(set, p) {
  let ok = 0, n = 0;
  const per = {};
  for (const id of set) for (const r of rows.get(id)) {
    if (!r.truth || r.truth === "brilliant") continue;
    const q = label(r, p);
    n++; if (q === r.truth) ok++;
    per[r.truth] ??= { n: 0, hit: 0, predicted: 0 };
    per[r.truth].n++; if (q === r.truth) per[r.truth].hit++;
  }
  for (const id of set) for (const r of rows.get(id)) { if (!r.truth || r.truth === "brilliant") continue; const q = label(r, p); per[q] ??= { n: 0, hit: 0, predicted: 0 }; per[q].predicted++; }
  return { acc: ok / n, n, per };
}

// Coordinate descent over the parameters (drops in win-% points).
const space = {
  inaccuracy: [4, 5, 6, 7, 8, 9, 10], mistake: [10, 11, 12, 13, 14, 16], blunder: [16, 20, 25, 30, 35, 40],
  bestEps: [0, 0.25, 0.5, 1, 1.5], excellent: [1, 1.5, 2, 2.5, 3, 4, 5],
  missGift: [5, 8, 10, 15, 20, 30], missDrop: [5, 8, 10, 15, 20], missTol: [0, 5, 10, 20, 100],
  greatGift: [5, 10, 15, 20, 30, 1000], greatFloor: [0, 50, 60],
};
let p = { inaccuracy: 8, mistake: 12, blunder: 30, bestEps: 0.5, excellent: 2, missGift: 10, missDrop: 10, missTol: 10, greatGift: 15, greatFloor: 0 };
for (let round = 0; round < 6; round++) {
  for (const [k, vals] of Object.entries(space)) {
    let bestV = p[k], bestA = evaluate(train, p).acc;
    for (const v of vals) { const a = evaluate(train, { ...p, [k]: v }).acc; if (a > bestA) { bestA = a; bestV = v; } }
    p[k] = bestV;
  }
}
const tr = evaluate(train, p), te = evaluate(test, p);
console.log("params", JSON.stringify(p));
console.log(`10-label agreement train ${(tr.acc * 100).toFixed(1)}% | TEST ${(te.acc * 100).toFixed(1)}% (${te.n} moves)`);
for (const [k, v] of Object.entries(te.per)) console.log(`  ${k.padEnd(11)} chess.com ${String(v.n).padStart(3)}  nimzo ${String(v.predicted).padStart(3)}  recall ${v.n ? ((v.hit / v.n) * 100).toFixed(0) + "%" : "-"}  precision ${v.predicted ? ((v.hit / v.predicted) * 100).toFixed(0) + "%" : "-"}`);
writeFileSync("labels-result.json", JSON.stringify({ params: p, train: tr, test: te }, null, 2));
