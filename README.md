# Nimzo

A personal chess coach. Nimzo pulls finished games from chess.com, analyzes every move with engines, tags mistakes with one shared taxonomy, and coaches in plain English. A Learn side uses the same tags for lessons, puzzles and practice.

**Fair play:** Nimzo never assists during a live chess.com game. It only reads finished games from chess.com's public API. Live blunder feedback exists only in Nimzo's own Practice mode, against Nimzo's own engine.

## Repo layout

| Path | What |
|---|---|
| `app/` | Next.js 16 web app (App Router, TypeScript strict), deployed to Vercel |
| `scripts/` | Local scripts: icon export, taxonomy seed, PDF ingestion, Lichess imports |
| `supabase/migrations/` | SQL schema, RLS, taxonomy seed |

## Build status

- [x] **Phase 1: Foundation.** Schema and migrations, no sign-in (server-only database access), design tokens, layout, nav and logo, the four screens (matched to the mockups) with empty states
- [x] **Phase 2: chess.com sync and Session mode.** Serial chess.com client (User-Agent, ETag/Last-Modified, month rollover), 3-month backfill, Recent games, Session mode with 60s polling, auto-off and resume-on-refresh
- [x] **Phase 3: Engine analysis.** Stockfish 19 lite (WASM, single-threaded, Web Worker) in the browser; Lichess win%, thresholds and accuracy; resumable per-game status; review board, eval graph, move list; auto-analysis of recent games and an "Analyze backlog" queue
- [x] **Phase 4: Facts, Jev, Maia, patterns.** Deterministic facts + tactical detectors; Maia 3 in the browser (ONNX, no server); Jev via OpenRouter with a Claude fallback; tags with confidence on the review card; Recurring patterns on Home
- [ ] Phase 5: Claude coaching
- [ ] Phase 6: Knowledge bank, puzzles, openings, coach chat
- [ ] Phase 7: Practice mode and polish

## Setup

Requirements: Node 22.6+ (scripts run TypeScript natively; developed on Node 24) and a Supabase project. Desktop browser only; phone layouts are not a goal.

```bash
cd app
npm install
cp .env.example .env.local   # fill in values, see below
npm run dev
```

### Environment variables (`app/.env.local`, and in Vercel)

| Var | Needed from | Notes |
|---|---|---|
| `CHESSCOM_USERNAME` | Phase 1 | Shown in the nav; used for sync |
| `CONTACT_EMAIL` | Phase 1 | Goes in the chess.com `User-Agent` |
| `NEXT_PUBLIC_SUPABASE_URL` | Phase 1 | Supabase → Project Settings → Data API |
| `SUPABASE_SECRET_KEY` | Phase 1 | `sb_secret_…`, server only; all database access goes through it (legacy `SUPABASE_SERVICE_ROLE_KEY` also works) |
| `ANTHROPIC_API_KEY` | Phase 5 | Claude, the coach |
| `CLAUDE_MODEL_COACH` / `CLAUDE_MODEL_REVIEW` | Phase 5 | Default `claude-opus-5-5` |
| `OPENROUTER_API_KEY` | Phase 4 | Jev is called through OpenRouter's Decisions API (`POST https://openrouter.ai/api/alpha/decisions`) |
| `JEV_MODEL` | Phase 4 | Default `typesafe/jev-1.13` |
| `VOYAGE_API_KEY` | Phase 6 | Embeddings: `voyage-4`, 1024 dims |

### Supabase

