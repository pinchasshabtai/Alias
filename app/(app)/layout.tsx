import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('username, avatar, is_admin').eq('id', user.id).maybeSingle();

  return (
    <>
      <Navbar username={profile?.username ?? 'שחקן'} avatar={profile?.avatar ?? '🙂'} isAdmin={Boolean(profile?.is_admin)} />
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-5 sm:pb-10">{children}</main>
    </>
  );
}
