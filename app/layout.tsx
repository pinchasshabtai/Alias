import type { Metadata, Viewport } from 'next';
import { Rubik, Secular_One } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

const rubik = Rubik({ subsets: ['hebrew', 'latin'], variable: '--font-rubik', display: 'swap' });
const secular = Secular_One({ subsets: ['hebrew', 'latin'], weight: '400', variable: '--font-secular', display: 'swap' });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${BRAND_NAME} — ${BRAND_TAGLINE}`, template: `%s | ${BRAND_NAME}` },
  description: BRAND_DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: BRAND_NAME, description: BRAND_DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: '#FFC93C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${secular.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
