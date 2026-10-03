import { COACH } from "@/lib/coach/persona";

/** Arthur's face, round, with a brass ring that glows while he speaks. */
export function CoachAvatar({ size = 56, speaking = false, className = "" }: { size?: number; speaking?: boolean; className?: string }) {
  return (
    <span
      className={`relative inline-block shrink-0 rounded-full ${speaking ? "arthur-speaking" : ""} ${className}`}
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
