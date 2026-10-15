import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link2Off } from 'lucide-react';
import { findReportShare } from '@/lib/queries/shares';
import { getEventAnalytics } from '@/lib/queries/analytics';
import { AnalyticsReport } from '@/components/analytics/report';
import { EmptyState } from '@/components/shared/empty-state';
import { Logo } from '@/components/shared/logo';
import { PoweredBy } from '@/components/shared/powered-by';
import { LanguageSwitcher } from '@/components/shared/language-switcher';

// Always read fresh: a link can be switched off at any moment.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const share = await findReportShare(token);
  const t = await getTranslations('share');
  return {
    title: share ? t('pageTitle', { title: share.title }) : t('goneTitle'),
    // A shared report is for the people it was sent to, not for search engines.
    robots: { index: false, follow: false },
  };
}

/**
 * An event's report, opened from a link its host shared: read-only, with
 * only the sections the host chose, and no exports. Anyone with the link can
 * read it until it expires or the host switches it off.
 */
export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('share');
  const share = await findReportShare(token);

  return (
    <div className="min-h-dvh bg-subtle">
      <header className="border-b border-border bg-background px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Logo />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
        {share ? <Report share={share} /> : (
          <EmptyState icon={Link2Off} title={t('goneTitle')} description={t('goneBody')} />
        )}
      </main>

      <footer className="flex justify-center px-5 pb-10 pt-4">
        <PoweredBy />
      </footer>
    </div>
  );
}

async function Report({
  share,
}: {
  share: NonNullable<Awaited<ReturnType<typeof findReportShare>>>;
}) {
  const t = await getTranslations('share');
  const format = await getFormatter();
  const analytics = await getEventAnalytics(share.eventId);

  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">{t('eyebrow')}</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{share.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('expiresOn', {
            date: format.dateTime(share.expiresAt, { dateStyle: 'medium', timeStyle: 'short' }),
          })}
        </p>
      </div>
      <AnalyticsReport analytics={analytics} sections={share.sections} />
    </>
  );
}
