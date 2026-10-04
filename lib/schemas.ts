import { z } from 'zod';

export const usernameSchema = z
  .string({ required_error: 'נא להזין שם משתמש' })
  .trim()
  .min(2, 'שם המשתמש חייב להכיל לפחות 2 תווים')
  .max(24, 'שם המשתמש יכול להכיל עד 24 תווים')
  .regex(/^[\p{L}\p{N}_ .-]+$/u, 'שם המשתמש יכול להכיל אותיות, ספרות, רווח, נקודה, מקף וקו תחתון בלבד');

export const emailSchema = z
  .string({ required_error: 'נא להזין אימייל' })
  .trim()
  .toLowerCase()
  .email('כתובת האימייל אינה תקינה');

export const passwordSchema = z
  .string({ required_error: 'נא להזין סיסמה' })
  .min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים')
  .max(72, 'הסיסמה ארוכה מדי');

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: 'נא לאשר את הסיסמה' }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'הסיסמאות אינן תואמות',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'נא להזין סיסמה' }).min(1, 'נא להזין סיסמה'),
  next: z.string().nullish(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'הסיסמאות אינן תואמות',
    path: ['confirmPassword'],
  });

export const settingsSchema = z
  .object({
    numTeams: z.number().int().min(2, 'לפחות 2 קבוצות').max(4, 'עד 4 קבוצות'),
    maxPlayers: z.number().int().min(2, 'לפחות 2 שחקנים').max(24, 'עד 24 שחקנים'),
    turnSeconds: z.union([z.literal(30), z.literal(60), z.literal(90)], {
      errorMap: () => ({ message: 'זמן תור חייב להיות 30, 60 או 90 שניות' }),
    }),
    winPoints: z.number().int().min(5, 'לפחות 5 נקודות לניצחון').max(100, 'עד 100 נקודות לניצחון'),
    difficulty: z.number().int().min(0).max(3),
    categoryIds: z.array(z.number().int().positive()).max(50),
  })
  .refine((v) => v.maxPlayers >= v.numTeams, {
    message: 'מספר השחקנים חייב להיות לפחות כמספר הקבוצות',
    path: ['maxPlayers'],
  });

export const createGameSchema = settingsSchema.and(
  z.object({
    name: z
      .string({ required_error: 'נא להזין שם למשחק' })
      .trim()
      .min(2, 'שם המשחק חייב להכיל לפחות 2 תווים')
      .max(40, 'שם המשחק יכול להכיל עד 40 תווים'),
    isPrivate: z.boolean(),
  }),
);

export const joinCodeSchema = z
  .string({ required_error: 'נא להזין קוד משחק' })
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/, 'קוד המשחק מורכב מ־6 תווים (אותיות באנגלית וספרות)');

export const wordSchema = z.object({
  word: z.string().trim().min(1, 'נא להזין מילה').max(60, 'המילה ארוכה מדי'),
  categoryId: z.number().int().positive('נא לבחור קטגוריה'),
  difficulty: z.number().int().min(1).max(3),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
export type CreateGameInput = z.infer<typeof createGameSchema>;
