// Exports the favicon set, app icons, outlined logo and OG image from the S9 logo.
// Run from /app: `npm run gen:icons`.
// The arched "NIMZO" is converted to glyph outlines (Fraunces 600 via opentype.js)
// so the exported logo and OG image don't depend on font loading.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import opentype from "opentype.js";
import pngToIco from "png-to-ico";
import { BRAND, badgeSvg, logoSvg } from "../app/src/lib/brand.ts";

const appDir = fileURLToPath(new URL("../app/", import.meta.url));
const require = createRequire(import.meta.url);

function outlinedArcText(): string {
  const fontPath = require.resolve("@fontsource/fraunces/files/fraunces-latin-600-normal.woff");
  const buf = readFileSync(fontPath);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const text = "NIMZO";
  const size = 23;
  const spacing = 7;
  const r = 78;
  const cx = 120;
  const cy = 120;
  const scale = size / font.unitsPerEm;

  const glyphs = font.stringToGlyphs(text);
  const advances = glyphs.map((g) => (g.advanceWidth ?? 0) * scale + spacing);
  const total = advances.reduce((a, b) => a + b, 0);
  const arcLen = Math.PI * r;
  let s = arcLen / 2 - total / 2; // startOffset 50%, text-anchor middle

  const paths: string[] = [];
  glyphs.forEach((g, i) => {
    const glyphWidth = (g.advanceWidth ?? 0) * scale;
    const mid = s + glyphWidth / 2;
    const alpha = Math.PI - mid / r;
    const x = cx + r * Math.cos(alpha);
    const y = cy - r * Math.sin(alpha);
    const deg = 90 - (alpha * 180) / Math.PI;
    const d = g.getPath(-glyphWidth / 2, 0, size).toPathData(3);
    paths.push(`<path d="${d}" transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${deg.toFixed(3)})"/>`);
    s += advances[i]!;
  });
  return `<g fill="${BRAND.brass}">${paths.join("")}</g>`;
}

async function png(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer();
}

async function main() {
  const badge = badgeSvg();
  const outlinedLogo = logoSvg(outlinedArcText());

  const appRoute = appDir + "src/app/";
  const brandDir = appDir + "public/brand/";
  mkdirSync(brandDir, { recursive: true });

  writeFileSync(appRoute + "icon.svg", badge);
  writeFileSync(brandDir + "badge.svg", badge);
  writeFileSync(brandDir + "logo.svg", outlinedLogo);

  writeFileSync(brandDir + "icon-32.png", await png(badge, 32));
  writeFileSync(brandDir + "icon-192.png", await png(badge, 192));
  writeFileSync(brandDir + "icon-512.png", await png(badge, 512));
  writeFileSync(appRoute + "apple-icon.png", await png(badge, 180));
  writeFileSync(appRoute + "favicon.ico", await pngToIco([await png(badge, 16), await png(badge, 32), await png(badge, 48)]));

  // OG image 1200x630: dark panel, outlined logo, wordmark tagline as outlines too.
  const logoPng = await png(outlinedLogo, 420);
  const og = await sharp({ create: { width: 1200, height: 630, channels: 4, background: BRAND.ink } })
    .composite([{ input: logoPng, left: 390, top: 105 }])
    .png()
    .toBuffer();
  writeFileSync(appRoute + "opengraph-image.png", og);

  console.log("Icons written: icon.svg, favicon.ico, apple-icon.png, opengraph-image.png, public/brand/*");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
