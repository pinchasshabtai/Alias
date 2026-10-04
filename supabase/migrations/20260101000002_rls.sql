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
