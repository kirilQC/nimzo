"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnalysisStatus } from "@/components/analysis/AnalysisProvider";

const LINKS = [
  { href: "/", label: "Analyze", match: (p: string) => p === "/" },
  { href: "/games", label: "My games", match: (p: string) => p.startsWith("/games") },
  { href: "/profile", label: "Profile", match: (p: string) => p.startsWith("/profile") },
  { href: "/learn", label: "Learn", match: (p: string) => p.startsWith("/learn") },
  { href: "/sessions", label: "Sessions", match: (p: string) => p.startsWith("/sessions") },
];

/** Club style header: tabs either side of the round Nimzo badge, a gold double rule underneath. */
export function Nav({ username }: { username: string }) {
  const pathname = usePathname();
  const link = (l: (typeof LINKS)[number]) => {
    const active = l.match(pathname);
    return (
      <li key={l.href}>
        <Link
          href={l.href}
          aria-current={active ? "page" : undefined}
          className={`inline-flex min-h-[44px] items-center border-b font-[family-name:var(--font-nav)] text-[0.8125rem] font-bold uppercase tracking-[0.18em] no-underline transition-colors ${
            active ? "border-gold text-gold" : "border-transparent text-[color:var(--nav-muted)] hover:text-ink"
          }`}
        >
          {l.label}
        </Link>
      </li>
    );
  };
  return (
    <header className="relative z-10 px-6 pt-4 lg:px-10">
      <nav aria-label="Main" className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-center gap-x-8 gap-y-1">
        <ul className="flex gap-x-8">{LINKS.slice(0, 2).map(link)}</ul>
        <Link href="/" aria-label="Nimzo home" className="mx-3 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" width={72} height={72} alt="" className="h-[72px] w-[72px]" />
        </Link>
        <ul className="flex gap-x-8">{LINKS.slice(2).map(link)}</ul>
      </nav>
      <div className="absolute right-6 top-5 hidden items-center gap-4 text-[0.8125rem] text-muted lg:right-10 xl:flex">
        <AnalysisStatus />
        <span>
          chess.com · <span className="text-body2">{username}</span>
        </span>
      </div>
      <div className="mx-auto mt-3 h-[5px] max-w-[1600px] border-y border-[color:var(--gold-rule)]" aria-hidden="true" />
    </header>
  );
}
