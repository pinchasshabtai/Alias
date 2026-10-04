-- Full setup: paste into Supabase SQL Editor and run once.

-- ===== 20260101000001_schema.sql =====
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


-- ===== 20260101000002_rls.sql =====
-- =====================================================================
-- Row Level Security + grants
-- Principle: clients may READ what they are allowed to see.
-- ALL game mutations go through SECURITY DEFINER functions (see 0003).
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.words enable row level security;
alter table public.games enable row level security;
alter table public.game_settings enable row level security;
alter table public.teams enable row level security;
alter table public.game_players enable row level security;
alter table public.team_players enable row level security;
alter table public.turns enable row level security;
alter table public.turn_secrets enable row level security;
alter table public.game_used_words enable row level security;
alter table public.game_results enable row level security;
alter table public.friendships enable row level security;
alter table public.game_invites enable row level security;

-- Start from zero privileges, then grant only what is needed.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.profiles, public.categories, public.games, public.game_settings,
  public.teams, public.game_players, public.team_players, public.turns,
  public.turn_secrets, public.game_results, public.game_invites, public.friendships,
  public.profile_stats to authenticated;
grant update (username, avatar) on public.profiles to authenticated;
grant insert, update, delete on public.categories to authenticated;   -- gated by is_admin() policies
grant select, insert, update, delete on public.words to authenticated; -- gated by is_admin() policies
grant insert, delete on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;
grant delete on public.game_invites to authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- categories: everyone reads, admins write
create policy categories_select on public.categories for select to authenticated using (true);
create policy categories_admin_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- words: ONLY admins can read/write (players must never see the word list)
create policy words_admin_all on public.words for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- games: members, hosts, admins, or public lobbies
create policy games_select on public.games for select to authenticated
  using (
    public.is_game_member(id)
    or host_id = auth.uid()
    or (is_private = false and status = 'lobby')
    or public.is_admin()
  );

create policy game_settings_select on public.game_settings for select to authenticated
  using (
    public.is_game_member(game_id)
    or exists (select 1 from public.games g where g.id = game_id and g.is_private = false and g.status = 'lobby')
    or public.is_admin()
  );

create policy teams_select on public.teams for select to authenticated using (public.is_game_member(game_id));
create policy game_players_select on public.game_players for select to authenticated
  using (
    public.is_game_member(game_id)
    or exists (select 1 from public.games g where g.id = game_id and g.is_private = false and g.status = 'lobby')
  );
create policy team_players_select on public.team_players for select to authenticated using (public.is_game_member(game_id));
create policy turns_select on public.turns for select to authenticated using (public.is_game_member(game_id));

-- THE SECRET WORD: visible only to the explainer of that turn.
create policy turn_secrets_explainer_only on public.turn_secrets for select to authenticated
  using (explainer_id = auth.uid());

create policy game_results_select on public.game_results for select to authenticated
  using (user_id = auth.uid() or public.is_game_member(game_id));

-- game_used_words: no policy => no access from clients at all.

-- friendships
create policy friendships_select on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_insert on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending' and addressee_id <> auth.uid());
create policy friendships_accept on public.friendships for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid());
create policy friendships_delete on public.friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- invites
create policy invites_select on public.game_invites for select to authenticated
  using (to_user = auth.uid() or from_user = auth.uid());
create policy invites_delete on public.game_invites for delete to authenticated
  using (to_user = auth.uid() or from_user = auth.uid());


-- ===== 20260101000003_functions.sql =====
-- =====================================================================
-- Game engine: every critical action is validated on the server.
-- Public RPCs are SECURITY DEFINER and always use auth.uid() — never a client-sent user id.
-- Internal helpers start with "_" and are not callable by clients.
-- =====================================================================

create or replace function public.server_now()
returns timestamptz language sql volatile as $$ select clock_timestamp() $$;

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)))
$$;

create or replace function public._team_name(i int) returns text language sql immutable as $$
  select (array['הכתומים', 'הכחולים', 'הירוקים', 'הורודים'])[i]
$$;
create or replace function public._team_color(i int) returns text language sql immutable as $$
  select (array['#FF8A00', '#2D7DFF', '#22C55E', '#EC4899'])[i]
$$;

create or replace function public._gen_join_code() returns text language plpgsql as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.games where join_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public._validate_settings(
  p_num_teams int, p_max_players int, p_turn_seconds int, p_win_points int, p_difficulty int, p_category_ids int[]
) returns void language plpgsql as $$
begin
  if p_num_teams is null or p_max_players is null or p_turn_seconds is null or p_win_points is null or p_difficulty is null
     or p_num_teams not between 2 and 4
     or p_max_players not between 2 and 24
     or p_turn_seconds not in (30, 60, 90)
     or p_win_points not between 5 and 100
     or p_difficulty not between 0 and 3
     or p_max_players < p_num_teams then
    raise exception 'INVALID_SETTINGS';
  end if;
  if p_category_ids is not null and exists (
    select 1 from unnest(p_category_ids) c where not exists (select 1 from public.categories where id = c)
  ) then
    raise exception 'INVALID_SETTINGS';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Players / lobby
