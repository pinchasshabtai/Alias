import { Avatar } from '@/components/Avatar';
import type { PlayerRow } from '@/lib/types';

interface Props {
  players: PlayerRow[];
  online: Set<string>;
  hostId: string;
  meId: string;
}

export function PlayerList({ players, online, hostId, meId }: Props) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="שחקנים בחדר">
      {players.map((p) => (
        <li key={p.user_id} className="flex animate-pop items-center gap-2 rounded-full border-2 border-ink/10 bg-white py-1 pe-3 ps-1">
          <Avatar emoji={p.profiles.avatar} seed={p.profiles.username} size="sm" online={online.has(p.user_id)} />
          <span className="text-sm font-bold">
            {p.profiles.username}
            {p.user_id === meId && ' (אני)'}
          </span>
          {p.user_id === hostId && <span title="מארח">👑</span>}
        </li>
      ))}
    </ul>
  );
}
