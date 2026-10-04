'use client';

import { useEffect, useState } from 'react';
import { isMuted, setMuted } from '@/lib/sound';

export function SoundToggle({ className = '' }: { className?: string }) {
  const [muted, setLocal] = useState(true);

  useEffect(() => {
    const sync = () => setLocal(isMuted());
    sync();
    window.addEventListener('alias:sound', sync);
    return () => window.removeEventListener('alias:sound', sync);
  }, []);

  return (
    <button
      type="button"
      className={`btn-ghost !px-3 !py-2 text-xl ${className}`}
      aria-label={muted ? 'הפעלת סאונד' : 'השתקת סאונד'}
      aria-pressed={!muted}
      onClick={() => setMuted(!muted)}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
