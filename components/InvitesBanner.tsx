'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchProfilesByIds } from '@/lib/friends';
import { gameApi } from '@/lib/game-api';
import { toHebrewError } from '@/lib/errors';
import { useToast } from '@/components/Toast';
import { Avatar } from '@/components/Avatar';
import type { GameInvite } from '@/lib/types';

interface InviteView extends GameInvite {
  fromName: string;
  fromAvatar: string;
}

export function InvitesBanner({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const [invites, setInvites] = useState<InviteView[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('game_invites').select('*').eq('to_user', userId).order('created_at', { ascending: false });
    const rows = (data ?? []) as GameInvite[];
    const profiles = await fetchProfilesByIds(supabase, [...new Set(rows.map((r) => r.from_user))]);
    setInvites(rows.map((r) => ({ ...r, fromName: profiles.get(r.from_user)?.username ?? 'חבר', fromAvatar: profiles.get(r.from_user)?.avatar ?? '🙂' })));
  }, [supabase, userId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`invites:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_invites', filter: `to_user=eq.${userId}` }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  const accept = async (id: string) => {
    try {
      const gameId = await gameApi.acceptInvite(id);
      router.push(`/games/${gameId}/lobby`);
    } catch (e) {
      toast(toHebrewError(e), 'error');
      void load();
    }
  };

  const decline = async (id: string) => {
    await supabase.from('game_invites').delete().eq('id', id);
    void load();
  };

  if (invites.length === 0) return null;

  return (
    <section aria-label="הזמנות למשחק" className="space-y-2">
      {invites.map((i) => (
        <div key={i.id} className="flex animate-pop items-center gap-3 rounded-2xl border-2 border-sun bg-white px-4 py-3 shadow-card">
          <Avatar emoji={i.fromAvatar} seed={i.fromName} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{i.fromName} מזמין אותך למשחק</div>
            <div className="truncate text-sm text-ink/60">{i.game_name}</div>
          </div>
          <button type="button" className="btn-mint !px-4 !py-2 text-sm" onClick={() => accept(i.id)}>הצטרפות</button>
          <button type="button" className="btn-ghost !px-3 !py-2 text-sm" onClick={() => decline(i.id)} aria-label="דחיית ההזמנה">✕</button>
        </div>
      ))}
    </section>
  );
}
