'use client';

import { useState } from 'react';
import { CreateGameModal } from '@/components/CreateGameModal';
import { JoinGameModal } from '@/components/JoinGameModal';

export function DashboardActions() {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary btn-lg !py-7 text-2xl">
          🎉 צור משחק
        </button>
        <button type="button" onClick={() => setJoinOpen(true)} className="btn-sky btn-lg !py-7 text-2xl">
          🔑 הצטרף למשחק
        </button>
      </div>
      {createOpen && <CreateGameModal open onClose={() => setCreateOpen(false)} />}
      <JoinGameModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
  );
}
