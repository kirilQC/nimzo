import type { ReactNode } from "react";
import { LABEL_BY_ID, type LabelId } from "@/lib/analysis/labels";

/** Round badge for a move label: coloured disc with a white glyph. Drawn here, no external art. */
export function MoveIcon({ label, size = 20, title }: { label: LabelId; size?: number | string; title?: string }) {
  const l = LABEL_BY_ID[label];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title ?? l.name} className="inline-block shrink-0">
      <title>{title ?? l.name}</title>
      <circle cx="12" cy="12" r="12" fill={l.color} />
      <circle cx="12" cy="12" r="11.25" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />
      <Glyph label={label} />
    </svg>
  );
}

/** Glyphs are drawn as shapes, not text, so they sit dead centre on every system (fonts shift text on Windows). */
function At({ x = 12, s = 1, children }: { x?: number; s?: number; children: ReactNode }) {
  return <g transform={`translate(${x} 12) scale(${s}) translate(-12 -12)`}>{children}</g>;
}

function Bang() {
  return (
    <g fill="#fff">
      <rect x="10.35" y="4.6" width="3.3" height="9.6" rx="1.65" />
      <circle cx="12" cy="18" r="1.85" />
    </g>
  );
}

function Query() {
  return (
    <g>
      <path d="M8.6 8.9a3.4 3.4 0 1 1 5.1 2.9c-1.1.65-1.7 1.3-1.7 2.6v.4" fill="none" stroke="#fff" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="18.2" r="1.85" fill="#fff" />
    </g>
  );
}

function Glyph({ label }: { label: LabelId }) {
  switch (label) {
    case "brilliant":
      return (
        <>
          <At x={8.9} s={0.92}><Bang /></At>
          <At x={15.1} s={0.92}><Bang /></At>
        </>
      );
    case "great":
      return <At s={1.05}><Bang /></At>;
    case "inaccuracy":
      return (
        <>
          <At x={9.3} s={0.85}><Query /></At>
          <At x={16.2} s={0.85}><Bang /></At>
        </>
      );
    case "mistake":
      return <At s={1.05}><Query /></At>;
    case "blunder":
      return (
        <>
          <At x={8.5} s={0.85}><Query /></At>
          <At x={15.5} s={0.85}><Query /></At>
        </>
      );
    case "best": // star
      return <At s={1.12}><path fill="#fff" d="M12 4.9l2.2 4.6 5 .6-3.7 3.5.9 5-4.4-2.4-4.4 2.4.9-5-3.7-3.5 5-.6z" /></At>;
    case "excellent": // thumbs up
      return (
        <At s={1.08}>
          <g fill="#fff" transform="translate(0.3 -0.4)">
            <rect x="5.6" y="10.6" width="3" height="7.6" rx="0.8" />
            <path d="M9.6 10.8l3-4.6c.4-.7 1.6-.5 1.7.4l-.3 3.1h3.6c1 0 1.7.9 1.4 1.8l-1.6 5.4c-.2.8-.9 1.3-1.7 1.3H9.6z" />
          </g>
        </At>
      );
    case "good": // check
      return <path fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" d="M6.6 12.3l3.6 3.6 7.2-7.4" />;
    case "book": // open book
      return (
        <At s={1.1}>
          <g fill="#fff">
            <path d="M11.3 8.1C9.7 7 7.6 6.6 5.4 6.8v9.6c2.2-.2 4.3.2 5.9 1.3z" />
            <path d="M12.7 8.1c1.6-1.1 3.7-1.5 5.9-1.3v9.6c-2.2-.2-4.3.2-5.9 1.3z" />
          </g>
        </At>
      );
    case "miss": // cross
      return <path fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" d="M7.8 7.8l8.4 8.4M16.2 7.8l-8.4 8.4" />;
  }
}
