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
