'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toHebrewError } from '@/lib/errors';
import type { Game, GameSettingsRow, PlayerRow, Team, TeamPlayer, Turn } from '@/lib/types';

export interface GameState {
  game: Game;
  settings: GameSettingsRow;
  teams: Team[];
  teamPlayers: TeamPlayer[];
  players: PlayerRow[];
  turn: Turn | null;
}

const TABLES = ['game_settings', 'teams', 'team_players', 'game_players', 'turns'] as const;

/**
 * Loads the full game snapshot and keeps it fresh via Supabase Realtime.
 * Safety nets: a periodic refetch (fast while the socket is down) so a dropped connection
 * or a refresh always converges to the server's truth.
 */
export function useGame(gameId: string, userId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const seq = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refetch = useCallback(async () => {
    const mySeq = ++seq.current;
    try {
      const [g, s, t, tp, pl, tu] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).maybeSingle(),
        supabase.from('game_settings').select('*').eq('game_id', gameId).maybeSingle(),
        supabase.from('teams').select('*').eq('game_id', gameId).order('idx'),
        supabase.from('team_players').select('user_id, team_id').eq('game_id', gameId),
        supabase
          .from('game_players')
          .select('user_id, joined_at, profiles(id, username, avatar)')
          .eq('game_id', gameId)
          .order('joined_at'),
        supabase.from('turns').select('*').eq('game_id', gameId).order('turn_number', { ascending: false }).limit(1),
      ]);
      if (mySeq !== seq.current) return; // a newer fetch is in flight
      const firstError = g.error ?? s.error ?? t.error ?? tp.error ?? pl.error ?? tu.error;
      if (firstError) throw firstError;
      if (!g.data || !s.data) {
        setError(toHebrewError('GAME_NOT_FOUND'));
        setLoading(false);
        return;
      }
      setState({
        game: g.data as Game,
        settings: s.data as GameSettingsRow,
        teams: (t.data ?? []) as Team[],
        teamPlayers: (tp.data ?? []) as TeamPlayer[],
        players: (pl.data ?? []) as unknown as PlayerRow[],
        turn: ((tu.data ?? [])[0] as Turn | undefined) ?? null,
      });
      setError(null);
      setLoading(false);
    } catch (e) {
      if (mySeq !== seq.current) return;
      setError(toHebrewError(e));
      setLoading(false);
    }
  }, [gameId, supabase]);

  const scheduleRefetch = useCallback(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void refetch(), 60);
  }, [refetch]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const channel = supabase.channel(`game:${gameId}`, { config: { presence: { key: userId } } });

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, scheduleRefetch);
    TABLES.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `game_id=eq.${gameId}` }, scheduleRefetch);
    });
    channel.on('presence', { event: 'sync' }, () => {
      setOnline(new Set(Object.keys(channel.presenceState())));
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        await channel.track({ at: Date.now() });
        void refetch(); // catch anything missed while disconnected
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnected(false);
      }
    });

    return () => {
      clearTimeout(debounce.current);
      void supabase.removeChannel(channel);
    };
  }, [gameId, userId, supabase, scheduleRefetch, refetch]);

  useEffect(() => {
    const id = setInterval(() => void refetch(), connected ? 10_000 : 3_000);
    return () => clearInterval(id);
  }, [connected, refetch]);

  return { state, loading, error, connected, online, refetch };
}

/** Sends the player to the right screen for the game's current status. */
export function useGameRedirect(state: GameState | null, gameId: string, current: 'lobby' | 'playing' | 'finished') {
  const router = useRouter();
  const status = state?.game.status;
  useEffect(() => {
    if (!status || status === current) return;
    const path = status === 'lobby' ? 'lobby' : status === 'playing' ? 'play' : 'results';
    router.replace(`/games/${gameId}/${path}`);
  }, [status, current, gameId, router]);
}
