import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';

export default async function GameEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: game } = await supabase.from('games').select('status').eq('id', id).maybeSingle();
  if (!game) notFound();

  redirect(`/games/${id}/${game.status === 'lobby' ? 'lobby' : game.status === 'playing' ? 'play' : 'results'}`);
}
