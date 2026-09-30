import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events } from '@/db/schema';
import { Logo } from '@/components/shared/logo';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { JoinForm } from '@/components/participant/join-form';
import { BrandLogo, BrandStyle } from '@/components/branding/brand';
import { readBranding } from '@/lib/branding/templates';
import { normalizeEventCode } from '@/lib/utils/event-code';
import { cn } from '@/lib/utils/cn';

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

  // Someone who scanned the QR code arrives with the event's code, so the
  // page can already wear that event's design. Typed by hand, there is no
  // event yet and it stays Chorus.
  const [event] = code
    ? await db
        .select({ title: events.title, branding: events.branding })
        .from(events)
        .where(eq(events.eventCode, normalizeEventCode(code)))
        .limit(1)
    : [];
  const branding = readBranding(event?.branding);

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col items-center justify-center px-5 py-12',
        branding && 'brand-backdrop',
      )}
    >
      <BrandStyle branding={branding} />

      {/* Offered before the form: a participant who cannot read the page
          cannot be expected to find a switcher further down it. */}
      <div className="mb-4">
        <LanguageSwitcher />
      </div>

      {branding?.logoId ? (
        <div className="mb-8">
          <BrandLogo
            branding={branding}
            title={event?.title ?? ''}
            className="h-16 max-w-56"
            fallback={null}
          />
        </div>
      ) : (
        <Link href="/" className="mb-8" aria-label={tNav('home')}>
          <Logo />
        </Link>
      )}
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">{event?.title ?? t('title')}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        <JoinForm defaultCode={code ?? ''} />
      </div>
    </div>
  );
}
