import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FriendsClient } from '@/components/FriendsClient';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'חברים' };

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <FriendsClient userId={user.id} />;
}
