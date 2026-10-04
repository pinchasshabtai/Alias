import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'ניהול' };

interface Stats { users: number; games: number; active_games: number; finished_games: number; words: number; categories: number }
interface GameRow { id: string; name: string; status: string; created_at: string; profiles: { username: string } | null }

export default async function AdminPage() {
  const supabase = await createClient();
  const [{ data: stats }, { data: users }, { data: games }] = await Promise.all([
    supabase.rpc('admin_stats'),
    supabase.from('profiles').select('id, username, is_admin, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('games').select('id, name, status, created_at, profiles(username)').order('created_at', { ascending: false }).limit(30),
  ]);
  const s = (stats ?? {}) as Partial<Stats>;
  const cards: [string, number | undefined][] = [
    ['משתמשים', s.users], ['משחקים', s.games], ['משחקים פעילים', s.active_games], ['משחקים שהסתיימו', s.finished_games], ['מילים', s.words], ['קטגוריות', s.categories],
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">לוח ניהול</h1>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="card text-center !p-4">
            <div className="font-display text-4xl">{value ?? '-'}</div>
            <div className="text-sm font-bold text-ink/70">{label}</div>
          </div>
        ))}
      </section>
      <section>
        <h2 className="mb-2 font-display text-xl">משתמשים אחרונים</h2>
        <ul className="card divide-y divide-ink/5 !p-0">
          {(users ?? []).map((u) => (
            <li key={u.id} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="font-bold">{u.username} {u.is_admin && '🛠️'}</span>
              <span className="text-ink/60">{formatDate(u.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-display text-xl">משחקים אחרונים</h2>
        <ul className="card divide-y divide-ink/5 !p-0">
          {((games ?? []) as unknown as GameRow[]).map((g) => (
            <li key={g.id} className="flex justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="truncate font-bold">{g.name} <span className="font-normal text-ink/60">({g.profiles?.username ?? '?'})</span></span>
              <span className="shrink-0 text-ink/60">{g.status} · {formatDate(g.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
