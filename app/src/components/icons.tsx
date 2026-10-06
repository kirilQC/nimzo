/** Nimzo's small line icons, drawn here in the gold of the theme. */
const PATHS = {
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="8" cy="14.5" r="1" fill="currentColor" />
      <circle cx="12" cy="14.5" r="1" fill="currentColor" />
      <circle cx="16" cy="14.5" r="1" fill="currentColor" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5C6.5 4 9.5 4 12 5.5v14C9.5 18 6.5 18 4 19.5z" />
      <path d="M20 5.5C17.5 4 14.5 4 12 5.5v14c2.5-1.5 5.5-1.5 8 0z" />
    </>
  ),
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  ruler: (
    <>
      <rect x="2" y="8" width="20" height="8" rx="2" />
      <path d="M6 8v3M10 8v4M14 8v3M18 8v4" />
    </>
  ),
  swords: <path d="M4 4l10 10M4 4v4M4 4h4M20 4L10 14M20 4v4M20 4h-4M7 17l-3 3M17 17l3 3M8.5 15.5l-2 2M15.5 15.5l2 2" />,
  stopwatch: <path d="M12 6a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM12 9.5v4.2l2.6 1.6M9.5 2.5h5M12 2.5v3" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className = "text-gold" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {PATHS[name]}
    </svg>
  );
}

/** A section heading with its icon in a soft gold tile. */
export function SectionHead({ icon, title, sub, id }: { icon: IconName; title: string; sub?: string; id?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[rgba(227,195,90,0.12)]">
        <Icon name={icon} size={22} />
      </span>
      <div>
        <h2 id={id} className="text-[1.125rem]">
          {title}
        </h2>
        {sub && <p className="text-[0.8125rem] text-muted">{sub}</p>}
      </div>
    </div>
  );
}