1. Create a project.
2. Open **SQL Editor**, paste the whole of [`supabase/setup.sql`](supabase/setup.sql) and click **Run**. It creates every table (RLS on, no policies), the taxonomy seed and the private `knowledge` storage bucket. (It's the migrations in `supabase/migrations/` concatenated; regenerate with `npm --prefix scripts run gen:setup-sql`.)
**No sign-in.** Nimzo has no login. The Next.js server talks to Supabase with the secret key; the browser never talks to Supabase directly. RLS is enabled on every table with no policies, so the public key can't read anything. Anyone who has the site URL can use the app, so keep the URL private, or turn on Vercel's Deployment Protection if you want a password in front of it.

### Taxonomy

`app/src/lib/taxonomy.ts` is the single source of truth. After editing it, regenerate the seed migration with `npm run gen:taxonomy` (from `app/`). A unit test fails if they drift. DB ids are namespaced (`motif:back_rank`, `phase:opening`) because `opening` is both a mistake type and a phase.

### Icons

`npm run gen:icons` (from `app/`) exports the favicon set (`favicon.ico`, `icon.svg`, `apple-icon.png`, 32/192/512 PNGs), the logo with the arched text converted to outlines, and the OG image, all from `app/src/lib/brand.ts`.

## How sync and Session mode work

**Fair play:** Nimzo only reads *finished* games from chess.com's public monthly archives (`/pub/player/{user}/games/{YYYY}/{MM}`). It never reads a live board or gives feedback during a chess.com game.

- **First visit:** Home imports the last `backfill_months` (default 3) of games from the archive list. Months with no games are skipped.
- **Every sync** (`POST /api/sync`) checks the current month's archive with `If-None-Match` / `If-Modified-Since`, so an unchanged archive costs one 304. Last month is also checked during the first 3 days of a month, or if it was never checked after it ended. Requests to chess.com are strictly serial.
- **Dedupe** is on the chess.com game `uuid`, falling back to its URL. Only `rules === "chess"` is imported; every time class is stored, and lists default to rapid and blitz.
- **Session mode on:** creates a `nimzo_sessions` row, pings the Render engine's `/health` (when `ENGINE_URL` is set), then polls `/api/sync` every 60 s while the tab is open. Games that end after the session started are attached to it and listed under "This session".
- **Off:** the toggle ends the session; "End session & summarize" ends it and opens its summary page (the written summary arrives in Phase 5). It turns itself off after `session_auto_off_minutes` (default 60) without a new game.
- **Closed tab = off.** The row stays open so it can still be ended and summarized on your next visit. A refresh within ~2.5 minutes resumes the session instead.
- **Analyze my last game** syncs, then opens your most recent game.
- Ratings from `/stats` are refreshed at most hourly into `nimzo_settings.ratings`.

## How analysis works (Phase 3)

- Stockfish 19 **lite single-threaded** WASM runs in a Web Worker in your browser (`app/public/engine/`, GPLv3, unmodified from the `stockfish` npm package v19.0.0). Single-threaded means no cross-origin isolation headers are needed.
- While any Nimzo tab is open, a queue analyzes one game at a time: new Session games first, then the game you're viewing, then the 20 most recent unanalyzed games (`auto_analyze_recent`). **Analyze backlog** queues the rest. The nav shows progress.
- Each position is searched at depth 16 (`thresholds.engine_depth`) with MultiPV 1; the position before each of your flagged moves is re-searched with MultiPV 3. Lines are kept to 8 plies.
- The browser posts raw engine output to `POST /api/games/[id]/engine`. The server recomputes everything deterministically (`lib/analysis/math.ts`): Lichess win% (cp clamped to ±1000, mate = ±1000), drops on the winning-chances scale (blunder ≥ 0.3, mistake ≥ 0.2, inaccuracy ≥ 0.1, all in `nimzo_settings.thresholds`), missed mates as blunders, and Lichess per-move accuracy averaged over your moves. PVs are converted to SAN with chess.js and cut at the first illegal move.
- Status per game: `imported → engine_done` (later phases add `facts_done → tagged → reviewed`), or `failed` with the error, shown with a **Retry analysis** button. Errors go to `nimzo_error_log`.
- `RUN_ENGINE=1 npx vitest run src/lib/analysis/engine.integration.test.ts` runs the same engine under Node against the fixtures.

## Facts, Maia and Jev (Phase 4)

- **Facts** (`lib/analysis/facts.ts`, server, deterministic): for each of your flagged moves, the move, FENs, evals and win%, the engine's best move and line, the opponent's best reply (the punishment), clocks, material and the previous moves, plus strict chess.js detectors (`lib/analysis/detectors.ts`): hanging piece (and after a capture), allowed/missed fork, back-rank mate, missed mate, mate threat, punishment captures the moved piece. This JSON is the only thing the language models see.
- **Maia 3** runs **in the browser**, not on a server: the official ONNX export from the Maia team (CSSLab/maia-platform-frontend, GPLv3) is served from `app/public/maia/` (45 MB, cached by the browser after the first load) and run with onnxruntime-web on WebAssembly. Rating defaults to 1000 (`nimzo_settings.maia_default_elo`). It yields "about N in 10 players at your level play this move". **No Render service is needed.**
- **Jev** (`lib/classifier/jev.ts`) is called through OpenRouter's Decisions API (`OPENROUTER_API_KEY`, model `JEV_MODEL`). One request per mistake asks small independent questions: mistake type, phase and root cause as choices, and one yes/no per motif. Yes/no confidence = distance from 50/50. Below `thresholds.jev_min_confidence` (0.6) a label shows as "unclear" and is left out of pattern stats. If Jev errors, Claude (`CLAUDE_MODEL_REVIEW`) classifies with a strict JSON schema, marked `source: "fallback"`. A detector that fires always overrides the classifier, and the deterministic phase wins; the classifier's original answers are kept in `tags.overridden`.
- Pipeline per game, driven by the browser queue and resumable from the stored status: `imported → engine_done → facts_done → (Maia) → tagged`. `reviewed` comes with Claude coaching in Phase 5.

## Tests

```bash
cd app
npm test          # Vitest
npm run typecheck
npm run lint
```

## Deploying

**Vercel:** Add New → Project → import the `nimzo` GitHub repo. Set **Root Directory** to `app` (framework preset Next.js is detected). Add the env vars above for Production, then Deploy. Every push to `main` redeploys.

## Credits

- Maia 3 by the CSSLab at the University of Toronto (model and browser encoding from CSSLab/maia-platform-frontend, GPLv3).
- Stockfish (GPLv3) via stockfish.js by Nathan Rugg / Chess.com: https://github.com/nmrugg/stockfish.js

- The knight in the Nimzo logo is based on the "Cburnett" chess pieces by Colin M.L. Burnett (CC BY-SA 3.0, via Wikimedia Commons).
- The arched logo text uses Fraunces (SIL Open Font License).
- Lichess puzzle and openings datasets (CC0) *(Phase 6)*.