-- ---------------------------------------------------------------------
create or replace function public._add_player(p_game uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
begin
  insert into game_players (game_id, user_id) values (p_game, p_user) on conflict do nothing;
  select t.id into v_team
  from teams t
  where t.game_id = p_game
  order by (select count(*) from team_players tp where tp.team_id = t.id), t.idx
  limit 1;
  insert into team_players (game_id, user_id, team_id) values (p_game, p_user, v_team)
  on conflict (game_id, user_id) do nothing;
end;
$$;

create or replace function public._join_game(p_user uuid, p_game uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  s game_settings%rowtype;
begin
  select * into g from games where id = p_game for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if exists (select 1 from game_players where game_id = p_game and user_id = p_user) then
    return p_game; -- re-join (e.g. after a disconnect) is always allowed
  end if;
  if g.status = 'finished' then raise exception 'GAME_FINISHED'; end if;
  if g.status <> 'lobby' then raise exception 'GAME_ALREADY_STARTED'; end if;
  select * into s from game_settings where game_id = p_game;
  if (select count(*) from game_players where game_id = p_game) >= s.max_players then
    raise exception 'GAME_FULL';
  end if;
  perform _add_player(p_game, p_user);
  return p_game;
end;
$$;

create or replace function public.create_game(
  p_name text, p_num_teams int, p_max_players int, p_turn_seconds int,
  p_win_points int, p_difficulty int, p_category_ids int[], p_is_private boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  gid uuid;
  i int;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 40 then raise exception 'INVALID_NAME'; end if;
  perform _validate_settings(p_num_teams, p_max_players, p_turn_seconds, p_win_points, p_difficulty, p_category_ids);

  insert into games (name, join_code, host_id, is_private)
  values (trim(p_name), _gen_join_code(), uid, coalesce(p_is_private, true))
  returning id into gid;

  insert into game_settings (game_id, num_teams, max_players, turn_seconds, win_points, difficulty, category_ids)
  values (gid, p_num_teams, p_max_players, p_turn_seconds, p_win_points, p_difficulty, coalesce(p_category_ids, '{}'));

  for i in 1..p_num_teams loop
    insert into teams (game_id, idx, name, color) values (gid, i, _team_name(i), _team_color(i));
  end loop;

  perform _add_player(gid, uid);
  return gid;
end;
$$;

create or replace function public.join_game(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select id into v_id from games where join_code = upper(trim(p_code));
  if v_id is null then raise exception 'GAME_NOT_FOUND'; end if;
  return _join_game(auth.uid(), v_id);
end;
$$;

create or replace function public.leave_game(p_game uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  uid uuid := auth.uid();
  v_next uuid;
begin
  select * into g from games where id = p_game for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if g.status = 'finished' then return; end if; -- keep history intact
  if not exists (select 1 from game_players where game_id = p_game and user_id = uid) then
    raise exception 'NOT_MEMBER';
  end if;
  delete from game_players where game_id = p_game and user_id = uid;
  if not exists (select 1 from game_players where game_id = p_game) then
    delete from games where id = p_game;
    return;
  end if;
  if g.host_id = uid then
    select user_id into v_next from game_players where game_id = p_game order by joined_at limit 1;
    update games set host_id = v_next where id = p_game;
  end if;
end;
$$;

create or replace function public.kick_player(p_game uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
begin
  select * into g from games where id = p_game for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if g.host_id is distinct from auth.uid() then raise exception 'NOT_HOST'; end if;
  if g.status <> 'lobby' then raise exception 'NOT_IN_LOBBY'; end if;
  if p_user = auth.uid() then raise exception 'CANNOT_KICK_SELF'; end if;
  delete from game_players where game_id = p_game and user_id = p_user;
  if not found then raise exception 'PLAYER_NOT_FOUND'; end if;
end;
$$;

create or replace function public.move_player(p_game uuid, p_user uuid, p_team uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
begin
  select * into g from games where id = p_game for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if g.host_id is distinct from auth.uid() then raise exception 'NOT_HOST'; end if;
  if g.status <> 'lobby' then raise exception 'NOT_IN_LOBBY'; end if;
  if not exists (select 1 from teams where id = p_team and game_id = p_game) then raise exception 'INVALID_TEAM'; end if;
  update team_players set team_id = p_team where game_id = p_game and user_id = p_user;
  if not found then raise exception 'PLAYER_NOT_FOUND'; end if;
end;
$$;

create or replace function public.update_settings(
  p_game uuid, p_num_teams int, p_max_players int, p_turn_seconds int,
  p_win_points int, p_difficulty int, p_category_ids int[]
) returns void language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  v_old int;
  i int;
  r record;
begin
  select * into g from games where id = p_game for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if g.host_id is distinct from auth.uid() then raise exception 'NOT_HOST'; end if;
  if g.status <> 'lobby' then raise exception 'NOT_IN_LOBBY'; end if;
  perform _validate_settings(p_num_teams, p_max_players, p_turn_seconds, p_win_points, p_difficulty, p_category_ids);
  if p_max_players < (select count(*) from game_players where game_id = p_game) then
    raise exception 'TOO_MANY_PLAYERS';
  end if;

  select num_teams into v_old from game_settings where game_id = p_game;
  if p_num_teams > v_old then
    for i in (v_old + 1)..p_num_teams loop
      insert into teams (game_id, idx, name, color) values (p_game, i, _team_name(i), _team_color(i));
    end loop;
  elsif p_num_teams < v_old then
    for r in
      select user_id from team_players
      where team_id in (select id from teams where game_id = p_game and idx > p_num_teams)
    loop
      update team_players
      set team_id = (
        select t.id from teams t
        where t.game_id = p_game and t.idx <= p_num_teams
        order by (select count(*) from team_players x where x.team_id = t.id), t.idx
        limit 1
      )
      where game_id = p_game and user_id = r.user_id;
    end loop;
    delete from teams where game_id = p_game and idx > p_num_teams;
  end if;

  update game_settings
  set num_teams = p_num_teams, max_players = p_max_players, turn_seconds = p_turn_seconds,
      win_points = p_win_points, difficulty = p_difficulty, category_ids = coalesce(p_category_ids, '{}')
  where game_id = p_game;
end;
$$;

-- ---------------------------------------------------------------------
-- Game engine
-- ---------------------------------------------------------------------
create or replace function public._draw_word(p_turn uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  t turns%rowtype;
  s game_settings%rowtype;
  w record;
  pass int;
begin
  select * into t from turns where id = p_turn;
  select * into s from game_settings where game_id = t.game_id;

  for pass in 1..2 loop
    select w2.id, w2.word into w
    from words w2
    where (cardinality(s.category_ids) = 0 or w2.category_id = any (s.category_ids))
      and (s.difficulty = 0 or w2.difficulty = s.difficulty)
      and not exists (select 1 from game_used_words u where u.game_id = t.game_id and u.word_id = w2.id)
    order by random()
    limit 1;
    exit when found;
    delete from game_used_words where game_id = t.game_id; -- pool exhausted: start a new cycle
  end loop;

  if w.id is null then raise exception 'NO_WORDS'; end if;

  insert into game_used_words (game_id, word_id) values (t.game_id, w.id) on conflict do nothing;
  insert into turn_secrets (turn_id, game_id, explainer_id, word)
  values (p_turn, t.game_id, t.explainer_id, w.word)
  on conflict (turn_id) do update set word = excluded.word;
  return w.word;
end;
$$;

create or replace function public._create_next_turn(p_game uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_cnt int;
  n int;
  tm teams%rowtype;
  pc int;
  v_exp uuid;
  tries int := 0;
  tid uuid;
begin
  select count(*) into v_cnt from teams where game_id = p_game;
  select coalesce(max(turn_number), 0) into n from turns where game_id = p_game;
  loop
    n := n + 1;
    tries := tries + 1;
    if v_cnt = 0 or tries > v_cnt then
      perform _finish_game(p_game); -- nobody left to play
      return null;
    end if;
    select * into tm from teams where game_id = p_game order by idx offset ((n - 1) % v_cnt) limit 1;
    select count(*) into pc from team_players where team_id = tm.id;
    if pc > 0 then
      select tp.user_id into v_exp
      from team_players tp
      join game_players gp on gp.game_id = tp.game_id and gp.user_id = tp.user_id
      where tp.team_id = tm.id
      order by gp.joined_at, tp.user_id
      offset (((n - 1) / v_cnt) % pc) limit 1;
      exit;
    end if;
  end loop;

  insert into turns (game_id, turn_number, team_id, explainer_id)
  values (p_game, n, tm.id, v_exp)
  returning id into tid;
  return tid;
end;
$$;

create or replace function public._finish_game(p_game uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_winner uuid;
begin
  select id into v_winner from teams where game_id = p_game order by score desc, idx limit 1;
  update games set status = 'finished', finished_at = now(), winner_team_id = v_winner
  where id = p_game and status = 'playing';
  if not found then return; end if;

  update turns set status = 'ended', ended_at = coalesce(ended_at, now()) where game_id = p_game and status <> 'ended';
  delete from turn_secrets where game_id = p_game;

  insert into game_results (game_id, user_id, team_id, team_score, won, correct_count, skipped_count, explained_turns)
  select gp.game_id, gp.user_id, tm.id, tm.score, (tm.id = v_winner),
         coalesce(sum(tu.correct_count), 0), coalesce(sum(tu.skipped_count), 0), count(tu.id)
  from game_players gp
  join team_players tp on tp.game_id = gp.game_id and tp.user_id = gp.user_id
  join teams tm on tm.id = tp.team_id
  left join turns tu on tu.game_id = gp.game_id and tu.explainer_id = gp.user_id and tu.status = 'ended'
  where gp.game_id = p_game
  group by gp.game_id, gp.user_id, tm.id, tm.score
  on conflict do nothing;
end;
$$;

create or replace function public._end_turn(p_turn uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t turns%rowtype;
  s game_settings%rowtype;
  v_cnt int;
  v_ended int;
  v_max int;
  v_leaders int;
begin
  select * into t from turns where id = p_turn for update;
  if not found or t.status = 'ended' then return; end if; -- idempotent: many clients may call this at once

  update turns set status = 'ended', ended_at = now() where id = p_turn;
  delete from turn_secrets where turn_id = p_turn;

  if (select status from games where id = t.game_id) <> 'playing' then return; end if;

  select * into s from game_settings where game_id = t.game_id;
  select count(*) into v_cnt from teams where game_id = t.game_id;
  select count(*) into v_ended from turns where game_id = t.game_id and status = 'ended';
  select max(score) into v_max from teams where game_id = t.game_id;
  select count(*) into v_leaders from teams where game_id = t.game_id and score = v_max;

  -- The game ends only after a full round, when someone reached the target and leads alone.
  if v_cnt > 0 and v_ended % v_cnt = 0 and v_max >= s.win_points and v_leaders = 1 then
    perform _finish_game(t.game_id);
  else
    perform _create_next_turn(t.game_id);
  end if;
end;
$$;

create or replace function public.start_game(p_game uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  v_teams int;
begin
  select * into g from games where id = p_game for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if g.host_id is distinct from auth.uid() then raise exception 'NOT_HOST'; end if;
  if g.status <> 'lobby' then raise exception 'NOT_IN_LOBBY'; end if;

  select count(*) into v_teams from teams t
  where t.game_id = p_game and exists (select 1 from team_players tp where tp.team_id = t.id);
  if v_teams < 2 then raise exception 'NOT_ENOUGH_TEAMS'; end if;

  delete from teams t where t.game_id = p_game and not exists (select 1 from team_players tp where tp.team_id = t.id);
  update teams set score = 0 where game_id = p_game;
  delete from game_used_words where game_id = p_game;
  update games set status = 'playing', started_at = now() where id = p_game;
  perform _create_next_turn(p_game);
end;
$$;

create or replace function public.begin_turn(p_turn uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  t turns%rowtype;
  s game_settings%rowtype;
begin
  select * into t from turns where id = p_turn for update;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;
  if t.explainer_id is distinct from auth.uid() then raise exception 'NOT_EXPLAINER'; end if;
  if t.status <> 'ready' then raise exception 'TURN_NOT_READY'; end if;
  select * into s from game_settings where game_id = t.game_id;
  update turns
  set status = 'active', started_at = now(), ends_at = now() + make_interval(secs => s.turn_seconds)
  where id = p_turn;
  return _draw_word(p_turn);
end;
$$;

-- "ניחשו!" — the ONLY way a point is ever awarded. Returns the next word, or null if time ran out.
create or replace function public.mark_correct(p_turn uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  t turns%rowtype;
begin
  select * into t from turns where id = p_turn for update;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;
  if t.explainer_id is distinct from auth.uid() then raise exception 'NOT_EXPLAINER'; end if;
  if t.status <> 'active' then raise exception 'TURN_NOT_ACTIVE'; end if;
  if now() > t.ends_at + interval '1 second' then
    perform _end_turn(p_turn);
    return null;
  end if;
  update turns set correct_count = correct_count + 1 where id = p_turn;
  update teams set score = score + 1 where id = t.team_id;
  return _draw_word(p_turn);
end;
$$;

create or replace function public.skip_word(p_turn uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  t turns%rowtype;
begin
  select * into t from turns where id = p_turn for update;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;
  if t.explainer_id is distinct from auth.uid() then raise exception 'NOT_EXPLAINER'; end if;
  if t.status <> 'active' then raise exception 'TURN_NOT_ACTIVE'; end if;
  if now() > t.ends_at + interval '1 second' then
    perform _end_turn(p_turn);
    return null;
  end if;
  update turns set skipped_count = skipped_count + 1 where id = p_turn;
  return _draw_word(p_turn);
end;
$$;

-- Ends a turn. Allowed for: the explainer (any time), anyone in the game once time is up,
-- the host when the turn hasn't started (absent explainer), or anyone if it was idle for 45s.
create or replace function public.end_turn(p_turn uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t turns%rowtype;
  g games%rowtype;
  uid uuid := auth.uid();
begin
  select * into t from turns where id = p_turn for update;
  if not found then raise exception 'TURN_NOT_FOUND'; end if;
  if not exists (select 1 from game_players where game_id = t.game_id and user_id = uid) then
    raise exception 'NOT_MEMBER';
  end if;
  if t.status = 'ended' then return; end if;
  select * into g from games where id = t.game_id;

  if t.status = 'active' then
    if t.explainer_id <> uid and now() < t.ends_at then raise exception 'TURN_STILL_RUNNING'; end if;
  else
    if t.explainer_id <> uid and g.host_id <> uid and now() < t.created_at + interval '45 seconds' then
      raise exception 'TURN_NOT_STALE';
    end if;
  end if;
  perform _end_turn(p_turn);
end;
$$;

-- ---------------------------------------------------------------------
-- Friends / invites / admin
-- ---------------------------------------------------------------------
create or replace function public.invite_friend(p_game uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  uid uuid := auth.uid();
begin
  select * into g from games where id = p_game;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if not exists (select 1 from game_players where game_id = p_game and user_id = uid) then raise exception 'NOT_MEMBER'; end if;
  if g.status <> 'lobby' then raise exception 'NOT_IN_LOBBY'; end if;
  if not exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = uid and addressee_id = p_user) or (requester_id = p_user and addressee_id = uid))
  ) then raise exception 'NOT_FRIENDS'; end if;
  if exists (select 1 from game_players where game_id = p_game and user_id = p_user) then return; end if;
  insert into game_invites (game_id, game_name, from_user, to_user)
  values (p_game, g.name, uid, p_user) on conflict do nothing;
end;
$$;

create or replace function public.accept_invite(p_invite uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv game_invites%rowtype;
  v_game uuid;
begin
  select * into inv from game_invites where id = p_invite and to_user = auth.uid();
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  v_game := _join_game(auth.uid(), inv.game_id);
  delete from game_invites where id = p_invite;
  return v_game;
end;
$$;

create or replace function public.admin_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return jsonb_build_object(
    'users', (select count(*) from profiles),
    'games', (select count(*) from games),
    'active_games', (select count(*) from games where status <> 'finished'),
    'finished_games', (select count(*) from games where status = 'finished'),
    'words', (select count(*) from words),
    'categories', (select count(*) from categories)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Function privileges: internals are private, RPCs are for signed-in users only.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    if left(r.proname, 1) = '_' or r.proname = 'handle_new_user' then
      execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    else
      execute format('revoke all on function %s from public, anon', r.sig);
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

grant execute on function public.username_available(text) to anon, authenticated;


-- ===== 20260101000004_realtime.sql =====
-- Realtime: stream row changes to clients (RLS still applies to every subscriber).
-- turn_secrets is intentionally NOT published.
do $$
declare t text;
begin
  foreach t in array array['games', 'game_settings', 'teams', 'team_players', 'game_players', 'turns', 'game_invites', 'friendships']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;


-- ===== seed.sql =====
-- Generated by scripts/generate_seed.py — edit data/words.txt and re-run.
-- 528 Hebrew words
insert into public.words (word, category_id, difficulty)
select v.word, c.id, v.difficulty
from (values
  ('פיצה', 'food', 1),
  ('המבורגר', 'food', 1),
  ('פלאפל', 'food', 1),
  ('שוקולד', 'food', 1),
  ('גלידה', 'food', 1),
  ('ביצה', 'food', 1),
  ('לחם', 'food', 1),
  ('חומוס', 'food', 1),
  ('בננה', 'food', 1),
  ('תפוח', 'food', 1),
  ('פסטה', 'food', 1),
  ('צ''יפס', 'food', 1),
  ('שקשוקה', 'food', 2),
  ('סושי', 'food', 2),
  ('פופקורן', 'food', 2),
  ('פנקייק', 'food', 2),
  ('שווארמה', 'food', 2),
  ('סלט', 'food', 2),
  ('סנדוויץ''', 'food', 2),
  ('עוגת גבינה', 'food', 2),
  ('מרק עוף', 'food', 2),
  ('אבטיח', 'food', 2),
  ('שניצל', 'food', 2),
  ('קוגל', 'food', 2),
  ('מלאווח', 'food', 3),
  ('ג''חנון', 'food', 3),
  ('בורקס', 'food', 3),
  ('כנאפה', 'food', 3),
  ('טירמיסו', 'food', 3),
  ('גפילטע פיש', 'food', 3),
  ('קרם ברולה', 'food', 3),
  ('פירה', 'food', 3),
  ('אנטיפסטי', 'food', 3),
  ('כלב', 'animals', 1),
  ('חתול', 'animals', 1),
  ('פיל', 'animals', 1),
  ('אריה', 'animals', 1),
  ('קוף', 'animals', 1),
  ('סוס', 'animals', 1),
  ('פרה', 'animals', 1),
  ('ציפור', 'animals', 1),
  ('דג', 'animals', 1),
  ('ארנב', 'animals', 1),
  ('דוב', 'animals', 1),
  ('נחש', 'animals', 1),
  ('ג''ירף', 'animals', 2),
  ('קנגורו', 'animals', 2),
  ('פינגווין', 'animals', 2),
  ('דולפין', 'animals', 2),
  ('תנין', 'animals', 2),
  ('יענה', 'animals', 2),
  ('צב', 'animals', 2),
  ('עטלף', 'animals', 2),
  ('כריש', 'animals', 2),
  ('תוכי', 'animals', 2),
  ('זברה', 'animals', 2),
  ('נמר', 'animals', 2),
  ('קיפוד', 'animals', 3),
  ('לוויתן', 'animals', 3),
  ('פלמינגו', 'animals', 3),
  ('שועל', 'animals', 3),
  ('יעל', 'animals', 3),
  ('ברבור', 'animals', 3),
  ('נמלה', 'animals', 3),
  ('עכביש', 'animals', 3),
  ('תן', 'animals', 3),
  ('כיסא', 'objects', 1),
  ('שולחן', 'objects', 1),
  ('טלפון', 'objects', 1),
  ('מפתח', 'objects', 1),
  ('כוס', 'objects', 1),
  ('מטרייה', 'objects', 1),
  ('שעון', 'objects', 1),
  ('מחשב', 'objects', 1),
  ('כדור', 'objects', 1),
  ('משקפיים', 'objects', 1),
  ('נעל', 'objects', 1),
  ('תיק', 'objects', 1),
  ('מזוודה', 'objects', 2),
  ('מקרר', 'objects', 2),
  ('מזגן', 'objects', 2),
  ('מברשת שיניים', 'objects', 2),
  ('מספריים', 'objects', 2),
  ('פנס', 'objects', 2),
  ('מכונת כביסה', 'objects', 2),
  ('חלון', 'objects', 2),
  ('מראה', 'objects', 2),
  ('מנעול', 'objects', 2),
  ('מטאטא', 'objects', 2),
  ('ארנק', 'objects', 2),
  ('פותחן', 'objects', 3),
  ('פטיש', 'objects', 3),
  ('מסמר', 'objects', 3),
  ('חבל', 'objects', 3),
  ('מגהץ', 'objects', 3),
  ('שואב אבק', 'objects', 3),
  ('מצקת', 'objects', 3),
  ('קופסה', 'objects', 3),
  ('מקל הליכה', 'objects', 3),
  ('רופא', 'professions', 1),
  ('מורה', 'professions', 1),
  ('שוטר', 'professions', 1),
  ('כבאי', 'professions', 1),
  ('טבח', 'professions', 1),
  ('נהג', 'professions', 1),
  ('טייס', 'professions', 1),
  ('אחות', 'professions', 1),
  ('צייר', 'professions', 1),
  ('זמר', 'professions', 1),
  ('שחקן', 'professions', 1),
  ('מלצר', 'professions', 1),
  ('עורך דין', 'professions', 2),
  ('חשמלאי', 'professions', 2),
  ('אינסטלטור', 'professions', 2),
  ('ספר', 'professions', 2),
  ('צלם', 'professions', 2),
  ('קוסם', 'professions', 2),
  ('נגר', 'professions', 2),
  ('מהנדס', 'professions', 2),
  ('חייל', 'professions', 2),
  ('שופט', 'professions', 2),
  ('נהג מונית', 'professions', 2),
  ('גנן', 'professions', 2),
  ('אסטרונאוט', 'professions', 3),
  ('ארכיאולוג', 'professions', 3),
  ('פסיכולוג', 'professions', 3),
  ('מנתח', 'professions', 3),
  ('מתרגם', 'professions', 3),
  ('שומר ראש', 'professions', 3),
  ('צוללן', 'professions', 3),
  ('קברניט', 'professions', 3),
  ('בלש', 'professions', 3),
  ('בית ספר', 'places', 1),
  ('בית חולים', 'places', 1),
  ('חוף', 'places', 1),
  ('מסעדה', 'places', 1),
  ('פארק', 'places', 1),
  ('ספרייה', 'places', 1),
  ('שוק', 'places', 1),
  ('אוניברסיטה', 'places', 1),
  ('מלון', 'places', 1),
  ('בנק', 'places', 1),
  ('גן חיות', 'places', 1),
  ('קניון', 'places', 1),
  ('שדה תעופה', 'places', 2),
  ('תחנת רכבת', 'places', 2),
  ('מדבר', 'places', 2),
  ('הר געש', 'places', 2),
  ('מגדל אייפל', 'places', 2),
  ('קולוסיאום', 'places', 2),
  ('מוזיאון', 'places', 2),
  ('בית קולנוע', 'places', 2),
  ('מכבסה', 'places', 2),
  ('מספרה', 'places', 2),
  ('מפעל', 'places', 2),
  ('מנהרה', 'places', 2),
  ('מצפה כוכבים', 'places', 3),
  ('מגדלור', 'places', 3),
  ('מנחת', 'places', 3),
  ('חממה', 'places', 3),
  ('מכרה', 'places', 3),
  ('אצטדיון', 'places', 3),
  ('נמל', 'places', 3),
  ('גשר', 'places', 3),
  ('אי בודד', 'places', 3),
  ('כדורגל', 'sports', 1),
  ('כדורסל', 'sports', 1),
  ('שחייה', 'sports', 1),
  ('ריצה', 'sports', 1),
  ('טניס', 'sports', 1),
  ('אופניים', 'sports', 1),
  ('ג''ודו', 'sports', 1),
  ('כדורעף', 'sports', 1),
  ('התעמלות', 'sports', 1),
  ('איגרוף', 'sports', 1),
  ('גלישה', 'sports', 1),
  ('כדור יד', 'sports', 1),
  ('שחמט', 'sports', 2),
  ('סקי', 'sports', 2),
  ('רכיבה על סוסים', 'sports', 2),
  ('קפיצה לגובה', 'sports', 2),
  ('הרמת משקולות', 'sports', 2),
  ('פינג פונג', 'sports', 2),
  ('גולף', 'sports', 2),
  ('קראטה', 'sports', 2),
  ('ירי בחץ וקשת', 'sports', 2),
  ('רוגבי', 'sports', 2),
  ('הוקי', 'sports', 2),
  ('באולינג', 'sports', 2),
  ('סייף', 'sports', 3),
  ('קפיצה במוט', 'sports', 3),
  ('שיט', 'sports', 3),
  ('פולו מים', 'sports', 3),
  ('קרלינג', 'sports', 3),
  ('מרתון', 'sports', 3),
  ('אולימפיאדה', 'sports', 3),
  ('שופט קו', 'sports', 3),
  ('פנדל', 'sports', 3),
  ('הארי פוטר', 'movies', 1),
  ('שרק', 'movies', 1),
  ('מלך האריות', 'movies', 1),
  ('מצא את נמו', 'movies', 1),
  ('ספיידרמן', 'movies', 1),
  ('באטמן', 'movies', 1),
  ('אלדין', 'movies', 1),
  ('פרוזן', 'movies', 1),
  ('טיטאניק', 'movies', 1),
  ('סופרמן', 'movies', 1),
  ('אווטאר', 'movies', 1),
  ('מדגסקר', 'movies', 1),
  ('שר הטבעות', 'movies', 2),
  ('מלחמת הכוכבים', 'movies', 2),
  ('הנוקמים', 'movies', 2),
  ('פארק היורה', 'movies', 2),
  ('ג''וקר', 'movies', 2),
  ('מטריקס', 'movies', 2),
  ('גלדיאטור', 'movies', 2),
  ('בן לבד בבית', 'movies', 2),
  ('מיסטר בין', 'movies', 2),
  ('סיפור צעצוע', 'movies', 2),
  ('קונג פו פנדה', 'movies', 2),
  ('פינוקיו', 'movies', 2),
  ('הסנדק', 'movies', 3),
  ('פורסט גאמפ', 'movies', 3),
  ('סלאח שבתי', 'movies', 3),
  ('קזבלן', 'movies', 3),
  ('אסקימו לימון', 'movies', 3),
  ('בופור', 'movies', 3),
  ('אינטרסטלר', 'movies', 3),
  ('פרזיטים', 'movies', 3),
  ('לה לה לנד', 'movies', 3),
  ('הסימפסונס', 'series', 1),
  ('חברים', 'series', 1),
  ('פאודה', 'series', 1),
  ('שטיסל', 'series', 1),
  ('ארץ נהדרת', 'series', 1),
  ('הכוכב הבא', 'series', 1),
  ('מאסטר שף', 'series', 1),
  ('האח הגדול', 'series', 1),
  ('דורה', 'series', 1),
  ('בוב ספוג', 'series', 1),
  ('טום וג''רי', 'series', 1),
  ('פאוור ריינג''רס', 'series', 1),
  ('משחקי הכס', 'series', 2),
  ('שובר שורות', 'series', 2),
  ('בית הנייר', 'series', 2),
  ('דברים מוזרים', 'series', 2),
  ('סיינפלד', 'series', 2),
  ('הבורר', 'series', 2),
  ('אבודים', 'series', 2),
  ('הישרדות', 'series', 2),
  ('המירוץ למיליון', 'series', 2),
  ('היהודים באים', 'series', 2),
  ('ריקוד עם כוכבים', 'series', 2),
  ('סקוויד גיים', 'series', 2),
  ('מד מן', 'series', 3),
  ('הכתר', 'series', 3),
  ('תיאוריית המפץ הגדול', 'series', 3),
  ('בטיפול', 'series', 3),
  ('טהרן', 'series', 3),
  ('סופרנוס', 'series', 3),
  ('ווסטוורלד', 'series', 3),
  ('לופין', 'series', 3),
  ('המשרד', 'series', 3),
  ('טלפון חכם', 'tech', 1),
  ('אינטרנט', 'tech', 1),
  ('מקלדת', 'tech', 1),
  ('עכבר מחשב', 'tech', 1),
  ('מצלמה', 'tech', 1),
  ('רובוט', 'tech', 1),
  ('אפליקציה', 'tech', 1),
  ('וואטסאפ', 'tech', 1),
  ('אינסטגרם', 'tech', 1),
  ('יוטיוב', 'tech', 1),
  ('טיקטוק', 'tech', 1),
  ('נטפליקס', 'tech', 1),
  ('בינה מלאכותית', 'tech', 2),
  ('סיסמה', 'tech', 2),
  ('מסך מגע', 'tech', 2),
  ('רחפן', 'tech', 2),
  ('מדפסת', 'tech', 2),
  ('אוזניות', 'tech', 2),
  ('אנטנה', 'tech', 2),
  ('שרת', 'tech', 2),
  ('אחסון בענן', 'tech', 2),
  ('קוד', 'tech', 2),
  ('וירוס מחשב', 'tech', 2),
  ('קישור', 'tech', 2),
  ('בלוקצ''יין', 'tech', 3),
  ('מציאות מדומה', 'tech', 3),
  ('אלגוריתם', 'tech', 3),
  ('סטרימינג', 'tech', 3),
  ('מנוע חיפוש', 'tech', 3),
  ('האקר', 'tech', 3),
  ('מעבד', 'tech', 3),
  ('דפדפן', 'tech', 3),
  ('לוויין', 'tech', 3),
  ('שמש', 'nature', 1),
  ('ירח', 'nature', 1),
  ('גשם', 'nature', 1),
  ('שלג', 'nature', 1),
  ('עץ', 'nature', 1),
  ('פרח', 'nature', 1),
  ('ים', 'nature', 1),
  ('הר', 'nature', 1),
  ('נהר', 'nature', 1),
  ('ענן', 'nature', 1),
  ('כוכב', 'nature', 1),
  ('אש', 'nature', 1),
  ('קשת בענן', 'nature', 2),
  ('רעם', 'nature', 2),
  ('ברק', 'nature', 2),
  ('מפל', 'nature', 2),
  ('יער', 'nature', 2),
  ('מערה', 'nature', 2),
  ('סערה', 'nature', 2),
  ('אגם', 'nature', 2),
  ('שונית אלמוגים', 'nature', 2),
  ('גיא', 'nature', 2),
  ('ערפל', 'nature', 2),
  ('שלולית', 'nature', 2),
  ('ליקוי חמה', 'nature', 3),
  ('זריחה', 'nature', 3),
  ('שקיעה', 'nature', 3),
  ('סופת חול', 'nature', 3),
  ('רעידת אדמה', 'nature', 3),
  ('צונאמי', 'nature', 3),
  ('כוכב שביט', 'nature', 3),
  ('גייזר', 'nature', 3),
  ('שביל החלב', 'nature', 3),
  ('לרקוד', 'actions', 1),
  ('לשיר', 'actions', 1),
  ('לישון', 'actions', 1),
  ('לרוץ', 'actions', 1),
  ('לקפוץ', 'actions', 1),
  ('לאכול', 'actions', 1),
  ('לשתות', 'actions', 1),
  ('לצחוק', 'actions', 1),
  ('לבכות', 'actions', 1),
  ('לצעוק', 'actions', 1),
  ('ללכת', 'actions', 1),
  ('לשחות', 'actions', 1),
  ('לצחצח שיניים', 'actions', 2),
  ('לנהוג', 'actions', 2),
  ('לבשל', 'actions', 2),
  ('לצלם', 'actions', 2),
  ('לנשק', 'actions', 2),
  ('לחבק', 'actions', 2),
  ('להתעטש', 'actions', 2),
  ('להתגלח', 'actions', 2),
  ('ללעוס', 'actions', 2),
  ('לדפדף', 'actions', 2),
  ('לנעול נעליים', 'actions', 2),
  ('לגהק', 'actions', 2),
  ('לשרוק', 'actions', 3),
  ('להתחפש', 'actions', 3),
  ('לסחוט', 'actions', 3),
  ('להתמתח', 'actions', 3),
  ('לצלול', 'actions', 3),
  ('להתגנב', 'actions', 3),
  ('למחוא כפיים', 'actions', 3),
  ('להזיע', 'actions', 3),
  ('לגרגר', 'actions', 3),
  ('אמא', 'people', 1),
  ('אבא', 'people', 1),
  ('סבתא', 'people', 1),
  ('סבא', 'people', 1),
  ('תינוק', 'people', 1),
  ('חבר', 'people', 1),
  ('מלך', 'people', 1),
  ('מלכה', 'people', 1),
  ('נסיכה', 'people', 1),
  ('ליצן', 'people', 1),
  ('גיבור על', 'people', 1),
  ('שודד ים', 'people', 1),
  ('מכשפה', 'people', 2),
  ('ערפד', 'people', 2),
  ('רוח רפאים', 'people', 2),
  ('שכן', 'people', 2),
  ('נינג''ה', 'people', 2),
  ('זומבי', 'people', 2),
  ('דוד', 'people', 2),
  ('חתן', 'people', 2),
  ('כלה', 'people', 2),
  ('תאומים', 'people', 2),
  ('בן דוד', 'people', 2),
  ('פנסיונר', 'people', 2),
  ('קיסר', 'people', 3),
  ('אביר', 'people', 3),
  ('וויקינג', 'people', 3),
  ('נזיר', 'people', 3),
  ('אינדיאני', 'people', 3),
  ('קאובוי', 'people', 3),
  ('ננס', 'people', 3),
  ('ענק', 'people', 3),
  ('מלאך', 'people', 3),
  ('ציור', 'hobbies', 1),
  ('קריאה', 'hobbies', 1),
  ('בישול', 'hobbies', 1),
  ('צילום', 'hobbies', 1),
  ('כתיבה', 'hobbies', 1),
  ('גינון', 'hobbies', 1),
  ('דיג', 'hobbies', 1),
  ('טיולים', 'hobbies', 1),
  ('נגינה', 'hobbies', 1),
  ('פאזל', 'hobbies', 1),
  ('קמפינג', 'hobbies', 1),
  ('משחקי וידאו', 'hobbies', 1),
  ('סריגה', 'hobbies', 2),
  ('פיסול', 'hobbies', 2),
  ('אוריגמי', 'hobbies', 2),
  ('יוגה', 'hobbies', 2),
  ('מדיטציה', 'hobbies', 2),
  ('אספנות בולים', 'hobbies', 2),
  ('רקמה', 'hobbies', 2),
  ('אפייה', 'hobbies', 2),
  ('ג''אגלינג', 'hobbies', 2),
  ('סקייטבורד', 'hobbies', 2),
  ('תיאטרון', 'hobbies', 2),
  ('תפירה', 'hobbies', 2),
  ('קליגרפיה', 'hobbies', 3),
  ('אסטרונומיה', 'hobbies', 3),
  ('עבודות עץ', 'hobbies', 3),
  ('קרמיקה', 'hobbies', 3),
  ('חדר בריחה', 'hobbies', 3),
  ('פארקור', 'hobbies', 3),
  ('צפרות', 'hobbies', 3),
  ('איסוף צדפים', 'hobbies', 3),
  ('בניית דגמים', 'hobbies', 3),
  ('נפיחה', 'funny', 1),
  ('שיהוק', 'funny', 1),
  ('גרב מסריח', 'funny', 1),
  ('מסיכת פנים', 'funny', 1),
  ('קקי של ציפור', 'funny', 1),
  ('גלגלי עיניים', 'funny', 1),
  ('שפם מזויף', 'funny', 1),
  ('פאה', 'funny', 1),
  ('חיוך מביך', 'funny', 1),
  ('ריקוד מביך', 'funny', 1),
  ('סלפי', 'funny', 1),
  ('תחפושת חיות', 'funny', 1),
  ('אנשים שנופלים', 'funny', 2),
  ('מבטא מצחיק', 'funny', 2),
  ('קול של ברווז', 'funny', 2),
  ('תנוחת ישיבה מוזרה', 'funny', 2),
  ('בדיחת אבא', 'funny', 2),
  ('נשיקה באוויר', 'funny', 2),
  ('חיקוי', 'funny', 2),
  ('שיר מקלחת', 'funny', 2),
  ('מקל סלפי', 'funny', 2),
  ('חולצה הפוכה', 'funny', 2),
  ('שיער פרוע', 'funny', 2),
  ('נעל חורקת', 'funny', 2),
  ('צחוק מתפקע', 'funny', 3),
  ('תמונת דרכון', 'funny', 3),
  ('ריקוד בחתונה', 'funny', 3),
  ('קריוקי', 'funny', 3),
  ('סנדלים עם גרביים', 'funny', 3),
  ('סבא נרדם', 'funny', 3),
  ('פרצוף חמוץ', 'funny', 3),
  ('זיוף בשירה', 'funny', 3),
  ('מכנסיים קרועים', 'funny', 3),
  ('דגל ישראל', 'israel', 1),
  ('ים המלח', 'israel', 1),
  ('תל אביב', 'israel', 1),
  ('ירושלים', 'israel', 1),
  ('הכותל', 'israel', 1),
  ('חנוכה', 'israel', 1),
  ('פורים', 'israel', 1),
  ('פסח', 'israel', 1),
  ('סוכה', 'israel', 1),
  ('מנגל', 'israel', 1),
  ('כנרת', 'israel', 1),
  ('אילת', 'israel', 1),
  ('חיפה', 'israel', 2),
  ('באר שבע', 'israel', 2),
  ('מצדה', 'israel', 2),
  ('הנגב', 'israel', 2),
  ('יום העצמאות', 'israel', 2),
  ('סופגניה', 'israel', 2),
  ('שבת', 'israel', 2),
  ('קיבוץ', 'israel', 2),
  ('טרמפ', 'israel', 2),
  ('שוק הכרמל', 'israel', 2),
  ('נמל יפו', 'israel', 2),
  ('כיפת ברזל', 'israel', 2),
  ('מצפה רמון', 'israel', 3),
  ('ראש הנקרה', 'israel', 3),
  ('כביש 6', 'israel', 3),
  ('רכבת קלה', 'israel', 3),
  ('עין גדי', 'israel', 3),
  ('פלמחים', 'israel', 3),
  ('בית שאן', 'israel', 3),
  ('קיסריה', 'israel', 3),
  ('צפת', 'israel', 3),
  ('מוזיקה', 'culture', 1),
  ('גיטרה', 'culture', 1),
  ('פסנתר', 'culture', 1),
  ('תופים', 'culture', 1),
  ('רומן', 'culture', 1),
  ('שיר', 'culture', 1),
  ('קונצרט', 'culture', 1),
  ('פסטיבל', 'culture', 1),
  ('פסל', 'culture', 1),
  ('במה', 'culture', 1),
  ('מיקרופון', 'culture', 1),
  ('כרטיס', 'culture', 1),
  ('אופרה', 'culture', 2),
  ('בלט', 'culture', 2),
  ('סטנד אפ', 'culture', 2),
  ('קריקטורה', 'culture', 2),
  ('קומיקס', 'culture', 2),
  ('גרפיטי', 'culture', 2),
  ('גלריה', 'culture', 2),
  ('פנטומימה', 'culture', 2),
  ('יצירת מופת', 'culture', 2),
  ('פרס אוסקר', 'culture', 2),
  ('רוק', 'culture', 2),
  ('ג''אז', 'culture', 2),
  ('ביטלס', 'culture', 3),
  ('מונה ליזה', 'culture', 3),
  ('שייקספיר', 'culture', 3),
  ('בטהובן', 'culture', 3),
  ('פיקאסו', 'culture', 3),
  ('מוצרט', 'culture', 3),
  ('פרס נובל', 'culture', 3),
  ('מחזמר', 'culture', 3),
  ('רנסנס', 'culture', 3)
) as v(word, slug, difficulty)
join public.categories c on c.slug = v.slug
on conflict (word, category_id) do nothing;
