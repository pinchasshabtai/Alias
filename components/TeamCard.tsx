import { Avatar } from '@/components/Avatar';
import type { PlayerRow, Team } from '@/lib/types';

interface Props {
  team: Team;
  players: PlayerRow[];
  otherTeams: Team[];
  isHost: boolean;
  hostId: string;
  meId: string;
  online: Set<string>;
  onMove: (userId: string, teamId: string) => void;
  onKick: (userId: string) => void;
}

export function TeamCard({ team, players, otherTeams, isHost, hostId, meId, online, onMove, onKick }: Props) {
  return (
    <section className="overflow-hidden rounded-3xl border-2 border-ink/10 bg-white shadow-card" aria-label={`קבוצה ${team.name}`}>
      <header className="flex items-center justify-between px-4 py-3 text-white" style={{ background: team.color }}>
        <h3 className="font-display text-xl">{team.name}</h3>
        <span className="rounded-full bg-black/15 px-3 py-0.5 text-sm font-bold">{players.length}</span>
      </header>
      <ul className="divide-y divide-ink/5">
        {players.length === 0 && <li className="px-4 py-5 text-center text-sm text-ink/50">אין שחקנים בקבוצה</li>}
        {players.map((p) => (
          <li key={p.user_id} className="flex animate-pop items-center gap-3 px-4 py-2.5">
            <Avatar emoji={p.profiles.avatar} seed={p.profiles.username} size="md" online={online.has(p.user_id)} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">
                {p.profiles.username} {p.user_id === hostId && '👑'}
                {p.user_id === meId && <span className="text-xs text-ink/50"> (אני)</span>}
              </div>
            </div>
            {isHost && (
              <div className="flex items-center gap-1.5">
                {otherTeams.length > 0 && (
                  <select
                    aria-label={`העברת ${p.profiles.username} לקבוצה אחרת`}
                    className="rounded-xl border-2 border-ink/15 bg-white px-2 py-1 text-xs font-bold"
                    value=""
                    onChange={(e) => e.target.value && onMove(p.user_id, e.target.value)}
                  >
                    <option value="">העברה…</option>
                    {otherTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                {p.user_id !== meId && (
                  <button
                    type="button"
                    onClick={() => onKick(p.user_id)}
                    className="rounded-xl border-2 border-tomato/30 px-2 py-1 text-xs font-bold text-tomato hover:bg-tomato/10"
                    aria-label={`הסרת ${p.profiles.username} מהחדר`}
                  >
                    הסרה
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
