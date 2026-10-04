import { createClient } from '@/lib/supabase/client';

/**
 * Thin wrappers around the server-side game RPCs. The database validates everything
 * (identity comes from the JWT, never from arguments), so these are safe to call from the browser.
 */
async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const gameApi = {
  startGame: (gameId: string) => call<void>('start_game', { p_game: gameId }),
  leaveGame: (gameId: string) => call<void>('leave_game', { p_game: gameId }),
  kickPlayer: (gameId: string, userId: string) => call<void>('kick_player', { p_game: gameId, p_user: userId }),
  movePlayer: (gameId: string, userId: string, teamId: string) =>
    call<void>('move_player', { p_game: gameId, p_user: userId, p_team: teamId }),
  beginTurn: (turnId: string) => call<string | null>('begin_turn', { p_turn: turnId }),
  markCorrect: (turnId: string) => call<string | null>('mark_correct', { p_turn: turnId }),
  skipWord: (turnId: string) => call<string | null>('skip_word', { p_turn: turnId }),
  endTurn: (turnId: string) => call<void>('end_turn', { p_turn: turnId }),
  inviteFriend: (gameId: string, userId: string) => call<void>('invite_friend', { p_game: gameId, p_user: userId }),
  acceptInvite: (inviteId: string) => call<string>('accept_invite', { p_invite: inviteId }),
  serverNow: () => call<string>('server_now'),
};
