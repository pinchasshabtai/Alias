import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ProfileEditor } from '@/components/ProfileEditor';
import { createClient } from '@/lib/supabase/server';
import { formatDate, winRate } from '@/lib/utils';

export const metadata: Metadata = { title: 'פרופיל' };

interface HistoryRow {
  game_id: string;
  team_score: number;
  won: boolean;
  created_at: string;
  games: { name: string } | null;
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: stats }, { data: history }] = await Promise.all([
    supabase.from('profiles').select('username, avatar').eq('id', user.id).maybeSingle(),
    supabase.from('profile_stats').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('game_results').select('game_id, team_score, won, created_at, games(name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
  ]);

  const games = stats?.games_played ?? 0;
  const wins = stats?.wins ?? 0;
  const rows = (history ?? []) as unknown as HistoryRow[];

  return (
    <div className="space-y-6">
      <ProfileEditor userId={user.id} initialUsername={profile?.username ?? ''} initialAvatar={profile?.avatar ?? '🦊'} email={user.email ?? ''} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="סטטיסטיקות">
        {[
          ['משחקים', games],
          ['ניצחונות', wins],
          ['אחוז ניצחונות', `${winRate(wins, games)}%`],
          ['ניקוד', stats?.total_points ?? 0],
        ].map(([label, value]) => (
          <div key={label as string} className="card text-center !p-4">
            <div className="font-display text-3xl">{value}</div>
            <div className="text-sm font-bold text-ink/70">{label}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl">היסטוריית משחקים</h2>
        {rows.length === 0 ? (
          <div className="card text-center text-ink/70">עוד אין משחקים שהסתיימו.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.game_id} className="card flex items-center justify-between !p-3">
                <div>
                  <div className="font-bold">{r.games?.name ?? 'משחק'}</div>
                  <div className="text-xs text-ink/60">{formatDate(r.created_at)} · {r.team_score} נקודות</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.won ? 'bg-mint/20 text-green-800' : 'bg-tomato/15 text-tomato'}`}>{r.won ? 'ניצחון' : 'הפסד'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
