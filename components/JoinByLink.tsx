'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { joinGameAction } from '@/app/(app)/actions';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';

export function JoinByLink({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void joinGameAction(code).then((res) => {
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const path = res.data.status === 'playing' ? 'play' : res.data.status === 'finished' ? 'results' : 'lobby';
      router.replace(`/games/${res.data.gameId}/${path}`);
    });
  }, [code, router]);

  if (error) return <ErrorState title="לא הצלחנו להיכנס לחדר" message={error} action={<Link href="/dashboard" className="btn-sun">לדף הבית</Link>} />;
  return <LoadingState label="מצטרפים לחדר…" />;
}
