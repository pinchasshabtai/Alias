'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { Avatar } from '@/components/Avatar';
import { SoundToggle } from '@/components/SoundToggle';
import { logoutAction } from '@/app/(auth)/actions';
import { BRAND_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface Props {
  username: string;
  avatar: string;
  isAdmin: boolean;
}

const LINKS = [
  { href: '/dashboard', label: 'בית', icon: '🏠' },
  { href: '/games', label: 'המשחקים שלי', icon: '🎮' },
  { href: '/friends', label: 'חברים', icon: '👥' },
  { href: '/profile', label: 'פרופיל', icon: '👤' },
];

export function Navbar({ username, avatar, isAdmin }: Props) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const links = isAdmin ? [...LINKS, { href: '/admin', label: 'ניהול', icon: '🛠️' }] : LINKS;
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const handleNavigation = (href: string, event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || pathname === href) return;
    setPendingHref(href);
  };

  const isActive = (href: string) => pendingHref ? pendingHref === href : active(href);

  return (
    <>
      <header className="sticky top-0 z-40 border-b-2 border-ink/10 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2 font-display text-xl sm:text-2xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sun text-xl shadow-[0_3px_0_0_#D69E00]">💬</span>
            {BRAND_NAME}
          </Link>
          <nav className="ms-6 hidden items-center gap-1 sm:flex" aria-label="ניווט ראשי">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={(event) => handleNavigation(l.href, event)}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn('rounded-xl px-3 py-2 text-sm font-bold transition hover:bg-white', isActive(l.href) && 'bg-white shadow-card')}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <SoundToggle />
            <Link href="/profile" className="hidden items-center gap-2 sm:flex" aria-label="הפרופיל שלי">
              <Avatar emoji={avatar} seed={username} size="sm" />
              <span className="max-w-[8rem] truncate text-sm font-bold">{username}</span>
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="btn-ghost !px-3 !py-2 text-sm">
                יציאה
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid border-t-2 border-ink/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
        aria-label="ניווט תחתון"
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={(event) => handleNavigation(l.href, event)}
            aria-current={isActive(l.href) ? 'page' : undefined}
            className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold', isActive(l.href) ? 'text-tomato' : 'text-ink/60')}
          >
            <span className="flex h-7 items-center justify-center text-xl">
              {pendingHref === l.href ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-label="טוען" /> : l.icon}
            </span>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
