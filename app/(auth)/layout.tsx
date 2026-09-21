import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Logo } from '@/components/shared/logo';
import { LanguageSwitcher } from '@/components/shared/language-switcher';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="mb-4">
        <LanguageSwitcher />
      </div>
      <Link href="/" className="mb-8" aria-label={t('home')}>
        <Logo />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
