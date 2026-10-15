import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Logo } from '@/components/shared/logo';
import { PoweredBy } from '@/components/shared/powered-by';
import { LanguageSwitcher } from '@/components/shared/language-switcher';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <header className="mb-8 flex flex-col items-center gap-4">
        <LanguageSwitcher />
        <Link href="/" aria-label={t('home')}>
          <Logo />
        </Link>
      </header>
      <main className="w-full max-w-sm">{children}</main>
      <footer className="mt-10">
        <PoweredBy />
      </footer>
    </div>
  );
}
