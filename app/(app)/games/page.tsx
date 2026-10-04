import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'המשחקים שלי' };

interface ActiveRow {
  games: { id: string; name: string; status: 'lobby' | 'playing' | 'finished'; join_code: string } | null;
}
interface HistoryRow {
  game_id: string;
  team_score: number;
  won: boolean;
  created_at: string;
  teams: { name: string } | null;
  games: { name: string; game_players: { count: number }[] } | null;
}

export default async function MyGamesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: active }, { data: history }] = await Promise.all([
    supabase.from('game_players').select('games(id, name, status, join_code)').eq('user_id', user.id).order('joined_at', { ascending: false }).limit(30),
    supabase
      .from('game_results')
      .select('game_id, team_score, won, created_at, teams(name), games(name, game_players(count))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const live = ((active ?? []) as unknown as ActiveRow[]).map((r) => r.games).filter((g): g is NonNullable<ActiveRow['games']> => !!g && g.status !== 'finished');
  const rows = (history ?? []) as unknown as HistoryRow[];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">המשחקים שלי</h1>

      {live.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-xl">משחקים פעילים</h2>
          <ul className="space-y-2">
            {live.map((g) => (
              <li key={g.id} className="card flex items-center justify-between !p-4">
                <div>
                  <div className="font-bold">{g.name}</div>
                  <div className="text-xs text-ink/60">קוד: <span dir="ltr">{g.join_code}</span></div>
                </div>
                <Link href={`/games/${g.id}/${g.status === 'lobby' ? 'lobby' : 'play'}`} className="btn-mint !px-4 !py-2 text-sm">חזרה למשחק</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display text-xl">היסטוריה</h2>
        {rows.length === 0 ? (
          <div className="card text-center text-ink/70">אין עדיין משחקים שהסתיימו.</div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border-2 border-ink/10 bg-white shadow-card">
            <table className="w-full min-w-[34rem] text-start text-sm">
              <thead className="bg-cream text-ink/70">
                <tr>
                  <th className="px-4 py-3 text-start">תאריך</th>
                  <th className="px-4 py-3 text-start">משחק</th>
                  <th className="px-4 py-3 text-start">קבוצה</th>
                  <th className="px-4 py-3 text-start">ניקוד</th>
                  <th className="px-4 py-3 text-start">תוצאה</th>
                  <th className="px-4 py-3 text-start">שחקנים</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {rows.map((r) => (
                  <tr key={r.game_id}>
                    <td className="px-4 py-3">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3 font-bold"><Link href={`/games/${r.game_id}/results`} className="text-sky">{r.games?.name ?? 'משחק'}</Link></td>
                    <td className="px-4 py-3">{r.teams?.name ?? '-'}</td>
                    <td className="px-4 py-3 font-bold">{r.team_score}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.won ? 'bg-mint/20 text-green-800' : 'bg-tomato/15 text-tomato'}`}>{r.won ? 'ניצחון 🏆' : 'הפסד'}</span>
                    </td>
                    <td className="px-4 py-3">{r.games?.game_players?.[0]?.count ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
