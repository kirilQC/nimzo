-- Every move of every analyzed game: computed features, tags (rule + Jev),
-- why it was played, and Arthur's one-sentence note. The player profile is
-- built from this table.
create table if not exists public.nimzo_move_features (
  game_id uuid not null references public.nimzo_games (id) on delete cascade,
  ply int not null,
  is_mine boolean not null,
  side text not null check (side in ('white', 'black')),
  move_number int not null,
  san text not null,
  label text,
  phase text,
  features jsonb not null,
  tags text[] not null default '{}',      -- confident tags: rule tags plus Jev tags above the threshold
  jev jsonb,                              -- { tags: {id: probability}, intent, root_cause, model, usage }
  intent text,
  root_cause text,
  note text,                              -- Arthur's one plain sentence about this move
  created_at timestamptz not null default now(),
  primary key (game_id, ply)
);
create index if not exists nimzo_move_features_tags_gin on public.nimzo_move_features using gin (tags);
create index if not exists nimzo_move_features_mine_idx on public.nimzo_move_features (is_mine, label);
alter table public.nimzo_move_features enable row level security;
