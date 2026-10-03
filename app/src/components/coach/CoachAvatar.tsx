import { COACH } from "@/lib/coach/persona";

/**
 * The Nimzo coach: an older club player in a tweed cap and jacket, drawn in
 * the app palette (walnut, brass, parchment). Pure SVG, scales to any size.
 */
export function CoachAvatar({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${COACH.name}, your coach`}
      className={`shrink-0 ${className}`}
    >
      <defs>
        <clipPath id="coach-clip">
          <circle cx="60" cy="60" r="57" />
        </clipPath>
        <pattern id="tweed" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#6E4A2C" />
          <path d="M0 0h3v3H0zM3 3h3v3H3z" fill="#7C5636" />
        </pattern>
      </defs>

      <circle cx="60" cy="60" r="60" fill="#2A231B" />
      <circle cx="60" cy="60" r="57" fill="#EADFCB" />
      <g clipPath="url(#coach-clip)">
        {/* jacket and shoulders */}
        <path d="M14 120c2-22 18-33 46-33s44 11 46 33z" fill="url(#tweed)" />
        <path d="M44 88l16 20 16-20-6-3-10 8-10-8z" fill="#F5EFE3" />
        {/* knitted tie */}
        <path d="M56 93h8l-1.5 5 2.5 22h-10l2.5-22z" fill="#9E2B25" />
        {/* lapels */}
        <path d="M44 88l12 26-14-10 2-16zM76 88l-12 26 14-10-2-16z" fill="#5C3D24" />
        {/* neck */}
        <path d="M51 76h18v12l-9 6-9-6z" fill="#D9A981" />
        {/* ears */}
        <ellipse cx="36.5" cy="58" rx="4.5" ry="7" fill="#E2B790" />
        <ellipse cx="83.5" cy="58" rx="4.5" ry="7" fill="#E2B790" />
        {/* face */}
        <path d="M38 52c0-15 10-24 22-24s22 9 22 24v8c0 13-9 23-22 23S38 73 38 60z" fill="#EBC59D" />
        {/* grey side hair */}
        <path d="M38 50c-1 4-1 10 1 14l3-2v-12zM82 50c1 4 1 10-1 14l-3-2v-12z" fill="#C8C2B6" />
        {/* tweed flat cap */}
        <path d="M34 47c1-15 12-23 27-23 14 0 24 7 26 19l2 5c-8-3-20-5-33-5-9 0-16 1-22 4z" fill="#7A5634" />
        <path d="M33 48c8-4 18-6 29-6 11 0 21 2 29 6-2 3-7 4-12 4-6-1-11-2-17-2-9 0-18 1-29 1z" fill="#5C3D24" />
        <path d="M46 30c6-3 12-4 18-3" stroke="#C9A063" strokeWidth="1.2" fill="none" opacity="0.7" />
        {/* eyebrows */}
        <path d="M44 56c3-2 7-2 10-1M66 55c3-1 7-1 10 1" stroke="#B9B2A6" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        {/* round brass glasses */}
        <circle cx="50" cy="62" r="6.5" fill="#F5EFE3" fillOpacity="0.35" stroke="#C9A063" strokeWidth="1.8" />
        <circle cx="70" cy="62" r="6.5" fill="#F5EFE3" fillOpacity="0.35" stroke="#C9A063" strokeWidth="1.8" />
        <path d="M56.5 62h7" stroke="#C9A063" strokeWidth="1.6" />
        {/* friendly eyes */}
        <path d="M47 63c1.6-1.6 4.4-1.6 6 0M67 63c1.6-1.6 4.4-1.6 6 0" stroke="#2A231B" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        {/* nose */}
        <path d="M60 64c-1.5 4-2 6-0.5 7.5 1 .8 2.5.8 3.5.3" stroke="#C99A72" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        {/* moustache and smile */}
        <path d="M49 74c4-3 8-3 11-1.5 3-1.5 7-1.5 11 1.5-3 3-7 3.5-11 1.8-4 1.7-8 1.2-11-1.8z" fill="#D9D3C8" />
        <path d="M55 78.5c3 1.6 7 1.6 10 0" stroke="#A86B4E" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        {/* cheeks */}
        <circle cx="45" cy="70" r="3.2" fill="#D98F72" opacity="0.35" />
        <circle cx="75" cy="70" r="3.2" fill="#D98F72" opacity="0.35" />
      </g>
      <circle cx="60" cy="60" r="57" fill="none" stroke="#C9A063" strokeWidth="2" />
    </svg>
  );
}
