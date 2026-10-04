import type { Team } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  teams: Team[];
  activeTeamId?: string | null;
  winPoints: number;
}

export function ScoreBoard({ teams, activeTeamId, winPoints }: Props) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(teams.length, 1)}, minmax(0, 1fr))` }} aria-label="לוח תוצאות">
      {teams.map((t) => (
        <div
          key={t.id}
          className={cn(
            'rounded-2xl border-2 border-black/10 p-2 text-center text-white shadow-card transition',
            t.id === activeTeamId && 'scale-[1.04] ring-4 ring-sun',
          )}
          style={{ background: t.color }}
        >
          <div className="truncate text-xs font-bold sm:text-sm">{t.name}</div>
          <div key={t.score} className="animate-pop font-display text-3xl sm:text-4xl">
            {t.score}
          </div>
          <div className="text-[10px] font-medium opacity-80">מתוך {winPoints}</div>
        </div>
      ))}
    </div>
  );
}
