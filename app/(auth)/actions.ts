'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '@/lib/schemas';
import { toHebrewError } from '@/lib/errors';
import { randomAvatar, safeNext } from '@/lib/utils';

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; error: string };

async function getOrigin(): Promise<string> {
  const h = await headers();
  return h.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';
}

export async function registerAction(input: unknown): Promise<AuthResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'הנתונים אינם תקינים' };
  const { username, email, password } = parsed.data;

  const supabase = await createClient();
  const { data: available } = await supabase.rpc('username_available', { p_username: username });
  if (available === false) return { ok: false, error: 'שם המשתמש כבר תפוס' };

  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, avatar: randomAvatar() },
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });
  if (error) return { ok: false, error: toHebrewError(error) };
  return { ok: true, needsConfirmation: !data.session };
}

export async function loginAction(input: unknown): Promise<{ error: string } | undefined> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'הנתונים אינם תקינים' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: toHebrewError(error) };
  redirect(safeNext(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/** Always reports success so the form can't be used to discover which emails are registered. */
export async function forgotPasswordAction(input: unknown): Promise<AuthResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'כתובת האימייל אינה תקינה' };

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error && error.message.toLowerCase().includes('rate')) return { ok: false, error: toHebrewError(error) };
  return { ok: true };
}

export async function resetPasswordAction(input: unknown): Promise<{ error: string } | undefined> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'הנתונים אינם תקינים' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'קישור האיפוס פג תוקף. בקשו קישור חדש' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: toHebrewError(error) };
  redirect('/dashboard');
}
