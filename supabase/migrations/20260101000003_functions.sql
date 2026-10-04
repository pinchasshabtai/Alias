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
