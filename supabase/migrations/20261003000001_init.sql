-- Nimzo initial schema.
-- Every object is prefixed nimzo_ because this Supabase project is shared with other apps.
-- No sign-in: the Next.js server reads and writes with the Supabase secret key,
-- which bypasses RLS. RLS is enabled on every table with no policies, so the
-- public (publishable/anon) key can't read or write anything.

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Taxonomy (seeded from app/src/lib/taxonomy.ts, see next migration)
-- ---------------------------------------------------------------------------
create table public.nimzo_taxonomy_tags (
  id text primary key,
  dimension text not null check (dimension in ('mistake_type', 'phase', 'root_cause', 'motif', 'level')),
  label text not null,
  description text not null,
  sort_order int not null default 0
);

create table public.nimzo_openings (
  eco text not null,
  name text not null,
  pgn text not null,
  uci text,
  epd text,
  primary key (eco, name, pgn)
);
create index nimzo_openings_epd_idx on public.nimzo_openings (epd);

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
create table public.nimzo_settings (
  id boolean primary key default true check (id),
  chesscom_username text,
  ratings jsonb not null default '{}'::jsonb,          -- snapshot from /stats per time class
  ratings_fetched_at timestamptz,
  thresholds jsonb not null default '{"inaccuracy":0.16,"mistake":0.24,"blunder":0.6,"jev_min_confidence":0.6,"engine_depth":16}'::jsonb,
  session_auto_off_minutes int not null default 60,
  maia_default_elo int,
  backfill_months int not null default 3,
  auto_analyze_recent int not null default 20,
  coach_note text,
  coach_note_updated_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.nimzo_settings (id) values (true);

-- chess.com monthly archive cache (ETag / Last-Modified per archive URL)
create table public.nimzo_chesscom_archives (
  url text primary key,
  year int not null,
  month int not null,
  etag text,
  last_modified text,
  last_checked_at timestamptz,
  game_count int not null default 0
);

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create table public.nimzo_sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_activity_at timestamptz not null default now(),
  ended_reason text check (ended_reason in ('manual', 'auto_off', 'tab_closed', 'stale')),
  rating_start int,
  rating_end int,
  summary jsonb,          -- { headline, takeaway, next_step: { motif, label }, stats: {...} }
  summary_model text,
  summarized_at timestamptz
);
create index nimzo_sessions_started_idx on public.nimzo_sessions (started_at desc);

-- ---------------------------------------------------------------------------
-- Games
-- ---------------------------------------------------------------------------
create type public.nimzo_analysis_status as enum ('imported', 'engine_done', 'facts_done', 'tagged', 'reviewed', 'failed');
create type public.nimzo_game_source as enum ('chesscom', 'practice');

create table public.nimzo_games (
  id uuid primary key default gen_random_uuid(),
  source public.nimzo_game_source not null default 'chesscom',
  chesscom_uuid text unique,
  chesscom_url text unique,
  pgn text not null,
  my_color text not null check (my_color in ('white', 'black')),
  opponent text not null,
  opponent_rating int,
  my_rating int,
  result text not null check (result in ('win', 'loss', 'draw')),
  result_detail text,                 -- chess.com result code: checkmated, timeout, resigned, ...
  time_class text,                    -- bullet | blitz | rapid | daily
  time_control text,
  rated boolean,
  end_time timestamptz not null,
  eco text,
  opening_name text,
  accuracy_ours numeric(5, 2),
  accuracy_chesscom numeric(5, 2),
  blunders int,
  mistakes int,
  inaccuracies int,
  analysis_status public.nimzo_analysis_status not null default 'imported',
  analysis_error text,
  analysis_updated_at timestamptz,
  session_id uuid references public.nimzo_sessions (id) on delete set null,
  practice_opponent jsonb,            -- { engine: 'maia'|'stockfish', level }
  created_at timestamptz not null default now()
);
create index nimzo_games_end_time_idx on public.nimzo_games (end_time desc);
create index nimzo_games_session_idx on public.nimzo_games (session_id);
create index nimzo_games_status_idx on public.nimzo_games (analysis_status);

