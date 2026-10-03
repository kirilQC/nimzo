import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import { getSessions } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Sessions" };

function duration(start: string, end: string | null): string {
  if (!end) return "In progress";
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export default async function SessionsPage() {
  const sessions = await getSessions();
  return (
    <div>
      <PageHeader title="Sessions" subtitle="Each time you play with Session mode on, Nimzo writes a summary." />
      {sessions.length ? (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/sessions/${s.id}`}
                className="card flex flex-wrap items-center justify-between gap-3 no-underline hover:border-walnut"
              >
                <div>
                  <p className="font-semibold text-ink">{formatDateTime(s.started_at)}</p>
                  <p className="serif mt-0.5 text-body2">{s.summary?.headline ?? "Summary not written yet"}</p>
                </div>
                <span className="mono text-sm text-muted">{duration(s.started_at, s.ended_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card">
          <EmptyState title="No sessions yet">
            Turn on Session mode on the Analyze page before you play.{" "}
            <Link href="/sessions/sample" className="link">
              See a sample summary layout
            </Link>
          </EmptyState>
        </div>
      )}
    </div>
  );
}
