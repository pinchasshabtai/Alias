import type { PlayerRow, Team, TeamPlayer } from '@/lib/types';

export interface TeamWithPlayers {
  team: Team;
  players: PlayerRow[];
}

export function groupPlayersByTeam(teams: Team[], teamPlayers: TeamPlayer[], players: PlayerRow[]): TeamWithPlayers[] {
  const byUser = new Map(players.map((p) => [p.user_id, p]));
  return teams.map((team) => ({
    team,
    players: teamPlayers
      .filter((tp) => tp.team_id === team.id)
      .map((tp) => byUser.get(tp.user_id))
      .filter((p): p is PlayerRow => Boolean(p)),
  }));
}

/** Mirrors the server rule in start_game(): at least two non-empty teams. */
export function canStartGame(teams: Team[], teamPlayers: TeamPlayer[]): boolean {
  return teams.filter((t) => teamPlayers.some((tp) => tp.team_id === t.id)).length >= 2;
}

export function standings(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => b.score - a.score || a.idx - b.idx);
}

export function totalScore(teams: Team[]): number {
  return teams.reduce((sum, t) => sum + t.score, 0);
}

export function secondsLeft(ms: number): number {
  return Math.ceil(Math.max(0, ms) / 1000);
}

export function isLastSeconds(ms: number, threshold = 10): boolean {
  const s = secondsLeft(ms);
  return s > 0 && s <= threshold;
}
