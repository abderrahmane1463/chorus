import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CalendarDays, MessageSquare, Plus, Radio, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getDashboardStats, listEventsForUser } from '@/lib/queries/dashboard';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dash');
  return { title: t('overview') };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations('dash');
  const tStatus = await getTranslations('status');

  const [stats, recentEvents] = await Promise.all([
    getDashboardStats(user.id),
    listEventsForUser(user.id, 5),
  ]);

  const firstName = user.name?.split(' ')[0] ?? t('welcomeFallback');

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
      <PageHeader
        title={t('welcome', { name: firstName })}
        description={t('welcomeBody')}
        action={
          <Button asChild>
            <Link href="/dashboard/events/new">
              <Plus />
              {t('newEvent')}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('events')} value={stats.totalEvents} icon={CalendarDays} />
        <StatCard label={t('liveNow')} value={stats.liveEvents} icon={Radio} />
        <StatCard
          label={t('participants')}
          value={stats.totalParticipants}
          icon={Users}
        />
        <StatCard
          label={t('responses')}
          value={stats.totalResponses}
          icon={MessageSquare}
        />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('recentEvents')}</h2>
          {recentEvents.length > 0 && (
            <Link
              href="/dashboard/events"
              className="text-sm text-primary hover:underline"
            >
              {t('viewAll')}
            </Link>
          )}
        </div>

        {recentEvents.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={t('noEvents')}
            description={t('noEventsBody')}
            action={
              <Button asChild>
                <Link href="/dashboard/events/new">
                  <Plus />
                  {t('createFirst')}
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {recentEvents.map((event) => (
              <li key={event.id}>
                <Card className="transition-colors hover:border-primary">
                  <Link
                    href={`/dashboard/events/${event.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{event.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {t('interactionCount', { count: event.interactionCount })} ·{' '}
                        {t('participantCount', { count: event.participantCount })}
                      </p>
                    </div>
                    {/* Join codes are Latin and never translated. */}
                    <span dir="ltr" className="font-mono text-sm text-muted-foreground">
                      {event.eventCode}
                    </span>
                    <Badge variant={event.status === 'live' ? 'success' : 'neutral'}>
                      {tStatus(event.status)}
                    </Badge>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
