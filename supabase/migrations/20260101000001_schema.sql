-- =====================================================================
-- אליאס ישראל — schema
-- =====================================================================
create extension if not exists pgcrypto;

create type public.game_status as enum ('lobby', 'playing', 'finished');
create type public.turn_status as enum ('ready', 'active', 'ended');

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(username) between 2 and 24),
  avatar text not null default '🦊',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- ---------- categories & words ----------
create table public.categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  emoji text not null default '🎯'
);

create table public.words (
  id serial primary key,
  word text not null check (char_length(word) between 1 and 60),
  category_id int not null references public.categories (id) on delete cascade,
  difficulty smallint not null default 1 check (difficulty between 1 and 3),
  created_at timestamptz not null default now(),
  unique (word, category_id)
);
create index words_category_idx on public.words (category_id, difficulty);

-- ---------- games ----------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  join_code text not null unique,
  host_id uuid not null references public.profiles (id),
  status public.game_status not null default 'lobby',
  is_private boolean not null default true,
  winner_team_id uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index games_status_idx on public.games (status, is_private);

create table public.game_settings (
  game_id uuid primary key references public.games (id) on delete cascade,
  num_teams int not null check (num_teams between 2 and 4),
  max_players int not null check (max_players between 2 and 24),
  turn_seconds int not null check (turn_seconds in (30, 60, 90)),
  win_points int not null check (win_points between 5 and 100),
  difficulty smallint not null default 0 check (difficulty between 0 and 3),
  category_ids int[] not null default '{}'
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  idx int not null check (idx between 1 and 4),
  name text not null,
  color text not null,
  score int not null default 0,
  unique (game_id, idx)
);

create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index game_players_user_idx on public.game_players (user_id, joined_at desc);

create table public.team_players (
  game_id uuid not null,
  user_id uuid not null,
  team_id uuid not null references public.teams (id) on delete cascade,
  primary key (game_id, user_id),
  foreign key (game_id, user_id) references public.game_players (game_id, user_id) on delete cascade
);
create index team_players_team_idx on public.team_players (team_id);

create table public.turns (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  turn_number int not null,
  team_id uuid not null references public.teams (id) on delete cascade,
  explainer_id uuid not null references public.profiles (id),
  status public.turn_status not null default 'ready',
  correct_count int not null default 0,
  skipped_count int not null default 0,
  started_at timestamptz,
  ends_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (game_id, turn_number)
);

-- The secret word lives in its own table so RLS can show it ONLY to the explainer.
create table public.turn_secrets (
  turn_id uuid primary key references public.turns (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  explainer_id uuid not null,
  word text not null
);

create table public.game_used_words (
  game_id uuid not null references public.games (id) on delete cascade,
  word_id int not null references public.words (id) on delete cascade,
  primary key (game_id, word_id)
);

create table public.game_results (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  team_score int not null default 0,
  won boolean not null default false,
  correct_count int not null default 0,
  skipped_count int not null default 0,
  explained_turns int not null default 0,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index game_results_user_idx on public.game_results (user_id, created_at desc);

-- ---------- friends & invites ----------
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table public.game_invites (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  game_name text not null,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_id, to_user)
);

-- ---------- stats view ----------
create view public.profile_stats with (security_invoker = true) as
select
  p.id as user_id,
  count(r.game_id)::int as games_played,
  (count(r.game_id) filter (where r.won))::int as wins,
  coalesce(sum(r.team_score), 0)::int as total_points,
  coalesce(sum(r.correct_count), 0)::int as words_explained
from public.profiles p
left join public.game_results r on r.user_id = p.id
group by p.id;

-- ---------- helper functions used by RLS ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_game_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.game_players where game_id = gid and user_id = auth.uid())
$$;

-- ---------- new-user trigger ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uname text;
begin
  uname := coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), 'player_' || substr(new.id::text, 1, 6));
  insert into public.profiles (id, username, avatar)
  values (new.id, uname, coalesce(nullif(new.raw_user_meta_data ->> 'avatar', ''), '🦊'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- default categories ----------
insert into public.categories (slug, name, emoji) values
  ('food', 'אוכל', '🍕'),
  ('animals', 'בעלי חיים', '🦁'),
  ('objects', 'חפצים', '🔧'),
  ('professions', 'מקצועות', '👩‍🚒'),
  ('places', 'מקומות', '🏖️'),
  ('sports', 'ספורט', '⚽'),
  ('movies', 'סרטים', '🎬'),
  ('series', 'סדרות', '📺'),
  ('tech', 'טכנולוגיה', '💻'),
  ('nature', 'טבע', '🌿'),
  ('actions', 'פעולות', '🏃'),
  ('people', 'אנשים', '🧑‍🤝‍🧑'),
  ('hobbies', 'תחביבים', '🎨'),
  ('funny', 'דברים מצחיקים', '🤡'),
  ('israel', 'ישראל', '🇮🇱'),
  ('culture', 'תרבות', '🎭')
on conflict (slug) do nothing;
