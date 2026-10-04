import Link from 'next/link';
import { BRAND_NAME } from '@/lib/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <Link href="/" className="mb-6 flex items-center justify-center gap-3 font-display text-3xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sun text-2xl shadow-[0_4px_0_0_#D69E00]">💬</span>
        {BRAND_NAME}
      </Link>
      <div className="card">{children}</div>
    </main>
  );
}
