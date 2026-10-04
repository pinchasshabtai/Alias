'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { resetPasswordAction } from '../actions';

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await resetPasswordAction({ password: fd.get('password'), confirmPassword: fd.get('confirmPassword') });
      if (res?.error) setError(res.error);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="font-display text-3xl">סיסמה חדשה</h1>
      <div>
        <label htmlFor="password" className="label">סיסמה חדשה</label>
        <input id="password" name="password" type="password" dir="ltr" autoComplete="new-password" className="input" minLength={8} required />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="label">אישור סיסמה</label>
        <input id="confirmPassword" name="confirmPassword" type="password" dir="ltr" autoComplete="new-password" className="input" required />
      </div>
      {error && <p role="alert" className="rounded-xl bg-tomato/10 px-3 py-2 text-sm font-bold text-tomato">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? 'שומרים…' : 'עדכון סיסמה'}</button>
    </form>
  );
}
