import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!data?.is_admin) notFound(); // RLS and RPC checks enforce this again on the database

  return (
    <div className="space-y-5">
      <nav className="flex gap-2" aria-label="ניווט ניהול">
        <Link href="/admin" className="btn-ghost !py-2 text-sm">סקירה</Link>
        <Link href="/admin/words" className="btn-ghost !py-2 text-sm">מילים וקטגוריות</Link>
      </nav>
      {children}
    </div>
  );
}
