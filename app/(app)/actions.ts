'use server';

import { createClient } from '@/lib/supabase/server';
import { createGameSchema, joinCodeSchema, settingsSchema } from '@/lib/schemas';
import { toHebrewError } from '@/lib/errors';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? 'הנתונים שהוזנו אינם תקינים';
}

/** Server-side validation with Zod, then the database re-validates everything again. */
export async function createGameAction(input: unknown): Promise<ActionResult<{ gameId: string }>> {
  const parsed = createGameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_game', {
    p_name: v.name,
    p_num_teams: v.numTeams,
    p_max_players: v.maxPlayers,
    p_turn_seconds: v.turnSeconds,
    p_win_points: v.winPoints,
    p_difficulty: v.difficulty,
    p_category_ids: v.categoryIds,
    p_is_private: v.isPrivate,
  });
  if (error) return { ok: false, error: toHebrewError(error) };
  return { ok: true, data: { gameId: data as string } };
}

export async function joinGameAction(code: unknown): Promise<ActionResult<{ gameId: string; status: string }>> {
  const parsed = joinCodeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_game', { p_code: parsed.data });
  if (error) return { ok: false, error: toHebrewError(error) };

  const gameId = data as string;
  const { data: game } = await supabase.from('games').select('status').eq('id', gameId).maybeSingle();
  return { ok: true, data: { gameId, status: (game?.status as string | undefined) ?? 'lobby' } };
}

export async function updateSettingsAction(gameId: string, input: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc('update_settings', {
    p_game: gameId,
    p_num_teams: v.numTeams,
    p_max_players: v.maxPlayers,
    p_turn_seconds: v.turnSeconds,
    p_win_points: v.winPoints,
    p_difficulty: v.difficulty,
    p_category_ids: v.categoryIds,
  });
  if (error) return { ok: false, error: toHebrewError(error) };
  return { ok: true, data: undefined };
}
