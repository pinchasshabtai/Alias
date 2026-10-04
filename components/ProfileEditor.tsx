'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';
import { toHebrewError } from '@/lib/errors';
import { usernameSchema } from '@/lib/schemas';
import { AVATARS, cn } from '@/lib/utils';

interface Props {
  userId: string;
  initialUsername: string;
  initialAvatar: string;
  email: string;
}

export function ProfileEditor({ userId, initialUsername, initialAvatar, email }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState(initialUsername);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) {
      toast(parsed.error.issues[0].message, 'error');
      return;
    }
    setSaving(true);
    const { error } = await createClient().from('profiles').update({ username: parsed.data, avatar }).eq('id', userId);
    setSaving(false);
    if (error) {
      toast(error.code === '23505' ? 'שם המשתמש כבר תפוס' : toHebrewError(error), 'error');
      return;
    }
    toast('הפרופיל עודכן', 'success');
    router.refresh();
  };

  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-4">
        <Avatar emoji={avatar} seed={username} size="xl" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl">{username || 'שחקן'}</h1>
          <p className="truncate text-sm text-ink/60" dir="ltr">{email}</p>
        </div>
      </div>
      <div>
        <span className="label">בחירת אווטאר</span>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((a) => (
            <button key={a} type="button" onClick={() => setAvatar(a)} aria-pressed={a === avatar} className={cn('rounded-2xl border-2 p-1', a === avatar ? 'border-ink bg-sun' : 'border-transparent')}>
              <Avatar emoji={a} size="md" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="username" className="label">שם משתמש</label>
        <input id="username" className="input" value={username} maxLength={24} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <button type="button" className="btn-sky w-full" disabled={saving} onClick={save}>{saving ? 'שומרים…' : 'שמירה'}</button>
    </section>
  );
}
