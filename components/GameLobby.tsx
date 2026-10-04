'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGame, useGameRedirect } from '@/hooks/useGame';
import { gameApi } from '@/lib/game-api';
import { updateSettingsAction } from '@/app/(app)/actions';
import { toHebrewError } from '@/lib/errors';
import { canStartGame, groupPlayersByTeam } from '@/lib/game-logic';
import { fetchFriends, type PublicProfile } from '@/lib/friends';
import { createClient } from '@/lib/supabase/client';
import { inviteUrl } from '@/lib/utils';
import type { SettingsValues } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { ErrorState } from '@/components/ErrorState';
import { GameSettings } from '@/components/GameSettings';
import { LoadingState } from '@/components/LoadingState';
import { PlayerList } from '@/components/PlayerList';
import { SoundToggle } from '@/components/SoundToggle';
import { TeamCard } from '@/components/TeamCard';
import { useToast } from '@/components/Toast';

function InviteFriends({ gameId, userId, inGame }: { gameId: string; userId: string; inGame: Set<string> }) {
  const { toast } = useToast();
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    void fetchFriends(createClient(), userId).then(setFriends);
  }, [userId]);

  const available = friends.filter((f) => !inGame.has(f.id));
  if (available.length === 0) return <p className="text-sm text-ink/60">אין חברים להזמנה כרגע. אפשר להוסיף חברים בעמוד “חברים”.</p>;

  return (
    <ul className="space-y-2">
      {available.map((f) => (
        <li key={f.id} className="flex items-center gap-3">
          <Avatar emoji={f.avatar} seed={f.username} size="sm" />
          <span className="flex-1 truncate font-bold">{f.username}</span>
          <button
            type="button"
            className="btn-ghost !px-3 !py-1.5 text-sm"
            disabled={sent.has(f.id)}
            onClick={async () => {
              try {
                await gameApi.inviteFriend(gameId, f.id);
                setSent((s) => new Set(s).add(f.id));
                toast(`ההזמנה נשלחה ל${f.username}`, 'success');
              } catch (e) {
                toast(toHebrewError(e), 'error');
              }
            }}
          >
            {sent.has(f.id) ? 'נשלח ✓' : 'הזמנה'}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function GameLobby({ gameId, userId }: { gameId: string; userId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { state, loading, error, connected, online, refetch } = useGame(gameId, userId);
  useGameRedirect(state, gameId, 'lobby');

  const [draft, setDraft] = useState<SettingsValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);

  const server = useMemo<SettingsValues | null>(
    () =>
      state && {
        numTeams: state.settings.num_teams,
        maxPlayers: state.settings.max_players,
        turnSeconds: state.settings.turn_seconds,
        winPoints: state.settings.win_points,
        difficulty: state.settings.difficulty,
        categoryIds: state.settings.category_ids,
      },
    [state],
  );

  // Keep the draft in sync with the server while the host is not editing.
  const serverKey = JSON.stringify(server);
  useEffect(() => {
    setDraft((d) => (d && JSON.stringify(d) !== serverKey && saving ? d : server));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const isMember = state?.players.some((p) => p.user_id === userId) ?? false;
  useEffect(() => {
    if (state && !isMember && state.game.status === 'lobby') {
      toast('הוסרתם מהחדר', 'info');
      router.replace('/dashboard');
    }
  }, [state, isMember, router, toast]);

  if (loading) return <LoadingState label="נכנסים לחדר…" />;
  if (error && !state) {
    return <ErrorState message={error} onRetry={refetch} action={<Link href="/dashboard" className="btn-ghost">לדף הבית</Link>} />;
  }
  if (!state || !draft || !server) return <LoadingState />;

  const { game, teams, teamPlayers, players } = state;
  const isHost = game.host_id === userId;
  const grouped = groupPlayersByTeam(teams, teamPlayers, players);
  const dirty = JSON.stringify(draft) !== JSON.stringify(server);
  const link = typeof window !== 'undefined' ? inviteUrl(window.location.origin, game.join_code) : '';

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refetch();
    } catch (e) {
      toast(toHebrewError(e), 'error');
    }
  };

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg, 'success');
    } catch {
      toast('לא הצלחנו להעתיק. אפשר להעתיק ידנית', 'error');
    }
  };

  const share = async () => {
    const data = { title: game.name, text: `בואו לשחק איתי! קוד המשחק: ${game.join_code}`, url: link };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        /* user cancelled */
      }
    } else {
      await copy(`${data.text}\n${link}`, 'ההזמנה הועתקה');
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    const res = await updateSettingsAction(gameId, draft);
    setSaving(false);
    if (!res.ok) toast(res.error, 'error');
    else toast('ההגדרות נשמרו', 'success');
    await refetch();
  };

  const start = async () => {
    setStarting(true);
    try {
      await gameApi.startGame(gameId);
      await refetch();
    } catch (e) {
      toast(toHebrewError(e), 'error');
      setStarting(false);
    }
  };

  const leave = async () => {
    if (!window.confirm('לצאת מהחדר?')) return;
    try {
      await gameApi.leaveGame(gameId);
      router.replace('/dashboard');
    } catch (e) {
      toast(toHebrewError(e), 'error');
    }
  };

  return (
    <div className="space-y-5">
      {!connected && (
        <div className="rounded-2xl bg-tomato px-4 py-2 text-center text-sm font-bold text-white" role="alert">
          החיבור בזמן אמת התנתק. מנסים להתחבר מחדש…
        </div>
      )}

      <section className="card text-center">
        <div className="flex items-start justify-between gap-2">
          <Link href="/dashboard" className="btn-ghost !px-3 !py-1.5 text-sm">→ בית</Link>
          <SoundToggle />
        </div>
        <h1 className="mt-1 font-display text-3xl">{game.name}</h1>
        <p className="mt-1 text-sm text-ink/60">הקוד לכניסה לחדר</p>
        <button
          type="button"
          onClick={() => copy(game.join_code, 'הקוד הועתק')}
          className="mx-auto mt-1 block rounded-2xl border-4 border-dashed border-ink/30 bg-sun/40 px-6 py-2 font-display text-5xl tracking-[0.25em]"
          dir="ltr"
          aria-label={`קוד המשחק ${game.join_code}. לחצו להעתקה`}
        >
          {game.join_code}
        </button>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button type="button" className="btn-sky" onClick={share}>📤 שתף משחק</button>
          <button type="button" className="btn-ghost" onClick={() => copy(link, 'הקישור הועתק')}>🔗 העתק קישור</button>
          <button type="button" className="btn-ghost" onClick={() => copy(game.join_code, 'הקוד הועתק')}>📋 העתק קוד</button>
        </div>
      </section>

      <section aria-label="שחקנים">
        <h2 className="mb-2 font-display text-xl">
          בחדר ({players.length}/{state.settings.max_players})
        </h2>
        <PlayerList players={players} online={online} hostId={game.host_id} meId={userId} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="קבוצות">
        {grouped.map(({ team, players: tp }) => (
          <TeamCard
            key={team.id}
            team={team}
            players={tp}
            otherTeams={teams.filter((t) => t.id !== team.id)}
            isHost={isHost}
            hostId={game.host_id}
            meId={userId}
            online={online}
            onMove={(uid, tid) => run(() => gameApi.movePlayer(gameId, uid, tid))}
            onKick={(uid) => run(() => gameApi.kickPlayer(gameId, uid))}
          />
        ))}
      </section>

      <section className="card">
        <h2 className="mb-3 font-display text-xl">{isHost ? 'הגדרות המשחק' : 'הגדרות (המארח קובע)'}</h2>
        <GameSettings
          values={isHost ? draft : server}
          editable={isHost}
          dirty={dirty}
          saving={saving}
          onChange={(p) => setDraft((d) => (d ? { ...d, ...p } : d))}
          onSave={saveSettings}
        />
      </section>

      <section className="card">
        <h2 className="mb-3 font-display text-xl">הזמנת חברים</h2>
        <InviteFriends gameId={gameId} userId={userId} inGame={new Set(players.map((p) => p.user_id))} />
      </section>

      <div className="space-y-3 pb-4">
        {isHost ? (
          <button type="button" className="btn-mint btn-lg w-full" disabled={starting || dirty || !canStartGame(teams, teamPlayers)} onClick={start}>
            {starting ? 'מתחילים…' : '🚀 התחלת משחק'}
          </button>
        ) : (
          <div className="card text-center font-bold">⏳ ממתינים שהמארח יתחיל את המשחק…</div>
        )}
        {isHost && !canStartGame(teams, teamPlayers) && (
          <p className="text-center text-sm text-ink/60">צריך לפחות שתי קבוצות עם שחקנים כדי להתחיל</p>
        )}
        {isHost && dirty && <p className="text-center text-sm text-ink/60">שמרו את ההגדרות לפני שמתחילים</p>}
        <button type="button" className="btn-ghost w-full" onClick={leave}>יציאה מהחדר</button>
      </div>
    </div>
  );
}
