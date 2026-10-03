import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { flagsSummary } from "@/components/ui";
import { ClockBuckets } from "@/components/sessions/ClockBuckets";
import { SummaryWriter } from "@/components/sessions/SummaryWriter";
import { CoachAvatar } from "@/components/coach/CoachAvatar";
import { SpeakButton } from "@/components/coach/SpeakButton";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Session summary" };

type Summary = {
  headline?: string;
  takeaway?: string;
  next_step?: { label: string; href: string };
  stats?: {
    wins: number;
    losses: number;
    draws: number;
    blunders: number;
    avg_accuracy: number | null;
    rating_change: number | null;
  };
  clock_buckets?: { bucket: string; blunders: number }[];
};

type SessionGame = {
  id: string;
  opponent: string;
  result: "win" | "loss" | "draw";
  opening_name: string | null;
  blunders: number | null;
  mistakes: number | null;
  inaccuracies: number | null;
};

const EMPTY_BUCKETS = [
  { bucket: "5 min +", blunders: 0 },
  { bucket: "2–5 min", blunders: 0 },
  { bucket: "1–2 min", blunders: 0 },
  { bucket: "Under 1 min", blunders: 0 },
];

const RESULT_TEXT = { win: "Win", loss: "Loss", draw: "Draw" } as const;

function minutesBetween(a: string, b: string | null): number | null {
  return b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000) : null;
}

export default async function SessionPage({ params }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  let eyebrow = "Session summary · Sample";
  let summary: Summary = {};
  let games: SessionGame[] = [];

  if (id !== "sample") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const db = await getDb();
    const { data } = await db.from(T.sessions).select("started_at, ended_at, summary").eq("id", id).maybeSingle();
    if (!data) notFound();
    summary = (data.summary ?? {}) as Summary;
    const mins = minutesBetween(data.started_at, data.ended_at);
    eyebrow = ["Session summary", formatDate(data.started_at, { month: "short", day: "numeric", year: "numeric" }), mins !== null ? `${mins} min` : "In progress"].join(" · ");
    const { data: g } = await db
      .from(T.games)
      .select("id, opponent, result, opening_name, blunders, mistakes, inaccuracies")
      .eq("session_id", id)
      .order("end_time", { ascending: true });
    games = (g ?? []) as SessionGame[];
  }

  const s = summary.stats;
  const tiles = [
    { label: "Wins – losses", value: s ? `${s.wins} – ${s.losses}` : "—" },
    { label: "Blunders", value: s ? String(s.blunders) : "—" },
    { label: "Average accuracy", value: s?.avg_accuracy != null ? s.avg_accuracy.toFixed(1) : "—" },
    { label: "Rating change", value: s?.rating_change != null ? `${s.rating_change > 0 ? "+" : ""}${s.rating_change}` : "—" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow mb-1">{eyebrow}</p>
        {id !== "sample" && <SummaryWriter sessionId={id} hasSummary={!!summary.headline} hasGames={games.length > 0} />}
      </div>
      <h1 className="mb-5 text-[2rem]">{summary.headline ?? "Your session headline appears here once the session ends."}</h1>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card px-4 py-3">
            <p className="serif text-[1.625rem] leading-tight">{t.value}</p>
            <p className="text-[0.8125rem] text-body2">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
        <section className="card-dark flex flex-col p-6" aria-labelledby="takeaway-h">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CoachAvatar size={44} />
              <h2 id="takeaway-h" className="eyebrow">
                Coach&apos;s takeaway
              </h2>
            </div>
            {summary.takeaway && <SpeakButton text={summary.takeaway} />}
          </div>
          <p className="serif text-[1.1875rem] leading-relaxed text-panel-text">
            {summary.takeaway ?? "After the session ends, the coach writes a short paragraph here about what decided your games."}
          </p>
          {summary.next_step && (
            <Link href={summary.next_step.href} className="arrow-link mt-4">
              {summary.next_step.label} →
            </Link>
          )}
        </section>
        <section className="card" aria-labelledby="clock-h">
          <h2 id="clock-h" className="mb-4 font-sans text-sm font-semibold">
            Blunders by time left on your clock
          </h2>
          <ClockBuckets buckets={summary.clock_buckets ?? EMPTY_BUCKETS} />
        </section>
      </div>

      <section aria-labelledby="games-h">
        <h2 id="games-h" className="section-title">
          Games this session
        </h2>
        {games.length ? (
          <div className="card table-scroll p-0">
            <table className="table">
              <caption className="sr-only">Games this session</caption>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td className="font-semibold text-ink">
                      {RESULT_TEXT[g.result]} vs {g.opponent}
                    </td>
                    <td className="text-walnut">{g.opening_name ?? "—"}</td>
                    <td className="text-body2">{flagsSummary(g) ?? "Clean"}</td>
                    <td className="text-right">
                      <Link href={`/games/${g.id}`} className="arrow-link">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-sm text-muted">Games you finish while Session mode is on appear here.</div>
        )}
      </section>
    </div>
  );
}
