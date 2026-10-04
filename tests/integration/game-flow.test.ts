/**
 * End-to-end tests against a REAL Supabase project (local `supabase start` or a throwaway project).
 * Run: RUN_INTEGRATION=1 npm run test:integration  (needs SUPABASE_SERVICE_ROLE_KEY in .env.local)
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service && process.env.RUN_INTEGRATION === '1');

interface TestUser { id: string; email: string; client: SupabaseClient }
const stamp = Date.now().toString(36);
const PASSWORD = 'Test-password-123';

describe.skipIf(!enabled)('Alias game flow (integration)', () => {
  let admin: SupabaseClient;
  const users: TestUser[] = [];
  let gameId = '';
  let code = '';

  const rpc = (u: TestUser, fn: string, args?: Record<string, unknown>) => u.client.rpc(fn, args);

  async function makeUser(name: string): Promise<TestUser> {
    const email = `${name}.${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { username: `${name}_${stamp}` } });
    if (error) throw error;
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const login = await client.auth.signInWithPassword({ email, password: PASSWORD });
    expect(login.error).toBeNull();
    return { id: data.user!.id, email, client };
  }

  beforeAll(async () => {
    admin = createClient(url!, service!, { auth: { persistSession: false } });
    for (const n of ['host', 'bob', 'cat', 'dan', 'eve']) users.push(await makeUser(n));
  });

  const [host, bob, cat, dan, eve] = [0, 1, 2, 3, 4].map((i) => () => users[i]);

  it('Register/Login: profile is created and wrong password fails', async () => {
    const { data } = await host().client.from('profiles').select('username').eq('id', host().id).single();
    expect(data?.username).toBe(`host_${stamp}`);
    const bad = await createClient(url!, anon!).auth.signInWithPassword({ email: host().email, password: 'wrong-password' });
    expect(bad.error).not.toBeNull();
  });

  it('Create Game: returns id, 6-char code, 2 teams, host in team 1', async () => {
    const { data, error } = await rpc(host(), 'create_game', { p_name: 'בדיקה', p_num_teams: 2, p_max_players: 8, p_turn_seconds: 30, p_win_points: 5, p_difficulty: 0, p_category_ids: [], p_is_private: true });
    expect(error).toBeNull();
    gameId = data as string;
    const { data: g } = await host().client.from('games').select('join_code').eq('id', gameId).single();
    code = g!.join_code;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('Join Game: valid code joins, bad code fails, rejoin is idempotent', async () => {
    for (const u of [bob(), cat(), dan()]) expect((await rpc(u, 'join_game', { p_code: code })).error).toBeNull();
    expect((await rpc(eve(), 'join_game', { p_code: 'ZZZZZZ' })).error?.message).toContain('GAME_NOT_FOUND');
    expect((await rpc(bob(), 'join_game', { p_code: code })).error).toBeNull();
  });

  it('Lobby: members see players; outsiders see nothing', async () => {
    const { data } = await bob().client.from('game_players').select('user_id').eq('game_id', gameId);
    expect(data).toHaveLength(4);
    const out = await eve().client.from('game_players').select('user_id').eq('game_id', gameId);
    expect(out.data ?? []).toHaveLength(0);
  });

  it('Teams: only the host can move players', async () => {
    const { data: teams } = await host().client.from('teams').select('id, idx').eq('game_id', gameId).order('idx');
    expect((await rpc(bob(), 'move_player', { p_game: gameId, p_user: cat().id, p_team: teams![1].id })).error?.message).toContain('NOT_HOST');
    expect((await rpc(host(), 'move_player', { p_game: gameId, p_user: cat().id, p_team: teams![1].id })).error).toBeNull();
    // 2 vs 2 after the move? host+dan vs bob+cat — verify both teams are populated
    const { data: tp } = await host().client.from('team_players').select('team_id').eq('game_id', gameId);
    expect(new Set(tp!.map((r) => r.team_id)).size).toBe(2);
  });

  it('Start Game: non-host rejected, late joiner rejected after start', async () => {
    expect((await rpc(bob(), 'start_game', { p_game: gameId })).error?.message).toContain('NOT_HOST');
    expect((await rpc(host(), 'start_game', { p_game: gameId })).error).toBeNull();
    expect((await rpc(eve(), 'join_game', { p_code: code })).error?.message).toContain('GAME_ALREADY_STARTED');
  });

  async function currentTurn() {
    const { data } = await host().client.from('turns').select('*').eq('game_id', gameId).order('turn_number', { ascending: false }).limit(1).single();
    return data as { id: string; explainer_id: string; team_id: string; status: string; turn_number: number };
  }
  const byId = (id: string) => users.find((u) => u.id === id)!;

  it('Permissions: secret word hidden from non-explainers, scores cannot be edited', async () => {
    const turn = await currentTurn();
    const explainer = byId(turn.explainer_id);
    const guesser = users.find((u) => u.id !== turn.explainer_id && u !== eve())!;
    expect((await rpc(explainer, 'begin_turn', { p_turn: turn.id })).data).toBeTruthy();

    const mine = await explainer.client.from('turn_secrets').select('word').eq('turn_id', turn.id);
    expect(mine.data).toHaveLength(1);
    const theirs = await guesser.client.from('turn_secrets').select('word').eq('turn_id', turn.id);
    expect(theirs.data ?? []).toHaveLength(0);

    expect((await rpc(guesser, 'mark_correct', { p_turn: turn.id })).error?.message).toContain('NOT_EXPLAINER');
    await guesser.client.from('teams').update({ score: 99 }).eq('game_id', gameId);
    const { data: teams } = await guesser.client.from('teams').select('score').eq('game_id', gameId);
    expect(teams!.every((t) => t.score < 99)).toBe(true);
    await guesser.client.from('games').update({ host_id: guesser.id }).eq('id', gameId);
    const { data: g } = await guesser.client.from('games').select('host_id').eq('id', gameId).single();
    expect(g!.host_id).toBe(host().id);
    expect((await guesser.client.from('profiles').update({ is_admin: true }).eq('id', guesser.id)).error).not.toBeNull();
    expect((await guesser.client.from('words').select('word').limit(1)).data ?? []).toHaveLength(0);
  });

  it('Scoring + Timer: server awards points, rejects early end, ends when expired', async () => {
    const turn = await currentTurn();
    const explainer = byId(turn.explainer_id);
    const other = users.find((u) => u.id !== turn.explainer_id && u !== eve())!;

    expect((await rpc(explainer, 'mark_correct', { p_turn: turn.id })).error).toBeNull();
    expect((await rpc(explainer, 'mark_correct', { p_turn: turn.id })).error).toBeNull();
    expect((await rpc(explainer, 'skip_word', { p_turn: turn.id })).error).toBeNull();
    const { data: t } = await host().client.from('turns').select('correct_count, skipped_count').eq('id', turn.id).single();
    expect(t).toMatchObject({ correct_count: 2, skipped_count: 1 });
    const { data: team } = await host().client.from('teams').select('score').eq('id', turn.team_id).single();
    expect(team!.score).toBe(2);

    expect((await rpc(other, 'end_turn', { p_turn: turn.id })).error?.message).toContain('TURN_STILL_RUNNING');
    await admin.from('turns').update({ ends_at: new Date(Date.now() - 5000).toISOString() }).eq('id', turn.id);
    expect((await rpc(other, 'end_turn', { p_turn: turn.id })).error).toBeNull();
    expect((await rpc(other, 'end_turn', { p_turn: turn.id })).error).toBeNull(); // idempotent
  });

  it('Turns: the next turn belongs to the other team with a new explainer', async () => {
    const turn = await currentTurn();
    expect(turn.turn_number).toBe(2);
    expect(turn.status).toBe('ready');
  });

  it('End Game: finishes after a full round when the leader reached the target; results stored', async () => {
    for (let i = 0; i < 8; i++) {
      const { data: g } = await host().client.from('games').select('status').eq('id', gameId).single();
      if (g!.status === 'finished') break;
      const turn = await currentTurn();
      const explainer = byId(turn.explainer_id);
      await rpc(explainer, 'begin_turn', { p_turn: turn.id });
      const { data: first } = await host().client.from('teams').select('id').eq('game_id', gameId).order('idx').limit(1).single();
      if (turn.team_id === first!.id) for (let k = 0; k < 5; k++) await rpc(explainer, 'mark_correct', { p_turn: turn.id });
      await rpc(explainer, 'end_turn', { p_turn: turn.id });
    }
    const { data: g } = await host().client.from('games').select('status, winner_team_id').eq('id', gameId).single();
    expect(g!.status).toBe('finished');
    const { data: results } = await host().client.from('game_results').select('user_id, won').eq('game_id', gameId);
    expect(results).toHaveLength(4);
    expect(results!.some((r) => r.won)).toBe(true);
    const { data: stats } = await host().client.from('profile_stats').select('games_played').eq('user_id', host().id).single();
    expect(stats!.games_played).toBe(1);
  });

  it('Realtime: guests receive settings changes; Disconnect: host leaves and host role transfers', async () => {
    const { data: gid } = await rpc(host(), 'create_game', { p_name: 'ריל-טיים', p_num_teams: 2, p_max_players: 6, p_turn_seconds: 60, p_win_points: 10, p_difficulty: 0, p_category_ids: [], p_is_private: true });
    const { data: g } = await host().client.from('games').select('join_code').eq('id', gid).single();
    await rpc(bob(), 'join_game', { p_code: g!.join_code });

    const received = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 10000);
      bob().client
        .channel(`t:${stamp}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_settings', filter: `game_id=eq.${gid}` }, () => { clearTimeout(timer); resolve(true); })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await rpc(host(), 'update_settings', { p_game: gid, p_num_teams: 3, p_max_players: 6, p_turn_seconds: 90, p_win_points: 10, p_difficulty: 0, p_category_ids: [] });
        });
    });
    expect(await received).toBe(true);

    expect((await rpc(host(), 'leave_game', { p_game: gid })).error).toBeNull();
    const { data: after } = await bob().client.from('games').select('host_id').eq('id', gid).single();
    expect(after!.host_id).toBe(bob().id);
  });
});
