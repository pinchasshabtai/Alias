# אליאס ישראל — משחק מילים חברתי בזמן אמת

משחק Web בסגנון Alias: פותחים חדר, מזמינים חברים בקוד או בקישור, מתחלקים לקבוצות, מסבירים מילים ומנחשים לפני שהטיימר נגמר. עברית מלאה, RTL, מותאם למובייל.
(שם זמני. אפשר להחליף ל"נחש את המילה" עם `NEXT_PUBLIC_APP_NAME`. כל העיצוב והנכסים מקוריים.)

## Features
- הרשמה, התחברות, יציאה, שכחתי סיסמה, איפוס סיסמה, session מתמשך, נתיבים מוגנים (middleware), פרופיל ואווטאר
- דשבורד, יצירת משחק (2–4 קבוצות, 30/60/90 שניות, נקודות לניצחון, קושי, קטגוריות, פרטי/ציבורי), קוד קצר + קישור הזמנה + שיתוף
- Lobby בזמן אמת: העברת שחקנים בין קבוצות, הסרה, שינוי הגדרות, התחלה (מארח בלבד), נוכחות (Presence)
- מנוע משחק בשרת: תורות, מילה סודית (רק למסביר, דרך RLS), ניקוד, דילוגים, סיום תור אוטומטי, טיימר מסונכרן לשעון השרת, התאוששות מרענון
- תוצאות חגיגיות, היסטוריית משחקים, סטטיסטיקות, חברים והזמנות למשחק, Admin (משתמשים, משחקים, מילים, קטגוריות)
- 528 מילים ב־16 קטגוריות, סאונד מסונתז (🔊/🔇), אנימציות עדינות, SEO (title, description, favicon, Open Graph, robots, sitemap)

## Tech Stack
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Realtime, RLS) · Zod · Vitest · Vercel

## התקנה מקומית
```bash
npm install
cp .env.example .env.local     # מלאו URL ומפתח anon מ־Supabase
npm run dev                    # http://localhost:3000
```

## Supabase setup
1. צרו פרויקט ב־supabase.com.
2. **Database:** ב־SQL Editor הריצו את `supabase/full_setup.sql` (סכמה + RLS + פונקציות + Realtime + 528 מילים).
   או עם ה־CLI: `supabase link --project-ref <ref> && supabase db push`, ואז הריצו את `supabase/seed.sql`.
3. **Auth → URL Configuration:** הגדירו Site URL לכתובת האתר, והוסיפו ל־Redirect URLs: `http://localhost:3000/auth/callback` ו־`https://<your-domain>/auth/callback`.
4. **Auth → Providers → Email:** להתנסות מהירה אפשר לכבות "Confirm email". בפרודקשן השאירו דלוק (הרישום מציג הודעת אישור).
5. **Realtime:** מופעל על ידי המיגרציה `0004` (ודאו ש־Realtime פעיל בפרויקט).
6. **מנהל ראשון:** הירשמו באתר ואז ב־SQL Editor: `update public.profiles set is_admin = true where username = 'השם-שלכם';`

## Environment variables
| משתנה | שימוש |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | כתובת הפרויקט |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | מפתח anon/publishable (ציבורי בכוונה, ההגנה היא RLS) |
| `NEXT_PUBLIC_SITE_URL` | כתובת האתר (קישורי אימייל, SEO) |
| `NEXT_PUBLIC_APP_NAME` | שם המוצר |
| `SUPABASE_SERVICE_ROLE_KEY` | **רק לבדיקות אינטגרציה מקומיות.** לא ל־Vercel ולא ל־git |

## Vercel deployment
```bash
git init && git add . && git commit -m "init"
git remote add origin <your-github-repo> && git push -u origin main
```
ב־Vercel: Add New → Project → בחרו את ה־repo (Framework: Next.js, ללא שינוי הגדרות). הוסיפו את ארבעת המשתנים הציבוריים (`NEXT_PUBLIC_*`) ב־Production/Preview ועשו Deploy.
אחרי הפריסה עדכנו את `NEXT_PUBLIC_SITE_URL` ואת Redirect URLs ב־Supabase לכתובת הסופית.

## ארכיטקטורה ואבטחה
- הלקוח רק **קורא** נתונים (RLS). כל פעולה קריטית (יצירה, הצטרפות, התחלה, "ניחשו", דילוג, סיום תור, העברת שחקנים) היא פונקציית SQL מסוג `SECURITY DEFINER` שמזהה את המשתמש מה־JWT (`auth.uid()`), לא מפרמטר.
- המילה הסודית נשמרת בטבלה נפרדת `turn_secrets` עם policy שמאפשר קריאה רק למסביר, והטבלה לא מפורסמת ל־Realtime. טבלת `words` גלויה רק למנהלים.
- אין policies לכתיבה על טבלאות המשחק, ו־`profiles` מאפשרת עדכון של `username` ו־`avatar` בלבד (לא `is_admin`).
- סיום תור הוא idempotent: כל השחקנים מנסים לסיים כשהזמן נגמר, והשרת מסיים פעם אחת בלבד.
- כללי מנוע: משחק מסתיים רק אחרי סבב מלא, כשקבוצה הגיעה ליעד ומובילה לבד (תיקו = ממשיכים). מילים לא חוזרות באותו משחק עד שהמאגר מוצה.
- ניתוק: Presence מציג מי מחובר; מארח יכול לדלג על מסביר נעדר; אחרי 45 שניות כל שחקן יכול. מארח שיוצא מעביר את התפקיד.

## בדיקות
```bash
npm test                  # בדיקות יחידה (Zod, לוגיקה, טיימר, שגיאות)
npm run test:integration  # E2E מול Supabase אמיתי (RUN_INTEGRATION=1 + service key ב־.env.local)
npm run typecheck && npm run build
```
בדיקות האינטגרציה מכסות: הרשמה/התחברות, יצירה, הצטרפות, Lobby, קבוצות, התחלה, הרשאות (מילה סודית, ניקוד, host), טיימר, ניקוד, תורות, סיום משחק, Realtime וניתוק.

## Troubleshooting
- **"Invalid login credentials" אחרי הרשמה:** אישור אימייל פעיל. אשרו במייל או כבו Confirm email.
- **קישור איפוס סיסמה נכשל:** בדקו Redirect URLs ב־Supabase.
- **אין עדכונים בזמן אמת:** ודאו ש־Realtime פעיל ושהרצתם את מיגרציה 4. האתר גם מרענן כל 10 שניות כגיבוי.
- **`NO_WORDS`:** הקטגוריות/הקושי שנבחרו ריקים. הריצו את `supabase/seed.sql`.
- **עריכת מילים:** `data/words.txt` ואז `npm run seed:generate`.
