"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnalysisStatus } from "@/components/analysis/AnalysisProvider";

const LINKS = [
  { href: "/", label: "Analyze", match: (p: string) => p === "/" },
  { href: "/games", label: "My games", match: (p: string) => p.startsWith("/games") },
  { href: "/learn", label: "Learn", match: (p: string) => p.startsWith("/learn") },
  { href: "/sessions", label: "Sessions", match: (p: string) => p.startsWith("/sessions") },
];

export function Nav({ username }: { username: string }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-x-8 gap-y-1 px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5 no-underline" aria-label="Nimzo home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/badge.svg" width={40} height={40} alt="" />
          <span className="serif text-[1.5rem] leading-none">Nimzo</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex gap-1">
            {LINKS.map((l) => {
              const active = l.match(pathname);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-[44px] items-center rounded-[8px] px-3.5 text-[0.9375rem] font-semibold no-underline ${
                      active ? "bg-chip text-ink" : "text-body2 hover:bg-chip/60"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-4 text-[0.8125rem] text-muted">
          <AnalysisStatus />
          <span>
            chess.com · <span className="text-body2">{username}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
