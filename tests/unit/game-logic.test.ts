import { describe, expect, it } from 'vitest';
import { canStartGame, groupPlayersByTeam, isLastSeconds, secondsLeft, standings, totalScore } from '@/lib/game-logic';
import { remainingMs, safeNext, winRate } from '@/lib/utils';
import { toHebrewError } from '@/lib/errors';
import type { PlayerRow, Team, TeamPlayer } from '@/lib/types';

const team = (id: string, idx: number, score = 0): Team => ({ id, game_id: 'g', idx, name: id, color: '#000', score });
const player = (id: string): PlayerRow => ({ user_id: id, joined_at: '', profiles: { id, username: id, avatar: '🙂' } });

describe('Teams & Start Game', () => {
  const teams = [team('a', 1), team('b', 2)];
  const players = [player('u1'), player('u2')];
  it('groups players by team', () => {
    const tp: TeamPlayer[] = [{ user_id: 'u1', team_id: 'a' }, { user_id: 'u2', team_id: 'b' }];
    expect(groupPlayersByTeam(teams, tp, players).map((g) => g.players.length)).toEqual([1, 1]);
  });
  it('needs two non-empty teams to start', () => {
    expect(canStartGame(teams, [{ user_id: 'u1', team_id: 'a' }])).toBe(false);
    expect(canStartGame(teams, [{ user_id: 'u1', team_id: 'a' }, { user_id: 'u2', team_id: 'b' }])).toBe(true);
  });
});

describe('Scoring & End Game', () => {
  it('orders standings by score then team index', () => {
    expect(standings([team('a', 1, 3), team('b', 2, 5), team('c', 3, 3)]).map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(totalScore([team('a', 1, 3), team('b', 2, 5)])).toBe(8);
  });
  it('computes win rate', () => {
    expect(winRate(1, 4)).toBe(25);
    expect(winRate(0, 0)).toBe(0);
  });
});

describe('Timer', () => {
  it('never goes negative and flags the last 10 seconds', () => {
    const end = new Date(1_000_000).toISOString();
    expect(remainingMs(end, 1_000_500)).toBe(0);
    expect(remainingMs(end, 990_000)).toBe(10_000);
    expect(secondsLeft(9_001)).toBe(10);
    expect(isLastSeconds(10_000)).toBe(true);
    expect(isLastSeconds(10_500)).toBe(false);
    expect(isLastSeconds(0)).toBe(false);
  });
});

describe('Permissions & errors', () => {
  it('maps database error codes to Hebrew', () => {
    expect(toHebrewError(new Error('NOT_HOST'))).toContain('המארח');
    expect(toHebrewError({ message: 'GAME_FULL' })).toContain('מלא');
    expect(toHebrewError(new Error('Invalid login credentials'))).toContain('שגויים');
    expect(toHebrewError(new Error('weird'))).toContain('שגיאה');
  });
  it('blocks open redirects', () => {
    expect(safeNext('//evil.com')).toBe('/dashboard');
    expect(safeNext('https://evil.com')).toBe('/dashboard');
    expect(safeNext('/games/1')).toBe('/games/1');
  });
});
