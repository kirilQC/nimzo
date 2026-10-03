import { MiniBoard } from "@/components/board/MiniBoard";
import { LESSON_CATEGORIES } from "@/lib/taxonomy";

const MAIA_LEVELS = [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900];

// Shown in the drill card until real puzzles are imported (a quiet middlegame, no claims attached).
const DRILL_PREVIEW_FEN = "5rk1/pp3ppp/2n1b3/3p4/3P4/2N1B3/PP3PPP/5RK1 w - - 0 20";

export function LearnView({ counts }: { counts: Map<string, number> }) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="rec-h">
        <h1 id="rec-h" className="text-[2rem]">
          Recommended for you
        </h1>
        <p className="mb-4 mt-1 text-sm text-body2">Picked from the mistakes that keep showing up in your games.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {["Lesson", "Lesson", "Habit"].map((kind, i) => (
            <article key={i} className="card flex min-h-[150px] flex-col">
              <p className="eyebrow mb-1.5">{kind}</p>
              <h2 className="text-[1.125rem] text-muted">Waiting for your games</h2>
              <p className="mt-2 text-sm text-muted">
                Picked from your weakest tags once a few games are analyzed, with the reason it was chosen.
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-dark flex items-center gap-5 p-5" aria-labelledby="drill-h">
          <div className="w-[150px] shrink-0">
            <MiniBoard fen={DRILL_PREVIEW_FEN} />
          </div>
          <div>
            <p className="eyebrow mb-1.5">Puzzle drill</p>
            <h2 id="drill-h" className="text-[1.375rem] leading-tight">
              Ten puzzles on your weakest pattern
            </h2>
            <p className="mt-1.5 text-sm text-panel-text-2">10 puzzles · tagged to your weakest pattern</p>
            <button type="button" className="btn btn-light mt-4" disabled>
              Start drill
            </button>
          </div>
        </section>

        <section className="card p-5" aria-labelledby="practice-h">
          <p className="eyebrow mb-1.5">Practice mode</p>
          <h2 id="practice-h" className="text-[1.25rem] leading-tight">
            Play the engine with a coach at your shoulder
          </h2>
          <p className="mt-2 text-sm text-body2">
            Maia plays like a human at the level you choose. The coach flags blunders the moment you make them. Practice
            games here, never on chess.com.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label htmlFor="maia-level" className="sr-only">
              Opponent level
            </label>
            <select id="maia-level" className="select" defaultValue={1100} disabled>
              {MAIA_LEVELS.map((l) => (
                <option key={l} value={l}>
                  Maia {l}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" disabled>
              New practice game
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-labelledby="library-h" className="min-w-0">
          <h2 id="library-h" className="section-title">
            Lesson library
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {LESSON_CATEGORIES.map((c) => {
              const n = counts.get(c.id) ?? 0;
              return (
                <li key={c.id} className="card p-4">
                  <h3 className="font-sans text-[0.9375rem] font-semibold">{c.label}</h3>
                  <p className="mt-0.5 text-[0.8125rem] text-body2">{c.description}</p>
                  <p className="mono mt-2 text-[0.8125rem] text-ink">
                    {n} {n === 1 ? "lesson" : "lessons"}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="ask-h" className="min-w-0">
          <h2 id="ask-h" className="section-title">
            Ask the coach
          </h2>
          <div className="card p-4">
            <p className="serif text-[0.9375rem] leading-relaxed text-body2">
              Ask about your openings, a plan, or a specific game. The coach answers from your own games, lessons and
              engine lines.
            </p>
            <form className="mt-4">
              <label htmlFor="ask-learn" className="sr-only">
                Ask the coach
              </label>
              <input id="ask-learn" className="input" placeholder="Ask about openings, plans, your games" disabled />
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