-- ---------------------------------------------------------------------------
-- Per-ply engine output
-- ply 0 = start position (no move); ply n = position after move n
-- ---------------------------------------------------------------------------
create table public.nimzo_positions (
  game_id uuid not null references public.nimzo_games (id) on delete cascade,
  ply int not null,
  fen text not null,
  san text,
  uci text,
  is_mine boolean not null default false,
  eval_cp int,                -- from white's perspective
  eval_mate int,              -- from white's perspective
  win_pct numeric(6, 3),      -- white's win% (0-100)
  clock_ms int,               -- clock left for the mover after this move
  time_spent_ms int,
  classification text check (classification in ('best', 'good', 'inaccuracy', 'mistake', 'blunder')),
  accuracy numeric(5, 2),
  best_move_uci text,         -- best move in the position BEFORE this ply
  best_move_san text,
  pv_san text[],
  multipv jsonb,
  primary key (game_id, ply)
);

-- ---------------------------------------------------------------------------
-- Mistakes (one per flagged move of mine)
-- ---------------------------------------------------------------------------
create table public.nimzo_mistakes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.nimzo_games (id) on delete cascade,
  ply int not null,
  source public.nimzo_game_source not null default 'chesscom',
  classification text not null check (classification in ('inaccuracy', 'mistake', 'blunder')),
  facts jsonb not null,
  detectors jsonb not null default '{}'::jsonb,
  tags jsonb not null default '{}'::jsonb,        -- { field: { value, confidence, source } }
  motifs text[] not null default '{}',            -- confident motif ids (for fast stats)
  mistake_type text,
  root_cause text,
  phase text,
  maia jsonb,                                      -- { elo, p_played, p_best, model }
  explanation text,
  explanation_model text,
  related_lesson_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (game_id, ply)
);
create index nimzo_mistakes_tags_gin on public.nimzo_mistakes using gin (tags);
create index nimzo_mistakes_motifs_gin on public.nimzo_mistakes using gin (motifs);
create index nimzo_mistakes_game_idx on public.nimzo_mistakes (game_id);

create table public.nimzo_game_reviews (
  game_id uuid primary key references public.nimzo_games (id) on delete cascade,
  summary jsonb not null,     -- { key_moment, went_well, work_on }
  model text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Knowledge bank
-- ---------------------------------------------------------------------------
create table public.nimzo_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  filename text not null,
  content_hash text not null,
  page_count int,
  status text not null default 'uploaded' check (status in ('uploaded', 'ingesting', 'done', 'failed')),
  progress jsonb not null default '{}'::jsonb,
  summary jsonb,
  error text,
  uploaded_at timestamptz not null default now(),
  ingested_at timestamptz
);

create table public.nimzo_lessons (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.nimzo_knowledge_documents (id) on delete set null,
  title text not null,
  slug text not null unique,
  category text not null check (category in ('openings', 'tactics', 'middlegame_plans', 'endgames', 'common_blunders', 'beginner_principles')),
  level text,
  page_start int,
  page_end int,
  content_hash text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nimzo_lesson_chunks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.nimzo_lessons (id) on delete cascade,
  chunk_index int not null,
  heading text,
  content text not null,
  content_hash text not null,
  fens text[] not null default '{}',
  tags jsonb not null default '{}'::jsonb,
  motifs text[] not null default '{}',
  phase text,
  mistake_type text,
  level text,
  eco text,
  page_start int,
  page_end int,
  token_count int,
  embedding vector(1024),   -- Voyage voyage-4 family, 1024 dims (unqualified: works whichever schema holds pgvector)
  unique (lesson_id, chunk_index)
);
create index nimzo_lesson_chunks_motifs_gin on public.nimzo_lesson_chunks using gin (motifs);
create index nimzo_lesson_chunks_hash_idx on public.nimzo_lesson_chunks (content_hash);
create index nimzo_lesson_chunks_embedding_idx on public.nimzo_lesson_chunks
  using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Puzzles
