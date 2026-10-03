// Splits an image sheet into tiles along its white divider lines.
import sharp from "sharp";
const [src, prefix, outDir] = process.argv.slice(2);
const img = sharp(src);
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const white = (x, y) => { const i = (y * W + x) * C; return data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225; };
const lines = (n, other, at) => {
  const out = [];
  for (let a = 0; a < n; a++) { let w = 0; for (let b = 0; b < other; b += 2) if (at(a, b)) w++; if (w / (other / 2) > 0.9) out.push(a); }
  return out;
};
const cols = lines(W, H, (x, y) => white(x, y));
const rows = lines(H, W, (y, x) => white(x, y));
const spans = (cuts, n) => { const s = []; let start = 0; const set = new Set(cuts); for (let i = 0; i <= n; i++) { if (i === n || set.has(i)) { if (i - start > 40) s.push([start, i]); start = i + 1; } } return s; };
const cs = spans(cols, W), rs = spans(rows, H);
console.log(`${src}: ${W}x${H}, ${cs.length} cols x ${rs.length} rows`);
let k = 0;
for (const [y0, y1] of rs) for (const [x0, x1] of cs) {
  k++;
  const inset = 2;
  await sharp(src).extract({ left: x0 + inset, top: y0 + inset, width: x1 - x0 - 2 * inset, height: y1 - y0 - 2 * inset }).webp({ quality: 88 }).toFile(`${outDir}/${prefix}${String(k).padStart(2, "0")}.webp`);
}
console.log("tiles:", k, "size ~", cs[0][1] - cs[0][0], "x", rs[0][1] - rs[0][0]);
