'use client';

import Link from 'next/link';
import { useState, useTransition, type FormEvent } from 'react';
import { loginAction } from '../actions';

export function LoginForm({ next, authError }: { next?: string; authError?: boolean }) {
  const [error, setError] = useState<string | null>(authError ? 'הקישור פג תוקף או שגוי. נסו להתחבר שוב' : null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await loginAction({ email: fd.get('email'), password: fd.get('password'), next });
      if (res?.error) setError(res.error);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="font-display text-3xl">ברוכים השבים 👋</h1>
      <div>
        <label htmlFor="email" className="label">אימייל</label>
        <input id="email" name="email" type="email" dir="ltr" autoComplete="email" className="input" required />
      </div>
      <div>
        <label htmlFor="password" className="label">סיסמה</label>
        <input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" className="input" required />
      </div>
      {error && <p role="alert" className="rounded-xl bg-tomato/10 px-3 py-2 text-sm font-bold text-tomato">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? 'מתחברים…' : 'התחברות'}</button>
      <div className="flex justify-between text-sm font-bold">
        <Link href="/forgot-password" className="text-sky">שכחתי סיסמה</Link>
        <Link href="/register" className="text-sky">אין לי חשבון</Link>
      </div>
    </form>
  );
}
