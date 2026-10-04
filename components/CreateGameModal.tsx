'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { SettingsFields } from '@/components/GameSettings';
import { useToast } from '@/components/Toast';
import { createGameAction } from '@/app/(app)/actions';
import { DEFAULT_SETTINGS, type SettingsValues } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Partial<SettingsValues> & { name?: string };
}

export function CreateGameModal({ open, onClose, initial }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? 'המשחק שלנו');
  const [isPrivate, setIsPrivate] = useState(true);
  const [settings, setSettings] = useState<SettingsValues>(() => {
    const { name: _ignored, ...rest } = initial ?? {};
    return { ...DEFAULT_SETTINGS, ...rest };
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createGameAction({ name, isPrivate, ...settings });
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      router.push(`/games/${res.data.gameId}/lobby`);
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="יצירת משחק חדש">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="game-name" className="label">שם המשחק</label>
          <input id="game-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div>
          <span className="label">סוג משחק</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setIsPrivate(true)} className={cn('chip !rounded-2xl !py-3', isPrivate && 'chip-on')}>🔒 פרטי (בקוד בלבד)</button>
            <button type="button" onClick={() => setIsPrivate(false)} className={cn('chip !rounded-2xl !py-3', !isPrivate && 'chip-on')}>🌍 ציבורי (מופיע ברשימה)</button>
          </div>
        </div>

        <SettingsFields values={settings} onChange={(p) => setSettings((s) => ({ ...s, ...p }))} disabled={pending} />

        <button type="submit" className="btn-primary btn-lg w-full" disabled={pending}>
          {pending ? 'יוצרים חדר…' : 'יאללה, יוצרים!'}
        </button>
      </form>
    </Modal>
  );
}
