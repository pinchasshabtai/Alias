import { describe, expect, it } from 'vitest';
import { createGameSchema, joinCodeSchema, loginSchema, registerSchema, resetPasswordSchema } from '@/lib/schemas';

const validGame = { name: 'משחק', isPrivate: true, numTeams: 2, maxPlayers: 8, turnSeconds: 60, winPoints: 30, difficulty: 0, categoryIds: [] };

describe('Register', () => {
  const ok = { username: 'דני', email: 'Dani@Example.com', password: 'password1', confirmPassword: 'password1' };
  it('accepts valid input and normalizes email', () => {
    const r = registerSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('dani@example.com');
  });
  it('rejects mismatched passwords, short passwords and bad usernames', () => {
    expect(registerSchema.safeParse({ ...ok, confirmPassword: 'other' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, password: 'short', confirmPassword: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, username: 'a' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, username: '<script>' }).success).toBe(false);
  });
});

describe('Login / reset', () => {
  it('requires email and password', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
  it('validates password reset', () => {
    expect(resetPasswordSchema.safeParse({ password: 'password1', confirmPassword: 'password2' }).success).toBe(false);
  });
});

describe('Create game', () => {
  it('accepts valid settings', () => expect(createGameSchema.safeParse(validGame).success).toBe(true));
  it('rejects invalid teams, timer and points', () => {
    expect(createGameSchema.safeParse({ ...validGame, numTeams: 5 }).success).toBe(false);
    expect(createGameSchema.safeParse({ ...validGame, turnSeconds: 45 }).success).toBe(false);
    expect(createGameSchema.safeParse({ ...validGame, winPoints: 1 }).success).toBe(false);
    expect(createGameSchema.safeParse({ ...validGame, maxPlayers: 2, numTeams: 3 }).success).toBe(false);
  });
});

describe('Join code', () => {
  it('normalizes and validates', () => {
    expect(joinCodeSchema.parse(' abc234 ')).toBe('ABC234');
    expect(joinCodeSchema.safeParse('ABC').success).toBe(false);
    expect(joinCodeSchema.safeParse('ABCO01').success).toBe(false);
  });
});
