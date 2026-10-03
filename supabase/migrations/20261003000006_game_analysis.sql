-- One row per analyzed game with everything Nimzo learned about it, flattened
-- for the player profile and correlation analysis. Rebuilt whenever the game is
-- (re)analyzed. Per-move detail stays in nimzo_move_features.
create table if not exists public.nimzo_game_analysis (
  game_id uuid primary key references public.nimzo_games (id) on delete cascade,
  analyzed_at timestamptz not null default now(),
  pipeline_version int not null,

  -- The game
  end_time timestamptz not null,
  time_class text,
  time_control text,
  base_seconds int,
  increment_seconds int,
  my_color text not null,
  opponent text not null,
  my_rating int,
  opponent_rating int,
  rating_diff int,                       -- mine minus theirs
  result text not null,                  -- win | loss | draw
  ending text,                           -- chess.com code: resigned, timeout, checkmated, agreed, ...
  ending_text text,                      -- "You resigned", "Opponent ran out of time", ...
  ended_by text,                         -- you | opponent | null (draws)
  eco text,
  opening_name text,
  opening_family text,                   -- first words, e.g. "Italian Game"
  move_count int,
  hour_of_day int,                       -- local to UTC; for "when do I play best"
  day_of_week int,                       -- 0 = Sunday

  -- Accuracy
  accuracy numeric(5, 2),
  accuracy_opponent numeric(5, 2),
  accuracy_chesscom numeric(5, 2),
  accuracy_opening numeric(5, 2),
  accuracy_middlegame numeric(5, 2),
  accuracy_endgame numeric(5, 2),

  -- My move labels
  n_brilliant int, n_great int, n_book int, n_best int, n_excellent int, n_good int,
  n_inaccuracy int, n_mistake int, n_miss int, n_blunder int, n_forced int,
  n_errors int,                          -- inaccuracies + mistakes + misses + blunders
  -- Opponent's errors (chances I had)
  opp_n_inaccuracy int, opp_n_mistake int, opp_n_miss int, opp_n_blunder int,
  opp_blunders_punished int,             -- their blunders/misses that I answered with best/great/excellent

  -- When my errors happened
  errors_opening int, errors_middlegame int, errors_endgame int,
  blunders_opening int, blunders_middlegame int, blunders_endgame int,
  first_error_move int,
  first_blunder_move int,
  biggest_drop numeric(5, 1),            -- winning chances lost on my worst move
  biggest_drop_move int,

  -- Momentum (my winning chances, %)
  win_at_10 numeric(5, 1), win_at_20 numeric(5, 1), win_at_30 numeric(5, 1), win_end numeric(5, 1),
  best_win numeric(5, 1), best_win_move int,
  worst_win numeric(5, 1), worst_win_move int,
  pct_moves_ahead int,                   -- share of moves with my chances >= 60%
  pct_moves_behind int,                  -- share with <= 40%
  lead_changes int,
  threw_winning boolean,                 -- had >= 75% and didn't win
  comeback boolean,                      -- was <= 25% and didn't lose

  -- Clock
  my_time_left_end_s int,
  opp_time_left_end_s int,
  avg_move_time_s numeric(6, 1),
  median_move_time_s numeric(6, 1),
  moves_under_60s int,
  moves_under_30s int,
  errors_under_60s int,
  instant_moves int,                     -- moved in 2 seconds or less (not book or forced)
  instant_errors int,
  long_thinks int,
  long_think_errors int,

  -- Opening habits
  castled boolean,
  castled_move int,
  castle_side text,                      -- kingside | queenside
  minors_developed_by_10 int,
  queen_moves_first_10 int,
  left_book_move int,
  fell_for_trap text,
  sprang_trap text,

  -- Material and endgame
  max_material_lead int,
  max_material_deficit int,
  reached_endgame boolean,
  endgame_start_move int,
  mate_pattern text,                     -- how a checkmate looked (back_rank, smothered), either side

  -- Tags, Jev and Maia (counts over my moves)
  tag_counts jsonb not null default '{}'::jsonb,       -- tag id -> times on my moves
  bad_tags text[] not null default '{}',
  good_tags text[] not null default '{}',
  principle_counts jsonb not null default '{}'::jsonb, -- principle broken -> count
  category_counts jsonb not null default '{}'::jsonb,  -- knowledge base mistake category -> count
  root_cause_counts jsonb not null default '{}'::jsonb,
  intent_counts jsonb not null default '{}'::jsonb,
  maia_avg_played numeric(4, 3),         -- how common my mistakes were at my level (0-1)
  common_mistakes int,                   -- mistakes at least 30% of players at my level make
  rare_mistakes int,                     -- mistakes at most 10% make (personal blind spots)

  -- Arthur
  verdict text,
  headline text,
  conclusion text,
  fell_short jsonb,
  went_well jsonb,

  -- Cost
  jev_cost numeric(10, 6)
);
create index if not exists nimzo_game_analysis_end_idx on public.nimzo_game_analysis (end_time desc);
create index if not exists nimzo_game_analysis_class_idx on public.nimzo_game_analysis (time_class);
create index if not exists nimzo_game_analysis_bad_tags_gin on public.nimzo_game_analysis using gin (bad_tags);
alter table public.nimzo_game_analysis enable row level security;
