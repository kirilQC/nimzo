// Splits an evenly gridded image sheet into tiles (cols x rows), trimming the divider lines.
//   node crop-grid.mjs <sheet> <prefix> <outDir> <cols> <rows>
import sharp from "sharp";

const [src, prefix, outDir, cols, rows] = process.argv.slice(2);
const meta = await sharp(src).metadata();
const cw = meta.width / Number(cols);
const rh = meta.height / Number(rows);
const inset = 4;
let k = 0;
for (let r = 0; r < Number(rows); r++) {
  for (let c = 0; c < Number(cols); c++) {
    k++;
    await sharp(src)
      .extract({ left: Math.round(c * cw + inset), top: Math.round(r * rh + inset), width: Math.round(cw - 2 * inset), height: Math.round(rh - 2 * inset) })
      .webp({ quality: 88 })
      .toFile(`${outDir}/${prefix}${String(k).padStart(2, "0")}.webp`);
  }
}
console.log(src.split("/").pop(), "->", k, "tiles of", Math.round(cw), "x", Math.round(rh));
