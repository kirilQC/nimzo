-- The player model: computed statistics over every analyzed game, Arthur's
-- written profile built from them, and the short "memory" Arthur carries into
-- every conversation. One row per rebuild, so progress can be compared over time.
create table if not exists public.nimzo_player_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  time_class text not null default 'rapid',
  games_analyzed int not null,
  period_from timestamptz,
  period_to timestamptz,
  stats jsonb not null,                -- every number the profile shows (lib/profile/stats.ts)
  profile jsonb,                       -- Arthur's written profile (lib/profile/synthesize.ts)
  memory text,                         -- what Arthur keeps in mind about the player in every prompt
  model text
);
create index if not exists nimzo_player_profiles_created_idx on public.nimzo_player_profiles (created_at desc);
alter table public.nimzo_player_profiles enable row level security;
