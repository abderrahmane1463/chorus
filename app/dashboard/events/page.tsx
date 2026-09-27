import Link from 'next/link';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { CalendarDays, Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listEventsForUser } from '@/lib/queries/dashboard';
import { PageHeader } from '@/components/dashboard/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('eventsPage');
  return { title: t('title') };
}

const statusVariant = {
  live: 'success',
  draft: 'neutral',
  ended: 'outline',
  archived: 'outline',
} as const;

export default async function EventsPage() {
  const user = await requireUser();
  const events = await listEventsForUser(user.id);

  const t = await getTranslations('eventsPage');
  const tDash = await getTranslations('dash');
  const tStatus = await getTranslations('status');
  const format = await getFormatter();

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
      <PageHeader
        title={t('title')}
        description={
          events.length === 0 ? t('empty') : t('count', { count: events.length })
        }
        action={
          <Button asChild>
            <Link href="/dashboard/events/new">
              <Plus />
              {tDash('newEvent')}
            </Link>
          </Button>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t('noneTitle')}
          description={t('noneBody')}
          action={
            <Button asChild>
              <Link href="/dashboard/events/new">
                <Plus />
                {tDash('newEvent')}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id}>
              <Card className="transition-colors hover:border-primary">
                <Link
                  href={`/dashboard/events/${event.id}`}
                  className="block p-4 sm:flex sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{event.title}</p>
                      <Badge variant={statusVariant[event.status]}>
                        {tStatus(event.status)}
                      </Badge>
                    </div>
                    {event.description && (
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tDash('interactionCount', { count: event.interactionCount })} ·{' '}
                      {tDash('participantCount', { count: event.participantCount })} ·{' '}
                      {t('questionCount', { count: event.questionCount })}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-4 sm:mt-0 sm:flex-col sm:items-end sm:gap-1">
                    {/* Join codes are Latin and never translated. */}
                    <span dir="ltr" className="font-mono text-sm">
                      {event.eventCode}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {/* Dates follow the reader's calendar and digits. */}
                      {format.dateTime(event.createdAt, { dateStyle: 'medium' })}
                    </span>
                  </div>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
