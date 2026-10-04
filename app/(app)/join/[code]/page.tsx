import type { Metadata } from 'next';
import { JoinByLink } from '@/components/JoinByLink';

export const metadata: Metadata = { title: 'הצטרפות למשחק' };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinByLink code={code} />;
}
