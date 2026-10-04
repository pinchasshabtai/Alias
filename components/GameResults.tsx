'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useGame, useGameRedirect } from '@/hooks/useGame';
import { createClient } from '@/lib/supabase/client';
import { standings } from '@/lib/game-logic';
import { play } from '@/lib/sound';
import type { GameResultRow } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { CreateGameModal } from '@/components/CreateGameModal';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { SoundToggle } from '@/components/SoundToggle';

const CONFETTI_COLORS = ['#FF5A5F', '#FFC93C', '#2D7DFF', '#22C55E', '#EC4899', '#8B5CF6'];
const PLACES = ['🥇 מקום ראשון', '🥈 מקום שני', '🥉 מקום שלישי', 'מקום רביעי'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: (i * 97) % 100,
        delay: ((i * 53) % 25) / 10,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 8 + ((i * 7) % 8),
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti rounded-sm"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.6, background: p.color, animationDelay: `${p.delay}s` }}
        />
      ))}
    </div>
  );
}

export function GameResults({ gameId, userId }: { gameId: string; userId: string }) {
  const { state, loading, error, refetch } = useGame(gameId, userId);
  useGameRedirect(state, gameId, 'finished');
  const [results, setResults] = useState<GameResultRow[]>([]);
  const [rematch, setRematch] = useState(false);
  const played = useRef(false);

  useEffect(() => {
    if (state?.game.status !== 'finished') return;
    createClient()
      .from('game_results')
      .select('user_id, team_id, team_score, won, correct_count, skipped_count, explained_turns, profiles(id, username, avatar)')
      .eq('game_id', gameId)
      .then(({ data }) => setResults((data ?? []) as unknown as GameResultRow[]));
  }, [state?.game.status, gameId]);

  const finished = state?.game.status === 'finished';
  useEffect(() => {
    if (finished && !played.current) {
      played.current = true;
      play('win');
    }
  }, [finished]);

  if (loading) return <LoadingState label="סופרים נקודות…" />;
  if (error && !state) return <ErrorState message={error} onRetry={refetch} action={<Link href="/dashboard" className="btn-ghost">לדף הבית</Link>} />;
  if (!state || !finished) return <LoadingState />;

  const ranked = standings(state.teams);
  const winner = ranked[0];
  const myResult = results.find((r) => r.user_id === userId);
  const iWon = myResult?.won ?? false;

  return (
    <div className="space-y-5">
      <Confetti />
      <div className="flex justify-end"><SoundToggle /></div>

      <section className="card animate-pop bg-sun text-center">
        <div className="text-7xl">🏆</div>
        <h1 className="mt-2 font-display text-4xl">הקבוצה המנצחת!</h1>
        <p className="mt-1 font-display text-3xl" style={{ color: winner.color }}>{winner.name}</p>
        <p className="mt-2 font-bold">{iWon ? 'כל הכבוד, ניצחתם! 🎉' : 'משחק מצוין, ברוך הבא לסיבוב נוסף!'}</p>
      </section>

      <section className="grid gap-4">
        {ranked.map((team, i) => {
          const members = results.filter((r) => r.team_id === team.id);
          const correct = members.reduce((s, m) => s + m.correct_count, 0);
          const skipped = members.reduce((s, m) => s + m.skipped_count, 0);
          return (
            <article key={team.id} className="overflow-hidden rounded-3xl border-2 border-ink/10 bg-white shadow-card">
              <header className="flex items-center justify-between px-4 py-3 text-white" style={{ background: team.color }}>
                <div>
                  <div className="text-sm font-bold opacity-90">{PLACES[i]}</div>
                  <h2 className="font-display text-2xl">{team.name}</h2>
                </div>
                <div className="font-display text-5xl">{team.score}</div>
              </header>
              <div className="grid grid-cols-2 gap-2 border-b-2 border-ink/5 p-3 text-center text-sm">
                <div className="rounded-2xl bg-mint/15 p-2"><div className="font-display text-2xl">{correct}</div>מילים נכונות</div>
                <div className="rounded-2xl bg-sun/30 p-2"><div className="font-display text-2xl">{skipped}</div>דילוגים</div>
              </div>
              <ul className="divide-y divide-ink/5">
                {members.map((m) => (
                  <li key={m.user_id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar emoji={m.profiles.avatar} seed={m.profiles.username} size="sm" />
                    <span className="flex-1 truncate font-bold">{m.profiles.username}{m.user_id === userId && ' (אני)'}</span>
                    <span className="text-sm text-ink/60">{m.explained_turns} תורות · {m.correct_count} נוחשו</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      <div className="grid gap-3 pb-4 sm:grid-cols-2">
        <button type="button" className="btn-primary btn-lg" onClick={() => setRematch(true)}>🔁 משחק נוסף</button>
        <Link href="/dashboard" className="btn-ghost btn-lg">🏠 חזרה לדף הבית</Link>
      </div>

      {rematch && (
        <CreateGameModal
          open
          onClose={() => setRematch(false)}
          initial={{
            name: `${state.game.name} (סיבוב נוסף)`.slice(0, 40),
            numTeams: state.settings.num_teams,
            maxPlayers: state.settings.max_players,
            turnSeconds: state.settings.turn_seconds,
            winPoints: state.settings.win_points,
            difficulty: state.settings.difficulty,
            categoryIds: state.settings.category_ids,
          }}
        />
      )}
    </div>
  );
}
