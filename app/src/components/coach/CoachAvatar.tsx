import { COACH } from "@/lib/coach/persona";

/** Arthur's face, round, in a brass ring. */
export function CoachAvatar({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-block shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/arthur-face.webp"
        width={size}
        height={size}
        alt={`${COACH.name}, your coach`}
        className="h-full w-full rounded-full border-2 border-brass object-cover"
      />
    </span>
  );
}
