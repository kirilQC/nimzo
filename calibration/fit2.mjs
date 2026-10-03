// Calibrates Nimzo's move labels and game accuracy against chess.com Game Review.
// Fits on half the games, reports on the held-out half.
import { readFileSync, writeFileSync } from "node:fs";

const read = (f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const cc = new Map(read("chesscom-reviews.jsonl").map((r) => [r.id, r]));
const nz = new Map(read("nimzo-evals.jsonl").map((r) => [r.id, r]));
const ids = [...cc.keys()].filter((id) => nz.has(id)).sort();
const train = new Set(ids.filter((_, i) => i % 2 === 0));
const test = new Set(ids.filter((_, i) => i % 2 === 1));

const CLAMP = 1000;
const toCp = (s) => (s.mate !== undefined ? (s.mate > 0 ? CLAMP : -CLAMP) : Math.max(-CLAMP, Math.min(CLAMP, s.cp)));
const win = (cp, k) => 50 + 50 * (2 / (1 + Math.exp(-k * cp)) - 1);
const ERR = ["inaccuracy", "mistake", "blunder", "incorrect"];
const OK = new Set(["best", "excellent", "good", "great_find", "brilliant"]);

const byGame = new Map();
for (const id of ids) {
  const c = cc.get(id), n = nz.get(id);
  const list = [];
  for (const m of c.moves) {
    const i = m.ply;
    const b = n.positions[i - 1], a = n.positions[i];
    if (!b || !a) continue;
    const mover = i % 2 === 1 ? "w" : "b";
    list.push({ id, ply: i, mover, cls: m.cls, before: toCp(b.score), after: a.terminal === "checkmate" ? (mover === "w" ? CLAMP : -CLAMP) : toCp(a.score), bestMate: b.score.mate, afterMate: a.score.mate });
  }
  list.forEach((r, k) => (r.prev = list[k - 1] ?? null));
  byGame.set(id, list);
}
const moverWin = (r, k) => {
  const b = win(r.before, k), a = win(r.after, k);
  return r.mover === "w" ? [b, a] : [100 - b, 100 - a];
};

function label(r, p) {
  const [wb, wa] = moverWin(r, p.k);
  const drop = (wb - wa) / 100;
  let l = drop >= p.blunder ? "blunder" : drop >= p.mistake ? "mistake" : drop >= p.inaccuracy ? "inaccuracy" : "ok";
  if (p.miss && (l === "mistake" || l === "blunder") && r.prev) {
    const [ob, oa] = moverWin(r.prev, p.k);
    if ((ob - oa) / 100 >= p.missGift && wb >= p.missWinFloor) l = "incorrect";
  }
  return l;
}

function score(set, p) {
  let agree = 0, total = 0, countErr = 0;
  const conf = {};
  for (const id of set) {
    const list = byGame.get(id);
    for (const r of list) {
      if (r.cls === "skills" || r.cls === "" || r.cls === "book") continue;
      const truth = ERR.includes(r.cls) ? r.cls : OK.has(r.cls) ? "ok" : null;
      if (!truth) continue;
      const pred = label(r, p);
      total++;
      if (pred === truth) agree++;
      conf[`${truth}->${pred}`] = (conf[`${truth}->${pred}`] ?? 0) + 1;
    }
    for (const side of ["w", "b"]) {
      const mine = list.filter((r) => r.mover === side && r.cls !== "book" && r.cls !== "skills");
      for (const lab of ERR) countErr += Math.abs(mine.filter((r) => r.cls === lab).length - mine.filter((r) => label(r, p) === lab).length);
    }
  }
  return { agree: agree / total, total, countErrPerSide: countErr / (set.size * 2), conf };
}

// Agreement on "is this move an error at all?" (any of the four) — the most useful binary signal.
function errorDetection(set, p) {
  let tp = 0, fp = 0, fn = 0;
  for (const id of set) for (const r of byGame.get(id)) {
    if (r.cls === "skills" || r.cls === "" || r.cls === "book") continue;
    const t = ERR.includes(r.cls), q = label(r, p) !== "ok";
    if (t && q) tp++; else if (!t && q) fp++; else if (t && !q) fn++;
  }
  return { precision: tp / (tp + fp), recall: tp / (tp + fn) };
}

const grid = [];
for (const k of [0.002, 0.0025, 0.003, 0.0035, 0.00368208, 0.004, 0.0045])
  for (const inaccuracy of [0.05, 0.06, 0.07, 0.08, 0.09, 0.1])
    for (const mistake of [0.1, 0.12, 0.14, 0.16, 0.2])
      for (const blunder of [0.2, 0.25, 0.3, 0.35, 0.4, 0.5])
        for (const miss of [false, true])
          for (const missGift of miss ? [0.08, 0.1, 0.15, 0.2] : [0])
            for (const missWinFloor of miss ? [0, 30, 40, 50] : [0])
              if (inaccuracy < mistake && mistake < blunder) grid.push({ k, inaccuracy, mistake, blunder, miss, missGift, missWinFloor });

let best = null;
for (const p of grid) {
  const s = score(train, p);
  if (!best || s.agree > best.s.agree) best = { p, s };
}

const lichess = { k: 0.00368208, inaccuracy: 0.05, mistake: 0.1, blunder: 0.15, miss: false };
const fmt = (x) => (x * 100).toFixed(1) + "%";
const out = { games: ids.length, train: train.size, test: test.size, labels: {}, accuracy: {} };
for (const [name, p] of [["nimzo_current_lichess", lichess], ["fitted", best.p]]) {
  const tr = score(train, p), te = score(test, p), det = errorDetection(test, p);
  out.labels[name] = { params: p, train_agreement: tr.agree, test_agreement: te.agree, test_moves: te.total, test_count_error_per_side: te.countErrPerSide, test_error_precision: det.precision, test_error_recall: det.recall, test_confusion: te.conf };
  console.log(`${name}: labels agree train ${fmt(tr.agree)} | TEST ${fmt(te.agree)} (${te.total} moves) | count error/side ${te.countErrPerSide.toFixed(2)} | error detection P ${fmt(det.precision)} R ${fmt(det.recall)}`);
}
console.log("fitted params:", JSON.stringify(best.p));

// ---- accuracy ----
const acc1 = (wb, wa, b) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-b * (wb - wa)) - 3.1669));
function gameAcc(id, side, p) {
  const list = byGame.get(id);
  const accs = list.filter((r) => r.mover === side).map((r) => { const [wb, wa] = moverWin(r, p.k); return acc1(wb, wa, p.b); });
  if (!accs.length) return null;
  if (p.mode === "mean") return accs.reduce((a, b) => a + b, 0) / accs.length;
  if (p.mode === "power") return Math.pow(accs.reduce((x, y) => x + Math.pow(Math.max(y, 1), p.q), 0) / accs.length, 1 / p.q);
  if (p.mode === "lichess") {
    const w = [win(list[0].before, p.k), ...list.map((r) => win(r.after, p.k))];
    const n = w.length - 1, ws = Math.min(8, Math.max(2, Math.floor(n / 10)));
    const wins = []; for (let i = 0; i < ws - 2; i++) wins.push(w.slice(0, ws)); for (let i = 0; i + ws <= w.length; i++) wins.push(w.slice(i, i + ws));
    const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
    const weights = wins.map((x) => Math.min(12, Math.max(0.5, sd(x))));
    let sw = 0, swa = 0, hs = 0, cnt = 0;
    for (let i = 1; i <= n; i++) { const white = i % 2 === 1; if ((white ? "w" : "b") !== side) continue; const b = white ? w[i - 1] : 100 - w[i - 1], a = white ? w[i] : 100 - w[i]; const ac = acc1(b, a, p.b); const wt = weights[i - 1] ?? 1; sw += wt; swa += wt * ac; hs += 1 / Math.max(ac, 1); cnt++; }
    return cnt ? (swa / sw + cnt / hs) / 2 : null;
  }
}
function accMae(set, p) {
  let s = 0, n = 0;
  for (const id of set) { const a = cc.get(id).accuracy; if (!a) continue; for (const [i, side] of [[0, "w"], [1, "b"]]) { const v = gameAcc(id, side, p); if (v == null) continue; s += Math.abs(v - a[i]); n++; } }
  return s / n;
}
let bestAcc = null;
for (const k of [0.001, 0.0015, 0.002, 0.0025, 0.003, 0.00368208])
  for (const b of [0.04354, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25])
    for (const mode of ["mean", "power", "lichess"])
      for (const q of mode === "power" ? [0.75, 0.5, 0.25, -0.25, -0.5] : [1]) {
        const p = { k, b, mode, q };
        const e = accMae(train, p);
        if (!bestAcc || e < bestAcc.e) bestAcc = { p, e };
      }
for (const [name, p] of [["nimzo_current_plain_mean", { k: 0.00368208, b: 0.04354, mode: "mean" }], ["lichess_full", { k: 0.00368208, b: 0.04354, mode: "lichess" }], ["fitted", bestAcc.p]]) {
  out.accuracy[name] = { params: p, train_mae: accMae(train, p), test_mae: accMae(test, p) };
  console.log(`accuracy ${name}: avg points off chess.com train ${accMae(train, p).toFixed(1)} | TEST ${accMae(test, p).toFixed(1)}`);
}
console.log("fitted accuracy params:", JSON.stringify(bestAcc.p));
writeFileSync("calibration-result.json", JSON.stringify(out, null, 2));
