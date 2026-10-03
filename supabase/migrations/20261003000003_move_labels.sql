-- chess.com's ten move labels (plus "forced"), Miss as a flagged mistake type,
-- and per-game move counts.
alter table public.nimzo_positions drop constraint if exists nimzo_positions_classification_check;
alter table public.nimzo_positions add constraint nimzo_positions_classification_check check (
  classification in ('brilliant', 'great', 'book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'miss', 'blunder', 'forced')
);

alter table public.nimzo_mistakes drop constraint if exists nimzo_mistakes_classification_check;
alter table public.nimzo_mistakes add constraint nimzo_mistakes_classification_check check (
  classification in ('inaccuracy', 'mistake', 'miss', 'blunder')
);

alter table public.nimzo_games add column if not exists misses int;
alter table public.nimzo_games add column if not exists move_count int; -- full moves (White + Black = 1)
create index if not exists nimzo_games_end_time_idx on public.nimzo_games (end_time desc);
