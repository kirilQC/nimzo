-- Public chess.com profiles of the player and his opponents (avatar, country,
-- title), cached so game lists can show them like chess.com does.
create table if not exists public.nimzo_players (
  username text primary key,          -- lower case
  display_name text not null,         -- as chess.com shows it
  avatar_url text,
  country_code text,                  -- chess.com code: ISO 3166 (US, IR) or its own (XE England, XX International)
  title text,                         -- GM, IM, ... when titled
  league text,
  profile_url text,
  status text,                        -- found | not_found (closed or renamed account)
  fetched_at timestamptz not null default now()
);
alter table public.nimzo_players enable row level security;
