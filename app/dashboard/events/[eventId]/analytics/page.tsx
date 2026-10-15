import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowLeft, Download } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getEventForOwner } from '@/lib/queries/events';
import { getEventAnalytics } from '@/lib/queries/analytics';
import { countActiveShares } from '@/lib/queries/shares';
import { PageHeader } from '@/components/dashboard/page-header';
import { AnalyticsReport } from '@/components/analytics/report';
import { ShareReport } from '@/components/analytics/share-report';
import { REPORT_SECTIONS } from '@/components/analytics/sections';
import { Button } from '@/components/ui/button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;
  const event = await getEventForOwner(eventId, user.id);
  const t = await getTranslations('eventAnalytics');
  const tList = await getTranslations('analytics');
  return {
    title: event ? t('metaTitle', { title: event.title }) : tList('title'),
  };
}

/** Formatted with the reader's calendar, digits and clock. */
async function formatRange(first: Date | null, last: Date | null) {
  if (!first || !last) return null;
  const format = await getFormatter();
  const sameDay = first.toDateString() === last.toDateString();

  if (sameDay) {
    const date = format.dateTime(first, { dateStyle: 'medium' });
    const from = format.dateTime(first, { timeStyle: 'short' });
    const to = format.dateTime(last, { timeStyle: 'short' });
    return `${date}, ${from} – ${to}`;
  }

  const style = { dateStyle: 'medium', timeStyle: 'short' } as const;
  return `${format.dateTime(first, style)} – ${format.dateTime(last, style)}`;
}

export default async function EventAnalyticsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;

  // Asked together: the numbers are read alongside the event rather than
  // after it, and are only shown once the event is known to be this host's.
  const [event, analytics, t, activeLinks] = await Promise.all([
    getEventForOwner(eventId, user.id),
    getEventAnalytics(eventId),
    getTranslations('eventAnalytics'),
    countActiveShares(eventId),
  ]);
  if (!event) notFound();

  const range = await formatRange(analytics.firstResponseAt, analytics.lastResponseAt);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
      <Link
        href={`/dashboard/events/${event.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t('back')}
      </Link>

      <PageHeader
        title={t('metaTitle', { title: event.title })}
        description={range ?? t('noActivity')}
        action={
          <div className="flex flex-wrap gap-2">
            <ShareReport eventId={event.id} activeLinks={activeLinks} />
            <Button variant="secondary" asChild>
              <a href={`/api/events/${event.id}/export?dataset=responses`}>
                <Download />
                {t('responsesCsv')}
              </a>
            </Button>
            <Button variant="secondary" asChild>
              <a href={`/api/events/${event.id}/export?dataset=questions`}>
                <Download />
                {t('questionsCsv')}
              </a>
            </Button>
          </div>
        }
      />

      <AnalyticsReport analytics={analytics} sections={REPORT_SECTIONS} />
    </div>
  );
}
