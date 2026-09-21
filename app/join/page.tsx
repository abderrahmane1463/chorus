import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/shared/logo';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { JoinForm } from '@/components/participant/join-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('join');
  return { title: t('title'), description: t('description') };
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const t = await getTranslations('join');
  const tNav = await getTranslations('nav');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      {/* Offered before the form: a participant who cannot read the page
          cannot be expected to find a switcher further down it. */}
      <div className="mb-4">
        <LanguageSwitcher />
      </div>

      <Link href="/" className="mb-8" aria-label={tNav('home')}>
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        <JoinForm defaultCode={code ?? ''} />
      </div>
    </div>
  );
}
