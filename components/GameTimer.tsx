'use client';

import { useEffect, useRef, useState } from 'react';
import { play } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { isLastSeconds, secondsLeft } from '@/lib/game-logic';

interface Props {
  endsAt: string;
  totalSeconds: number;
  /** Returns "now" on the SERVER clock. */
  now: () => number;
  onExpire: () => void;
}

const R = 54;
const C = 2 * Math.PI * R;

export function GameTimer({ endsAt, totalSeconds, now, onExpire }: Props) {
  const [ms, setMs] = useState(() => Math.max(0, new Date(endsAt).getTime() - now()));
  const expired = useRef(false);
  const lastTick = useRef(-1);
  const expireRef = useRef(onExpire);

  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expired.current = false;
    lastTick.current = -1;
    const end = new Date(endsAt).getTime();

    const tick = () => {
      const left = Math.max(0, end - now());
      setMs(left);
      const sec = secondsLeft(left);
      if (isLastSeconds(left) && sec !== lastTick.current) {
        lastTick.current = sec;
        play('tick');
      }
      if (left <= 0 && !expired.current) {
        expired.current = true;
        play('turnEnd');
        expireRef.current();
      }
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [endsAt, now]);

  const urgent = isLastSeconds(ms);
  const progress = Math.min(1, ms / (totalSeconds * 1000));

  return (
    <div
      className={cn('relative mx-auto h-44 w-44 sm:h-52 sm:w-52', urgent && 'animate-pulseFast')}
      role="timer"
      aria-label={`נשארו ${secondsLeft(ms)} שניות`}
    >
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={R} fill="white" stroke="#1E1B4B22" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={R}
          fill="none"
          strokeLinecap="round"
          strokeWidth="12"
          stroke={urgent ? '#FF5A5F' : '#2D7DFF'}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s' }}
        />
      </svg>
      <div className={cn('absolute inset-0 flex items-center justify-center font-display text-6xl sm:text-7xl', urgent && 'text-tomato')}>
        {secondsLeft(ms)}
      </div>
    </div>
  );
}
