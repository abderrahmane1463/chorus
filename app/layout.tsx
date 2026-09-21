import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono, Noto_Sans_Arabic } from 'next/font/google';
import { getLocale, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Toaster } from 'sonner';
import { ThemeScript } from '@/components/shared/theme-script';
import { localeDirection, type Locale } from '@/i18n/config';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
// Geist has no Arabic glyphs; without this, Arabic falls back to whatever the
// device happens to have and the page stops looking like Chorus.
const notoArabic = Noto_Sans_Arabic({ variable: '--font-arabic', subsets: ['arabic'] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');

  return {
    title: { default: t('title'), template: `%s · Chorus` },
    description: t('description'),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) as Locale;

  return (
    <html
      lang={locale}
      dir={localeDirection[locale] ?? 'ltr'}
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh bg-background">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
