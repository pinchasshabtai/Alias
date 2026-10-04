'use client';

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { joinGameAction } from '@/app/(app)/actions';
import { createClient } from '@/lib/supabase/client';

interface PublicGame {
  id: string;
  name: string;
  join_code: string;
  game_settings: { max_players: number } | null;
  game_players: { count: number }[];
}

export function JoinGameModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [pending, startTransition] = useTransition();
  const [publicGames, setPublicGames] = useState<PublicGame[]>([]);

  useEffect(() => {
    if (!open) return;
    createClient()
      .from('games')
      .select('id, name, join_code, game_settings(max_players), game_players(count)')
      .eq('is_private', false)
      .eq('status', 'lobby')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setPublicGames((data ?? []) as unknown as PublicGame[]));
  }, [open]);

  const join = (value: string) => {
    startTransition(async () => {
      const res = await joinGameAction(value);
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      const path = res.data.status === 'playing' ? 'play' : res.data.status === 'finished' ? 'results' : 'lobby';
      router.push(`/games/${res.data.gameId}/${path}`);
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    join(code);
  };

  return (
    <Modal open={open} onClose={onClose} title="הצטרפות למשחק">
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="join-code" className="label">קוד המשחק</label>
        <input
          id="join-code"
          dir="ltr"
          className="input text-center font-display text-3xl uppercase tracking-[0.4em]"
          placeholder="ABC123"
          maxLength={6}
          autoComplete="off"
          autoCapitalize="characters"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button type="submit" className="btn-sky btn-lg w-full" disabled={pending || code.length < 6}>
          {pending ? 'מצטרפים…' : 'כניסה לחדר'}
        </button>
      </form>

      {publicGames.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 font-display text-lg">משחקים ציבוריים פתוחים</h3>
          <ul className="space-y-2">
            {publicGames.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink/10 bg-white px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-bold">{g.name}</div>
                  <div className="text-xs text-ink/60">
                    {g.game_players?.[0]?.count ?? 0}/{g.game_settings?.max_players ?? '?'} שחקנים
                  </div>
                </div>
                <button type="button" className="btn-mint !px-4 !py-2 text-sm" disabled={pending} onClick={() => join(g.join_code)}>
                  הצטרפות
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
