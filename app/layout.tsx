import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeScript } from '@/components/shared/theme-script';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Chorus — live polls, Q&A and quizzes for any room',
    template: '%s · Chorus',
  },
  description:
    'Run live polls, audience Q&A and quizzes in meetings, classes and conferences. Your audience joins with a code — no account, no app.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh bg-background">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
