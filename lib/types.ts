export type GameStatus = 'lobby' | 'playing' | 'finished';
export type TurnStatus = 'ready' | 'active' | 'ended';

export interface Profile {
  id: string;
  username: string;
  avatar: string;
  is_admin: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  emoji: string;
}

export interface Word {
  id: number;
  word: string;
  category_id: number;
  difficulty: number;
}

export interface Game {
  id: string;
  name: string;
  join_code: string;
  host_id: string;
  status: GameStatus;
  is_private: boolean;
  winner_team_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface GameSettingsRow {
  game_id: string;
  num_teams: number;
  max_players: number;
  turn_seconds: number;
  win_points: number;
  difficulty: number;
  category_ids: number[];
}

export interface Team {
  id: string;
  game_id: string;
  idx: number;
  name: string;
  color: string;
  score: number;
}

export interface TeamPlayer {
  user_id: string;
  team_id: string;
}

export interface PlayerProfile {
  id: string;
  username: string;
  avatar: string;
}

export interface PlayerRow {
  user_id: string;
  joined_at: string;
  profiles: PlayerProfile;
}

export interface Turn {
  id: string;
  game_id: string;
  turn_number: number;
  team_id: string;
  explainer_id: string;
  status: TurnStatus;
  correct_count: number;
  skipped_count: number;
  started_at: string | null;
  ends_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface GameResultRow {
  user_id: string;
  team_id: string | null;
  team_score: number;
  won: boolean;
  correct_count: number;
  skipped_count: number;
  explained_turns: number;
  profiles: PlayerProfile;
}

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
}

export interface GameInvite {
  id: string;
  game_id: string;
  game_name: string;
  from_user: string;
  to_user: string;
  created_at: string;
}

export interface SettingsValues {
  numTeams: number;
  maxPlayers: number;
  turnSeconds: number;
  winPoints: number;
  difficulty: number;
  categoryIds: number[];
}

export const DEFAULT_SETTINGS: SettingsValues = {
  numTeams: 2,
  maxPlayers: 8,
  turnSeconds: 60,
  winPoints: 30,
  difficulty: 0,
  categoryIds: [],
};

export const DIFFICULTY_LABELS: Record<number, string> = {
  0: 'מעורב',
  1: 'קל',
  2: 'בינוני',
  3: 'קשה',
};
