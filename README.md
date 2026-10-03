# Nimzo

A personal chess coach. Nimzo pulls finished games from chess.com, analyzes every move with engines, tags mistakes with one shared taxonomy, and coaches in plain English. A Learn side uses the same tags for lessons, puzzles and practice.

**Fair play:** Nimzo never assists during a live chess.com game. It only reads finished games from chess.com's public API. Live blunder feedback exists only in Nimzo's own Practice mode, against Nimzo's own engine.

## Repo layout

| Path | What |
|---|---|
| `app/` | Next.js 16 web app (App Router, TypeScript strict), deployed to Vercel |
| `engine/` | Maia service (Python, FastAPI, Docker), deployed to Render *(Phase 4)* |
| `scripts/` | Local scripts: icon export, taxonomy seed, PDF ingestion, Lichess imports |
| `supabase/migrations/` | SQL schema, RLS, taxonomy seed |

## Build status

- [x] **Phase 1: Foundation.** Schema and migrations, no sign-in (server-only database access), design tokens, layout, nav and logo, the four screens (matched to the mockups) with empty states
- [x] **Phase 2: chess.com sync and Session mode.** Serial chess.com client (User-Agent, ETag/Last-Modified, month rollover), 3-month backfill, Recent games, Session mode with 60s polling, auto-off and resume-on-refresh
- [ ] Phase 3: Stockfish WASM analysis, review board, eval graph
- [ ] Phase 4: Facts, Jev, Maia, recurring patterns
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
| `ENGINE_URL` / `ENGINE_SHARED_SECRET` | Phase 4 | Render Maia service |

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

## Tests

```bash
cd app
npm test          # Vitest
npm run typecheck
npm run lint
```

## Deploying

**Vercel:** Add New → Project → import the `nimzo` GitHub repo. Set **Root Directory** to `app` (framework preset Next.js is detected). Add the env vars above for Production, then Deploy. Every push to `main` redeploys.

**Render:** covered in Phase 4.

## Credits

- The knight in the Nimzo logo is based on the "Cburnett" chess pieces by Colin M.L. Burnett (CC BY-SA 3.0, via Wikimedia Commons).
- The arched logo text uses Fraunces (SIL Open Font License).
- Lichess puzzle and openings datasets (CC0) *(Phase 6)*.
