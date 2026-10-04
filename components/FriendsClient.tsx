'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/Avatar';
import { InvitesBanner } from '@/components/InvitesBanner';
import { LoadingState } from '@/components/LoadingState';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';
import { fetchProfilesByIds, type PublicProfile } from '@/lib/friends';
import { toHebrewError } from '@/lib/errors';
import type { FriendshipRow } from '@/lib/types';

export function FriendsClient({ userId }: { userId: string }) {
  const supabase = createClient();
  const { toast } = useToast();
  const [rows, setRows] = useState<FriendshipRow[] | null>(null);
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searched, setSearched] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('friendships').select('*').order('created_at', { ascending: false });
    const list = (data ?? []) as FriendshipRow[];
    setRows(list);
    setProfiles(await fetchProfilesByIds(supabase, list.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id))));
  }, [supabase, userId]);

  useEffect(() => {
    void load();
    const ch = supabase.channel(`friends:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => void load()).subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, userId, load]);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim().replace(/[%_,]/g, '');
    if (q.length < 2) {
      toast('הקלידו לפחות 2 תווים לחיפוש', 'info');
      return;
    }
    const { data } = await supabase.from('profiles').select('id, username, avatar').ilike('username', `%${q}%`).neq('id', userId).limit(8);
    setResults((data ?? []) as PublicProfile[]);
    setSearched(true);
  };

  const otherId = (r: FriendshipRow) => (r.requester_id === userId ? r.addressee_id : r.requester_id);
  const relationWith = (id: string) => rows?.find((r) => otherId(r) === id);

  const send = async (id: string) => {
    const { error } = await supabase.from('friendships').insert({ requester_id: userId, addressee_id: id });
    if (error) toast(error.code === '23505' ? 'כבר קיימת בקשה או חברות עם המשתמש הזה' : toHebrewError(error), 'error');
    else toast('בקשת החברות נשלחה', 'success');
    void load();
  };
  const accept = async (id: string) => {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
    if (error) toast(toHebrewError(error), 'error');
    void load();
  };
  const remove = async (id: string) => {
    await supabase.from('friendships').delete().eq('id', id);
    void load();
  };

  if (!rows) return <LoadingState />;

  const incoming = rows.filter((r) => r.status === 'pending' && r.addressee_id === userId);
  const outgoing = rows.filter((r) => r.status === 'pending' && r.requester_id === userId);
  const friends = rows.filter((r) => r.status === 'accepted');
  const Row = ({ id, children }: { id: string; children: React.ReactNode }) => {
    const p = profiles.get(id);
    return (
      <li className="card flex items-center gap-3 !p-3">
        <Avatar emoji={p?.avatar} seed={p?.username} size="md" />
        <span className="min-w-0 flex-1 truncate font-bold">{p?.username ?? 'משתמש'}</span>
        {children}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">חברים</h1>
      <InvitesBanner userId={userId} />

      <form onSubmit={search} className="flex gap-2" role="search">
        <input className="input" placeholder="חיפוש לפי שם משתמש" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="חיפוש משתמש" />
        <button type="submit" className="btn-sky">חיפוש</button>
      </form>
      {searched && (
        <ul className="space-y-2">
          {results.length === 0 && <li className="card text-center text-ink/70">לא נמצאו משתמשים.</li>}
          {results.map((p) => {
            const rel = relationWith(p.id);
            return (
              <li key={p.id} className="card flex items-center gap-3 !p-3">
                <Avatar emoji={p.avatar} seed={p.username} size="md" />
                <span className="flex-1 truncate font-bold">{p.username}</span>
                {rel ? <span className="text-sm text-ink/60">{rel.status === 'accepted' ? 'חברים ✓' : 'בקשה פתוחה'}</span> : <button type="button" className="btn-mint !px-4 !py-2 text-sm" onClick={() => send(p.id)}>הוספה</button>}
              </li>
            );
          })}
        </ul>
      )}

      {incoming.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-xl">בקשות שהתקבלו</h2>
          <ul className="space-y-2">
            {incoming.map((r) => (
              <Row key={r.id} id={otherId(r)}>
                <button type="button" className="btn-mint !px-3 !py-2 text-sm" onClick={() => accept(r.id)}>אישור</button>
                <button type="button" className="btn-ghost !px-3 !py-2 text-sm" onClick={() => remove(r.id)}>דחייה</button>
              </Row>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-xl">בקשות שנשלחו</h2>
          <ul className="space-y-2">
            {outgoing.map((r) => (
              <Row key={r.id} id={otherId(r)}>
                <button type="button" className="btn-ghost !px-3 !py-2 text-sm" onClick={() => remove(r.id)}>ביטול</button>
              </Row>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display text-xl">החברים שלי ({friends.length})</h2>
        {friends.length === 0 ? (
          <div className="card text-center text-ink/70">עוד אין חברים. חפשו משתמשים למעלה.</div>
        ) : (
          <ul className="space-y-2">
            {friends.map((r) => (
              <Row key={r.id} id={otherId(r)}>
                <button type="button" className="btn-ghost !px-3 !py-2 text-sm" onClick={() => window.confirm('להסיר את החבר?') && remove(r.id)}>הסרה</button>
              </Row>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-ink/60">כדי להזמין חבר למשחק, פתחו חדר והשתמשו ב”הזמנת חברים” בחדר ההמתנה.</p>
      </section>
    </div>
  );
}
