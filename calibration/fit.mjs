// Fits Nimzo's move labels and game accuracy to chess.com Game Review data.
// Inputs: chesscom-reviews.jsonl (scraped), nimzo-evals.jsonl (Nimzo engine pass), games.json.
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const cc = new Map(read("chesscom-reviews.jsonl").map((r) => [r.id, r]));
const nz = new Map(read("nimzo-evals.jsonl").map((r) => [r.id, r]));
const games = new Map(JSON.parse(readFileSync("games.json", "utf8")).map((g) => [g.url.split("/").pop(), g]));
const ids = [...cc.keys()].filter((id) => nz.has(id));

const CLAMP = 1000;
const toCp = (s) => (s.mate !== undefined ? (s.mate > 0 ? CLAMP : -CLAMP) : Math.max(-CLAMP, Math.min(CLAMP, s.cp)));
function parseCc(str) {
  if (!str) return null;
  const t = str.replace("−", "-").trim();
  const m = /^([+-]?)M(\d+)$/.exec(t);
  if (m) return m[1] === "-" ? -CLAMP : CLAMP;
  if (/^#/.test(t)) return t.includes("-") ? -CLAMP : CLAMP;
  if (t === "1-0") return CLAMP;
  if (t === "0-1") return -CLAMP;
  if (t === "½-½" || t === "1/2-1/2") return 0;
  const v = Number(t);
  return Number.isFinite(v) ? Math.max(-CLAMP, Math.min(CLAMP, v * 100)) : null;
}
const win = (cp, k) => 50 + 50 * (2 / (1 + Math.exp(-k * cp)) - 1); // White's win%

const ERR = ["inaccuracy", "mistake", "blunder", "incorrect"];
const NORMAL = new Set(["best", "excellent", "good", "great_find", "brilliant", "book"]);

// One row per move: who moved, chess.com label, cp before/after from both engines.
const rows = [];
for (const id of ids) {
  const c = cc.get(id), n = nz.get(id);
  const ccScores = c.moves.map((m) => parseCc(m.score));
  for (const m of c.moves) {
    const i = m.ply; // position after move i
    const mover = i % 2 === 1 ? "w" : "b";
    const nzBefore = n.positions[i - 1], nzAfter = n.positions[i];
    if (!nzBefore || !nzAfter) continue;
    rows.push({
      id, ply: i, mover, cls: m.cls, san: m.san,
      ccBefore: i === 1 ? 20 : ccScores[i - 2], ccAfter: ccScores[i - 1],
      nzBefore: toCp(nzBefore.score), nzAfter: nzAfter.terminal === "checkmate" ? (mover === "w" ? CLAMP : -CLAMP) : toCp(nzAfter.score),
      bestPlayed: nzBefore.bestUci !== null && n.positions[i] && false,
    });
  }
}
// previous-move label for "miss" modelling
const byGame = new Map();
for (const r of rows) (byGame.get(r.id) ?? byGame.set(r.id, []).get(r.id)).push(r);
for (const list of byGame.values()) list.forEach((r, i) => (r.prev = list[i - 1] ?? null));

const moverWin = (cpBefore, cpAfter, mover, k) => {
  const b = win(cpBefore, k), a = win(cpAfter, k);
  return mover === "w" ? [b, a] : [100 - b, 100 - a];
};

function classify(r, src, p) {
  const before = src === "cc" ? r.ccBefore : r.nzBefore;
  const after = src === "cc" ? r.ccAfter : r.nzAfter;
  if (before === null || after === null || before === undefined || after === undefined) return null;
  const [wb, wa] = moverWin(before, after, r.mover, p.k);
  const drop = (wb - wa) / 100; // expected points lost (0..1)
  let label = drop >= p.blunder ? "blunder" : drop >= p.mistake ? "mistake" : drop >= p.inaccuracy ? "inaccuracy" : "ok";
  if (p.miss && (label === "mistake" || label === "blunder") && r.prev) {
    // The opponent just handed over an advantage, and this move gave it back.
    const pb = src === "cc" ? r.prev.ccBefore : r.prev.nzBefore;
    const pa = src === "cc" ? r.prev.ccAfter : r.prev.nzAfter;
    if (pb !== null && pa !== null && pb !== undefined && pa !== undefined) {
      const [ob, oa] = moverWin(pb, pa, r.prev.mover, p.k);
      if ((ob - oa) / 100 >= p.missGift && wb >= p.missWinFloor) label = "incorrect";
    }
  }
  return label;
}

function labelScore(src, p) {
  let agree = 0, total = 0;
  const conf = {};
  for (const r of rows) {
    if (r.cls === "skills" || r.cls === "" || r.cls === "book") continue;
    const truth = ERR.includes(r.cls) ? r.cls : NORMAL.has(r.cls) ? "ok" : null;
    if (!truth) continue;
    const pred = classify(r, src, p);
    if (!pred) continue;
    total++;
    if (pred === truth) agree++;
    const key = `${truth}->${pred}`;
    conf[key] = (conf[key] ?? 0) + 1;
  }
  return { acc: agree / total, total, conf };
}

function errorCountsMatch(src, p) {
  // per game & side: compare counts of each error label
  let diff = 0;
  for (const [id, list] of byGame) {
    for (const side of ["w", "b"]) {
      const mine = list.filter((r) => r.mover === side && r.cls !== "book");
      for (const lab of ERR) {
        const truth = mine.filter((r) => r.cls === lab).length;
        const pred = mine.filter((r) => r.cls !== "skills" && classify(r, src, p) === lab).length;
        diff += Math.abs(truth - pred);
      }
    }
  }
  return diff;
}

// --- Label fitting -----------------------------------------------------------
const grid = [];
for (const k of [0.002, 0.0025, 0.003, 0.00368208, 0.0045, 0.0055])
  for (const inaccuracy of [0.04, 0.05, 0.06, 0.07])
    for (const mistake of [0.08, 0.1, 0.12, 0.14])
      for (const blunder of [0.15, 0.18, 0.2, 0.25, 0.3])
        for (const miss of [false, true])
          for (const missGift of miss ? [0.1, 0.15, 0.2] : [0])
            for (const missWinFloor of miss ? [0, 40, 50] : [0])
              if (inaccuracy < mistake && mistake < blunder) grid.push({ k, inaccuracy, mistake, blunder, miss, missGift, missWinFloor });

function best(src) {
  let top = null;
  for (const p of grid) {
    const s = labelScore(src, p);
    if (!top || s.acc > top.s.acc) top = { p, s };
  }
  return top;
}

const lichess = { k: 0.00368208, inaccuracy: 0.05, mistake: 0.1, blunder: 0.15, miss: false };
console.log(`games: ${ids.length}, labeled moves: ${rows.length}`);
for (const src of ["cc", "nz"]) {
  const l = labelScore(src, lichess);
  console.log(`\n[${src === "cc" ? "chess.com evals" : "Nimzo evals"}] current Nimzo (Lichess thresholds): agreement ${(l.acc * 100).toFixed(1)}% over ${l.total}, count error ${errorCountsMatch(src, lichess)}`);
  const b = best(src);
  console.log(`  best fit: ${JSON.stringify(b.p)} -> agreement ${(b.s.acc * 100).toFixed(1)}%, count error ${errorCountsMatch(src, b.p)}`);
  console.log("  confusion (truth->pred):", JSON.stringify(Object.fromEntries(Object.entries(b.s.conf).sort((a, c) => c[1] - a[1]))));
}

// --- Accuracy fitting ---------------------------------------------------------
const accData = [];
for (const id of ids) {
  const c = cc.get(id);
  if (!c.accuracy) continue;
  for (const [idx, side] of [[0, "w"], [1, "b"]]) {
    const list = byGame.get(id).filter((r) => r.mover === side);
    accData.push({ id, side, truth: c.accuracy[idx], list, all: byGame.get(id) });
  }
}

const moveAcc = (wb, wa, a, b, c) => Math.max(0, Math.min(100, a * Math.exp(-b * (wb - wa)) - c));
function gameAcc(d, src, p) {
  const accs = [], wins = [];
  for (const r of d.all) {
    const before = src === "cc" ? r.ccBefore : r.nzBefore;
    wins.push(win(before ?? 0, p.k));
  }
  for (const r of d.list) {
    const before = src === "cc" ? r.ccBefore : r.nzBefore;
    const after = src === "cc" ? r.ccAfter : r.nzAfter;
    if (before === null || after === null || before === undefined || after === undefined) continue;
    const [wb, wa] = moverWin(before, after, r.mover, p.k);
    accs.push(moveAcc(wb, wa, 103.1668, p.b, 3.1669));
  }
  if (!accs.length) return null;
  if (p.mode === "lichess") return lichessAcc(d, src, p);
  const mean = accs.reduce((x, y) => x + y, 0) / accs.length;
  const harm = accs.length / accs.reduce((x, y) => x + 1 / Math.max(y, 1), 0);
  if (p.mode === "mean") return mean;
  if (p.mode === "harmonic") return harm;
  if (p.mode === "blend") return p.w * mean + (1 - p.w) * harm;
  if (p.mode === "power") {
    // generalized mean with exponent q (q=1 mean, q=-1 harmonic)
    const q = p.q;
    return Math.pow(accs.reduce((x, y) => x + Math.pow(Math.max(y, 1), q), 0) / accs.length, 1 / q);
  }
  return mean;
}
// Lichess game accuracy: volatility-weighted mean and harmonic mean, averaged.
function lichessAcc(d, src, p) {
  const w = [win(src === "cc" ? 20 : d.all[0].nzBefore, p.k)];
  for (const r of d.all) w.push(win((src === "cc" ? r.ccAfter : r.nzAfter) ?? 0, p.k));
  const n = w.length - 1;
  const ws = Math.min(8, Math.max(2, Math.floor(n / 10)));
  const wins = [];
  for (let i = 0; i < ws - 2; i++) wins.push(w.slice(0, ws));
  for (let i = 0; i + ws <= w.length; i++) wins.push(w.slice(i, i + ws));
  const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
  const weights = wins.map((x) => Math.min(12, Math.max(0.5, sd(x))));
  let sw = 0, swa = 0, hs = 0, cnt = 0;
  for (let i = 1; i <= n; i++) {
    const white = i % 2 === 1;
    if ((white ? "w" : "b") !== d.side) continue;
    const b = white ? w[i - 1] : 100 - w[i - 1];
    const a = white ? w[i] : 100 - w[i];
    const ac = moveAcc(b, a, 103.1668, p.b, 3.1669);
    const wt = weights[i - 1] ?? 1;
    sw += wt; swa += wt * ac; hs += 1 / Math.max(ac, 1); cnt++;
  }
  return cnt ? (swa / sw + cnt / hs) / 2 : null;
}

function accErr(src, p) {
  let s = 0, n = 0;
  for (const d of accData) {
    const v = gameAcc(d, src, p);
    if (v === null) continue;
    s += Math.abs(v - d.truth);
    n++;
  }
  return s / n;
}
console.log(`\naccuracy data points: ${accData.length}`);
for (const src of ["cc", "nz"]) {
  console.log(`[${src}] current plain mean MAE ${accErr(src, { mode: "mean", k: 0.00368208, b: 0.04354 }).toFixed(2)}`);
  console.log(`[${src}] Lichess full formula MAE ${accErr(src, { mode: "lichess", k: 0.00368208, b: 0.04354 }).toFixed(2)}`);
  let top = null;
  for (const k of [0.002, 0.0025, 0.003, 0.00368208, 0.0045])
    for (const b of [0.02, 0.03, 0.04354, 0.06, 0.08, 0.1])
      for (const mode of ["mean", "harmonic", "blend", "power", "lichess"])
        for (const w of mode === "blend" ? [0.25, 0.5, 0.75] : [0])
          for (const q of mode === "power" ? [0.5, 0.25, -0.25, -0.5] : [0]) {
            const p = { k, b, mode, w, q };
            const e = accErr(src, p);
            if (!top || e < top.e) top = { p, e };
          }
  console.log(`[${src}] best accuracy fit MAE ${top.e.toFixed(2)}: ${JSON.stringify(top.p)}`);
}
