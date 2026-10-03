-- Arthur's explanations of individual move tags, written on first click and cached.
alter table public.nimzo_move_features add column if not exists tag_explanations jsonb not null default '{}'::jsonb;
