import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BarChart3, MessageSquare, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getDashboardStats, listEventsForUser } from '@/lib/queries/dashboard';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Card } from '@/components/ui/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('analytics');
  return { title: t('title') };
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const t = await getTranslations('analytics');
  const [stats, events] = await Promise.all([
    getDashboardStats(user.id),
    listEventsForUser(user.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
      <PageHeader
        title={t('title')}
        description={t('description')}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('event')} value={stats.totalEvents} icon={BarChart3} />
        <StatCard label={t('participants')} value={stats.totalParticipants} icon={Users} />
        <StatCard label={t('responses')} value={stats.totalResponses} icon={MessageSquare} />
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">{t('byEvent')}</h2>

        {events.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title={t('noneTitle')}
            description={t('noneBody')}
          />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-start text-muted-foreground">
                  <th scope="col" className="p-4 font-medium">{t('event')}</th>
                  <th scope="col" className="p-4 font-medium">{t('code')}</th>
                  <th scope="col" className="p-4 text-end font-medium">{t('participants')}</th>
                  <th scope="col" className="p-4 text-end font-medium">{t('interactions')}</th>
                  <th scope="col" className="p-4 text-end font-medium">{t('questions')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-border last:border-0">
                    <td className="p-4">
                      <Link
                        href={`/dashboard/events/${event.id}/analytics`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {event.title}
                      </Link>
                    </td>
                    <td dir="ltr" className="p-4 font-mono text-muted-foreground">
                      {event.eventCode}
                    </td>
                    <td className="p-4 text-end tabular-nums">
                      {event.participantCount}
                    </td>
                    <td className="p-4 text-end tabular-nums">
                      {event.interactionCount}
                    </td>
                    <td className="p-4 text-end tabular-nums">
                      {event.questionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
