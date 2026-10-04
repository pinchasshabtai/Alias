import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { GameResults } from '@/components/GameResults';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export const metadata: Metadata = { title: 'תוצאות' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <GameResults gameId={id} userId={user.id} />;
}
