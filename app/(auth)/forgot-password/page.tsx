'use client';

import Link from 'next/link';
import { useState, useTransition, type FormEvent } from 'react';
import { forgotPasswordAction } from '../actions';

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await forgotPasswordAction({ email: fd.get('email') });
      if (res.ok) setSent(true);
      else setError(res.error);
    });
  };

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <div className="text-6xl">📨</div>
        <h1 className="font-display text-3xl">בדקו את האימייל</h1>
        <p>אם הכתובת רשומה אצלנו, נשלח אליה קישור לאיפוס הסיסמה.</p>
        <Link href="/login" className="btn-ghost w-full">חזרה להתחברות</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="font-display text-3xl">שכחתם סיסמה?</h1>
      <p className="text-ink/70">נשלח קישור לאיפוס לכתובת האימייל שלכם.</p>
      <div>
        <label htmlFor="email" className="label">אימייל</label>
        <input id="email" name="email" type="email" dir="ltr" autoComplete="email" className="input" required />
      </div>
      {error && <p role="alert" className="rounded-xl bg-tomato/10 px-3 py-2 text-sm font-bold text-tomato">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? 'שולחים…' : 'שליחת קישור'}</button>
      <p className="text-center text-sm font-bold"><Link href="/login" className="text-sky">חזרה להתחברות</Link></p>
    </form>
  );
}
