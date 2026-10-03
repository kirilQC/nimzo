// Generates the wooden board and pieces (app/public/board/wood/*).
// Piece shapes: cburnett (Colin M.L. Burnett, GPLv2+, via lichess). Wood grain is
// procedural noise, so every square and piece texture here is our own render.
import { readFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const OUT = new URL("../app/public/board/wood/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const src = (p) => readFileSync(new URL(`./pieces-src/${p}.svg`, import.meta.url), "utf8");

// --- pieces -----------------------------------------------------------------
const WOOD = {
  w: { hi: "#efe0cb", mid: "#dcc4a6", lo: "#b99a78", grain: 0.22, line: "#1d150e", detail: "#1d150e" },
  b: { hi: "#5a5450", mid: "#403b38", lo: "#2a2725", grain: 0.35, line: "#0f0e0d", detail: "#121110" },
};

function piece(name) {
  const c = WOOD[name[0]];
  let s = src(name).replace(/ style="color-scheme:light only"/, "").replace(/ width="45" height="45"/, "");
  const fillFrom = name[0] === "w" ? "#fff" : "#000";
  s = s.replaceAll(`fill="${fillFrom}"`, 'fill="url(#wood)"');
  s = s.replaceAll('stroke="#000"', `stroke="${c.line}"`);
  s = s.replaceAll('fill="#ececec"', `fill="${c.detail}"`).replaceAll('stroke="#ececec"', `stroke="${c.detail}"`);
  const defs = `<defs>
    <linearGradient id="shade" x1="0" x2="1" y1="0" y2="0.25">
      <stop offset="0" stop-color="${c.lo}"/><stop offset="0.32" stop-color="${c.hi}"/>
      <stop offset="0.6" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.lo}"/>
    </linearGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9 0.06" numOctaves="3" seed="${name.charCodeAt(1)}"/>
      <feColorMatrix values="0 0 0 0 0.18  0 0 0 0 0.1  0 0 0 0 0.04  0 0 0 ${c.grain * 2.2} ${-c.grain * 0.9}"/>
    </filter>
    <pattern id="wood" patternUnits="userSpaceOnUse" width="45" height="45">
      <rect width="45" height="45" fill="url(#shade)"/>
      <rect width="45" height="45" filter="url(#grain)"/>
    </pattern>
  </defs>`;
  // Wrap the body so paths with no explicit fill (some black pieces) take the wood too.
  s = s.replace(/(<svg[^>]*>)([\s\S]*)<\/svg>/, `$1${defs}<g fill="url(#wood)">$2</g></svg>`);
  return s;
}

for (const color of "wb") for (const p of "PNBRQK") {
  const name = color + p;
  await sharp(Buffer.from(piece(name)), { density: 600 }).resize(240, 240).webp({ quality: 92, alphaQuality: 100 }).toFile(new URL(`${name}.webp`, OUT).pathname.slice(1));
}

// --- board ------------------------------------------------------------------
// Light maple and dark walnut, grain running up the board, sampled from the reference.
const SQ = 160, N = 8, SIZE = SQ * N;
async function texture(base, streak, alpha, seed) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <filter id="g" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09 0.004" numOctaves="4" seed="${seed}"/>
      <feColorMatrix values="0 0 0 0 ${streak[0]}  0 0 0 0 ${streak[1]}  0 0 0 0 ${streak[2]}  0 0 0 ${alpha * 2.4} ${-alpha}"/>
    </filter>
    <filter id="f" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.6 0.02" numOctaves="2" seed="${seed + 7}"/>
      <feColorMatrix values="0 0 0 0 ${streak[0]}  0 0 0 0 ${streak[1]}  0 0 0 0 ${streak[2]}  0 0 0 ${alpha * 1.6} ${-alpha * 0.7}"/>
    </filter>
    <rect width="100%" height="100%" fill="${base}"/>
    <rect width="100%" height="100%" filter="url(#g)"/>
    <rect width="100%" height="100%" filter="url(#f)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
const light = await texture("#ba9f7a", [0.55, 0.42, 0.27], 0.55, 3);
const dark = await texture("#6f4e34", [0.24, 0.15, 0.09], 0.6, 11);

// Each square gets its own patch of the texture so neighbours don't look alike.
let rnd = 12345;
const rand = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const tiles = [];
for (let r = 0; r < N; r++) for (let f = 0; f < N; f++) {
  const isLight = (r + f) % 2 === 0; // a8 (row 0, file 0) is light
  const left = Math.floor(rand() * (SIZE - SQ)), top = Math.floor(rand() * (SIZE - SQ));
  const input = await sharp(isLight ? light : dark).extract({ left, top, width: SQ, height: SQ }).toBuffer();
  tiles.push({ input, left: f * SQ, top: r * SQ });
}
await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: "#000" } })
  .composite(tiles)
  .webp({ quality: 86 })
  .toFile(new URL("board.webp", OUT).pathname.slice(1));
console.log("wrote board + 12 pieces to", OUT.pathname);
