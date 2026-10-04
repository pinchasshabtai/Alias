'use client';

import { ErrorState } from '@/components/ErrorState';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <ErrorState message="אירעה שגיאה בשרת. נסו שוב בעוד רגע." onRetry={reset} />
    </main>
  );
}
