import Link from 'next/link';
import { ErrorState } from '@/components/ErrorState';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <ErrorState title="העמוד לא נמצא" message="הקישור שגוי או שהחדר כבר לא קיים." action={<Link href="/dashboard" className="btn-sun">לדף הבית</Link>} />
    </main>
  );
}
