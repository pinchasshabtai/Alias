import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DashboardActions } from '@/components/DashboardActions';
import { InvitesBanner } from '@/components/InvitesBanner';
import { createClient } from '@/lib/supabase/server';
import { formatDate, winRate } from '@/lib/utils';

export const metadata: Metadata = { title: 'דף הבית' };

interface RecentGame {
  joined_at: string;
  games: { id: string; name: string; status: 'lobby' | 'playing' | 'finished'; created_at: string } | null;
}

const STATUS_LABEL = { lobby: 'בחדר המתנה', playing: 'במשחק', finished: 'הסתיים' } as const;
const STATUS_PATH = { lobby: 'lobby', playing: 'play', finished: 'results' } as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: stats }, { data: recent }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle(),
    supabase.from('profile_stats').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('game_players')
      .select('joined_at, games(id, name, status, created_at)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(5),
  ]);

  const games = stats?.games_played ?? 0;
  const wins = stats?.wins ?? 0;
  const recentGames = ((recent ?? []) as unknown as RecentGame[]).filter((r) => r.games);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">שלום {profile?.username ?? 'שחקן'} 👋</h1>

      <InvitesBanner userId={user.id} />
      <DashboardActions />

      <section aria-label="סטטיסטיקות" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'משחקים', value: games, color: 'bg-sky/15' },
          { label: 'ניצחונות', value: wins, color: 'bg-mint/20' },
          { label: 'אחוז ניצחונות', value: `${winRate(wins, games)}%`, color: 'bg-sun/40' },
          { label: 'ניקוד כולל', value: stats?.total_points ?? 0, color: 'bg-bubble/15' },
        ].map((s) => (
          <div key={s.label} className={`rounded-3xl border-2 border-ink/10 p-4 text-center ${s.color}`}>
            <div className="font-display text-4xl">{s.value}</div>
            <div className="text-sm font-bold text-ink/70">{s.label}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl">המשחקים האחרונים שלי</h2>
          <Link href="/games" className="text-sm font-bold text-sky">הכול</Link>
        </div>
        {recentGames.length === 0 ? (
          <div className="card text-center text-ink/70">עוד לא שיחקתם. פתחו חדר והזמינו חברים!</div>
        ) : (
          <ul className="space-y-2">
            {recentGames.map(({ games: g }) => (
              <li key={g!.id}>
                <Link href={`/games/${g!.id}/${STATUS_PATH[g!.status]}`} className="card flex items-center justify-between !p-4 transition hover:-translate-y-0.5">
                  <div className="min-w-0">
                    <div className="truncate font-bold">{g!.name}</div>
                    <div className="text-xs text-ink/60">{formatDate(g!.created_at)}</div>
                  </div>
                  <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold">{STATUS_LABEL[g!.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
