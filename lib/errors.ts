const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'צריך להתחבר כדי להמשיך',
  INVALID_NAME: 'שם המשחק חייב להכיל בין 2 ל־40 תווים',
  INVALID_SETTINGS: 'הגדרות המשחק אינן תקינות',
  INVALID_TEAM: 'הקבוצה שנבחרה אינה קיימת במשחק הזה',
  GAME_NOT_FOUND: 'החדר לא נמצא. בדקו את הקוד ונסו שוב',
  GAME_FULL: 'החדר מלא',
  GAME_ALREADY_STARTED: 'המשחק כבר התחיל, אי אפשר להצטרף עכשיו',
  GAME_FINISHED: 'המשחק הזה כבר הסתיים',
  NOT_HOST: 'רק המארח יכול לבצע את הפעולה הזו',
  NOT_MEMBER: 'אתם לא משתתפים במשחק הזה',
  NOT_IN_LOBBY: 'אי אפשר לשנות את זה אחרי שהמשחק התחיל',
  NOT_ENOUGH_TEAMS: 'צריך לפחות שתי קבוצות עם שחקנים כדי להתחיל',
  NOT_EXPLAINER: 'רק השחקן שמסביר יכול לבצע את הפעולה הזו',
  TURN_NOT_FOUND: 'התור לא נמצא',
  TURN_NOT_READY: 'התור כבר התחיל',
  TURN_NOT_ACTIVE: 'התור כבר הסתיים',
  TURN_STILL_RUNNING: 'התור עדיין רץ',
  TURN_NOT_STALE: 'עדיין ממתינים לשחקן שמסביר',
  NO_WORDS: 'אין מילים זמינות בקטגוריות שנבחרו. נסו להרחיב את הבחירה',
  PLAYER_NOT_FOUND: 'השחקן לא נמצא במשחק',
  CANNOT_KICK_SELF: 'אי אפשר להסיר את עצמך. אפשר לצאת מהחדר',
  TOO_MANY_PLAYERS: 'יש כבר יותר שחקנים מהמספר שבחרתם',
  NOT_FRIENDS: 'אפשר להזמין רק חברים',
  INVITE_NOT_FOUND: 'ההזמנה כבר לא זמינה',
  NOT_ADMIN: 'אין לכם הרשאה לפעולה הזו',
};

const FALLBACK = 'אירעה שגיאה. נסו שוב בעוד רגע';

export function toHebrewError(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : '';

  const code = Object.keys(MESSAGES).find((k) => raw.includes(k));
  if (code) return MESSAGES[code];

  const lower = raw.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'האימייל או הסיסמה שגויים';
  if (lower.includes('email not confirmed')) return 'יש לאשר את כתובת האימייל לפני ההתחברות';
  if (lower.includes('already registered') || lower.includes('already been registered')) return 'האימייל הזה כבר רשום';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'בוצעו יותר מדי ניסיונות. נסו שוב בעוד כמה דקות';
  if (lower.includes('password should be') || lower.includes('weak')) return 'הסיסמה חלשה מדי';
  if (lower.includes('jwt') || lower.includes('not authenticated')) return 'ההתחברות פגה. התחברו מחדש';
  if (lower.includes('permission denied') || lower.includes('row-level security')) return 'אין לכם הרשאה לפעולה הזו';
  if (lower.includes('duplicate key') || lower.includes('already exists')) return 'הערך הזה כבר קיים';
  if (lower.includes('failed to fetch') || lower.includes('network')) return 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב';
  return FALLBACK;
}