-- ---------------------------------------------------------------------------
create table public.nimzo_puzzles (
  id text primary key,                 -- Lichess PuzzleId
  fen text not null,
  moves text[] not null,               -- UCI; first move is the opponent's setup move
  rating int not null,
  rating_deviation int,
  popularity int,
  lichess_themes text[] not null default '{}',
  motifs text[] not null default '{}',
  opening_tags text[] not null default '{}'
);
create index nimzo_puzzles_motifs_gin on public.nimzo_puzzles using gin (motifs);
create index nimzo_puzzles_rating_idx on public.nimzo_puzzles (rating);

create table public.nimzo_puzzle_attempts (
  id uuid primary key default gen_random_uuid(),
  puzzle_id text not null references public.nimzo_puzzles (id) on delete cascade,
  motif text,
  solved boolean not null,
  time_taken_ms int,
  attempted_at timestamptz not null default now()
);
create index nimzo_puzzle_attempts_motif_idx on public.nimzo_puzzle_attempts (motif, attempted_at desc);

-- ---------------------------------------------------------------------------
-- Coach chat
-- ---------------------------------------------------------------------------
create table public.nimzo_chat_threads (
  id uuid primary key default gen_random_uuid(),
  title text,
  game_id uuid references public.nimzo_games (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nimzo_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.nimzo_chat_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null,        -- Anthropic content blocks (text, tool_use, tool_result)
  engine_context jsonb,          -- Stockfish lines the client attached
  model text,
  created_at timestamptz not null default now()
);
create index nimzo_chat_messages_thread_idx on public.nimzo_chat_messages (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- Error log
-- ---------------------------------------------------------------------------
create table public.nimzo_error_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  scope text not null,           -- e.g. 'sync', 'analysis.facts', 'jev', 'claude'
  game_id uuid references public.nimzo_games (id) on delete set null,
  message text not null,
  detail jsonb
);
create index nimzo_error_log_at_idx on public.nimzo_error_log (at desc);

-- ---------------------------------------------------------------------------
-- Pattern stats: motif counts over my last N analyzed games (default 30)
-- ---------------------------------------------------------------------------
create or replace function public.nimzo_pattern_stats(window_games int default 30, include_practice boolean default false)
returns table (motif text, games int, occurrences int)
language sql
stable
set search_path = ''
as $$
  with recent as (
    select g.id
    from public.nimzo_games g
    where g.analysis_status in ('tagged', 'reviewed')
      and (include_practice or g.source = 'chesscom')
    order by g.end_time desc
    limit window_games
  )
  select m_motif as motif,
         count(distinct m.game_id)::int as games,
         count(*)::int as occurrences
  from public.nimzo_mistakes m
  join recent r on r.id = m.game_id
  cross join lateral unnest(m.motifs) as m_motif
  group by m_motif
  order by games desc, occurrences desc;
$$;

-- ---------------------------------------------------------------------------
-- RLS on, no policies: only the server's secret key can access these tables.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'nimzo_taxonomy_tags', 'nimzo_openings', 'nimzo_settings', 'nimzo_chesscom_archives', 'nimzo_sessions', 'nimzo_games', 'nimzo_positions', 'nimzo_mistakes', 'nimzo_game_reviews', 'nimzo_knowledge_documents', 'nimzo_lessons', 'nimzo_lesson_chunks', 'nimzo_puzzles', 'nimzo_puzzle_attempts', 'nimzo_chat_threads', 'nimzo_chat_messages', 'nimzo_error_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Private storage bucket for the knowledge PDF (server uploads with the secret key)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('nimzo-knowledge', 'nimzo-knowledge', false)
on conflict (id) do nothing;
