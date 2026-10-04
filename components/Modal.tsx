'use client';

import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="סגירה" className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full animate-slideIn overflow-y-auto rounded-t-[2rem] border-2 border-ink/10 bg-cream p-5 shadow-card sm:max-w-xl sm:rounded-[2rem]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost !px-3 !py-1.5" aria-label="סגירה">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
