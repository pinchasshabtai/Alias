import type { SupabaseClient } from '@supabase/supabase-js';
import type { FriendshipRow, Profile } from '@/lib/types';

export type PublicProfile = Pick<Profile, 'id' | 'username' | 'avatar'>;

export async function fetchProfilesByIds(supabase: SupabaseClient, ids: string[]): Promise<Map<string, PublicProfile>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from('profiles').select('id, username, avatar').in('id', ids);
  return new Map(((data ?? []) as PublicProfile[]).map((p) => [p.id, p]));
}

export async function fetchFriends(supabase: SupabaseClient, userId: string): Promise<PublicProfile[]> {
  const { data } = await supabase.from('friendships').select('*').eq('status', 'accepted');
  const rows = (data ?? []) as FriendshipRow[];
  const ids = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
  const profiles = await fetchProfilesByIds(supabase, ids);
  return ids.map((id) => profiles.get(id)).filter((p): p is PublicProfile => Boolean(p));
}
