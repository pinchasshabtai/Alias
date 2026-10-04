'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { registerAction } from '../actions';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await registerAction({
        username: fd.get('username'),
        email: fd.get('email'),
        password: fd.get('password'),
        confirmPassword: fd.get('confirmPassword'),
      });
      if (!res.ok) setError(res.error);
      else if (res.needsConfirmation) setConfirm(true);
      else {
        router.replace('/dashboard');
        router.refresh();
      }
    });
  };

  if (confirm) {
    return (
      <div className="space-y-3 text-center">
        <div className="text-6xl">📬</div>
        <h1 className="font-display text-3xl">כמעט שם!</h1>
        <p>שלחנו אליכם אימייל לאישור הכתובת. אחרי האישור אפשר להתחבר ולהתחיל לשחק.</p>
        <Link href="/login" className="btn-sun w-full">למסך ההתחברות</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="font-display text-3xl">הצטרפות למשחק 🎉</h1>
      <div>
        <label htmlFor="username" className="label">שם משתמש</label>
        <input id="username" name="username" autoComplete="username" className="input" maxLength={24} required />
      </div>
      <div>
        <label htmlFor="email" className="label">אימייל</label>
        <input id="email" name="email" type="email" dir="ltr" autoComplete="email" className="input" required />
      </div>
      <div>
        <label htmlFor="password" className="label">סיסמה (לפחות 8 תווים)</label>
        <input id="password" name="password" type="password" dir="ltr" autoComplete="new-password" className="input" minLength={8} required />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="label">אישור סיסמה</label>
        <input id="confirmPassword" name="confirmPassword" type="password" dir="ltr" autoComplete="new-password" className="input" required />
      </div>
      {error && <p role="alert" className="rounded-xl bg-tomato/10 px-3 py-2 text-sm font-bold text-tomato">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? 'נרשמים…' : 'הרשמה'}</button>
      <p className="text-center text-sm font-bold">כבר רשומים? <Link href="/login" className="text-sky">התחברות</Link></p>
    </form>
  );
}
