import type { Metadata } from 'next';
import { AdminWords } from '@/components/AdminWords';

export const metadata: Metadata = { title: 'ניהול מילים' };

export default function AdminWordsPage() {
  return <AdminWords />;
}
