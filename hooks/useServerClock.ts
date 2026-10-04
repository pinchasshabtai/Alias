'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { gameApi } from '@/lib/game-api';

/**
 * Keeps the offset between this device's clock and the database clock, so every player's
 * timer counts down to the same server-defined `ends_at` regardless of local clock drift.
 */
export function useServerClock() {
  const offset = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      const t0 = Date.now();
      try {
        const serverNow = await gameApi.serverNow();
        const t1 = Date.now();
        if (!cancelled && serverNow) {
          offset.current = new Date(serverNow).getTime() - (t0 + t1) / 2;
        }
      } catch {
        /* keep the previous offset */
      }
      if (!cancelled) setReady(true);
    }
    void sync();
    const id = setInterval(sync, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const now = useCallback(() => Date.now() + offset.current, []);
  return { now, ready };
}
