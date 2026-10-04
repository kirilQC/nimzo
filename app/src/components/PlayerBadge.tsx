/* eslint-disable @next/next/no-img-element -- remote chess.com avatars and small flag images, sized here */

/** chess.com country codes that aren't ISO countries, mapped to flagcdn's subdivision flags. */
const SPECIAL: Record<string, string> = { XE: "gb-eng", XS: "gb-sct", XW: "gb-wls" };

function flagSlug(code: string | null | undefined): string | null {
  if (!code) return null;
  if (SPECIAL[code]) return SPECIAL[code];
  if (/^[A-Z]{2}$/.test(code) && !code.startsWith("X")) return code.toLowerCase();
  return null; // XX International and other chess.com-only regions: no flag
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** A country flag image (Windows doesn't draw flag emoji). */
export function Flag({ code, size = 16 }: { code: string | null | undefined; size?: number }) {
  const slug = flagSlug(code);
  if (!slug) return null;
  const name = countryName(code!);
  return (
    <img
      src={`https://flagcdn.com/w20/${slug}.png`}
      srcSet={`https://flagcdn.com/w40/${slug}.png 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt={name}
      title={name}
      loading="lazy"
      className="inline-block shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
    />
  );
}

/** The player's chess.com avatar, or a pawn when they haven't set one. */
export function Avatar({ src, name, size = 28 }: { src: string | null | undefined; name: string; size?: number }) {
  if (!src)
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded-[4px] bg-chip text-muted" style={{ width: size, height: size }} aria-hidden="true">
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3a3.2 3.2 0 0 0-2.2 5.5A4.6 4.6 0 0 0 8.4 13c-1.9.9-3.1 3.3-3.1 6.5h13.4c0-3.2-1.2-5.6-3.1-6.5a4.6 4.6 0 0 0-1.4-4.5A3.2 3.2 0 0 0 12 3z" />
        </svg>
      </span>
    );
  return <img src={src} width={size} height={size} alt="" title={name} loading="lazy" referrerPolicy="no-referrer" className="inline-block shrink-0 rounded-[4px] object-cover" />;
}

export type PlayerLook = { avatar_url?: string | null; country_code?: string | null; title?: string | null };

/** Avatar, title, name, rating and flag, the way chess.com lists a player. */
export function PlayerBadge({ name, rating, look, size = 28, bold = true }: { name: string; rating?: number | null; look?: PlayerLook; size?: number; bold?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 align-middle">
      <Avatar src={look?.avatar_url} name={name} size={size} />
      {look?.title && <span className="shrink-0 rounded-[3px] bg-[#7c2d22] px-1 text-[0.6875rem] font-bold leading-[1.35] text-white">{look.title}</span>}
      <span className={`truncate ${bold ? "font-semibold text-ink" : "text-body2"}`}>{name}</span>
      {rating !== undefined && rating !== null && <span className="shrink-0 text-muted">({rating})</span>}
      <Flag code={look?.country_code} />
    </span>
  );
}
