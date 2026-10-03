import { LABEL_BY_ID, type LabelId } from "@/lib/analysis/labels";

/** Round badge for a move label: coloured disc with a white glyph. Drawn here, no external art. */
export function MoveIcon({ label, size = 20, title }: { label: LabelId; size?: number; title?: string }) {
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

function Text({ children, size = 13 }: { children: string; size?: number }) {
  return (
    <text x="12" y="12.5" textAnchor="middle" dominantBaseline="central" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize={size} fill="#fff" letterSpacing="-0.5">
      {children}
    </text>
  );
}

function Glyph({ label }: { label: LabelId }) {
  switch (label) {
    case "brilliant":
      return <Text size={12}>!!</Text>;
    case "great":
      return <Text size={14}>!</Text>;
    case "inaccuracy":
      return <Text size={11}>?!</Text>;
    case "mistake":
      return <Text size={14}>?</Text>;
    case "blunder":
      return <Text size={11}>??</Text>;
    case "best": // star
      return <path fill="#fff" d="M12 4.6l2.2 4.6 5 .6-3.7 3.5.9 5-4.4-2.4-4.4 2.4.9-5-3.7-3.5 5-.6z" />;
    case "excellent": // thumbs up
      return (
        <g fill="#fff">
          <rect x="5.6" y="10.6" width="3" height="7.6" rx="0.8" />
          <path d="M9.6 10.8l3-4.6c.4-.7 1.6-.5 1.7.4l-.3 3.1h3.6c1 0 1.7.9 1.4 1.8l-1.6 5.4c-.2.8-.9 1.3-1.7 1.3H9.6z" />
        </g>
      );
    case "good": // check
      return <path fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M6.8 12.4l3.4 3.4 7-7.2" />;
    case "book": // open book
      return (
        <g fill="#fff">
          <path d="M11.3 8.1C9.7 7 7.6 6.6 5.4 6.8v9.6c2.2-.2 4.3.2 5.9 1.3z" />
          <path d="M12.7 8.1c1.6-1.1 3.7-1.5 5.9-1.3v9.6c-2.2-.2-4.3.2-5.9 1.3z" />
        </g>
      );
    case "miss": // cross
      return <path fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" d="M8 8l8 8M16 8l-8 8" />;
  }
}
