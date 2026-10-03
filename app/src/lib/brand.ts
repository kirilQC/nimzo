// Nimzo S9 logo: the single source for the React logo components and the
// icon/OG export script (scripts/gen-icons.ts).
// The knight silhouette is based on the Cburnett chess piece set (CC BY-SA 3.0).

export const BRAND = { ink: "#2A231B", brass: "#C9A063" } as const;

export const KNIGHT_SHAPES = `
    <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18"/>
    <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10"/>
    <rect x="12" y="39.6" width="28.5" height="3.2" rx="1"/>
    <circle cx="9" cy="25.5" r="0.6" fill="${BRAND.ink}"/>
    <ellipse cx="14.5" cy="15.5" rx="0.5" ry="1.5" transform="rotate(30 14.5 15.5)" fill="${BRAND.ink}"/>`;

const RINGS = `
  <circle cx="120" cy="120" r="120" fill="${BRAND.ink}"/>
  <circle cx="120" cy="120" r="114" fill="none" stroke="${BRAND.brass}" stroke-width="3"/>
  <circle cx="120" cy="120" r="105" fill="none" stroke="${BRAND.brass}" stroke-width="1"/>`;

/** Small badge: roundel without the arched text, knight scaled to fill the ring. */
export function badgeSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Nimzo">${RINGS}
  <g transform="translate(41,37.3) scale(3.4)" fill="${BRAND.brass}">${KNIGHT_SHAPES}
  </g>
</svg>
`;
}

/** Full logo. Pass pre-outlined text paths for font-independent output. */
export function logoSvg(textMarkup?: string): string {
  const text =
    textMarkup ??
    `<defs><path id="nimzo-arc" d="M 42,120 A 78,78 0 0 1 198,120"/></defs>
  <text font-family="Fraunces, Georgia, serif" font-weight="600" font-size="23" letter-spacing="7" fill="${BRAND.brass}">
    <textPath href="#nimzo-arc" startOffset="50%" text-anchor="middle">NIMZO</textPath>
  </text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Nimzo">${RINGS}
  ${text}
  <g transform="translate(52.6,59.8) scale(2.9)" fill="${BRAND.brass}">${KNIGHT_SHAPES}
  </g>
</svg>
`;
}
