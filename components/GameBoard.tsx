'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGame, useGameRedirect } from '@/hooks/useGame';
import { useServerClock } from '@/hooks/useServerClock';
import { gameApi } from '@/lib/game-api';
import { createClient } from '@/lib/supabase/client';
import { toHebrewError } from '@/lib/errors';
import { totalScore } from '@/lib/game-logic';
import { play } from '@/lib/sound';
import { Avatar } from '@/components/Avatar';
import { ErrorState } from '@/components/ErrorState';
import { GameTimer } from '@/components/GameTimer';
import { LoadingState } from '@/components/LoadingState';
import { PlayerList } from '@/components/PlayerList';
import { ScoreBoard } from '@/components/ScoreBoard';
import { SoundToggle } from '@/components/SoundToggle';
import { useToast } from '@/components/Toast';
import { WordCard } from '@/components/WordCard';

export function GameBoard({ gameId, userId }: { gameId: string; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const { state, loading, error, connected, online, refetch } = useGame(gameId, userId);
  const clock = useServerClock();
  useGameRedirect(state, gameId, 'playing');

  const [word, setWord] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plusKey, setPlusKey] = useState(0);
  const prevTotal = useRef<number | null>(null);

  const turn = state?.turn ?? null;
  const isExplainer = !!turn && turn.explainer_id === userId;
  const turnId = turn?.id;
  const turnStatus = turn?.status;

  // After a refresh the explainer re-reads the secret word (RLS: only the explainer can).
  useEffect(() => {
    if (!turnId || turnStatus !== 'active' || !isExplainer) {
      setWord(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('turn_secrets')
      .select('word')
      .eq('turn_id', turnId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.word) setWord((prev) => prev ?? (data.word as string));
      });
    return () => {
      cancelled = true;
    };
  }, [turnId, turnStatus, isExplainer, supabase]);

  // Sound for spectators when a point lands.
  const total = state ? totalScore(state.teams) : null;
  useEffect(() => {
    if (total === null) return;
    if (prevTotal.current !== null && total > prevTotal.current && !isExplainer) play('correct');
    prevTotal.current = total;
  }, [total, isExplainer]);

  // Many clients may call this when time is up; the database ends the turn exactly once.
  const expire = useCallback(async () => {
    if (!turnId) return;
    const mine = turn?.explainer_id === userId;
    if (!mine) await new Promise((r) => setTimeout(r, Math.random() * 600));
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await gameApi.endTurn(turnId);
        break;
      } catch (e) {
        const msg = toHebrewError(e);
        if (!msg.includes('עדיין רץ')) break; // anything else won't improve by retrying
        await new Promise((r) => setTimeout(r, 700));
      }
    }
    void refetch();
  }, [turnId, turn?.explainer_id, userId, refetch]);

  if (loading) return <LoadingState label="נכנסים למשחק…" />;
  if (error && !state) {
    return <ErrorState message={error} onRetry={refetch} action={<Link href="/dashboard" className="btn-ghost">לדף הבית</Link>} />;
  }
  if (!state) return <LoadingState />;

  const { game, teams, players, settings } = state;
  const team = teams.find((t) => t.id === turn?.team_id);
  const explainer = players.find((p) => p.user_id === turn?.explainer_id);
  const teamPlayerIds = new Set(state.teamPlayers.filter((tp) => tp.team_id === turn?.team_id).map((tp) => tp.user_id));
  const isHost = game.host_id === userId;
  const amInTeam = teamPlayerIds.has(userId);
  const explainerOnline = turn ? online.has(turn.explainer_id) : true;
  const staleReady = turn?.status === 'ready' && clock.now() - new Date(turn.created_at).getTime() > 45_000;

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(toHebrewError(e), 'error');
      void refetch();
    } finally {
      setBusy(false);
    }
  };

  const begin = () =>
    act(async () => {
      if (!turn) return;
      const w = await gameApi.beginTurn(turn.id);
      setWord(w);
      play('start');
      await refetch();
    });

  const correct = () =>
    act(async () => {
      if (!turn) return;
      const w = await gameApi.markCorrect(turn.id);
      if (w) {
        setWord(w);
        setPlusKey((k) => k + 1);
        play('correct');
      } else {
        await refetch();
      }
    });

  const skip = () =>
    act(async () => {
      if (!turn) return;
      const w = await gameApi.skipWord(turn.id);
      if (w) {
        setWord(w);
        play('skip');
      } else {
        await refetch();
      }
    });

  const finishTurn = () =>
    act(async () => {
      if (!turn) return;
      await gameApi.endTurn(turn.id);
      await refetch();
    });

  const leave = async () => {
    if (!window.confirm('לצאת מהמשחק? לא תוכלו לחזור אליו אחר כך.')) return;
    try {
      await gameApi.leaveGame(gameId);
      router.replace('/dashboard');
    } catch (e) {
      toast(toHebrewError(e), 'error');
    }
  };

  return (
    <div className="space-y-4">
      {!connected && (
        <div className="rounded-2xl bg-tomato px-4 py-2 text-center text-sm font-bold text-white" role="alert">
          החיבור בזמן אמת התנתק. מנסים להתחבר מחדש…
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h1 className="truncate font-display text-xl">{game.name}</h1>
        <SoundToggle />
      </div>

      <ScoreBoard teams={teams} activeTeamId={turn?.team_id} winPoints={settings.win_points} />

      {!turn ? (
        <LoadingState label="מכינים את התור הבא…" />
      ) : (
        <section key={turn.id} className="animate-slideIn space-y-4" aria-live="polite">
          <div className="card flex items-center gap-3 !p-3">
            <Avatar emoji={explainer?.profiles.avatar} seed={explainer?.profiles.username} size="lg" online={explainerOnline} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-ink/60">תור {turn.turn_number} · {team?.name}</div>
              <div className="truncate font-display text-2xl">{isExplainer ? 'התור שלך להסביר!' : `${explainer?.profiles.username ?? '…'} מסביר/ה`}</div>
            </div>
            <div className="text-center text-sm font-bold">
              <div>✅ {turn.correct_count}</div>
              <div className="text-ink/60">⏭️ {turn.skipped_count}</div>
            </div>
          </div>

          {turn.status === 'ready' && (
            <div className="card space-y-4 text-center">
              {isExplainer ? (
                <>
                  <div className="text-6xl">🎤</div>
                  <p className="font-bold">מוכנים? כשתלחצו הטיימר מתחיל ותראו את המילה הראשונה.</p>
                  <button type="button" className="btn-primary btn-lg w-full" disabled={busy} onClick={begin}>
                    ▶️ התחלת תור ({settings.turn_seconds} שניות)
                  </button>
                </>
              ) : (
                <>
                  <div className="animate-wiggle text-6xl">⏳</div>
                  <p className="font-bold">
                    {amInTeam ? 'הקבוצה שלכם עומדת לשחק. תתכוננו לנחש!' : `קבוצת ${team?.name} עומדת לשחק.`} ממתינים ש{explainer?.profiles.username ?? 'המסביר'} יתחיל…
                  </p>
                  {!explainerOnline && <p className="text-sm font-bold text-tomato">נראה שהשחקן הזה התנתק.</p>}
                  {(isHost || staleReady) && (
                    <button type="button" className="btn-ghost" disabled={busy} onClick={finishTurn}>
                      דילוג על התור
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {turn.status === 'active' && turn.ends_at && (
            <>
              <GameTimer endsAt={turn.ends_at} totalSeconds={settings.turn_seconds} now={clock.now} onExpire={expire} />
              {isExplainer ? (
                <div className="relative space-y-4">
                  <WordCard word={word} />
                  {plusKey > 0 && (
                    <span key={plusKey} className="pointer-events-none absolute start-1/2 top-0 animate-floatUp font-display text-5xl text-mint">
                      +1
                    </span>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" className="btn-mint btn-lg" disabled={busy || !word} onClick={correct}>
                      ✅ ניחשו!
                    </button>
                    <button type="button" className="btn-ghost btn-lg" disabled={busy || !word} onClick={skip}>
                      ⏭️ דלג
                    </button>
                  </div>
                  <button type="button" className="btn-ghost w-full" disabled={busy} onClick={finishTurn}>
                    סיום תור
                  </button>
                </div>
              ) : (
                <div className="card space-y-2 text-center">
                  <div className="text-6xl">{amInTeam ? '🙋' : '👀'}</div>
                  <p className="font-display text-2xl">{amInTeam ? 'נחשו את המילה!' : 'קבוצה יריבה משחקת'}</p>
                  <p className="text-ink/60">
                    {amInTeam ? `${explainer?.profiles.username ?? 'המסביר'} מסביר/ה. קראו את הניחושים בקול רם.` : 'שימו לב שהמסביר לא אומר את המילה בעצמו.'}
                  </p>
                  {!explainerOnline && <p className="text-sm font-bold text-tomato">המסביר התנתק. התור יסתיים עם סיום הזמן.</p>}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section aria-label="שחקנים">
        <PlayerList players={players} online={online} hostId={game.host_id} meId={userId} />
      </section>
      <button type="button" className="btn-ghost w-full !text-sm" onClick={leave}>
        יציאה מהמשחק
      </button>
    </div>
  );
}
