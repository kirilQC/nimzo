import type { ReactNode } from "react";

export type Severity = "blunder" | "miss" | "mistake" | "inaccuracy";

const SEVERITY_LABEL: Record<Severity, string> = { blunder: "Blunder", miss: "Miss", mistake: "Mistake", inaccuracy: "Inaccuracy" };

export function severityText(severity: Severity, count: number): string {
  const word =
    severity === "inaccuracy" ? (count === 1 ? "inaccuracy" : "inaccuracies") : severity === "miss" ? (count === 1 ? "miss" : "misses") : `${severity}${count === 1 ? "" : "s"}`;
  return `${count} ${word}`;
}

export function SeverityChip({ severity, count }: { severity: Severity; count?: number }) {
  const text = count !== undefined ? severityText(severity, count) : SEVERITY_LABEL[severity];
  return <span className={`chip chip-${severity}`}>{text}</span>;
}

/** "1 blunder · 2 mistakes" style summary, or null when clean. */
export function flagsSummary(f: { blunders?: number | null; misses?: number | null; mistakes?: number | null; inaccuracies?: number | null }): string | null {
  const parts: string[] = [];
  if (f.blunders) parts.push(severityText("blunder", f.blunders));
  if (f.misses) parts.push(severityText("miss", f.misses));
  if (f.mistakes) parts.push(severityText("mistake", f.mistakes));
  if (!f.blunders && !f.mistakes && f.inaccuracies) parts.push(severityText("inaccuracy", f.inaccuracies));
  return parts.length ? parts.join(" · ") : null;
}

export function Card({ children, className = "", as: As = "section", ...rest }: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={`card ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, eyebrow, action, id }: { title: string; eyebrow?: string; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 id={id}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-dashed border-line px-4 py-8 text-center">
      <p className="font-semibold text-body2">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="mt-1 text-body2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mono mt-1 text-2xl text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
    </div>
  );
}
