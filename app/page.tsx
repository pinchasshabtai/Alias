import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-8 px-5 py-10 text-center">
      <div className="rotate-[-3deg] rounded-[2rem] border-4 border-ink bg-sun px-8 py-7 shadow-chunky">
        <div className="text-sm font-bold text-ink/60">המילה שלכם</div>
        <div className="font-display text-6xl sm:text-8xl">מטוס</div>
      </div>
      <div>
        <h1 className="font-display text-4xl sm:text-6xl">{BRAND_NAME}</h1>
        <p className="mt-2 text-xl font-bold text-ink/70">{BRAND_TAGLINE}</p>
        <p className="mx-auto mt-3 max-w-md text-ink/70">
          פותחים חדר, שולחים קוד לחברים, מתחלקים לקבוצות ומנחשים מילים לפני שהטיימר נגמר. הכול בזמן אמת, ישר מהטלפון.
        </p>
      </div>
      <div className="grid w-full max-w-sm gap-3">
        <Link href="/register" className="btn-primary btn-lg">יוצאים לדרך, הרשמה</Link>
        <Link href="/login" className="btn-ghost btn-lg">כבר יש לי חשבון</Link>
      </div>
    </main>
  );
}
