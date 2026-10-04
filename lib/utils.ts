export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Only allow same-site relative redirects. */
export function safeNext(next?: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export function remainingMs(endsAt: string | null, nowMs: number): number {
  if (!endsAt) return 0;
  return Math.max(0, new Date(endsAt).getTime() - nowMs);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function winRate(wins: number, games: number): number {
  return games > 0 ? Math.round((wins / games) * 100) : 0;
}

export function inviteUrl(origin: string, code: string): string {
  return `${origin}/join/${code}`;
}

export const AVATARS = ['🦊', '🐼', '🦁', '🐸', '🐙', '🦄', '🐯', '🐵', '🐧', '🦉', '🐨', '🐲', '🦖', '🐝', '🦋', '🍀'];

export function randomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
